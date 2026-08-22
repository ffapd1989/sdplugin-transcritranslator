*Language: **English** · [Português](PRIVACY.pt-BR.md)*

# Privacy

This plugin has no backend. There is no account, no telemetry, no analytics and no server
belonging to this project. The only thing it talks to is **OpenAI, with your own API key**.

## What is sent, and when

Nothing is sent until you press a key. When you do:

| Step | What goes out | To |
|---|---|---|
| 1 — Listen | the recorded audio, as MP3; the spoken language; the transcription prompt (your dictionary and your *Context* field, if you filled them in) | `api.openai.com/v1/audio/transcriptions` |
| 2 — Write | the transcribed text, plus the instructions you can read in *See what will be sent* | `api.openai.com/v1/chat/completions` |

Step 2 only happens if you switched it on. A key set to raw dictation makes exactly one call. A
key with recording switched off makes only the second call, and its input is whatever was
selected or on your clipboard — worth remembering before pressing it over something sensitive.

Audio shorter than 0.8 s, or with no speech in it, is **not sent at all**. Neither is anything
else: the plugin does not phone home on startup, does not check for updates and does not report
usage.

What OpenAI does with what it receives is between you and OpenAI, under the terms of the account
whose key you configured. At the time of writing, API traffic is not used to train their models
by default, but that is their policy to state and change, not ours — read it yourself.

## What stays on your machine

| Path | What | Lifetime |
|---|---|---|
| `%LOCALAPPDATA%\transcritranslator\openai-key.xml` | your API key, encrypted with Windows DPAPI | until you clear it in the panel |
| `…\historico\YYYY-MM.md` | one entry per dictation: the raw transcription, the final text, the models used and the duration | forever, unless you delete it — history can be switched off in the panel |
| `…\audio\` | the MP3 files | only if you tick *keep audio*; otherwise deleted right after delivery |
| `…\audio\falhou\` | audio whose upload failed | kept **even with *keep audio* off**, so a network error does not cost you the recording. Nothing deletes these but you |
| `…\presets.json` | the moulds you saved | until you delete them |
| `…\atalhos.json` | nickname → key, for the keyboard shortcut, including a copy of those keys' settings | rebuilt as keys appear |

The clipboard is used to deliver the text, so what you dictate passes through it and stays there
until something else replaces it.

## Deleting everything

Close the Stream Deck app and delete `%LOCALAPPDATA%\transcritranslator`. That takes the key, the
history, the audio, the presets and the shortcut index with it. The per-key settings live with
the Stream Deck profile, under `%APPDATA%\Elgato`, and go away when you delete the keys.

Revoking the API key itself is done at OpenAI, not here.
