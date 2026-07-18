import { renderShelf } from "./shelf.js";

export function renderToRead(root, nav) {
  renderShelf(root, nav, {
    status: "toread",
    tab: "toread",
    title: "To Read",
    emptyText: "Nothing on your to-read list yet. Tap + to add a book.",
  });
}
