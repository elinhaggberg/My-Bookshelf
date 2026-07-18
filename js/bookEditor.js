import { createEmptyBook, saveBook, getGenres } from "./storage.js";
import { openSheet } from "./sheet.js";
import { readAndResizeImage } from "./photo.js";
import { renderStarPicker } from "./starRating.js";
import { hostnameFor, todayISO } from "./util.js";

export function openAddBook(nav, refresh, presetStatus) {
  const book = createEmptyBook();
  if (presetStatus === "reading") book.startedAt = todayISO();
  openBookEditor(nav, { book, isNew: true, refresh });
}

export function openBookEditor(nav, { book, isNew, refresh, autoFetch }) {
  const draft = { ...book };

  const sheet = openSheet("tpl-book-editor");
  const el = sheet.el;
  el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
  el.querySelector("#editor-heading").textContent = isNew ? "Add a book" : "Edit book";

  // ---- Cover image ----
  const dropEl = el.querySelector("#photo-drop");
  const previewWrap = el.querySelector("#photo-preview-wrap");
  const previewImg = el.querySelector("#photo-preview-img");
  const cameraInput = el.querySelector("#camera-input");
  const libraryInput = el.querySelector("#library-input");

  function renderImagePreview() {
    if (draft.coverImage) {
      previewImg.src = draft.coverImage;
      dropEl.classList.add("hidden");
      previewWrap.classList.remove("hidden");
    } else {
      previewWrap.classList.add("hidden");
      dropEl.classList.remove("hidden");
    }
  }
  renderImagePreview();

  el.querySelector("#photo-camera-btn").addEventListener("click", () => cameraInput.click());
  el.querySelector("#photo-library-btn").addEventListener("click", () => libraryInput.click());

  async function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      draft.coverImage = await readAndResizeImage(file);
      renderImagePreview();
    } catch {
      // Unreadable file — leave the drop control as-is so they can retry.
    }
  }
  cameraInput.addEventListener("change", () => handleFile(cameraInput));
  libraryInput.addEventListener("change", () => handleFile(libraryInput));

  el.querySelector("#photo-clear-btn").addEventListener("click", () => {
    draft.coverImage = "";
    renderImagePreview();
  });

  // ---- Link + fetch cover/title ----
  const urlInput = el.querySelector("#editor-url-input");
  urlInput.value = draft.url || "";
  urlInput.addEventListener("input", () => {
    draft.url = urlInput.value.trim();
  });

  const titleInput = el.querySelector("#editor-title");
  const authorInput = el.querySelector("#editor-author");

  const fetchBtn = el.querySelector("#editor-fetch-btn");
  const msgEl = el.querySelector("#editor-fetch-message");
  async function runFetch() {
    const url = urlInput.value.trim();
    if (!url) return;
    msgEl.classList.remove("error", "hidden");
    msgEl.textContent = "Fetching…";
    fetchBtn.disabled = true;
    try {
      const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      draft.url = url;
      if (data.title) draft.title = data.title;
      if (data.image) draft.coverImage = data.image;
      draft.siteName = data.siteName || hostnameFor(url);
      titleInput.value = draft.title || "";
      renderImagePreview();
      if (data.error) {
        msgEl.textContent = `${data.error} You can still fill in the details yourself, or add your own cover photo below.`;
        msgEl.classList.add("error");
      } else if (data.notice) {
        msgEl.textContent = `${data.notice} You can add your own cover photo below instead.`;
      } else {
        msgEl.textContent = "Got it — title and cover filled in below.";
      }
    } catch {
      msgEl.textContent = "Couldn't fetch that link. You can still fill in the details yourself.";
      msgEl.classList.add("error");
    } finally {
      fetchBtn.disabled = false;
    }
  }
  fetchBtn.addEventListener("click", runFetch);
  if (autoFetch && draft.url) runFetch();

  titleInput.value = draft.title || "";
  titleInput.addEventListener("input", () => {
    draft.title = titleInput.value;
  });
  authorInput.value = draft.author || "";
  authorInput.addEventListener("input", () => {
    draft.author = authorInput.value;
  });

  // ---- Genre ----
  const genreInput = el.querySelector("#editor-genre");
  const genreList = el.querySelector("#genre-suggestions");
  genreList.replaceChildren(
    ...getGenres().map((g) => {
      const opt = document.createElement("option");
      opt.value = g;
      return opt;
    })
  );
  genreInput.value = draft.genre || "";
  genreInput.addEventListener("input", () => {
    draft.genre = genreInput.value;
  });

  // ---- Format ----
  const formatSegmented = el.querySelector("#editor-format-segmented");
  formatSegmented.querySelectorAll(".segmented-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.format === draft.format);
    btn.addEventListener("click", () => {
      draft.format = btn.dataset.format;
      formatSegmented.querySelectorAll(".segmented-option").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // ---- Rating ----
  renderStarPicker(el.querySelector("#editor-star-picker"), {
    value: draft.rating,
    onChange: (rating) => {
      draft.rating = rating;
    },
  });

  // ---- Started / finished dates ----
  const startedInput = el.querySelector("#editor-started-input");
  const finishedInput = el.querySelector("#editor-finished-input");
  startedInput.value = draft.startedAt || "";
  finishedInput.value = draft.finishedAt || "";
  startedInput.addEventListener("input", () => {
    draft.startedAt = startedInput.value;
  });
  finishedInput.addEventListener("input", () => {
    draft.finishedAt = finishedInput.value;
  });
  el.querySelector("#editor-started-today-btn").addEventListener("click", () => {
    draft.startedAt = todayISO();
    startedInput.value = draft.startedAt;
  });
  el.querySelector("#editor-finished-today-btn").addEventListener("click", () => {
    draft.finishedAt = todayISO();
    finishedInput.value = draft.finishedAt;
    if (!draft.startedAt) {
      draft.startedAt = draft.finishedAt;
      startedInput.value = draft.startedAt;
    }
  });

  // ---- Note ----
  const noteInput = el.querySelector("#editor-note");
  noteInput.value = draft.note || "";
  noteInput.addEventListener("input", () => {
    draft.note = noteInput.value;
  });

  el.querySelector("#editor-save-btn").addEventListener("click", () => {
    const finalBook = {
      ...draft,
      title: draft.title?.trim() || "Untitled",
      author: draft.author?.trim() || "",
      genre: draft.genre?.trim() || "",
    };
    saveBook(finalBook);
    sheet.close();
    refresh();
  });
}
