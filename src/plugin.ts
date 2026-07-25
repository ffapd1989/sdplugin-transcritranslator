// Entrada do plugin.
//
// O boot faz tres coisas antes de conectar, e as tres existem para tirar peso do
// caminho quente do ditado:
//   1. cria as pastas de trabalho;
//   2. mata ffmpeg orfao de um encerramento abrupto anterior;
//   3. aquece o cache da chave (a leitura do cofre DPAPI custa um powershell —
//      pagar isso no boot e' invisivel; pagar no meio do ditado, nao).

import streamDeck from "@elgato/streamdeck";

import { Dictation } from "./actions/dictation.js";
import { ensureDirs } from "./lib/paths.js";
import { cleanupOrphans, killAll } from "./lib/sessions.js";
import { getApiKey } from "./lib/vault.js";

streamDeck.logger.setLevel("info");

try {
  await ensureDirs();
  await cleanupOrphans();
} catch (err) {
  streamDeck.logger.warn("boot: preparo do ambiente falhou", err);
}

void getApiKey().catch(() => {});

streamDeck.actions.registerAction(new Dictation());
await streamDeck.connect();

// Nao deixar ffmpeg vivo se o processo do plugin for encerrado.
for (const sig of ["exit", "SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => killAll());
}
