import { resolveImageSrc } from "./imageStore.js";

// Shared lazy-loading for the masonry grids on Home/To Read/Reading (see
// bookCard.js, rendered via shelf.js) and Search -- defers the actual
// resolveImageSrc() work (an IndexedDB read + object-URL creation for a
// local upload) until a card's cover scrolls near the viewport, instead of
// resolving every cover in a grid eagerly the moment it's created. A shelf
// of a few hundred books would otherwise open a few hundred IndexedDB reads
// and object URLs at once, almost all for cards nobody has scrolled to yet.
//
// Only one of these grids is ever mounted in the DOM at a time (route()
// replaces the whole view), and masonry.js's renderMasonry always does a
// full replaceChildren rebuild rather than an incremental append -- so a
// single module-level registry (reset before each rebuild) is enough,
// without needing to track which grid/container a given image belongs to.
let activeUrls = new Set();
let observedImages = new Set();
const pendingTasks = new WeakMap();

const observer = new IntersectionObserver(onIntersect, { rootMargin: "600px 0px" });

function onIntersect(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    observer.unobserve(img);
    observedImages.delete(img);
    const task = pendingTasks.get(img);
    pendingTasks.delete(img);
    if (!task) continue;
    resolveImageSrc(task.ref).then((src) => {
      if (src) {
        img.src = src;
        if (src.startsWith("blob:")) activeUrls.add(src);
      } else if (task.onMiss) {
        task.onMiss();
      }
    });
  }
}

// Call at card-creation time in place of an eager
// resolveImageSrc(ref).then(...) call. Unhides `img` immediately -- its
// aspect-ratio box is reserved in CSS (see style.css's .pin-media comment)
// specifically so masonry.js's column-balancing pass can measure it right
// after the card is appended, before the real image has resolved; a
// `display: none` element also has no layout box at all, so
// IntersectionObserver could never report it as intersecting and it would
// stay unresolved forever. Lazy here only means deferring the *resolve*,
// never the *layout reservation*. `onMiss` runs if resolution comes back
// empty (falls back to the placeholder icon, same as before this module).
export function lazyLoadImage(img, ref, onMiss) {
  if (!ref) return;
  img.classList.remove("hidden");
  pendingTasks.set(img, { ref, onMiss });
  observedImages.add(img);
  observer.observe(img);
}

// Call right before a grid is rebuilt (renderMasonry always replaces the
// whole container's children) -- revokes every object URL handed out for
// the previous card set and stops observing any that never scrolled into
// view, so neither leaks across repeated re-renders (switching shelves,
// filtering, searching, saving a new book, etc).
export function resetLazyGrid() {
  for (const url of activeUrls) URL.revokeObjectURL(url);
  activeUrls = new Set();
  for (const img of observedImages) observer.unobserve(img);
  observedImages = new Set();
}

// Best-effort storage-quota read for a proactive warning, surfaced before a
// real QuotaExceededError hits mid-upload or mid-sync. Not supported in
// every browser, so callers should treat a null return as "unknown, say
// nothing" rather than an error.
export async function getStorageUsage() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  if (!quota) return null;
  return { usage, quota, ratio: usage / quota };
}
