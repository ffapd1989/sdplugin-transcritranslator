*Language: **English** · [Português](CLAUDE.pt-BR.md)*

# TranscriTranslator — guide for anyone touching the code

A Stream Deck plugin: one key records the microphone, transcribes it at OpenAI and pastes the
text into the focused field, optionally cleaning it up, translating it or rewriting it first.

This file is the **development** guide. For usage and configuration, see [README.md](README.md).

> **Read the section [Decisions that must not be reverted](#decisions-that-must-not-be-reverted)
> before touching `recorder.ts`, `openai.ts` or `canon.ts`.** Several choices in there look
> crooked and are the consequence of a measurement or of a production bug — including one from
> another project.

---

## Commands

```powershell
npm run check     # types (tsc --noEmit)
npm run test      # 240 assertions over the pure parts — no Stream Deck, no network, no microphone
npm run mic       # records 3 s from the real microphone and validates the core against the hardware
npm run build     # bundle -> com.felipe.transcritranslator.sdPlugin/bin/plugin.js
npm run watch     # automatic rebuild
npm run shots     # regenerates the README images from the real interface (needs Chrome)

streamdeck restart com.felipe.transcritranslator   # reloads it in the app
```

Normal working cycle: **bump** → `check` → `test` → `build` → `restart`. If you touched
`recorder.ts`, run `npm run mic` as well — it is the only test that exercises the real ffmpeg
command.

## RULE: every change bumps the version

Before committing any change, edit [version.json](version.json) — it is the **single source**:

```json
{ "version": "1.0.0.0", "date": "2026-07-25" }
```

Four digits, `a.b.c.d`, as Elgato's manifest requires. Bump the last one for a small fix, the
third for a behaviour change, the second for a new feature, the first for a major turn. Update
the `date` along with it — it shows in the panel footer.

`build.mjs` **syncs the manifest by itself** from that file and injects the values into the
bundle, so the panel version and the Stream Deck version cannot drift apart. It also refuses to
build if the format is not `a.b.c.d`.

### And the commit? Only when authorised

Bumping is automatic. **Committing and pushing are not.** Leave the change ready and verified,
say what is pending and wait for the go-ahead — or ask, when the change is significant enough
to justify the interruption.

The reason is about history, not security: ten fine-tuning commits are worse than one coherent
commit, and whoever has to live with the repository is the one who decides where the cuts go.

Initial setup (once): `npm install`, `render-images.ps1`, `streamdeck dev`,
`streamdeck link com.felipe.transcritranslator.sdPlugin`.

## RULE: documentation is bilingual — English and Portuguese

Every document exists twice: the English file is canonical and the Portuguese one sits next to
it with the `.pt-BR` suffix. **Both change in the same edit.** A `.pt-BR` file that lags behind
is worse than no translation at all, because it looks current.

The pairs are `README`, `CLAUDE`, `CONTRIBUTING`, `PRIVACY`, `SECURITY`, `CODE_OF_CONDUCT`,
`docs/README`, `docs/ROADMAP` and `docs/ORIGINAL-PLAN`. Adding a document means adding two, plus
a line in both `docs/README` files.

The tab strip GitHub shows above the repository page (*Readme*, *MIT license*, *Code of
conduct*, *Security*) only recognises fixed file names, so those tabs always open the English
side. That is a GitHub limitation, not a decision — the switch at the top of each page is what
carries a reader to the Portuguese one.

Code comments, commit messages and identifiers are in **English**. User-facing strings are a
different matter: they live in the i18n files and exist in all three languages (see the rule
further down). Portuguese strings carry **full diacritics** — `Configurações`, never
`Configuracoes`; if mojibake shows up on screen (`Ã§`, `Ã£`), the bug is in the encoding, and
you fix the encoding rather than dropping the accent.

---

## Architecture

```
press   → capture the focused process (UIAutomation, ~75 ms, in parallel)
        → ffmpeg dshow — 1 process, 2 simultaneous outputs
               ├─ MP3 16 kHz mono 48 kbps → %LOCALAPPDATA%\transcritranslator\audio\
               └─ level meter (RMS) over stderr → key waveform + auto-stop
        → stop: "q" on stdin
        → [step 1] POST /v1/audio/transcriptions
        → canonical dictionary regex
        → [step 2] POST /v1/chat/completions   (clean-up + style, in layers)
        → canonical dictionary regex
        → .md history → clipboard → paste if the focus has not changed
```

| File | Role |
|---|---|
| [src/plugin.ts](src/plugin.ts) | Boot: creates folders, kills orphan ffmpeg, warms the vault, connects |
| [src/actions/dictation.ts](src/actions/dictation.ts) | The key's state machine + bridge to the panel. This is the big file (~800 lines) |
| [src/lib/recorder.ts](src/lib/recorder.ts) | ffmpeg: lists microphones, records, measures level, detects silence |
| [src/lib/openai.ts](src/lib/openai.ts) | The two calls, retries, refusal detection, anti-echo |
| [src/lib/prompts.ts](src/lib/prompts.ts) | Layered composition of the system prompt |
| [src/lib/prompt-text.ts](src/lib/prompt-text.ts) | The **text** of the prompts in pt/en/es — this is what the AI reads |
| [src/lib/key-text.ts](src/lib/key-text.ts) | The **key's text** in pt/en/es — "sending", "no speech", "words" |
| [src/lib/preset-text.ts](src/lib/preset-text.ts) | Preset names and instructions in pt/en/es |
| [src/lib/presets.ts](src/lib/presets.ts) | Built-in moulds + saving/applying the user's own |
| [src/lib/canon.ts](src/lib/canon.ts) | Dictionary: 224-token budget + regex correction |
| [src/lib/deliver.ts](src/lib/deliver.ts) | Focus, clipboard, pasting, history |
| [src/lib/sessions.ts](src/lib/sessions.ts) | Global key state, single-recording lock, orphan PIDs |
| [src/lib/shortcuts.ts](src/lib/shortcuts.ts) | Nickname → key, so the keyboard shortcut can reach an off-screen key |
| [src/lib/icons.ts](src/lib/icons.ts) | The key drawn in SVG (icons, waveform, badges) |
| [src/lib/settings.ts](src/lib/settings.ts) | Types, defaults and the language resolution cascade |
| [src/lib/vault.ts](src/lib/vault.ts) | DPAPI vault for the OpenAI key |
| [src/lib/theme.ts](src/lib/theme.ts), [beep.ts](src/lib/beep.ts), [paths.ts](src/lib/paths.ts) | Derived colours, beeps via ffplay, paths |
| [`…sdPlugin/ui/dictation.html`](com.felipe.transcritranslator.sdPlugin/ui/dictation.html) | The whole panel: hand-written HTML+CSS+JS, no external dependency |
| [`…sdPlugin/ui/i18n.js`](com.felipe.transcritranslator.sdPlugin/ui/i18n.js) | **Interface** text in pt/en/es — this is what the user reads |
| [tools/screenshots.ts](tools/screenshots.ts) | Draws `docs/img/*.png` from the real key and the real panel |

### The three language axes

They are not the same thing and they do not have to agree:

| Axis | Where it lives | Resolves to |
|---|---|---|
| Panel (what **you** read) | `GlobalSettings.uiLang` | `resolveUiLocale()` → Stream Deck app |
| Presets and prompts (what the **AI** reads) | `GlobalSettings.contentLang` | `resolveContentLocale()` → spoken language → panel → app |
| Spoken language (per key) | `ActionSettings.language` | goes straight into the API's `language` parameter |

Interface text lives in `ui/i18n.js`; text the AI reads lives in `src/lib/prompt-text.ts` and
`preset-text.ts`; text that shows up **on the key** lives in `src/lib/key-text.ts`. **Never
duplicate a phrase between them** — the panel receives from the plugin whatever has already
been resolved.

The key follows the **panel's** language (`uiLang`), not the spoken one: whoever looks at the
key is whoever configured the plugin. The `uiLocaleCache` in `dictation.ts` holds that language
because the key is redrawn at 8 fps — one `getGlobalSettings()` per frame would be absurd. It
is updated on `willAppear`, on the panel's `init` and after every `setGlobal`.

### RULE: everything that is text must exist in all three languages

The plugin is publishable on Elgato's store, so **there is no "Portuguese only"**. When you add
any text, all three (`pt`, `en`, `es`) go in the same change:

| If you add… | You have to touch |
|---|---|
| A panel label, hint or button | `ui/i18n.js` — all three blocks |
| A rule in the clean-up layer, a lock, a translation instruction | `src/lib/prompt-text.ts` — all three blocks |
| A built-in preset (name or instruction) | `src/lib/preset-text.ts` — all three blocks |
| A word that shows up **on the key** (state, warning, error) | `src/lib/key-text.ts` — all three blocks |
| A language name | **nothing** — it comes from `Intl.DisplayNames` |
| A new translation target language | **only the code** in `TARGET_CODES` — name and ordering come from `Intl` |

Two quick checks before committing:

```bash
# key parity across the panel languages
node -e "global.window={};require('./com.felipe.transcritranslator.sdPlugin/ui/i18n.js');
const I=global.window.TT_I18N,b=Object.keys(I.pt);
for(const l of ['pt','en','es']){const m=b.filter(k=>!(k in I[l]));
console.log(l, m.length?('MISSING '+m):'complete')}"

npm run test   # covers prompts and presets in all three languages
```

That parity check compares `en` and `es` AGAINST `pt`, so a key missing from **all three**
walks straight past it — `applyLang()` keeps whatever the HTML says and the panel shows
Portuguese inside an English interface. That is how the `copy` key on the *Copy address* button
went unnoticed until a screenshot caught it. `npm run test` now reads `dictation.html`, collects
every `data-i18n`, `data-i18n-ph` and `data-i18n-title`, and fails if any of them is missing in
any language.

**Language names are not translated by hand.** `src/lib/languages.ts` uses `Intl.DisplayNames`
— verified: the Stream Deck's Node has full ICU. There are two forms: `languageName()` returns
lowercase so it fits inside the prompt sentence ("Translate the text into english");
`languageLabel()` returns it capitalised for the panel list ("English"). English writes
language names capitalised and Portuguese/Spanish in lowercase — `Intl` already delivers the
right form for each.

---

## Decisions that must not be reverted

Each one cost a measurement or a bug. If you are going to change it, measure again first.

**1. The level meter comes out of ffmpeg's stderr, not stdout.** Measured on this machine:

| Output | First sample |
|---|---|
| `ametadata … file=-` (stdout) | **4519 ms**, all at once at the end |
| `ametadata` with no `file` (log → stderr) | **373 ms**, continuous stream |

stdout goes through `avio`, which buffers. Over stdout the key would only turn "recording"
after 4.5 s and the first words of every dictation would be lost. That is why `-loglevel` is
`info` and the parser separates sample from noise in `onMeter()`.

**2. Speech and silence thresholds are relative to the noise floor, not absolute.** The FIFINE
measures −80 dBFS in silence and the CORSAIR headset −96 dBFS. A fixed threshold ("−34 dB is
speech") works on one microphone and reports "no speech" on *every* dictation with the other.

**3. Stopping is `q` on stdin, never `taskkill`.** It is the `q` that closes the MP3 properly.

**4. MP3, not m4a/opus.** A pure stream, with no *moov atom* to finalise: if the process dies
halfway, what was recorded is still valid. And it is a format the API officially accepts.

**5. Anti-echo.** The GPT-4o models return the `prompt` itself as if it were the transcription
when the audio is short or silent — behaviour the FALA TU project suffered in production. Since
the dictionary goes into the prompt, without a defence an accidental tap would paste the list of
acronyms into the document. Three barriers: audio under 0.8 s or with no speech is not sent; a
return that resembles the prompt too closely is discarded; auto-stop on silence avoids recording
nothing.

**6. Canonical spelling is guaranteed by regex, not by the model.** Deterministic, with no size
limit and no cost. The transcription prompt only *improves the odds* of hearing it right. And
JS's `\b` does **not** recognise accented letters — the word boundary uses
`(?<![\p{L}\p{N}])…`.

**7. The key goes in the DPAPI vault, never in the Stream Deck settings** — those become a
plain-text `.json` under `%APPDATA%\Elgato`.

**8. The text step's prompt changes language along with the speech.** The clean-up layer relies
on examples from the spoken language ("vírgula", "né" / "comma", "um"). OpenAI's docs reinforce
it: *"The prompt should match the audio language."*

**9. Recording state lives in `sessions.ts`, outside the action instance.** The SDK fires
`willDisappear` when you switch page or profile; inside the instance, the dictation would die
with it.

**10. Each icon is drawn ONCE, and both modes come out of it.** In `icons.ts` an icon is a list
of shapes with roles (`body`, `ink`, `cut`, `cutfill`, `fill`, `slash`). The `neon` style
renders that list as an outline; `aurora` and `ring` render it as a filled silhouette. If
someone one day "simplifies" this by writing two sets of glyphs, the two will diverge the
following month. Every icon lives on the 32×32 grid centred at (36,28) — there is a test that
fails on any coordinate outside it.

**11. The shrunken stroke is compensated by `1/√k`, not by `1/k`.** Measured: with a three-line
label the glyph drops to `k ≈ 0.4` and a 3.1 px stroke becomes 1.2 px and disappears.
Compensating in full — which is what `vector-effect="non-scaling-stroke"` does — gives back
3.1 px and the glyph turns into a blob, because on a drawing at 40% that is proportionally
enormous. The square root sits in the middle. **Do not swap it for `non-scaling-stroke`:** it
has already been evaluated and it is the wrong answer, not the easy one.

**12. No `<filter>` in the key's SVG.** Glow and halo are gradients — the same mechanism the key
has always used and that we know the Stream Deck renderer accepts. The `neon` halo is three
passes of the same outline (wide and faint, medium in the colour, white hairline). Real blur
only goes in if someone validates it on the physical device first.

**13. The key preview in the panel uses the SAME function that draws the key.** `idleImage()` is
called by `render()` and by the `keyPreview` command. If the preview is ever reimplemented in
HTML "to make it faster", it starts lying the next day, and a preview that lies is worse than no
preview. The settings travel **in the panel's message**, they are not read from `getSettings()`:
the panel saves with a 150 ms delay and the preview would always show the second-to-last
character typed.

**14. On the key, the text owns the space and the icon gives way.** With a two- or three-line
label the glyph shrinks and moves up (`<g transform="…scale(…)">` in `keyImage`). Without that,
"Attendance report" prints its lines **on top of** the microphone. There is a test locking down
the non-overlap; if you touch the key layout, render it and look — the test guarantees the
geometry, not the aesthetics.

---

**15. Dictation does not need a key on screen — the `Surface` is what matters.** The SDK only
hands over the **visible** actions (`SingletonAction.actions` is literally *"the visible
actions"*), and the keyboard shortcut exists precisely so you can trigger the key on page 5
while standing on page 1. That is why the pipeline receives a `Surface` (id, `getSettings`,
`setImage`), which both a real `KeyAction` and the borrowed surface satisfy. The borrowed one
reads from a copy kept in `shortcuts.ts` and draws on **any** visible key of the plugin —
preferring the owner, if it happens to be showing. If there is none, dictation runs with no
display and the beeps do the job. **Do not swap this for "look the key up in the SDK":** it is
not there, and that is the whole reason the little notebook exists.

**16. The shortcut nickname is the switch on the outside door.** Any program on the machine can
fire a `streamdeck://` URL. A key with no nickname is unreachable, and the field starts out
empty — exposure is always a conscious act, one key at a time. Do not add a separate "allow
external triggering" toggle: that would be two switches on the same door, and one of them would
end up lying.

**17. Keyboard triggering is always toggle.** The message from Windows is a pulse; there is no
"shortcut released". A key configured as *hold to talk* runs as a toggle when the trigger comes
from the keyboard, instead of refusing — refusing would punish the person for a limitation of
the transport.

## Product decisions (settled with the user)

These are not implementation accidents — they were chosen explicitly:

- Switching pages on the Stream Deck does **not** interrupt a recording.
- **One recording at a time** on the machine; the second key blinks "busy".
- Focus changed between recording and delivery → **do not paste**, only copy and warn.
- Refusal on content policy → **deliver the raw transcription** rather than lose the speech.
- API failure → 2 retries on transient errors only, and the **audio is preserved**.
- Holding the key during recording cancels; the `RELEASE TO CANCEL` warning appears *before*
  the action.
- Presets are **moulds**: applying one copies values, the key stays independent afterwards.
- Cost is **not** tracked.
- The plugin is **general-purpose** — no domain-specific content baked in. The dictionary and
  the style field start out empty.

The full history of these decisions is in the plan at
[docs/ORIGINAL-PLAN.md](docs/ORIGINAL-PLAN.md).

---

## Environment traps

- **TC39 decorators.** The SDK v2 `@action` requires TC39 decorators — do **not** enable
  `experimentalDecorators` in the tsconfig.
- **The `createRequire` banner in [build.mjs](build.mjs).** The SDK's `ws` library uses
  `require()` on builtins; without the banner, the ESM bundle breaks at runtime.
- **The plugin runs on the Stream Deck's Node 20**, not the system Node
  (`%APPDATA%\Elgato\StreamDeck\NodeJS\20.x\node.exe`). `File`, `FormData`, `fetch` and
  `AbortSignal.timeout` exist there — already verified — but a newer API may not.
- **`streamDeck.ui.sendToPropertyInspector(...)`** is what talks to the panel, not the action
  object.
- **PowerShell and negative numbers:** `Mix-Channel $r -0.42` makes the parser read `-0.42` as a
  parameter name. Always in parentheses: `(Mix-Channel $r (-0.42))`.
- **Full Portuguese diacritics** in Portuguese prompts and interface strings. The prompts go to
  the API in correct Portuguese — not in ASCII.
- **The keyboard shortcut REPEATS while the key is held down.** Measured: PowerToys fires the
  action on every keyboard auto-repeat, ~30 ms apart — a slightly long press turned into 28
  messages and eight simultaneous recordings from the same microphone. That is why `onDeepLink`
  has two **synchronous** locks (a 600 ms window per nickname and a reentrancy bolt) before any
  `await`. Do not move those locks to after an `await`: the burst comes in precisely during the
  wait.
- **The key is slow to reflect a new build.** After `streamdeck restart`, the image on the
  physical key may stay the old one for a few seconds. This has already cost one wrong
  diagnosis: a clipped label looked like a layout bug and was just the old drawing still on
  screen. Before going off to investigate, confirm by generating the SVG directly
  (`keyImage(...)` in a script) and comparing it with what the key shows — if they differ, it is
  cache, not code.

---

## How to test

**`npm run test`** covers what is pure: dictionary, token budget, anti-echo, prompt composition
in all three languages, the language cascade, the key SVG, defaults. Runs in ~1 s.

**`npm run mic`** exercises the hardware: lists devices, records 3 s, and reports confirmation
latency, sample rate, peak in dBFS and whether the MP3 came out valid. It is the test that
catches regressions in the ffmpeg command.

**The panel can be rendered without the Stream Deck**, and it is worth doing before touching the
layout: copy `ui/i18n.js` and `ui/dictation.html` into a temporary folder, inject a `<script>`
before `</body>` that calls `handlePlugin({event:"init", …})` with fake data, and run

```bash
chrome --headless --disable-gpu --force-device-scale-factor=2 \
  --window-size=360,1500 --virtual-time-budget=2500 \
  --screenshot=out.png "file:///…/preview.html"
```

To check overflow at the panel's real width (340 px), inject
`<style>html,body{width:340px}</style>` and read `document.body.scrollWidth` via `--dump-dom`
with the value written into `document.title`. That is how we found out the panel died entirely
when `i18n.js` was missing.

**The README images are generated, never hand-made.** `npm run shots` runs
[tools/screenshots.ts](tools/screenshots.ts): the key strip comes out of `keyImage()`, the same
function the physical key uses, and the panel shots are the real `ui/dictation.html` fed the
same payloads the plugin sends over `sendToPropertyInspector`. Change the interface, run it
again. A screenshot taken by hand starts lying the next day, and nobody notices.

Two traps in there, both already handled, both worth knowing if you touch that file: headless
Chrome refuses to make a window narrower than ~500 px (so the width is pinned in the document
and the height is read back from the page), and the panel wires its buttons on
`DOMContentLoaded` (so the injected script has to wait for it, or every click is a no-op).

**None of this replaces testing on the physical key.** A passing build does not prove the
waveform moves.

---

## State

**The main path works** — validated with real speech on 25/07/2026 (v1.0.1.1): record,
transcribe and paste, end to end.

On 26/07/2026 (v1.1.0.0) four roadmap items landed: an OpenAI key you can paste inside the help
modal itself, 28 target languages (there were 12), a two-line confirmation with the big number,
and a **live key preview in the panel** — that last one shortens the appearance-tuning cycle a
lot, because it takes the physical Stream Deck out of the loop. Along with it came the
translation of all the key's text into the three languages (`key-text.ts`).

In v1.2.0.0, the same day, the **visual turn** (roadmap 2.1 and 2.4): near-black background,
colour only on what carries information, **three directions selectable per key** (`neon`,
`aurora`, `ring`) and the icon set going from 5 to 18. Eight proposals were drawn and compared
before the final code was written — the sheets are in [docs/estilos/](docs/estilos/), and they
are worth opening before proposing a ninth. Choosing an icon and a style is now a grid of
thumbnails, not a `<select>`.

In v1.3.0.0 (27/07/2026) the **keyboard shortcut** landed: a
`streamdeck://plugins/message/<uuid>/dictate?key=<nickname>&streamdeck=hidden` URL triggers the
key even when it sits on another page of the deck. Measured on this machine: **434 ms** between
firing the URL and the plugin receiving it, and passive mode (`streamdeck=hidden`) **does not
steal focus** — verified by comparing the focused window before and after, which is the
condition for the text to be pasted in the right place.

**None of this has been seen on the physical key yet** — only in the headless render.

What is missing are the **edge cases**, which normal use does not exercise and which fail
silently: switching windows during processing, switching pages on the XL during a recording, and
the anti-echo shielding (press and stop without speaking). Full list in
[docs/ROADMAP.md](docs/ROADMAP.md) item 0; detailed script in
[docs/ORIGINAL-PLAN.md](docs/ORIGINAL-PLAN.md), section *Verification*.

What comes next is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Out of scope (phase 2)

Transcribing an existing audio file · capturing system audio for meetings · streaming the
transcription · a global shortcut without the Stream Deck · a resend queue for audio that failed
· cost tracking.
