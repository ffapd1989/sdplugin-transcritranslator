// Plugin entry point.
//
// Boot does three things before connecting, and all three exist to take weight off
// the hot path of dictation:
//   1. creates the working folders;
//   2. kills orphan ffmpeg processes left by a previous abrupt shutdown;
//   3. warms the key cache (reading the DPAPI vault costs one powershell —
//      paying that at boot is invisible; paying it mid-dictation is not).

import streamDeck from "@elgato/streamdeck";

import { Dictation } from "./actions/dictation.js";
import { findFfmpeg } from "./lib/ffmpeg.js";
import { ensureDirs } from "./lib/paths.js";
import type { GlobalSettings } from "./lib/settings.js";
import { cleanupOrphans, killAll } from "./lib/sessions.js";
import { loadShortcuts } from "./lib/shortcuts.js";
import { getApiKey } from "./lib/vault.js";

streamDeck.logger.setLevel("info");

try {
  await ensureDirs();
  await cleanupOrphans();
  // Keyboard shortcut nicknames: without this, a shortcut pointing at a key that has not
  // shown up in this session would have nothing to refer to.
  await loadShortcuts();
} catch (err) {
  streamDeck.logger.warn("boot: environment setup failed", err);
}

void getApiKey().catch(() => {});

streamDeck.actions.registerAction(new Dictation());
await streamDeck.connect();

// Where ffmpeg lives is only known after connecting — the configured path is a global
// setting. Searching now keeps the first press from paying for it.
void streamDeck.settings
  .getGlobalSettings<GlobalSettings>()
  .then((g) => findFfmpeg(g?.ffmpegPath))
  .catch(() => {});

// Do not leave ffmpeg alive if the plugin process is shut down.
for (const sig of ["exit", "SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => killAll());
}
