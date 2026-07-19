import { renderHome } from "./views/home.js";
import { renderToRead } from "./views/toread.js";
import { renderReading } from "./views/reading.js";
import { applyTheme } from "./theme.js";
import { createEmptyBook } from "./storage.js";
import { openBookEditor } from "./bookEditor.js";
import { checkWhatsNew } from "./whatsNew.js";
import { checkOnboarding } from "./onboarding.js";

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
route();
// Skip the onboarding/"what's new" sheets when a share-target flow is about
// to pop its own sheet open — stacking them on first paint reads as broken,
// not busy.
if (!handleIncomingShare()) {
  checkOnboarding();
  checkWhatsNew();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
