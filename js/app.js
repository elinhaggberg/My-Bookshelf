import { renderHome } from "./views/home.js";
import { renderToRead } from "./views/toread.js";
import { renderReading } from "./views/reading.js";
import { applyTheme } from "./theme.js";
import { createEmptyBook, migrateImagesToIndexedDB } from "./storage.js";
import { openBookEditor } from "./bookEditor.js";
import { checkWhatsNew } from "./whatsNew.js";
import { checkOnboarding } from "./onboarding.js";
import { checkMigrationNotice } from "./migrationNotice.js";

applyTheme();

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
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
