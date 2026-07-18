import { getBooks, statusFor } from "./storage.js";
import { openSheet } from "./sheet.js";
import { renderMasonry } from "./masonry.js";
import { createBookNode } from "./bookCard.js";
import { openBookDetail } from "./bookDetail.js";

const STATUS_LABEL = { toread: "To Read", reading: "Reading", home: "Read" };

export function openSearch(nav, refresh) {
  const sheet = openSheet("tpl-search");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  const input = el.querySelector("#search-input");
  const resultsEl = el.querySelector("#search-results");
  const emptyEl = el.querySelector("#search-empty");

  function runSearch() {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      resultsEl.replaceChildren();
      emptyEl.textContent = "Start typing to search your books.";
      emptyEl.classList.remove("hidden");
      return;
    }
    const matches = getBooks().filter((b) => {
      return (
        (b.title || "").toLowerCase().includes(q) ||
        (b.author || "").toLowerCase().includes(q) ||
        (b.genres || []).some((g) => g.toLowerCase().includes(q)) ||
        (b.note || "").toLowerCase().includes(q)
      );
    });
    if (matches.length === 0) {
      resultsEl.replaceChildren();
      emptyEl.textContent = "No books match that search.";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    renderMasonry(resultsEl, matches, (book) => {
      const node = createBookNode(book, (b) => openBookDetail(nav, b, () => {
        runSearch();
        refresh();
      }));
      const badge = document.createElement("span");
      badge.className = "pin-status-badge";
      badge.textContent = STATUS_LABEL[statusFor(book)];
      node.querySelector(".pin").appendChild(badge);
      return node;
    });
  }

  input.addEventListener("input", runSearch);
  runSearch();
  setTimeout(() => input.focus(), 50);
}
