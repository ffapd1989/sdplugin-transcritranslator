// The plugin bundle. The banner injects a `require` (createRequire) because the `ws`
// library (the SDK's WebSocket) uses require() on builtins and esbuild in ESM does not
// support dynamic require without that shim. The same pattern already validated in the
// VPN plugin.
//
// The build is also the guardian of the VERSION: version.json is the single source, and
// from here it goes into the bundle AND into the manifest. That way there is no chance of
// the panel claiming one version while the Stream Deck shows another.

import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

const VERSION_FILE = "version.json";
const MANIFEST_FILE = "com.felipe.transcritranslator.sdPlugin/manifest.json";

const { version, date } = JSON.parse(readFileSync(VERSION_FILE, "utf8"));

// Elgato's manifest requires four digits (a.b.c.d).
if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`version.json: "${version}" is not in a.b.c.d format`);
}

const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
if (manifest.Version !== version) {
  manifest.Version = version;
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`manifest synced to ${version}`);
}

const options = {
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "com.felipe.transcritranslator.sdPlugin/bin/plugin.js",
  define: {
    __TT_VERSION__: JSON.stringify(version),
    __TT_DATE__: JSON.stringify(date),
  },
  banner: {
    js: "import{createRequire as ___cr}from'node:module';const require=___cr(import.meta.url);",
  },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching...");
} else {
  await esbuild.build(options);
  console.log(`build ok — v${version} (${date})`);
}
