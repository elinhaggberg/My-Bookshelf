import { renderShelf } from "./shelf.js";

export function renderReading(root, nav) {
  renderShelf(root, nav, {
    status: "reading",
    tab: "reading",
    title: "Reading",
    emptyText: "Nothing in progress. Log a start date on a book to move it here.",
  });
}
