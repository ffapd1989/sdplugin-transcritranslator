*Language: **English** · [Português](README.pt-BR.md)*

# TranscriTranslator — voice dictation on the Stream Deck

One Stream Deck key becomes a dictation microphone: **press, speak, press again**, and the
text shows up in the field you were typing into — transcribed by OpenAI and, if you want it,
already cleaned up, translated or rewritten in the tone you defined.

It is a **general-purpose** plugin. It ships with no vocabulary and no domain prompts: whatever
belongs to your line of work comes in through your dictionary and your presets.

```
┌────────┐   press   ┌────────┐   press   ┌────────┐        ┌────────┐
│   ▂▄▆   │  ──────>  │ ▁▃▅█▆▃▁ │  ──────>  │   ▚▚    │ ─────> │   ✓    │
│   ███   │           │ ▁▃▅█▆▃▁ │           │         │        │  142   │
│ Dictate │           │  0:07   │           │ sending │        │ words  │
└────────┘           └────────┘           └────────┘        └────────┘
   idle                recording            sending           pasted
```

## Installation

Prerequisites: **Node 24+**, the **Stream Deck 6.5+** app, **ffmpeg** on the PATH (the
`ffmpeg full build` includes `ffplay`, used for the beeps) and an **OpenAI API key**.

```powershell
cd path\to\TRANSCRITRANSLATOR
npm install
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\render-images.ps1

streamdeck dev                                        # once, enables local plugins
streamdeck link com.felipe.transcritranslator.sdPlugin
streamdeck restart com.felipe.transcritranslator
```

In the Stream Deck app, drag **Dictate** (category *TranscriTranslator*) onto a key. Open the
**Machine settings** section in the property inspector and paste your OpenAI key — this is done
**once** and applies to every key.

## How to use it

| Action | What it does |
|---|---|
| Tap | Starts recording. The key turns red and the bars show your voice |
| Tap again | Stops, transcribes and pastes |
| **Hold ~1 s while recording** | **Cancels** and discards, spending no API |
| Hold while sending | Aborts the call in flight |

Staying quiet for ~10 s also ends the recording on its own (configurable from 2.5 to 30 s). In
**hold-to-talk** mode the key records while your finger is down and stops when you release it.

## Presets

Every key is independent. Presets are **moulds**: applying one copies the values into the key,
which goes its own way from then on. Save your own with *Save as…* — they land in
`%LOCALAPPDATA%\transcritranslator\presets.json` and can be carried to another machine.

| Preset | Records? | What it does with the text |
|---|---|---|
| Raw dictation | yes | nothing — pastes exactly what was transcribed |
| **Clean dictation** (default) | yes | punctuates and cleans up the speech, without swapping your words |
| Translate → English | yes | cleans up and translates (`EN` badge on the key) |
| Translate → Spanish | yes | cleans up and translates (`ES` badge on the key) |
| Translate → Portuguese | yes | to capture a foreign passage in your own language |
| Formal email | yes | cleans up and rewrites as an email |
| Bullet points | yes | cleans up and organises into bullets |
| Proofread selection only | **no** | grabs the selected text (Ctrl+C) and proofreads it in place |

## The two steps

The property inspector presents the key as a two-step path, because that is what it is:

```
1. LISTEN         your voice becomes text     [audio model]
        ↓
2. WRITE          the text becomes other text [language model]
```

Two different models, because these are two different jobs: one listens to audio, the other
writes. **Translating is the second one's job** — the first only knows how to transcribe what
was said, in the language it was said in. Each step switches on and off independently, and that
is where the useful combinations come from:

| 1. Listen | 2. Write | Result |
|---|---|---|
| ✅ | ❌ | raw dictation, faster and cheaper |
| ✅ | clean-up | clean dictation — same words, tidy writing |
| ✅ | clean-up + translation | you speak Portuguese, English comes out |
| ✅ | clean-up + instruction | formalised, in bullets, in whatever tone you asked for |
| ❌ | anything | rewrites whatever is selected, **recording nothing** |

**Dictation clean-up** punctuates, removes hesitations ("um", "like"), honours the speaker's
self-corrections ("send it to John, *I mean*, to Mary" → "send it to Mary"), converts spoken
commands ("comma", "new paragraph") and formats numbers and dates. It does **not** swap your
words and it does not summarise.

Translating **requires no prompt writing**: tick *Translate into another language*, pick the
language from the list, and the key starts showing the code in the corner (`EN`, `ES`). The
instruction is assembled underneath — and you can read it, see below.

## The property inspector

- **Simple / Advanced** — Simple mode shows the preset, the label, the microphone, **the
  language you are going to speak** and the two steps. Advanced opens up models, context,
  silence, limits, colours and ffmpeg.
- **Every preset explains itself** — selecting one brings up a sentence saying what it is for;
  in Advanced mode it comes with a breakdown of what it configures, **generated from the preset
  itself**, so it can never drift from what the preset actually does.
