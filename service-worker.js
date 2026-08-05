const CACHE_NAME = "my-bookshelf-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/imageStore.js",
  "./js/lazyImage.js",
  "./js/supabaseOAuth.js",
  "./js/cloudSyncInstall.js",
  "./js/cloudBackup.js",
  "./js/cloudImageSync.js",
  "./js/theme.js",
  "./js/util.js",
  "./js/sheet.js",
  "./js/share.js",
  "./js/icons.js",
  "./js/tabbar.js",
  "./js/photo.js",
  "./js/masonry.js",
  "./js/bookCard.js",
  "./js/bookEditor.js",
  "./js/bookDetail.js",
  "./js/starRating.js",
  "./js/tagInput.js",
  "./js/filterSort.js",
  "./js/search.js",
  "./js/settingsMenu.js",
  "./js/version.js",
  "./js/whatsNew.js",
  "./js/onboarding.js",
  "./js/migrationNotice.js",
  "./js/views/shelf.js",
  "./js/views/home.js",
  "./js/views/toread.js",
  "./js/views/reading.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // The unfurl endpoint is a live network call by nature (it fetches
  // whatever URL you just pasted) — never cache it or serve it offline.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first: always try to get the latest app shell when online, only
  // falling back to the cache when offline. Cache-first would serve a stale
  // version right after a deploy until a second reload.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
