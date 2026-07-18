const BOOKS_KEY = "mb_books_v1";
const THEME_KEY = "mb_theme_v1";
const HOME_TITLE_KEY = "mb_home_title_v1";
const FILTER_SORT_KEY = "mb_filter_sort_v1";

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

export function getBooks() {
  return readJSON(BOOKS_KEY, []);
}

export function getBook(id) {
  return getBooks().find((b) => b.id === id) || null;
}

export function saveBook(book) {
  const books = getBooks();
  const idx = books.findIndex((b) => b.id === book.id);
  const withTimestamp = { ...book, updatedAt: Date.now() };
  if (idx >= 0) books[idx] = withTimestamp;
  else books.push(withTimestamp);
  writeJSON(BOOKS_KEY, books);
  return withTimestamp;
}

export function deleteBook(id) {
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
    genre: "",
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

// Genre suggestions are whatever the user has already typed elsewhere,
// rather than a fixed taxonomy — keeps the field free-text but still
// filterable/consistent once a few books share a spelling.
export function getGenres() {
  const set = new Set();
  for (const book of getBooks()) {
    if (book.genre && book.genre.trim()) set.add(book.genre.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---- Export / import ----

export function exportBackupData() {
  return {
    type: "backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    books: getBooks(),
  };
}

export function exportBookData(book) {
  return {
    type: "book",
    version: 1,
    exportedAt: new Date().toISOString(),
    books: [book],
  };
}

// Always merges (adds new entries) rather than replacing anything, so a bad
// or repeated import can't destroy existing data — every imported book is
// given a fresh id and added alongside whatever's already saved.
export function importData(data) {
  if (!data || !["backup", "book"].includes(data.type) || !Array.isArray(data.books)) {
    throw new Error("That doesn't look like a My Bookshelf export file.");
  }

  const newBooks = data.books.map((b) => ({
    ...createEmptyBook(),
    ...b,
    id: uid(),
    createdAt: Date.now(),
  }));
  writeJSON(BOOKS_KEY, [...getBooks(), ...newBooks]);

  return { bookCount: newBooks.length };
}

// ---- Preferences ----

export function getThemePref() {
  return readJSON(THEME_KEY, {});
}

export function setThemePref(pref) {
  writeJSON(THEME_KEY, pref);
}

export function getHomeTitle() {
  return localStorage.getItem(HOME_TITLE_KEY) || "My Bookshelf";
}

export function setHomeTitle(value) {
  const trimmed = (value || "").trim();
  if (trimmed) localStorage.setItem(HOME_TITLE_KEY, trimmed);
  else localStorage.removeItem(HOME_TITLE_KEY);
}

const DEFAULT_FILTER_SORT = { sort: "date-desc", rating: "any", genre: "any", format: "any" };

export function getFilterSortPref() {
  return { ...DEFAULT_FILTER_SORT, ...readJSON(FILTER_SORT_KEY, {}) };
}

export function setFilterSortPref(pref) {
  writeJSON(FILTER_SORT_KEY, pref);
}

export { uid };
