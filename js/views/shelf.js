import { getBooksByStatus, getHomeTitle, getFilterSortPref } from "../storage.js";
import { createBookNode } from "../bookCard.js";
import { renderTabbar } from "../tabbar.js";
import { renderMasonry } from "../masonry.js";
import { openAddBook } from "../bookEditor.js";
import { openBookDetail } from "../bookDetail.js";
import { openSettingsMenu } from "../settingsMenu.js";
import { openSearch } from "../search.js";
import { openFilterSort, applyFilterSort, isFilterActive } from "../filterSort.js";
import { ICON_SEARCH, ICON_FILTER } from "../icons.js";

// Home, To Read and Reading are all "one shelf of books, filtered by
// status" — the only real differences are the status, page title and
// empty-state copy, so all three views share this one renderer.
export function renderShelf(root, nav, { status, tab, title, emptyText }) {
  const tpl = document.getElementById("tpl-shelf");
  root.replaceChildren(tpl.content.cloneNode(true));
  renderTabbar(root, nav, tab);

  const topbar = root.querySelector(".topbar");
  const titleEl = document.getElementById("shelf-title");
  if (tab === "home") {
    titleEl.id = "home-title";
    topbar.classList.add("home-topbar");
    titleEl.textContent = getHomeTitle();
  } else {
    titleEl.textContent = title;
  }

  document.getElementById("add-btn").addEventListener("click", () => openAddBook(nav, renderList, status));
  document.getElementById("search-btn").addEventListener("click", () => openSearch(nav, renderList));
  const filterBtn = document.getElementById("filter-btn");
  filterBtn.addEventListener("click", () => openFilterSort(renderList));
  document.getElementById("settings-btn").addEventListener("click", () => openSettingsMenu(renderList));

  renderList();

  function renderList() {
    filterBtn.classList.toggle("active", isFilterActive(getFilterSortPref()));
    const grid = document.getElementById("shelf-grid");
    const books = applyFilterSort(getBooksByStatus(status), getFilterSortPref(), status);
    if (books.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = emptyText;
      grid.replaceChildren(empty);
      return;
    }
    renderMasonry(grid, books, (book) => createBookNode(book, (b) => openBookDetail(nav, b, renderList)));
  }
}
