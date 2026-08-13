import { renderHome } from "./views/home.js";
import { renderToRead } from "./views/toread.js";
import { renderReading } from "./views/reading.js";
import { applyTheme } from "./theme.js";
import {
  createEmptyBook,
  migrateImagesToIndexedDB,
  getBooks,
  upsertRecords,
  getTombstones,
  clearTombstones,
  applyRemoteDeletion,
  patchBookImage,
  getHomeTitle,
  getPrefsSnapshot,
  getPrefsUpdatedAt,
  applyPrefsSnapshot,
} from "./storage.js";
import { registerRemoteResolver } from "./imageStore.js";
import { createStorageResolver, STORAGE_PREFIX } from "./cloudImageSync.js";
import { openBookEditor } from "./bookEditor.js";
import { checkWhatsNew } from "./whatsNew.js";
import { checkOnboarding } from "./onboarding.js";
import { checkMigrationNotice } from "./migrationNotice.js";
import { consumeOAuthRedirect } from "./supabaseOAuth.js";
import { openCloudSyncSheet } from "./settingsMenu.js";
import { startAutoSync } from "./cloudBackup.js";

applyTheme();

// Wires Cloud Backup's Storage-based image sync (js/cloudImageSync.js) into
// every existing resolveImageSrc call site, with no call-site changes --
// see imageStore.js's registerRemoteResolver. patchRecordImage is the one
// piece cloudImageSync.js can't know generically: where this app's own
// records actually live (a plain localStorage array here, see storage.js).
registerRemoteResolver(
  STORAGE_PREFIX,
  createStorageResolver({
    patchRecordImage: async (store, recordId, idbRef) => {
      if (store === "books") await patchBookImage(recordId, idbRef);
    },
  })
);

const root = document.getElementById("app");

const nav = {
  toHome: () => {
    location.hash = "#/home";
  },
  toToRead: () => {
    location.hash = "#/toread";
  },
  toReading: () => {
    location.hash = "#/reading";
  },
};

function route() {
  const hash = location.hash || "#/home";
  const match = hash.match(/^#\/([a-z]+)$/);
  const view = match ? match[1] : "home";

  switch (view) {
    case "toread":
      renderToRead(root, nav);
      break;
    case "reading":
      renderReading(root, nav);
      break;
    default:
      renderHome(root, nav);
  }
}

// Handles a book link shared into the app from the OS Share Sheet — the
// Android share_target manifest entry and the iOS Shortcut workaround
// (there's no Web Share Target support in Safari) both land here the same
// way: a URL in the ?url= or ?text= query param on a plain page load, no
// hash. Opens straight into the add-book flow with a fetch already kicked
// off, instead of dropping you on Home with nothing.
function handleIncomingShare() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("url") || params.get("text") || "";
  const match = raw.match(/https?:\/\/\S+/);
  if (!match) return false;

  history.replaceState(null, "", location.pathname + location.hash);

  const book = createEmptyBook();
  book.url = match[0];
  openBookEditor(nav, { book, isNew: true, refresh: route, autoFetch: true });
  return true;
}

window.addEventListener("hashchange", route);

// Picks up the redirect back from Supabase's consent screen (see
// supabaseOAuth.js / api/oauth-callback.js) before anything else touches
// location.hash -- clears the token fragment out of the URL either way, and
// reopens the Cloud Sync sheet with the result if this load was one of
// those redirects.
const oauthResult = consumeOAuthRedirect();

// Anyone who saved cover photos before IndexedDB storage existed has them
// sitting in localStorage as huge inline images — move those out before
// the first render so the app isn't showing (and re-writing) oversized
// data any longer than it has to. checkMigrationNotice reads the current
// (pre-migration) data to decide whether to say anything, so it must run
// first; the migration itself is a no-op after the first run either way,
// and doesn't wait on the notice being read — it's just explaining what's
// already happening in the background.
const migrationNotice = checkMigrationNotice();
const migrationDone = migrateImagesToIndexedDB().finally(() => {
  route();
});

// Held until the migration notice (if any) has actually been dismissed and
// the migration itself has finished, so a second one-time sheet can't stack
// on top of it before it's been read. Also skips the onboarding/"what's
// new" sheets when a share-target flow is about to pop its own sheet open
// — stacking them on first paint reads as broken, not busy.
Promise.all([migrationNotice, migrationDone]).then(() => {
  if (!handleIncomingShare()) {
    checkOnboarding();
    checkWhatsNew();
  }
  if (oauthResult) openCloudSyncSheet(oauthResult);
});

// Inert unless Cloud Backup has actually been installed and configured
// (see js/cloudBackup.js) -- a no-op otherwise. Runs a sync immediately,
// then periodically/on-visibility-change while the app stays open. Theme
// and title are re-applied live after every round via onSynced below; a
// background pull of books still doesn't re-render whatever view happens
// to be open right now, so content shows up on the next navigation or
// reload rather than instantly -- a known limitation, not a bug.
startAutoSync(
  { getBooks, upsertRecords, getTombstones, clearTombstones, applyRemoteDeletion, getPrefsSnapshot, getPrefsUpdatedAt, applyPrefsSnapshot },
  () => {
    applyTheme();
    const homeTitleEl = document.getElementById("home-title");
    if (homeTitleEl) homeTitleEl.textContent = getHomeTitle();
  }
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
