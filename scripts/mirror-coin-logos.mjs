// One-time mirror of coinpaprika coin logos into our Supabase Storage.
//
// Context: static.coinpaprika.com enabled hotlink protection (403 without
// a coinpaprika.com referer), which broke every proxied logo. This script
// fetches each coin's logo WITH the referer workaround — the only place
// that workaround is allowed — and stores it in the `token-logos` bucket
// under `paprika-<id>`, so /api/logo/[id] can serve from our own storage
// forever and never depend on their CDN again.
//
//   node scripts/mirror-coin-logos.mjs            # mirror all missing
//   node scripts/mirror-coin-logos.mjs --force    # re-mirror everything
//
// Resumable: skips logos already in the bucket (HEAD on the public URL).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = "token-logos";
// Low concurrency: Supabase Storage uploads hit the project's Postgres
// connection pool; 8-wide tripped "Too many connections" on free tier.
const CONCURRENCY = 3;
/** Only the coins the site actually serves (top window by rank). */
const MAX_COINS = 2000;
const FORCE = process.argv.includes("--force");

const MIRROR_HEADERS = {
  // Hotlink-protection bypass — one-time mirroring only, never live serving.
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Referer: "https://coinpaprika.com/",
};

async function listPaprikaIds() {
  const ids = [];
  for (let from = 0; ids.length < MAX_COINS; from += 1000) {
    const { data, error } = await sb
      .from("coins")
      .select("id,source")
      .order("rank", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data) {
      // Coinpaprika ids are "<sym>-<name>"; pinned/dex coins are excluded.
      if ((r.source === "binance" || r.source == null) && r.id.includes("-")) {
        ids.push(r.id);
        if (ids.length >= MAX_COINS) break;
      }
    }
    if (!data || data.length < 1000) break;
  }
  return ids;
}

async function alreadyMirrored(id) {
  if (FORCE) return false;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(`paprika-${id}`);
  try {
    const res = await fetch(data.publicUrl, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function mirrorOne(id) {
  if (await alreadyMirrored(id)) return "skipped";
  let res;
  try {
    res = await fetch(`https://static.coinpaprika.com/coin/${id}/logo.png`, {
      headers: MIRROR_HEADERS,
    });
  } catch {
    return "fetch-error";
  }
  if (res.status === 404) return "no-logo";
  if (!res.ok) return `upstream-${res.status}`;
  const contentType = res.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) return "not-image";
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) return "empty";
  // Retry uploads: the storage API can transiently refuse under pool
  // pressure ("Too many connections issued to the database").
  for (let attempt = 1; attempt <= 4; attempt++) {
    const up = await sb.storage
      .from(BUCKET)
      .upload(`paprika-${id}`, bytes, { contentType, upsert: true });
    if (!up.error) return "mirrored";
    if (attempt === 4) return `upload-error:${up.error.message}`;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  return "upload-error:unreachable";
}

const ids = await listPaprikaIds();
console.log(`coins to process: ${ids.length}`);
const tally = {};
let done = 0;
const queue = [...ids];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const result = await mirrorOne(id);
      tally[result] = (tally[result] ?? 0) + 1;
      if (!["mirrored", "skipped", "no-logo"].includes(result)) {
        console.log(`  ! ${id}: ${result}`);
      }
      done += 1;
      if (done % 250 === 0) console.log(`  …${done}/${ids.length}`);
    }
  })
);
console.log("tally:", JSON.stringify(tally));
