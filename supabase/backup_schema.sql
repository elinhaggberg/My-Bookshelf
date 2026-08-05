-- Run this once (or via the automated Cloud Sync install) to set up the
-- optional Cloud Backup add-on. Safe to commit: no secrets.

-- One row per book, keyed by the app's own client-side id so every device
-- agrees on the same identity for the same record -- that's what lets two
-- devices converge on one shared dataset instead of just duplicating each
-- other's data. "data" holds the full record as JSON, same shape as what's
-- already in localStorage. "deleted" is a tombstone rather than an actual
-- row delete, so a device that's been offline for a while can still learn
-- something was removed elsewhere instead of just never hearing about it.
create table if not exists backup_records (
  store text not null check (store in ('books')),
  record_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (store, record_id)
);
create index if not exists backup_records_updated_at_idx on backup_records (updated_at);

alter table backup_records enable row level security;

-- No policies are defined on purpose -- the anon/publishable key can never
-- read or write this table directly, even if the key or project URL leaks.
-- All access goes through the backup-sync Edge Function, which uses the
-- service role key server-side only, and requires the backup passphrase (a
-- plain Edge Function secret, BACKUP_PASSPHRASE -- see backup-sync/index.ts)
-- on every request. That passphrase is the actual thing protecting real
-- content here.

-- Private Storage bucket for Cloud Backup's image sync (see
-- js/cloudImageSync.js) -- holds the actual bytes of uploaded cover photos,
-- keyed by "<store>/<recordId>", so a synced record only ever carries a
-- small "storage:<store>:<recordId>" reference instead of its cover's full
-- data: URI. No RLS policy is defined here either, same reasoning as
-- backup_records above -- only the backup-image Edge Function's
-- service-role client can ever reach this bucket, gated by the same backup
-- passphrase as every other Cloud Backup call.
insert into storage.buckets (id, name, public)
values ('backup-images', 'backup-images', false)
on conflict (id) do nothing;
