import { formatDate } from "./util.js";
import { statusFor } from "./storage.js";
import { ICON_IMAGE, ICON_STAR, ICON_STAR_OUTLINE, ICON_HEADPHONES, ICON_BOOK } from "./icons.js";

function starsMarkup(rating) {
  if (!rating) return "";
  const stars = [1, 2, 3, 4, 5].map((n) => (n <= rating ? ICON_STAR : ICON_STAR_OUTLINE)).join("");
  return `<span class="pin-stars">${stars}</span>`;
}

// Builds one Pinterest-style grid tile from the shared <template id="tpl-pin-card">.
export function createBookNode(book, onOpen) {
  const tpl = document.getElementById("tpl-pin-card");
  const node = tpl.content.cloneNode(true);
  const article = node.querySelector(".pin");
  const img = node.querySelector(".pin-media");
  const placeholder = node.querySelector(".pin-media-placeholder");

  if (book.coverImage) {
    img.src = book.coverImage;
    img.alt = book.title || "";
    img.classList.remove("hidden");
  } else {
    placeholder.innerHTML = ICON_IMAGE;
    placeholder.classList.remove("hidden");
  }

  node.querySelector(".pin-title").textContent = book.title || "Untitled";

  const authorEl = node.querySelector(".pin-source");
  if (book.author) {
    authorEl.textContent = book.author;
    authorEl.classList.remove("hidden");
  }

  const metaEl = node.querySelector(".pin-meta");
  const formatEl = document.createElement("span");
  formatEl.className = "pin-format";
  formatEl.innerHTML = book.format === "audiobook" ? ICON_HEADPHONES : ICON_BOOK;
  metaEl.prepend(formatEl);

  const badgeEl = node.querySelector(".pin-badge");
  const status = statusFor(book);
  if (status === "home" && book.rating) {
    badgeEl.innerHTML = starsMarkup(book.rating);
    badgeEl.classList.remove("hidden");
  } else if (status === "reading" && book.startedAt) {
    badgeEl.textContent = `Started ${formatDate(book.startedAt)}`;
    badgeEl.classList.remove("hidden");
  } else if (book.rating) {
    badgeEl.innerHTML = starsMarkup(book.rating);
    badgeEl.classList.remove("hidden");
  }

  article.addEventListener("click", () => onOpen(book));
  return node;
}
