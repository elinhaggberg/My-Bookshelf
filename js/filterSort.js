import { getFilterSortPref, setFilterSortPref, getGenres } from "./storage.js";
import { openSheet } from "./sheet.js";

// The date that matters for "newest/oldest" depends on which shelf a book
// is being viewed on — a Reading-shelf sort cares about when you started,
// a Home (finished) sort cares about when you finished, and To Read has
// neither, so it falls back to when the book was added.
function relevantDate(book, status) {
  if (status === "home" && book.finishedAt) return new Date(book.finishedAt).getTime();
  if (status === "reading" && book.startedAt) return new Date(book.startedAt).getTime();
  return book.createdAt || 0;
}

export function applyFilterSort(books, pref, status) {
  let list = books;

  const query = (pref.query || "").trim().toLowerCase();
  if (query) {
    list = list.filter((b) => {
      return (
        (b.title || "").toLowerCase().includes(query) ||
        (b.author || "").toLowerCase().includes(query) ||
        (b.genres || []).some((g) => g.toLowerCase().includes(query)) ||
        (b.note || "").toLowerCase().includes(query)
      );
    });
  }
  if (pref.rating !== "any") {
    const target = Number(pref.rating);
    list = list.filter((b) => (b.rating || 0) === target);
  }
  if (pref.genre !== "any") {
    list = list.filter((b) => (b.genres || []).includes(pref.genre));
  }
  if (pref.format !== "any") {
    list = list.filter((b) => b.format === pref.format);
  }

  list = [...list];
  switch (pref.sort) {
    case "date-asc":
      list.sort((a, b) => relevantDate(a, status) - relevantDate(b, status));
      break;
    case "rating-desc":
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || relevantDate(b, status) - relevantDate(a, status));
      break;
    case "rating-asc":
      list.sort((a, b) => (a.rating || 0) - (b.rating || 0) || relevantDate(b, status) - relevantDate(a, status));
      break;
    default:
      list.sort((a, b) => relevantDate(b, status) - relevantDate(a, status));
  }
  return list;
}

export function isFilterActive(pref) {
  return pref.rating !== "any" || pref.genre !== "any" || pref.format !== "any" || (pref.query || "").trim() !== "";
}

const SORT_OPTIONS = [
  { id: "date-desc", label: "Date: newest first" },
  { id: "date-asc", label: "Date: oldest first" },
  { id: "rating-desc", label: "Rating: best first" },
  { id: "rating-asc", label: "Rating: worst first" },
];

export function openFilterSort(onChange) {
  const sheet = openSheet("tpl-filter-sort");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  const pref = getFilterSortPref();

  const queryInput = el.querySelector("#filter-query-input");
  queryInput.value = pref.query || "";
  queryInput.addEventListener("input", () => {
    pref.query = queryInput.value;
    setFilterSortPref(pref);
    onChange();
  });

  const sortList = el.querySelector("#filter-sort-list");
  sortList.replaceChildren(
    ...SORT_OPTIONS.map((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sort-option" + (pref.sort === opt.id ? " active" : "");
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        pref.sort = opt.id;
        setFilterSortPref(pref);
        sortList.querySelectorAll(".sort-option").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        onChange();
      });
      return btn;
    })
  );

  const ratingRow = el.querySelector("#filter-rating-row");
  const ratingOptions = [
    { id: "any", label: "Any" },
    { id: "5", label: "5★" },
    { id: "4", label: "4★" },
    { id: "3", label: "3★" },
    { id: "2", label: "2★" },
    { id: "1", label: "1★" },
  ];
  ratingRow.replaceChildren(
    ...ratingOptions.map((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (pref.rating === opt.id ? " active" : "");
      chip.textContent = opt.label;
      chip.addEventListener("click", () => {
        pref.rating = opt.id;
        setFilterSortPref(pref);
        ratingRow.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
        chip.classList.add("active");
        onChange();
      });
      return chip;
    })
  );

  const formatRow = el.querySelector("#filter-format-row");
  const formatOptions = [
    { id: "any", label: "Any" },
    { id: "physical", label: "Physical" },
    { id: "audiobook", label: "Audiobook" },
  ];
  formatRow.replaceChildren(
    ...formatOptions.map((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (pref.format === opt.id ? " active" : "");
      chip.textContent = opt.label;
      chip.addEventListener("click", () => {
        pref.format = opt.id;
        setFilterSortPref(pref);
        formatRow.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
        chip.classList.add("active");
        onChange();
      });
      return chip;
    })
  );

  const genreRow = el.querySelector("#filter-genre-row");
  const genres = getGenres();
  const genreSection = el.querySelector("#filter-genre-section");
  genreSection.classList.toggle("hidden", genres.length === 0);
  genreRow.replaceChildren(
    ...["any", ...genres].map((g) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (pref.genre === g ? " active" : "");
      chip.textContent = g === "any" ? "Any" : g;
      chip.addEventListener("click", () => {
        pref.genre = g;
        setFilterSortPref(pref);
        genreRow.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
        chip.classList.add("active");
        onChange();
      });
      return chip;
    })
  );

  el.querySelector("#filter-reset-btn").addEventListener("click", () => {
    setFilterSortPref({ sort: "date-desc", rating: "any", genre: "any", format: "any", query: "" });
    sheet.close();
    onChange();
  });
}
