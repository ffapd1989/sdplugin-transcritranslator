*Language: **English** · [Português](CONTRIBUTING.pt-BR.md)*

# Contributing

Pull requests are welcome. This page is the short version; the long one — architecture, traps
and the decisions that must not be reverted — is in [CLAUDE.md](CLAUDE.md), and it is worth
reading before touching `recorder.ts`, `openai.ts` or `canon.ts`.

## Getting it running

```powershell
git clone https://github.com/ffapd1989/sdplugin-transcritranslator.git
cd sdplugin-transcritranslator
npm install
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\render-images.ps1

streamdeck dev                                        # once, enables local plugins
streamdeck link com.felipe.transcritranslator.sdPlugin
streamdeck restart com.felipe.transcritranslator
```

You need Windows, the Stream Deck app 7.1+, ffmpeg on the PATH and Node 24+. An OpenAI key is
only needed to exercise the network path; everything else runs without one.

## The working cycle

```powershell
npm run check     # types
npm run test      # 240 assertions, no Stream Deck, no network, no microphone
npm run build
streamdeck restart com.felipe.transcritranslator
```

If you touched `recorder.ts`, run `npm run mic` as well — it is the only test that exercises the
real ffmpeg command, and it needs a microphone. If you touched the interface, run `npm run shots`
so the images in the README stop being out of date.

## Four rules that are not negotiable

**1. Every change bumps the version.** [version.json](version.json) is the single source; the
build syncs the manifest from it. Last digit for a small fix, third for a behaviour change,
second for a new feature, first for a major turn. Update the `date` along with it.

**2. Every user-facing string exists in three languages.** The plugin is meant for the Elgato
store, so there is no "English only". A panel label goes in `ui/i18n.js`, a prompt rule in
`src/lib/prompt-text.ts`, a preset name in `src/lib/preset-text.ts`, a word on the key in
`src/lib/key-text.ts` — always in the `pt`, `en` and `es` blocks of the same file. `npm run test`
fails if the panel asks for a key that some language does not have.

**3. Documentation is bilingual.** The English file is canonical and the Portuguese one sits next
to it with the `.pt-BR` suffix. Both change in the same commit. A `.pt-BR` that lags behind is
worse than no translation, because it looks current.

**4. Code, comments and commit messages are in English.** Identifiers too. The exception is
Portuguese *content* — prompts, interface strings — which keeps full diacritics: `Configurações`,
never `Configuracoes`. Mojibake on screen (`Ã§`, `Ã£`) is an encoding bug; fix the encoding, do
not drop the accent.

## Before opening a pull request

- `npm run check` and `npm run test` pass.
- The change is visible on a physical key, or you say plainly that you could not test it there.
  A passing build does not prove the waveform moves.
- If you changed something in *Decisions that must not be reverted* ([CLAUDE.md](CLAUDE.md)),
  say why in the pull request. Each of those cost a measurement or a production bug, so the bar
  is a new measurement, not a preference.

## Reporting a bug

Open an issue with what you did, what you expected and what happened. For anything involving the
plugin's behaviour, the log is worth its weight:

```
%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log
```

Search for `com.felipe.transcritranslator`. Please scrub anything you dictated before pasting it
— the log does not carry transcriptions, but your description of the bug might.

Security issues do not go in an issue: see [SECURITY.md](SECURITY.md).
