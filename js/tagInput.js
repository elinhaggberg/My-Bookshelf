import { ICON_CLOSE_SMALL } from "./icons.js";

// Genre tag editor: a row of removable chips plus a text input backed by a
// <datalist> for autocomplete. Typing an existing tag and pressing
// Enter/comma (or a suggestion click) commits it as a chip rather than
// free text, so genres stay consistent enough to actually filter by.
export function renderTagInput(container, { tags, suggestions, datalistId }) {
  const list = [...tags];

  function draw(shouldFocus) {
    const chipRow = document.createElement("div");
    chipRow.className = "tag-chip-row";
    list.forEach((tag, i) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      const label = document.createElement("span");
      label.textContent = tag;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-chip-remove";
      removeBtn.setAttribute("aria-label", `Remove ${tag}`);
      removeBtn.innerHTML = ICON_CLOSE_SMALL;
      removeBtn.addEventListener("click", () => {
        list.splice(i, 1);
        draw(true);
      });
      chip.append(label, removeBtn);
      chipRow.appendChild(chip);
    });

    const inputWrap = document.createElement("div");
    inputWrap.className = "tag-input-wrap";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tag-input";
    input.placeholder = list.length ? "Add another…" : "e.g. Fantasy";
    input.setAttribute("list", datalistId);
    input.autocomplete = "off";

    function commit(refocus) {
      const val = input.value.trim();
      input.value = "";
      if (!val) return;
      const norm = val.toLowerCase();
      if (!list.some((t) => t.toLowerCase() === norm)) {
        list.push(val);
      }
      draw(refocus);
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commit(true);
      } else if (e.key === "Backspace" && input.value === "" && list.length) {
        list.pop();
        draw(true);
      }
    });
    input.addEventListener("blur", () => commit(false));
    inputWrap.appendChild(input);

    container.replaceChildren(chipRow, inputWrap);
    if (shouldFocus) input.focus();
  }

  draw(false);

  const datalist = document.getElementById(datalistId);
  if (datalist) {
    datalist.replaceChildren(
      ...suggestions.map((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        return opt;
      })
    );
  }

  return {
    getTags: () => [...list],
  };
}
