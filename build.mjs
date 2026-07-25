// Bundle do plugin. O banner injeta um `require` (createRequire) porque a lib `ws`
// (WebSocket do SDK) usa require() de builtins e o esbuild em ESM não suporta
// require dinâmico sem esse shim. Mesmo padrão já validado no plugin da VPN.
//
// O build também é o guardião da VERSÃO: version.json é a fonte única, e daqui ela
// vai para o bundle E para o manifest. Assim não existe a possibilidade de o painel
// dizer uma versão e o Stream Deck mostrar outra.

import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

const VERSION_FILE = "version.json";
const MANIFEST_FILE = "com.felipe.transcritranslator.sdPlugin/manifest.json";

const { version, date } = JSON.parse(readFileSync(VERSION_FILE, "utf8"));

// O manifest da Elgato exige quatro dígitos (a.b.c.d).
if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`version.json: "${version}" não está no formato a.b.c.d`);
}

const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
if (manifest.Version !== version) {
  manifest.Version = version;
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`manifest sincronizado para ${version}`);
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
