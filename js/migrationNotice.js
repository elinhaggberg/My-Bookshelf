import { hasLegacyImages, exportBackupData } from "./storage.js";
import { openSheet } from "./sheet.js";
import { shareOrDownload } from "./share.js";

// A one-time heads-up for anyone with cover photos saved before IndexedDB
// storage existed (see storage.js's migrateImagesToIndexedDB) — explains
// that their photos are being moved automatically, and offers an optional
// backup download first for extra peace of mind. Purely informational with
// respect to the migration itself: dismissing it any way doesn't block or
// delay that, which runs regardless (see app.js) and is what naturally
// stops this from showing again once there's nothing left to migrate.
//
// Returns a promise that resolves once the sheet is gone (however it was
// dismissed), so a caller can hold off on stacking another one-time sheet
// (e.g. What's New) right on top of this one before it's even been read.
export function checkMigrationNotice() {
  if (!hasLegacyImages()) return Promise.resolve();

  return new Promise((resolve) => {
    const sheet = openSheet("tpl-migration-notice");
    const el = sheet.el;

    // Every dismissal path (X, Continue, or tapping the backdrop) ends with
    // sheet.js removing this backdrop node from the DOM — watching for that
    // directly covers all three instead of only the buttons we wire below.
    let resolved = false;
    const observer = new MutationObserver(() => {
      if (!el.isConnected && !resolved) {
        resolved = true;
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true });

    el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    el.querySelector("#migration-notice-continue-btn").addEventListener("click", () => sheet.close());

    const backupBtn = el.querySelector("#migration-notice-backup-btn");
    const statusEl = el.querySelector("#migration-notice-backup-status");
    backupBtn.addEventListener("click", async () => {
      backupBtn.disabled = true;
      try {
        const data = await exportBackupData();
        const stamp = new Date().toISOString().slice(0, 10);
        await shareOrDownload(`my-bookshelf-backup-${stamp}.json`, JSON.stringify(data, null, 2));
        statusEl.textContent = "Backup downloaded.";
      } catch {
        statusEl.textContent = "Couldn't create a backup — you can also do this later from Settings.";
      } finally {
        statusEl.classList.remove("hidden");
        backupBtn.disabled = false;
      }
    });
  });
}
