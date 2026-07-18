// Bump APP_VERSION and add a CHANGELOG entry with every user-visible
// release — whatsNew.js compares this against what a returning visitor
// last saw and shows the "What's new" sheet for anything newer. Keep the
// version string in YYYY.MM.DD form (zero-padded) so plain string
// comparison sorts the same as chronological order.
export const APP_VERSION = "2026.07.19";

export const CHANGELOG = [
  {
    version: "2026.07.19",
    date: "July 19, 2026",
    changes: [
      "Genres now work like tags — add as many as you like per book, and your existing ones are suggested as you type to keep filtering consistent.",
      "Star ratings on book cards now show as a row of stars instead of a star icon plus a number.",
      "You'll see a note like this one whenever the app updates, so you always know what's changed.",
    ],
  },
];
