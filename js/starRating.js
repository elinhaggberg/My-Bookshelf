import { ICON_STAR, ICON_STAR_OUTLINE } from "./icons.js";

// Shared 5-star tappable widget used in both the book editor and the detail
// sheet. Tapping the currently-set star again clears the rating back to 0,
// so "no rating" stays reachable without a separate clear control.
export function renderStarPicker(container, { value, onChange }) {
  function draw(current) {
    const stars = [1, 2, 3, 4, 5].map((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "star-btn" + (n <= current ? " filled" : "");
      btn.innerHTML = n <= current ? ICON_STAR : ICON_STAR_OUTLINE;
      btn.setAttribute("aria-label", `${n} star${n !== 1 ? "s" : ""}`);
      btn.addEventListener("click", () => {
        const next = current === n ? 0 : n;
        current = next;
        onChange(next);
        draw(current);
      });
      return btn;
    });
    container.replaceChildren(...stars);
  }
  draw(value || 0);
}
