# My Bookshelf

A Goodreads-style PWA for tracking what you're reading, finished and want to read next — all stored locally on your device. No ads, no data collection, no account needed.

## How it works

A book moves itself between shelves as you log dates — no manual filing:

- **To Read** → log a start date and it moves to **Reading**
- **Reading** → log a finish date and it moves to **Home**, your finished-books feed

Rate any book 1–5 stars, tag it with a genre and mark it physical or audiobook, then use the filter icon on any shelf to narrow down by rating, genre or format, or to sort by date/rating. The search icon looks across titles, authors, genres and notes on every shelf at once.

## Features

- **Add a book**: paste a link to a book page (fetches the cover image and title for you) or fill in the details yourself with your own cover photo.
- **Shelves**: To Read, Reading, and Home (finished) — driven entirely by the started/finished dates you log.
- **Filter & sort**: by star rating, genre, format, newest/oldest, or best/worst rated.
- **Search**: one search across every book you've logged, regardless of shelf.
- **Backup & sharing**: export a single book or a full backup as a JSON file; import always merges, never replaces.
- **Customize**: Playful/Light/Dark themes with a choice of accent colors, plus a custom home screen title.

## Architecture

No build step — plain HTML/CSS/JS modules, same approach as [My Closet](https://github.com/elinhaggberg/My-Closet). All data lives in `localStorage` on the device.

The only server-side piece is `api/unfurl.js`, a stateless Vercel serverless function that fetches a pasted URL server-side (the browser can't read cross-origin HTML itself) and extracts Open Graph / JSON-LD metadata to build the card. It stores nothing — no database, no accounts. That keeps the "no data collection" promise true even with a link-preview feature.

## Deploying

Deploy straight from this repo on [Vercel](https://vercel.com) — no configuration needed. It auto-detects the static site plus the `api/` serverless function.
