// Bump APP_VERSION and add a CHANGELOG entry with every user-visible
// release — whatsNew.js compares this against what a returning visitor
// last saw and shows the "What's new" sheet for anything newer. Keep the
// version string in YYYY.MM.DD form (zero-padded) so plain string
// comparison sorts the same as chronological order.
export const APP_VERSION = "2026.08.05";

export const CHANGELOG = [
  {
    version: "2026.08.05",
    date: "August 5, 2026",
    changes: [
      "Every shelf (Home, To Read, Reading) and Search now load book covers as you scroll to them instead of all at once -- keeps things smooth once you've saved a lot of books, since nothing behind the fold does an IndexedDB lookup until you actually scroll near it.",
      "Home now warns once local storage gets close to full, instead of the first sign of trouble being a failed save.",
    ],
  },
  {
    version: "2026.07.31",
    date: "July 31, 2026",
    changes: [
      "Added an App Library link in the gear menu, pointing to the Make it Local App Library of sibling apps.",
    ],
  },
  {
    version: "2026.07.19",
    date: "July 19, 2026",
    changes: [
      "Genres now work like tags — add as many as you like per book, and your existing ones are suggested as you type to keep filtering consistent.",
      "Star ratings on book cards now show as a row of stars instead of a star icon plus a number.",
      "You'll see a note like this one whenever the app updates, so you always know what's changed.",
      "Full backups now also include your theme and home screen title, not just your books — if you've exported one before, it's worth making a fresh one.",
    ],
  },
];
