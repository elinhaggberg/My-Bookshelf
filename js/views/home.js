import { renderShelf } from "./shelf.js";

export function renderHome(root, nav) {
  renderShelf(root, nav, {
    status: "home",
    tab: "home",
    emptyText: "Nothing finished yet. Log a finish date on a book to see it here.",
  });
}
