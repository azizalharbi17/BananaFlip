// Trigger /api/cron/trending by hand and print the resulting set — the
// same call Vercel Cron makes on its schedule (vercel.json).
//
//   node scripts/run-trending-cron.mjs                       # production
//   node scripts/run-trending-cron.mjs http://localhost:3000 # local dev
//
// Reads CRON_SECRET from the environment, else from .env.local.

import { existsSync, readFileSync } from "fs";

const origin = (process.argv[2] ?? "https://www.bananaflip.io").replace(/\/+$/, "");

let secret = process.env.CRON_SECRET;
if (!secret && existsSync(".env.local")) {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
  secret = env.CRON_SECRET;
}
if (!secret) {
  console.error("CRON_SECRET is not set (environment or .env.local)");
  process.exit(1);
}

const res = await fetch(`${origin}/api/cron/trending`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const body = await res.json().catch(() => ({}));
console.log(`${res.status} ${res.statusText}`);

if (Array.isArray(body.trending)) {
  const fmt = (v) =>
    v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString("en-US")}`;
  for (const t of body.trending) {
    console.log(
      `${String(t.rank).padStart(2)}  ${t.symbol.padEnd(10)} ${t.chain.padEnd(9)} cap ${fmt(t.marketCap).padStart(9)}  liq ${fmt(t.liquidityUsd ?? 0).padStart(9)}  vol24h ${fmt(t.volume24hUsd ?? 0).padStart(9)}  ${t.logo ?? "(no logo)"}`
    );
  }
}
const { trending, ...rest } = body;
console.log(JSON.stringify(rest, null, 2));
