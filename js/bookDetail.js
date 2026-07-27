import { getBook, saveBook, deleteBook, exportBookData, statusFor } from "./storage.js";
import { openSheet } from "./sheet.js";
import { shareOrDownload, filenameFor } from "./share.js";
import { hostnameFor, formatDate, todayISO, escapeHtml } from "./util.js";
import { renderStarPicker } from "./starRating.js";
import { openBookEditor } from "./bookEditor.js";
import { resolveImageSrc } from "./imageStore.js";
import { ICON_HEADPHONES, ICON_BOOK } from "./icons.js";

export function openBookDetail(nav, bookRef, refresh) {
  const book = getBook(bookRef.id) || bookRef;
  const sheet = openSheet("tpl-book-detail");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  const img = el.querySelector("#detail-image");
  if (book.coverImage) {
    img.alt = book.title || "";
    resolveImageSrc(book.coverImage).then((src) => {
      if (src) {
        img.src = src;
        img.classList.remove("hidden");
      }
    });
  }

  el.querySelector("#detail-title").textContent = book.title || "Untitled";

  const authorEl = el.querySelector("#detail-author");
  if (book.author) {
    authorEl.textContent = book.author;
    authorEl.classList.remove("hidden");
  }

  const tagsEl = el.querySelector("#detail-tags");
  const tags = (book.genres || []).map((g) => `<span class="detail-tag">${escapeHtml(g)}</span>`);
  tags.push(
    `<span class="detail-tag">${book.format === "audiobook" ? ICON_HEADPHONES : ICON_BOOK}<span>${
      book.format === "audiobook" ? "Audiobook" : "Physical"
    }</span></span>`
  );
  tagsEl.innerHTML = tags.join("");

  renderStarPicker(el.querySelector("#detail-star-picker"), {
    value: book.rating,
    onChange: async (rating) => {
      book.rating = rating;
      await saveBook(book);
      refresh();
    },
  });

  const linkEl = el.querySelector("#detail-link");
  if (book.url) {
    linkEl.href = book.url;
    el.querySelector("#detail-link-text").textContent = book.siteName || hostnameFor(book.url);
    linkEl.classList.remove("hidden");
  }

  const noteEl = el.querySelector("#detail-note");
  if (book.note) {
    noteEl.textContent = book.note;
    noteEl.classList.remove("hidden");
  }

  // ---- Reading log ----
  const logEl = el.querySelector("#detail-log");
  function renderLog() {
    const status = statusFor(book);
    const rows = [];
    if (book.startedAt) rows.push(`<p class="detail-log-row">Started ${formatDate(book.startedAt)}</p>`);
    if (book.finishedAt) rows.push(`<p class="detail-log-row">Finished ${formatDate(book.finishedAt)}</p>`);
    logEl.innerHTML = rows.join("");

    const startBtn = el.querySelector("#detail-start-btn");
    const finishBtn = el.querySelector("#detail-finish-btn");
    startBtn.classList.toggle("hidden", status !== "toread");
    finishBtn.classList.toggle("hidden", status === "home");
  }
  renderLog();

  el.querySelector("#detail-start-btn").addEventListener("click", async () => {
    book.startedAt = todayISO();
    await saveBook(book);
    refresh();
    renderLog();
  });
  el.querySelector("#detail-finish-btn").addEventListener("click", async () => {
    book.finishedAt = todayISO();
    if (!book.startedAt) book.startedAt = book.finishedAt;
    await saveBook(book);
    refresh();
    renderLog();
  });

  el.querySelector("#detail-edit-btn").addEventListener("click", () => {
    sheet.close();
    openBookEditor(nav, { book, isNew: false, refresh });
  });

  el.querySelector("#detail-share-btn").addEventListener("click", async () => {
    const data = await exportBookData(book);
    await shareOrDownload(filenameFor(book.title), JSON.stringify(data, null, 2));
  });

  el.querySelector("#detail-delete-btn").addEventListener("click", () => {
    const confirmSheet = openSheet("tpl-confirm-delete");
    confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${book.title || "this book"}"? This can't be undone.`;
    confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
    confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", async () => {
      await deleteBook(book.id);
      confirmSheet.close();
      sheet.close();
      refresh();
    });
  });
}
