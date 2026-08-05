// Runs the actual "install" on top of a connected Cloud Sync project --
// applies the backup SQL schema, sets the backup passphrase secret, and
// deploys the backup-sync / backup-image Edge Functions, via the
// Management API endpoints in api/cloud-sync-*. The "connect the app"
// step always runs last, once install succeeds.
//
// Every step is an upsert (create-table-if-not-exists, deploy-or-update),
// so the whole sequence is safe to run again from scratch if it fails
// partway -- there's no separate "resume" logic, just re-run. That's also
// what lets an existing install pick up new backup steps added later
// (like the image-sync function) just by re-clicking Install.
import { getValidAccessToken, getSelectedProject, setApiConfig } from "./supabaseOAuth.js";
import { getBackupPassphrase, setBackupPassphrase } from "./cloudBackup.js";

const BACKUP_PASSPHRASE_NAME = "BACKUP_PASSPHRASE";
const INSTALLED_FEATURES_KEY = "mb_installed_features_v1";

// Tracked locally (keyed by project ref, so switching projects doesn't
// carry over a stale "already installed" state) since there's no cheap way
// to ask the project itself "did I already set up Cloud Backup here" --
// used to reveal the backup section once it's live.
export function getInstalledFeatures(ref) {
  try {
    const raw = localStorage.getItem(INSTALLED_FEATURES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.ref !== ref) return { backup: false };
    return { backup: Boolean(parsed.backup) };
  } catch {
    return { backup: false };
  }
}

function markFeaturesInstalled(ref) {
  localStorage.setItem(INSTALLED_FEATURES_KEY, JSON.stringify({ ref, backup: true }));
}

export const BACKUP_STEPS = [
  "Setting up backup tables",
  "Creating a backup passphrase",
  "Deploying the backup function",
  "Deploying the image sync function",
];

const CONNECT_STEP = "Connecting the app to your project";

// Exported so the UI can render the full (pending) step list upfront,
// matching exactly what installCloudSync will report progress against.
export function getInstallSteps() {
  return [...BACKUP_STEPS, CONNECT_STEP];
}

function randomSecret() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

async function loadTemplate(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status}).`);
  return res.text();
}

async function callApi(path, token, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Request to ${path} failed.`);
  return data;
}

async function runSql(token, ref, sql) {
  return callApi("/api/cloud-sync-sql", token, { ref, sql, readOnly: false });
}

async function deployFunction(token, ref, { slug, verifyJwt, source }) {
  return callApi("/api/cloud-sync-deploy-function", token, { ref, slug, name: slug, verifyJwt, source });
}

async function setSecret(token, ref, name, value) {
  return callApi("/api/cloud-sync-secret", token, { ref, name, value });
}

async function fetchPublishableKey(token, ref) {
  const path = `/v1/projects/${ref}/api-keys?reveal=true`;
  const res = await fetch(`/api/supabase-management?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || "Couldn't read the project's API keys.");
  const publishable = Array.isArray(data) ? data.find((k) => k.type === "publishable") : null;
  if (!publishable?.api_key) throw new Error("Couldn't find a publishable API key on this project.");
  return publishable.api_key;
}

function backupSteps(token, ref) {
  const [dbLabel, passphraseLabel, fnLabel, imageFnLabel] = BACKUP_STEPS;
  return [
    {
      label: dbLabel,
      run: async () => {
        // Also creates the private "backup-images" Storage bucket that
        // image sync uploads into (see js/cloudImageSync.js) -- one more
        // statement in the same SQL file, not a separate step, since it's
        // just as much "setting up backup tables" as backup_records itself.
        const sql = await loadTemplate("/supabase/backup_schema.sql");
        await runSql(token, ref, sql);
      },
    },
    {
      label: passphraseLabel,
      run: async () => {
        // Reuse the existing passphrase on a reinstall rather than
        // generating a new one -- rotating it here would silently break
        // sync on every already-paired second device. Only ever generated
        // fresh the first time Cloud Backup is turned on for this project.
        let passphrase = getBackupPassphrase();
        if (!passphrase) {
          passphrase = randomSecret();
          setBackupPassphrase(passphrase);
        }
        await setSecret(token, ref, BACKUP_PASSPHRASE_NAME, passphrase);
      },
    },
    {
      label: fnLabel,
      run: async () => {
        const source = await loadTemplate("/supabase/functions/backup-sync/index.ts");
        // verify_jwt false -- the publishable key isn't JWT-shaped, so the
        // gateway's own JWT check would reject every real call; the
        // passphrase header check inside the function is the real access
        // control here.
        await deployFunction(token, ref, { slug: "backup-sync", verifyJwt: false, source });
      },
    },
    {
      label: imageFnLabel,
      run: async () => {
        const source = await loadTemplate("/supabase/functions/backup-image/index.ts");
        await deployFunction(token, ref, { slug: "backup-image", verifyJwt: false, source });
      },
    },
  ];
}

// onProgress(stepLabel, status) is called with status "running", "done", or
// "error" as each step starts/finishes, so the UI can show live checkmarks
// rather than one long spinner for what's actually several sequential
// requests.
export async function installCloudSync(onProgress) {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Not connected to Supabase.");
  const project = getSelectedProject();
  if (!project?.ref) throw new Error("No project selected.");
  const { ref } = project;

  const steps = [
    ...backupSteps(token, ref),
    {
      label: CONNECT_STEP,
      run: async () => {
        const anonKey = await fetchPublishableKey(token, ref);
        setApiConfig({ url: `https://${ref}.supabase.co`, anonKey, ref });
      },
    },
  ];

  for (const step of steps) {
    onProgress?.(step.label, "running");
    try {
      await step.run();
    } catch (err) {
      onProgress?.(step.label, "error", err.message || "Something went wrong.");
      throw err;
    }
    onProgress?.(step.label, "done");
  }

  markFeaturesInstalled(ref);
}