- **See what will be sent** — opens the **exact** text that goes to OpenAI in both steps, piece
  by piece: clean-up, translation or your instruction, canonical spelling and the safety locks.
  No prompt is hidden: if the plugin sends it, you can read it.
- **With no key configured**, a warning appears at the top with a step-by-step guide on getting
  one from OpenAI, with direct links and the estimated cost.

## Languages — three independent axes

Portuguese, English and Spanish, in three places that **do not have to agree**:

| Axis | What it controls | Default |
|---|---|---|
| 🌐 **Panel** | what **you** read | follows the Stream Deck app |
| 📝 **Presets and prompts** | what the **AI** reads | follows the key's spoken language |
| 🎙 **Spoken language** (per key) | what the transcription expects to hear | Portuguese |

This exists because they are different questions. Someone running the Stream Deck in English
while working in Portuguese needs exactly this — and the app only reports one language.

**It is worth declaring the spoken language.** OpenAI's documentation is explicit: supplying it
*"will improve accuracy and latency"*. That is why it sits in the essential section rather than
buried in Advanced. Leave it on *Detect* only if you genuinely switch languages.

**What if I mix languages?** `language` is a **hint, not a filter**: isolated words from another
language (*deploy*, *commit*, *workshop*) come out right even with a fixed language. What breaks
is pinning the wrong language on audio that is mostly foreign — use *Detect* there. And to
guarantee the **spelling** of foreign terms, the way to go is the canonical dictionary, which is
deterministic and does not depend on the model getting it right.

And it is not just translated labels: **the prompts change language along with the speech**,
because the clean-up layer relies on examples from the spoken language. "vírgula" and the
fillers "né", "tipo" only exist in Portuguese; in English they are "comma", "um", "you know";
in Spanish, "coma", "este", "o sea". A Portuguese prompt applied to English speech would lose
precisely the part that does the work. Preset names and instructions follow the same axis.

## Canonical word dictionary

Your acronyms and proper terms. It lives in **Machine settings → Open dictionary**, which opens
a window of its own with a large field and the term count next to the button. It works on two
fronts:

1. **In the transcription prompt** — it helps the model *hear* correctly. It has a ceiling of
   **224 tokens** (~75 acronyms); anything past that is silently dropped by the API, and it
   drops the *beginning*, which is why the dictionary is trimmed before your context. The panel
   shows a meter.
2. **In the final correction** — an exact comparison forces the canonical spelling on the
   finished text. No quantity limit, no cost and no chance of hallucination. This is the one
   that guarantees the result; the first only improves the odds.

## The transcription prompt goes out empty until you fill it in

Worth knowing, because it is not obvious: the step-1 `prompt` parameter is assembled from **two
sources, both yours** — the canonical word dictionary and the key's *Context* field. Both start
out empty, and **no built-in preset fills in the Context**. While both are empty, the parameter
is not even sent to the API.

That is deliberate: generic context hurts more than it helps. Fill in the Context when the key
has a fixed subject ("Technical meeting about network infrastructure") — from then on the model
listens expecting that vocabulary.

## Where things live

