*Language: **English** · [Português](ROADMAP.pt-BR.md)*

# Roadmap

What was left for the next rounds, with enough context to pick it up again without rebuilding
the reasoning. Order = suggested priority, not obligation.

When you touch any item: bump [version.json](../version.json) before committing
(see [CLAUDE.md](../CLAUDE.md), *RULE: every change bumps the version*).

---

## 0. Speech test — ✅ main path WORKING

**Validated on 25/07/2026, v1.0.1.1.** The plugin transcribes real speech and delivers the text:
record → transcribe → paste works end to end. This was the item blocking all the others, and it
blocks them no longer.

What is missing are the **edge cases**, which normal use does not exercise — each one exists for
a situation that only shows up when something goes wrong:

- [x] Dictate and paste (main path)
- [ ] `ptt` mode (hold to record)
- [ ] Auto-stop: speak and then stay quiet for 3 s
- [ ] Hold during recording → `RELEASE TO CANCEL`, nothing is sent
- [ ] **Switch windows during processing** → does not paste, warns "copied"
- [ ] **Switch pages on the XL during recording** → delivers anyway
- [ ] **Press and stop without speaking** → "no speech", nothing pasted (anti-echo shielding)
- [ ] Dictionary: register an acronym, dictate, check the canonical spelling
- [ ] Spoken commands: "comma", "new paragraph"
- [ ] Guardrail: dictate something the policy refuses → it must paste the **raw text**, not lose
      the speech
- [x] Keyboard shortcut: trigger and finish (validated with speech on 27/07/2026)
- [ ] Shortcut with the key on **another page/profile** → the borrowed display takes over, and
      pressing it ends someone else's dictation
- [ ] Shortcut with **no** plugin key visible → runs blind, on beeps alone
- [ ] Shortcut with a **full-screen game** → does not record, does not beep, spends nothing

> The three in bold are the ones that involve logic nobody has tested yet and that fails
> silently — if the anti-echo does not work, an accidental tap pastes your list of acronyms into
> the document. Full script in [ORIGINAL-PLAN.md](ORIGINAL-PLAN.md), section *Verification*.
>
> Note down here whatever comes out crooked, instead of fixing it immediately — the failure
> pattern is more informative than the first symptom.

---

## 1. Discovery

Two questions that cannot be settled by discussion — they need an experiment.

### 1.1 Is the transcription prompt good for anything?

**An open question that has never been measured.** We kept the `prompt` in step 1 by reasoning,
not by evidence: the docs say it exists, and the GPT-4o models "follow instructions", unlike
whisper. But nobody has verified whether, on `gpt-4o-mini-transcribe`, it **improves anything
the regex correction does not already solve**.

What we know today:

- OpenAI's docs only say the prompt "guides the style" and "should match the audio language".
  They do not promise a vocabulary accuracy gain.
- FALA TU **removed** the transcription prompt in production — the model hallucinated the whole
  list on short or silent audio. We kept it with three shields, but we never tested whether the
  benefit is worth the risk we are managing.
- The dictionary regex fixes the **spelling** (`cpc` → `CPC`) and does not fix the **sound**
  (`see-pee-see` → `CPC`). The prompt is only justified if it solves that second case.
- It **costs**: it goes in as input tokens and can weigh on latency, which on a dictation key is
  the thing you feel most.

#### Protocol

- [ ] Record a fixed set of ~10 short clips with **acronyms spelled out loud**
      (`see-pee-see`, `ess-arr-vee-dee-arr-you`), proper names and technical jargon. Keep the
      `.wav` files as versioned test material
- [ ] Transcribe each one under **four conditions**: no prompt · dictionary only · context only ·
      dictionary + context
- [ ] Measure, per condition: hit rate on the target acronyms, general error (approximate WER),
      **latency** and input tokens
- [ ] Also run the full path with the regex enabled, to separate what the prompt deserves credit
      for from what the regex was already fixing on its own
- [ ] Test the **echo** on purpose: 0.5 s of audio, audio with breathing only, silent audio — do
      the shields catch it? How often?

#### What to decide with the result

| If… | Then |
|---|---|
| The prompt does not change the hit rate on spoken acronyms | **Drop it from step 1.** Only the regex remains, and the echo risk disappears |
| It helps with the dictionary but not the context | Keep the dictionary, make the context explicitly opt-in |
| It helps, but costs noticeable latency | Keep it, with a switch in the panel and the measurement documented |
| It helps little and the echo is frequent | Drop it — the regex is deterministic and has no downside |

