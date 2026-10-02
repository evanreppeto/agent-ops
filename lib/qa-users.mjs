import { randomBytes } from "node:crypto";

// BSR production must never get a QA admin; Arc has one shared database, so only that one is allowed.
const BSR_PROD_REF = "tesgvrcgcyadownahujh";
const ARC_DB_REF = "qqbecyrhnowmooyjiztz";

/** Set KEY=value lines in a .env file's text, replacing existing keys and keeping everything else. */
export function mergeEnv(text, updates) {
  const pending = new Map(Object.entries(updates));
  const lines = text.split("\n").filter((line, i, all) => !(i === all.length - 1 && line === ""));
  const merged = lines.map((line) => {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (!key || !pending.has(key)) return line;
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of pending) merged.push(`${key}=${value}`);
  return merged.join("\n") + "\n";
}

export function newPassword() {
  return randomBytes(24).toString("base64url");
}

/** Throws unless the Supabase URL is a database this script may write QA users into. */
export function assertSafeTarget(appKey, url) {
  if (!url) throw new Error(`Supabase URL for ${appKey} is missing`);
  if (appKey === "bsr" && url.includes(BSR_PROD_REF)) {
    throw new Error("That is the BSR production database. Use the dev database's URL (from the dev/Preview env in Vercel).");
  }
  if (appKey === "arc" && !url.includes(ARC_DB_REF)) {
    throw new Error(`That is not Arc's database (expected ${ARC_DB_REF}.supabase.co).`);
  }
}
