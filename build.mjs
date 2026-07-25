// Bundle do plugin. O banner injeta um `require` (createRequire) porque a lib `ws`
// (WebSocket do SDK) usa require() de builtins e o esbuild em ESM nao suporta
// require dinamico sem esse shim. Mesmo padrao ja validado no plugin da VPN.
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "com.felipe.transcritranslator.sdPlugin/bin/plugin.js",
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
  console.log("build ok");
}