> Write the result here, with the numbers. The current decision is a **bet**; what settles a bet
> is measurement, not more discussion.

#### First partial answer — one clip, not the ten of the protocol

A single synthetic pt-BR clip (Windows SAPI, `Microsoft Maria`), six target terms, the same
audio for every condition:

| condition | terms heard right | latency |
|---|---|---|
| `gpt-transcribe`, nothing sent | 2/6 | 1257 ms |
| `gpt-transcribe`, dictionary in the `prompt` | 4/6 | 1734 ms |
| `gpt-transcribe`, dictionary in `keywords[]` | **6/6** | 2185 ms |
| `gpt-4o-mini-transcribe`, dictionary in the `prompt` | 4/6 | 3997 ms |
| `whisper-1`, dictionary in the `prompt` | 5/6 | 2181 ms |

So the prompt **does** earn something the regex cannot: `DPE-RS` and `Krzyzanowski` came out of
the audio wrong (`DPRS`, `Krizanowski`), and a regex over the wrong spelling does not put them
right. `keywords[]` is what actually closes the gap.

The echo test is settled for these two models: with 1.5 s of digital silence and the dictionary
in the prompt, `gpt-4o-mini-transcribe` handed the whole list back, twice out of two.
`gpt-transcribe` returned an empty string in every arrangement.

What this does **not** answer: ten varied clips, real voices, acronyms spelled out loud, WER,
input token cost. The protocol above stands.

### 1.2 Show the translation in a popup, without pasting

**Idea:** instead of delivering the text into the focused field, show it in a little window on
screen. This serves the "I just want to **read** what this means" case — subtitling a foreign
passage, checking a translation before using it, understanding a piece of audio without writing
anything anywhere.

The Stream Deck has **no** API for drawing outside the key: `showOk`, `showAlert` and `setImage`
stop at 72×72. The window would have to come from the operating system, and that is what needs
investigating before promising anything.

#### Paths to test (from most to least likely)

- [ ] **WinForms via PowerShell**, which is the infrastructure the project already uses in
      [deliver.ts](../src/lib/deliver.ts). A borderless window, `TopMost`, semi-transparent,
      closing on click/ESC or by itself after N seconds. The VPN plugin already makes a window
      that way (`Vpn-Settings.ps1` in SRVDRU), so there is a working precedent on the same
      machine
- [ ] **Windows toast** (native notification). More elegant and it does not steal focus, but the
      text is short and disappears fast — it may only serve sentences, not paragraphs
- [ ] **HTML window** (`chrome --app` or similar): gives the pretty look, but it is a lot of
      weight for displaying one paragraph, and it starts a whole process
- [ ] Discard up front: using the Property Inspector as the display. It only exists while the key
      is **selected in the app** — no use for normal operation

#### What must be true for it to be worth it

- [ ] **Do not steal focus.** If the window activates, it breaks Ctrl+V for the other keys and
      gets in the way of whatever the person was doing. It needs `WS_EX_NOACTIVATE` /
      `ShowWithoutActivation` — **this is the point that decides feasibility**, test it first
- [ ] Show up fast. Starting a PowerShell costs ~200 ms; measure whether that disappears into the
      API time or becomes annoying
- [ ] Selectable text, so it can be copied by hand if the urge strikes
- [ ] Effortless dismissal: ESC, click outside, or a timeout proportional to the text length
- [ ] Predictable position — near the cursor or in a fixed corner? Decide after seeing it work

#### How this would fit into the configuration

