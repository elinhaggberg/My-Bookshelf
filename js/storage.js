import { IDB_PREFIX, putImage, getImage, deleteImage, dataUrlToBlob, blobToDataUrl } from "./imageStore.js";

const BOOKS_KEY = "mb_books_v1";
const THEME_KEY = "mb_theme_v1";
const HOME_TITLE_KEY = "mb_home_title_v1";
const FILTER_SORT_KEY = "mb_filter_sort_v1";
const LAST_SEEN_VERSION_KEY = "mb_last_seen_version_v1";
const LAST_BACKUP_KEY = "mb_last_backup_at_v1";
const BACKUP_BANNER_DISMISSED_KEY = "mb_backup_banner_dismissed_at_v1";
const FIRST_OPEN_KEY = "mb_first_open_at_v1";
const ONBOARDING_SEEN_KEY = "mb_onboarding_seen_v1";
const IMAGES_MIGRATED_KEY = "mb_images_migrated_v1";

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- Books ----

// Genre used to be a single free-text string; it's now a list of tags.
// Normalizing on every read lets older saved/imported books (with a plain
// `genre` string, or nothing at all) keep working without a one-time
// migration step.
function normalizeBook(book) {
  const { genre, genres, ...rest } = book;
  return { ...rest, genres: genres || (genre ? [genre] : []) };
}

export function getBooks() {
  return readJSON(BOOKS_KEY, []).map(normalizeBook);
}

export function getBook(id) {
  return getBooks().find((b) => b.id === id) || null;
}

export async function saveBook(book) {
  const books = getBooks();
  const idx = books.findIndex((b) => b.id === book.id);
  const previous = idx >= 0 ? books[idx] : null;

  // A fresh camera/library upload arrives as a Blob (see photo.js) — move it
  // into IndexedDB and store just a reference, since the actual bytes are
  // too big for localStorage's tiny quota. A link's cover URL (or a
  // re-saved idb: reference) is already a plain string and passes through
  // untouched.
  let coverImage = book.coverImage;
  if (coverImage instanceof Blob) {
    coverImage = IDB_PREFIX + book.id;
    await putImage(book.id, book.coverImage);
  }
  if (previous?.coverImage?.startsWith(IDB_PREFIX) && previous.coverImage !== coverImage) {
    await deleteImage(previous.coverImage.slice(IDB_PREFIX.length)).catch(() => {});
  }

  const withTimestamp = { ...book, coverImage, updatedAt: Date.now() };
  if (idx >= 0) books[idx] = withTimestamp;
  else books.push(withTimestamp);
  writeJSON(BOOKS_KEY, books);
  return withTimestamp;
}

export async function deleteBook(id) {
  const book = getBook(id);
  if (book?.coverImage?.startsWith(IDB_PREFIX)) {
    await deleteImage(book.coverImage.slice(IDB_PREFIX.length)).catch(() => {});
  }
  writeJSON(BOOKS_KEY, getBooks().filter((b) => b.id !== id));
}

export function createEmptyBook() {
  return {
    id: uid(),
    createdAt: Date.now(),
    title: "",
    author: "",
    coverImage: "",
    url: "",
    siteName: "",
    genres: [],
    format: "physical",
    rating: 0,
    note: "",
    startedAt: "",
    finishedAt: "",
  };
}

// A book's shelf is derived from its logged dates rather than stored
// directly, so "moving" a book between shelves is just logging a date.
export function statusFor(book) {
  if (book.finishedAt) return "home";
  if (book.startedAt) return "reading";
  return "toread";
}

export function getBooksByStatus(status) {
  return getBooks().filter((b) => statusFor(b) === status);
}