| Path | What |
|---|---|
| `%LOCALAPPDATA%\transcritranslator\openai-key.xml` | key, encrypted with **DPAPI** |
| `…\historico\YYYY-MM.md` | monthly history (raw transcription + final text) |
| `…\audio\` | audio files, if you ask for them to be kept |
| `…\audio\falhou\` | audio from a failed upload — **always preserved** |
| `…\presets.json` | your presets |

The key does **not** live in the Stream Deck settings: those become a plain-text `.json` under
`%APPDATA%\Elgato`. Under DPAPI it only opens on this Windows account.

## Decisions that are not obvious

**The level meter comes out of ffmpeg's stderr, not stdout.** Measured on this machine:

| Output | First sample |
|---|---|
| `ametadata … file=-` (stdout) | **4519 ms**, all at once at the end |
| `ametadata` with no `file` (log → stderr) | **373 ms**, continuous stream |

stdout goes through `avio`, which buffers; the log goes straight out. Over stdout the key would
only turn "recording" after 4.5 s — the first words would be lost every single time. **Do not
switch it back.**

**Speech and silence thresholds are relative to the noise floor, not absolute.** The FIFINE
measures −80 dBFS in silence and the CORSAIR headset −96 dBFS. A fixed threshold like "−34 dB
is speech" would work on one microphone and report "no speech" on every dictation with the
other. The floor is measured during the recording itself (the lowest level seen, which
calibrates itself in the valleys between syllables), and speech is "floor + 14 dB".

**The key only turns REC once ffmpeg confirms capture**, and that is when the beep plays. The
beep stops being decoration and becomes the "you may speak now" signal.

**Audio is MP3 16 kHz mono 48 kbps** — ~0.36 MB/min against ~1.9 MB for WAV. The gain is not
bandwidth, it is the API's 25 MB ceiling: 13 min become ~70 min. And it is free, because the
encode runs *during* capture. MP3 and not m4a because it is a pure stream, with no *moov atom*
to finalise — if the process dies halfway, what was recorded is still valid.

**Stopping is `q` on ffmpeg's stdin, never `taskkill`** — it is the `q` that closes the file
properly.

**Anti-echo.** The GPT-4o models sometimes return the `prompt` itself as if it were the
transcription when the audio is short or silent. Since the dictionary goes into the prompt,
without a defence an accidental tap would paste your list of acronyms into the document. Three
barriers: audio shorter than 0.8 s or with no speech is not sent; a return that resembles the
prompt too closely is discarded; and auto-stop on silence keeps you from recording nothing.

**A model refusal does not cost you your speech.** If the text step is blocked by content
policy, the plugin pastes the **raw transcription** and reports "raw — blocked" — rather than
losing minutes of dictation over the polishing.

**Prompt injection.** In "rewrite selection only" mode the text comes from the **clipboard**,
which may have been copied from any page at all. The system prompt states that the user's text
is data to transform, never an order to carry out.

**A recording survives page changes on the Stream Deck.** The SDK fires `willDisappear` when you
navigate to another page or profile; if the state lived in the key's instance, the dictation
would die with it. It lives in a global registry indexed by the action id
([`sessions.ts`](src/lib/sessions.ts)).

**Ctrl+V only happens if the focused window has not changed.** The focused process is read at
the start and checked at the end (`UIAutomation`, 75 ms — P/Invoke with `Add-Type
-TypeDefinition` would cost ~1 s because it compiles C#). If you went off to do something else,
the plugin copies and tells you, instead of pasting in the wrong place.

## Development

```powershell
npm run check     # types
npm run test      # 236 assertions over the pure parts (dictionary, prompts, languages, SVG, defaults)
npm run mic       # records 3 s from the microphone and validates the core against the hardware
npm run watch     # automatic rebuild
npm run build
streamdeck restart com.felipe.transcritranslator
```

`npm run mic -- "MICROPHONE NAME"` tests a specific device. It reports confirmation latency,
sample rate, peak in dBFS and whether the MP3 came out valid — it is the test that catches
regressions in the ffmpeg command.

The SDK v2 `@action` decorator uses **TC39 decorators** — do not enable
`experimentalDecorators`. The bundle needs the `createRequire` banner in
[`build.mjs`](build.mjs), because the SDK's `ws` library uses `require()` on builtins.

Plugin log: `%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log` (look for
`com.felipe.transcritranslator`; "Plugin connected" means it came up).

## Structure

| File | Role |
|---|---|
| [src/lib/recorder.ts](src/lib/recorder.ts) | ffmpeg: lists microphones, records, measures level, detects silence |
| [src/lib/openai.ts](src/lib/openai.ts) | the two calls, retries, refusals, anti-echo |
| [src/lib/prompts.ts](src/lib/prompts.ts) | layered prompt composition |
| [src/lib/prompt-text.ts](src/lib/prompt-text.ts) | the text of the prompts in pt/en/es — what the AI reads |
| [src/lib/preset-text.ts](src/lib/preset-text.ts) | preset names and instructions in pt/en/es |
| [src/lib/canon.ts](src/lib/canon.ts) | dictionary: prompt with a token ceiling + regex correction |
| [src/lib/deliver.ts](src/lib/deliver.ts) | focus, clipboard, pasting, history |
| [src/lib/sessions.ts](src/lib/sessions.ts) | global key state, single-recording lock, orphans |
| [src/lib/icons.ts](src/lib/icons.ts) | the key drawn in SVG |
| [src/actions/dictation.ts](src/actions/dictation.ts) | state machine and bridge to the property inspector |
| [com.felipe.transcritranslator.sdPlugin/ui/dictation.html](com.felipe.transcritranslator.sdPlugin/ui/dictation.html) | the property inspector, with no network dependency |
| [com.felipe.transcritranslator.sdPlugin/ui/i18n.js](com.felipe.transcritranslator.sdPlugin/ui/i18n.js) | property inspector text in pt/en/es |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "no key" | key not saved in the vault — panel → Machine settings |
| "no ffmpeg" | ffmpeg not on the PATH; set the path in the panel |
| always "no speech" | microphone muted or wrong — run `npm run mic` and use **Test** in the panel |
| "copied, Ctrl+V" | you switched windows during processing; the text is on the clipboard |
| "raw — blocked" | the text step was refused; the transcription was pasted untreated |
| "recording on another key" | another key is already recording |
| Key does not show up | run `streamdeck dev` and redo the `link` |

---

## Documentation

| File | For whom |
|---|---|
| **README.md** (this one) | people who are going to **use** the plugin |
| [CLAUDE.md](CLAUDE.md) | people who are going to **work on the code** — architecture, traps and decisions that must not be reverted |
| [docs/ORIGINAL-PLAN.md](docs/ORIGINAL-PLAN.md) | history: the plan approved before implementation, with the reasoning behind each choice |
| [docs/ROADMAP.md](docs/ROADMAP.md) | what comes next — open items and ideas, with enough context to pick them up |

Every one of these documents also exists in Portuguese, next to it with the `.pt-BR` suffix.