It would be a third output destination, alongside *copy* and *paste*: **show**. Combinable —
"show and copy" covers the read-first-use-later case. The configuration model already supports it
(the panel's *Output* section), so the work is the window itself, not the fit.

> Build a throwaway PowerShell prototype **before** touching the plugin: a topmost window with no
> focus, showing text. If it steals focus or flickers, the idea dies there and no more is spent.

---

## 2. The key: black background and more elegance — ✅ done (v1.2.0.0)

The whole background used to be the state colour, with white bars and text on top: saturated and
"prototype-looking". Now the background is near-black (`#0C0C10`) and **colour only shows up on
what carries information**.

**Eight** proposals were drawn and compared side by side before any final code was written — the
sheets are in [docs/estilos/](estilos/). Three survived, and the decision was **not to elect
one**: they became a per-key option (`keyStyle`), because the three serve different tastes and
the cost of maintaining all three is nearly zero — the icon drawing is a single one.

| Direction | What it is |
|---|---|
| `neon` (default) | a lit outline with a colour halo — the one that pops most on a crowded deck |
| `aurora` | a white icon over a mist of colour — the most discreet |
| `ring` | a colour meter-arc around the icon — an instrument look |

All in [src/lib/icons.ts](../src/lib/icons.ts) — SVG generated at runtime, no dependencies.

### 2.1 Voice bars — ✅ done

- [x] Near-black background, the state colour migrated to the **bars**
- [x] Bars with a vertical gradient
- [x] **`<filter>` was discarded, not tested — on purpose.** Every glow in the project is a
      `radialGradient`/`linearGradient`, the same mechanism the key already used and that we know
      the Stream Deck renderer accepts. The `neon` halo is made of three passes of the same
      outline (wide and faint, medium in the colour, a white hairline in the middle) — it gives
      the impression of light without depending on a feature we have no way to validate without
      the device in hand
- [x] The 9 rolling bars were kept
- [ ] Centre bars taller by construction, like a real VU — not done, and maybe it should not be:
      the height today is the REAL level, and dressing that up is lying about what the bar
      measures

### 2.2 Processing state (today "sending" / "writing") — **what is left of item 2**

It is the only part of item 2 that did not make it into v1.2.0.0, and it turned out cheap:
`key-text.ts` already exists, so adding a word is adding three lines to three blocks.

- [ ] Replace the three dots with something that suggests continuous work — an indeterminate bar,
      lines of text appearing, or a stroke sweeping the key. **Careful:** the dots are redrawn at
      8 fps by `tick()`; anything heavier starts costing on every frame
- [ ] **Rethink the word.** "Writing" is vague. Contextual would be better, because the plugin
      already knows what it is doing: `translating` when `styleMode === "translate"`,
      `proofreading` when there is only clean-up, `rewriting` when there is a free instruction.
      Needs all three translations — now in [key-text.ts](../src/lib/key-text.ts), not in i18n

### 2.3 Final confirmation — ✅ done (v1.1.0.0)

```
   ✓            ✓
 142      →    142
words        words
```

- [x] Number and word on separate lines, the number big (22 px) and the word small (10 px)
- [x] `keyImage` gained `fontSizes` — font size **per line**. With equal sizes the spacing stays
      identical to before, so no existing key changed
- [x] Correct singular: "1 word", "142 words"
- [x] `palavras` / `palabras` in the other languages

**A side effect that was worth it:** to translate "words" we had to carry the panel's language
all the way to the key drawing. With the path open, **all** of the key's text was translated —
`opening`, `sending`, `writing`, `RELEASE TO CANCEL`, `no speech`, `copied`, the error messages.
It now lives in [key-text.ts](../src/lib/key-text.ts), the project's third home for text
(panel · prompt · **key**). It was a violation of the trilingual rule that would have blocked
publication on the store.

> **Careful:** the `icon and text do not overlap` test locks down the geometry, not the
> aesthetics. When you touch it, render it and look — there is a ready-made harness described in
> CLAUDE.md (*How to test*).

### 2.4 Icon library — ✅ done (v1.2.0.0)

There were **five** (`mic`, `globe`, `bubble`, `pen`, `none`). Now there are **18 + `none`**,
covering the four groups that were missing. The five old ones still exist with the same id —
settings already saved on keys do not break, and there is a test locking that down.

| Group | Icons |
|---|---|
| Capture | `mic` `micOff` `waves` `headset` |
| Language | `globe` `translate` `bubble` `quote` |
| Text | `doc` `list` `keyboard` `code` |
| Action | `pen` `wand` `bolt` `check` |
| Context | `mail` `calendar` |

#### What we learned while drawing

- [x] **Outline vs. solid turned out to be the wrong question.** Each icon is described ONCE, as
      a list of shapes with roles (body · stroke · cut-out). `neon` renders that list as an
      outline; `aurora` and `ring` render it as a filled silhouette. Drawing 18 icons twice would
      guarantee the two sets diverged one day
- [x] **A stroke that survives shrinking — MEASURED, and the answer was not the expected one.**
      With a 3-line label the glyph drops to `k ≈ 0.4` and a 3.1 px stroke becomes 1.2 px and
      disappears. But compensating in full (`1/k` — exactly what
      `vector-effect="non-scaling-stroke"` would do) gives back the 3.1 px, and on a glyph at 40%
      that is proportionally enormous: the microphone turns into a blob. **The square root sits
      in the middle: `3.1/√k`**, ~2.0 px effective. In other words, `non-scaling-stroke` was not
      only unnecessary, it would have been wrong
- [x] A common 32×32 grid centred at (36,28), with an automated test that fails any coordinate
      outside it — that is what caught the first pencil, which spilled out of the drawing
- [x] Contrast solved by construction: the glyph is always a slightly cool white (`#EFF2F7`), so
      it does not depend on whichever colour the person picks

#### Cautions — all addressed

- [x] The icon `<select>` **became a visual grid of thumbnails**, and so did the style one. The
      thumbnails are generated by the plugin itself, in the key's style and colour — the grid
      shows what the key will show, not an illustration made separately. The `<select>` elements
      are still there, hidden: the grid writes into them and fires `change`, so saving, preview
      and presets keep going through a single path
- [x] The `switch` in `glyph()` became the `GLYPHS` table (`name → shapes`), as planned
- [ ] An icon is identity and the plugin is going to the store: revisit the set once there is
      real usage, to see which ones sit unused and what is missing

---

## 3. A more high-tech panel

### 3.0 Pasting the key inside the help modal itself — ✅ done (v1.1.0.0)

The "How to get an OpenAI key" modal ended at step 4 saying "paste it into the panel field" — and
then the person had to close the modal, find *Machine settings*, open the section and only then
paste. They had just copied the key, with it still on the clipboard: the field had to be **right
there**.

- [x] A password field + *Save* button in the modal footer, before *Close*
- [x] Reuses the `setKey` command that already existed — no new path to the DPAPI vault
- [x] On a successful save: the modal closes, the warning banner disappears and **both**
      indicators update (`refreshKeyStatus()` now writes to both)
- [x] Errors visible right there, without closing: an empty field and a key that does not start
      with `sk-`
- [x] A single path (`submitKey()`) for both fields — the validation was born shared, and with it
      the *Machine settings* field started validating too
- [x] Enter in the field saves, since the hand is on the keyboard right after pasting

> Verified with the panel rendered outside the Stream Deck: an empty field and a malformed key
> show the error without closing; a valid key shows "storing in the vault…", and the success
> response closes the modal, clears the field and removes the banner.

### 3.1 Full review of the interface text

The texts were written along with the code, one at a time, and were never read as a whole. There
is jargon, inconsistency and at least one label that is **not understandable** — which we only
found out because the user said "I didn't even get that one".

It is all in [ui/i18n.js](../com.felipe.transcritranslator.sdPlugin/ui/i18n.js), in the three
blocks. Rewrite pt first and then translate; do not translate bad text.

#### Cases already identified

- [ ] **"Follow the key's spoken language"** — the automatic option in the *Presets and prompts*
      selector. Nobody understands it, and that is the label's fault, not the reader's. What it
      does: the prompts come out in the language you declared under *I will speak in*; if that is
      on *Detect*, it falls back to the panel language. It exists because the clean-up uses
      examples from the spoken language ("comma", "um"). Something like **"Automatic — follows
      what I speak"** would already say more
- [x] **The canonical dictionary placeholder — done (v1.6.0.0).** It named one person's server,
      which means nothing to anyone else. Now `GitHub, JavaScript, PostgreSQL, PDF, API, e-mail`
      (`OAuth` in place of `e-mail` in English)
- [ ] Review **all** the other placeholders by the same criterion: an example illustrates, it does
      not give instructions and does not assume anyone's context
- [ ] **"Prompt" is jargon.** It shows up in *Presets and prompts*, *See what will be sent*,
      *transcription prompt*. Someone who has never used an API does not know what it is. See
      whether "instructions" works without losing precision — and where precision matters, keep it
      and explain it once
- [x] **Panel language selector — done (v1.1.0.1).** The top now carries `🌐 UI` next to the
      selector, and the four options are invariant: `Default · Português · English · Español`.
      The point is precise: someone who opened the panel in a language they cannot read is
      looking for exactly how to change it, and cannot depend on reading anything around it to
      find it. Out went *"Follows the Stream Deck"*, which was the only translated item in the
      list; what it explained moved to the end of `langHint` ("Default means following the app's
      language"). The selector's tooltip, which was hardcoded in Portuguese in the HTML, became an
      i18n key — `applyLang()` gained support for `data-i18n-title`
- [ ] Inconsistencies of form: *"Clean up the dictation"* (verb) and *"Dictation clean-up"* (noun)
      for the same thing. The *Presets and prompts* selector still says *"Follow the key's spoken
      language"* — this is **not** the same case as the one above: there the automatic option has
      a meaning of its own that "Default" alone would not convey, so solve it together with the
      first item in this section
- [x] `"wds."` abbreviated on the confirmation key — solved along with 2.3: it became the whole
      word, on two lines, in all three languages (`key-text.ts`)
- [ ] Unavoidable terms (`ffmpeg`, `tokens`, `DPAPI`) need to be explained **the first time** they
      appear, not on every mention

#### How to do it

- [ ] Read the whole panel top to bottom, in all three languages, **as someone who has never seen
      it** — that is how inconsistency shows up; field by field it hides
- [ ] Fix the vocabulary before rewriting: one word per concept, and always the same one
- [ ] Run the headless render of the three languages and check whether any rewritten text broke
      the layout (German does not exist here, but Spanish is already ~15% longer than Portuguese)
- [ ] Check key parity at the end (the command is in [CLAUDE.md](../CLAUDE.md))

### 3.2 Visual refinement

The panel works and is honest, but it looks like a form. Without turning it into decoration:

- [x] **Live key preview inside the panel — done (v1.1.0.0).** It sits in *Preset and
      essentials*, right below the label, and it shows in simple mode too. It is the SAME image
      that goes to the key: `idleImage()` came out of `render()` and is called by both, so the
      preview and the physical key have no way to diverge.
      Two decisions worth recording: the settings travel **in the** `keyPreview` **message**, and
      are not read from `getSettings()`, because the panel saves with a 150 ms delay — reading
      from the Stream Deck, the preview would always show the second-to-last character typed; and
      the request is debounced at 120 ms, so typing a label does not turn into a burst of
      round-trips.
- [ ] Typography and rhythm: a coherent size scale, breathing room between sections, label
      alignment
- [ ] Short transitions when opening/closing sections and when switching style mode
- [ ] Replace the 🌐 emoji and the `↳` with inline SVG — emoji vary between systems
- [ ] Visible focus states for keyboard navigation
- [ ] Review contrast in the Stream Deck light theme, if there is one

---

## 4. Translation

### 4.0 Expanding the target languages — ✅ done (v1.1.0.0)

There were **12** targets against **30** spoken languages. Now there are **28**
(`TARGET_CODES` in [languages.ts](../src/lib/languages.ts)).

- [x] Added the 16 that were missing: Polish, Czech, Romanian, Hungarian, Greek, Swedish,
      Norwegian, Danish, Finnish, Ukrainian, Turkish, Hebrew, Hindi, Indonesian, Vietnamese, Thai
- [x] Confirmed in practice: the code was all it took. Name and alphabetical ordering came from
      `Intl.DisplayNames`, in the three panel languages — there is a test locking that down
- [x] **Where it stopped:** at the languages already accepted as spoken, minus Catalan and
      Galician. They were left out because translation quality *into* them is the most doubtful on
      the list, and offering a target that translates badly is worse than not offering it. They
      go in as speech, not as a target — changing that is one line, if experience says otherwise
- [ ] At 28 the `<select>` still holds up; if it ever reaches ~35, consider a searchable field or
      the most recently used at the top
- [ ] The 2-letter badge is still the code, and there are now opaque ones to read (`el` for Greek,
      `he` for Hebrew, `cs` for Czech). Kept on purpose for now: the preset descriptions say "the
      key shows EN in the corner", so changing to a short name is a decision with knock-on
      effects — decide it together with item 2.4

### 4.1 Selection translation: a more direct flow

Today, to translate selected text you have to work out that "turning Listen off + turning Write
on with translation" does that. It works, but it requires understanding the model before using it.

- [ ] **A ready-made preset** "Translate selection → English" (and Spanish), with no recording, so
      the thing exists without configuration
- [ ] The key needs to **look** different from the one that records: maybe a text/selection icon
      instead of the microphone, so there is no doubt about what it does
- [ ] Consider a **hybrid** mode: if there is selected text, translate the selection; if there is
      not, record. A single key would solve both cases — but careful, behaviour that changes on
      its own is hard to predict, and that decision has to be yours
- [ ] Feedback when there is neither a selection nor a clipboard: today it says "no text", it
      could be clearer
- [ ] The target language on the badge in that mode too

---

## 5. Larger backlog (phase 2)

Already discussed and deliberately outside the initial scope:

- [ ] Transcribe an existing **audio file**
- [ ] Capture **system audio** (loopback) for meetings — requires VB-Cable or WASAPI
- [ ] **Streaming** the transcription (the GPT-4o models support it)
- [ ] A **resend** queue for audio that failed — today it is preserved, but resending is manual
- [x] A global keyboard shortcut, without having to **press** the Stream Deck — done in v1.3.0.0,
      see section 7. It still depends on Elgato's **app** running, because that is where the
      plugin lives; what stopped being necessary is having the key within reach
- [ ] Cost tracking (it was decided **not** to do it; revisit only if there is demand)
- [ ] Publish on the Elgato store. The code side is done (v1.6.0.0): SDK 3 with the DRM
      manifest (`SDKVersion: 3`, Stream Deck 7.1+), white monochrome list icons, `showAlert` on
      errors, ffmpeg found or installed from the panel, `THIRD-PARTY-NOTICES.txt`, and
      `streamdeck validate`/`pack` passing on CLI 1.10.1. Left: the listing — a 288×288 app
      icon, a 1920×960 thumbnail, at least three gallery items, the demo video Elgato requires
      for plugins that use a paid service, the English description listing the requirements —
      and testing the protected build downloaded from Maker Console after the first upload

---

## 6. Known technical debt

- [ ] [dictation.ts](../src/actions/dictation.ts) has passed **1160 lines** and accumulates the
      state machine + the bridge to the panel + the keyboard shortcut handler. The bridge
      (`onSendToPlugin`) would come out cleanly into a module of its own — it grew in v1.2.0.0
      with `keyPreview` serving both grids, and again in v1.3.0.0 with `Surface` and the borrowed
      display. It is the debt that grows most every round
- [ ] [icons.ts](../src/lib/icons.ts) doubled in size with the 18 icons and the three directions.
      The `GLYPHS` table is pure data and would come out cleanly into a file of its own, leaving
      `icons.ts` with only the engine (text layout, scaling, key composition)
- [ ] `CHAR_RATIO = 0.56` in icons.ts is an estimate of average character width; it is wrong for
      text with many capitals or many "i"s. If it becomes a problem, measure per character
- [ ] The panel has no automated test — only the manual headless render. A smoke test that loads
      the HTML and checks that `handlePlugin({event:"init"})` populates everything would prevent
      silent regressions (that is how we found the panel dying without i18n.js)
- [ ] `npm run mic` records from the microphone and does not run in CI; keep it as a local test

---

## 7. Keyboard shortcut — ✅ done (v1.3.0.1)

A keyboard key triggers dictation without touching the Stream Deck, **including when the deck key
is on another page or another profile**. Designed in a grilling session with the user on
27/07/2026; the decisions are in [CLAUDE.md](../CLAUDE.md), items 15 to 17 of *Decisions that must
not be reverted*.

How it works: a `streamdeck://plugins/message/<uuid>/dictate?key=<nickname>` URL reaches the
plugin, which finds the key by its nickname in [shortcuts.ts](../src/lib/shortcuts.ts) and runs
the dictation from a copy of the settings — the SDK only hands over the **visible** actions, so
without that little notebook the key on page 5 would not exist.

**Measured on this machine:** 434 ms between firing the URL and the plugin receiving it; passive
mode (`streamdeck=hidden`) **does not steal focus**, which is the condition for the text to be
pasted in the right place.

What was left out, and why:

- **Hold to talk over the shortcut.** The message is a pulse, there is no "released". We found out
  afterwards that it could be inferred from the key's auto-repeat — and the conclusion was **do
  not do it**: it depends on the Windows repeat configuration and on undocumented PowerToys
  behaviour.
- **Triggering another plugin's button or a built-in action.** Impossible: the deep link is
  delivered to the plugin that owns the UUID. Only Bitfocus Companion would solve it, by replacing
  Elgato's software.
- **A list of programs where the shortcut applies.** It existed at one point and was removed on
  request: failing silently in a program outside the list is worse than the annoyance inside a
  game. What remains is the plugin's full-screen lock.

### The PowerToys trap (cost an hour)

The remapping is written by hand into
`%LOCALAPPDATA%\Microsoft\PowerToys\Keyboard Manager\default.json`, under
`remapShortcuts.global` with `operationType: 2` and `openUri` — the `remapShortcutsToRunProgram`
section exists in the PowerToys constants but **is not read**. The engine does not watch the file:
it needs the `PowerToys_KeyboardManager_Event_Settings` event.

**Opening the Keyboard Manager editor wipes the remapping and kills the keyboard hook.** Getting
it back requires either restarting PowerToys elevated or toggling the module through the
interface.