// Genre tag suggestions are whatever the user has already typed elsewhere,
// rather than a fixed taxonomy — keeps tags free-text but still
// filterable/consistent once a few books share a spelling.
export function getGenres() {
  const set = new Set();
  for (const book of getBooks()) {
    for (const g of book.genres || []) {
      if (g && g.trim()) set.add(g.trim());
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---- Export / import ----

// Exports inline each book's actual cover-image bytes as a data: URI
// (resolving any idb: reference back out of IndexedDB first) so an
// exported file is fully self-contained and portable — it doesn't depend
// on this device's IndexedDB to be useful on another device or after a
// reinstall.
async function inlineImages(books) {
  return Promise.all(
    books.map(async (book) => {
      if (book.coverImage?.startsWith(IDB_PREFIX)) {
        const blob = await getImage(book.coverImage.slice(IDB_PREFIX.length));
        if (blob) return { ...book, coverImage: await blobToDataUrl(blob) };
      }
      return book;
    })
  );
}

export async function exportBackupData() {
  return {
    type: "backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    books: await inlineImages(getBooks()),
    theme: getThemePref(),
    homeTitle: getHomeTitle(),
  };
}

export async function exportBookData(book) {
  return {
    type: "book",
    version: 1,
    exportedAt: new Date().toISOString(),
    books: await inlineImages([book]),
  };
}

// A malformed or hand-edited export file shouldn't be able to wedge the
// app -- genres in particular gets iterated with for...of and .some()
// elsewhere (getGenres, search, filter), which throws on every future
// render if it's not actually an array. Coerce each field to the type the
// rest of the app assumes rather than trusting the file, same "never
// trust the file" treatment as everywhere else user data gets rendered.
function sanitizeImportedBook(b) {
  const src = b && typeof b === "object" ? b : {};
  const asString = (v) => (typeof v === "string" ? v : "");
  return {
    title: asString(src.title),
    author: asString(src.author),
    coverImage: asString(src.coverImage),
    url: asString(src.url),
    siteName: asString(src.siteName),
    genres: Array.isArray(src.genres) ? src.genres.filter((g) => typeof g === "string") : [],
    format: src.format === "audiobook" ? "audiobook" : "physical",
    rating: typeof src.rating === "number" && Number.isFinite(src.rating) ? src.rating : 0,
    note: asString(src.note),
    startedAt: asString(src.startedAt),
    finishedAt: asString(src.finishedAt),
  };
}

// Always merges (adds new entries) rather than replacing anything, so a bad
// or repeated import can't destroy existing data — every imported book is
// given a fresh id and added alongside whatever's already saved.
export async function importData(data) {
  if (!data || !["backup", "book"].includes(data.type) || !Array.isArray(data.books)) {
    throw new Error("That doesn't look like a My Bookshelf export file.");
  }

  // An imported book's cover is a plain data: URI (inlined at export time,
  // see inlineImages above) — move it straight into IndexedDB rather than
  // leaving it sitting in localStorage, so importing a backup doesn't
  // immediately blow past the same quota this whole store exists to avoid.
  const newBooks = await Promise.all(
    data.books.map(async (b) => {
      const id = uid();
      const sanitized = sanitizeImportedBook(b);
      let coverImage = sanitized.coverImage;
      if (coverImage.startsWith("data:")) {
        try {
          await putImage(id, await dataUrlToBlob(coverImage));
          coverImage = IDB_PREFIX + id;
        } catch {
          // Couldn't decode/store it — fall back to keeping the raw
          // data: URI so the book still imports with its cover intact.
        }
      }
      return {
        ...createEmptyBook(),
        ...sanitized,
        id,
        coverImage,
        createdAt: Date.now(),
      };
    })
  );
  writeJSON(BOOKS_KEY, [...getBooks(), ...newBooks]);

  // Theme and home title are single current-state settings, not a list, so
  // a full backup restore applies them directly rather than merging --
  // that's what "restore my backup" means for a device's preferences.
  let preferencesApplied = false;
  if (data.type === "backup") {
    if (data.theme) setThemePref(data.theme);
    if (data.homeTitle) setHomeTitle(data.homeTitle);
    preferencesApplied = Boolean(data.theme || data.homeTitle);
  }

  return { bookCount: newBooks.length, preferencesApplied };
}

// ---- Preferences ----

export function getThemePref() {
  return readJSON(THEME_KEY, {});
}

export function setThemePref(pref) {
  writeJSON(THEME_KEY, pref);
}

export function getLastSeenVersion() {
  return localStorage.getItem(LAST_SEEN_VERSION_KEY) || "";
}

export function setLastSeenVersion(version) {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}

export function getHomeTitle() {
  return localStorage.getItem(HOME_TITLE_KEY) || "My Bookshelf";
}

export function setHomeTitle(value) {
  const trimmed = (value || "").trim();
  if (trimmed) localStorage.setItem(HOME_TITLE_KEY, trimmed);
  else localStorage.removeItem(HOME_TITLE_KEY);
}

const DEFAULT_FILTER_SORT = { sort: "date-desc", rating: "any", genre: "any", format: "any", query: "" };

export function getFilterSortPref() {
  return { ...DEFAULT_FILTER_SORT, ...readJSON(FILTER_SORT_KEY, {}) };
}

export function setFilterSortPref(pref) {
  writeJSON(FILTER_SORT_KEY, pref);
}

const BACKUP_REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
const BACKUP_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // re-ask 3 days after "Later"

function getFirstOpenAt() {
  let v = Number(localStorage.getItem(FIRST_OPEN_KEY));
  if (!v) {
    v = Date.now();
    localStorage.setItem(FIRST_OPEN_KEY, String(v));
  }
  return v;
}

export function markBackedUp() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  localStorage.removeItem(BACKUP_BANNER_DISMISSED_KEY);
}

export function dismissBackupBanner() {
  localStorage.setItem(BACKUP_BANNER_DISMISSED_KEY, String(Date.now()));
}

// Nudges toward exporting a backup every ~2 weeks, since all data lives only
// on this device. Tied to the last time a real export happened (or, if
// never, since first open) -- not to when the banner was last shown -- so
// dismissing with "Later" doesn't quietly reset the clock without an actual
// backup having happened.
export function shouldShowBackupBanner() {
  if (getBooks().length === 0) return false;

  const lastBackupAt = Number(localStorage.getItem(LAST_BACKUP_KEY)) || getFirstOpenAt();
  if (Date.now() - lastBackupAt < BACKUP_REMIND_AFTER_MS) return false;

  const dismissedAt = Number(localStorage.getItem(BACKUP_BANNER_DISMISSED_KEY));
  if (dismissedAt && Date.now() - dismissedAt < BACKUP_SNOOZE_MS) return false;

  return true;
}

export function getOnboardingSeen() {
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";
}

export function setOnboardingSeen() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
}

// One-time cleanup for anyone who saved cover photos before this store
// existed — their images are sitting in localStorage as huge inline data:
// URIs, which is exactly what fills up the quota. Moves each into
// IndexedDB and rewrites the book to reference it instead. Runs once
// (gated by a flag) and skips any book it can't process rather than
// letting one bad image block startup.
// Cheap, synchronous check for whether the migration below actually has
// anything to do — lets the caller (migrationNotice.js) decide whether to
// say anything, without needing to await the migration itself first.
export function hasLegacyImages() {
  return getBooks().some((b) => typeof b.coverImage === "string" && b.coverImage.startsWith("data:"));
}

export async function migrateImagesToIndexedDB() {
  if (localStorage.getItem(IMAGES_MIGRATED_KEY) === "true") return;
  const books = getBooks();
  let changed = false;
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    if (typeof book.coverImage === "string" && book.coverImage.startsWith("data:")) {
      try {
        await putImage(book.id, await dataUrlToBlob(book.coverImage));
        books[i] = { ...book, coverImage: IDB_PREFIX + book.id };
        changed = true;
      } catch {
        // Leave this one as-is and keep going with the rest.
      }
    }
  }
  if (changed) writeJSON(BOOKS_KEY, books);
  localStorage.setItem(IMAGES_MIGRATED_KEY, "true");
}

export { uid };
