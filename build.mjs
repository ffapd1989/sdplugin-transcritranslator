// The plugin bundle. The banner injects a `require` (createRequire) because the `ws`
// library (the SDK's WebSocket) uses require() on builtins and esbuild in ESM does not
// support dynamic require without that shim. The same pattern already validated in the
// VPN plugin.
//
// The build is also the guardian of the VERSION: version.json is the single source, and
// from here it goes into the bundle AND into the manifest. That way there is no chance of
// the panel claiming one version while the Stream Deck shows another.

import * as esbuild from "esbuild";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const watch = process.argv.includes("--watch");

const VERSION_FILE = "version.json";
const MANIFEST_FILE = "com.felipe.transcritranslator.sdPlugin/manifest.json";
const NOTICES_FILE = "com.felipe.transcritranslator.sdPlugin/THIRD-PARTY-NOTICES.txt";

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
  const result = await esbuild.build({ ...options, metafile: true });
  writeNotices(result.metafile);
  console.log(`build ok — v${version} (${date})`);
}

// The bundle carries other people's MIT code, and MIT asks for its notice to travel with
// it. The list comes from what esbuild actually bundled, so a new dependency cannot be
// left out of it.
function writeNotices(metafile) {
  const dirs = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const pkgDir = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input)?.[1];
    if (pkgDir) dirs.add(pkgDir);
  }
  const blocks = [...dirs].sort().map((dir) => {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const licenseFile = readdirSync(dir).find((name) => /^licen[cs]e/i.test(name));
    // Some packages ship their LICENSE with CRLF; the repository is LF.
    const text = licenseFile
      ? readFileSync(join(dir, licenseFile), "utf8").replace(/\r\n/g, "\n").trim()
      : `License: ${pkg.license}`;
    return `${pkg.name} ${pkg.version} (${pkg.license})\n\n${text}`;
  });
  const rule = `\n\n${"-".repeat(72)}\n\n`;
  writeFileSync(NOTICES_FILE, `This plugin bundles the following packages.${rule}${blocks.join(rule)}\n`, "utf8");
}
