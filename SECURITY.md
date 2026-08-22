*Language: **English** · [Português](SECURITY.pt-BR.md)*

# Security

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private reporting on this repository —
*Security* → *Report a vulnerability* — which reaches the maintainer without the report becoming
public first.

Tell us what an attacker gets and how you got there. A proof of concept helps; a stack trace and
the plugin version (bottom of the property inspector) help more. Expect an answer within a few
days: this is a one-person project, so there is no on-call rotation, but a real vulnerability
gets priority over anything else in the roadmap.

Only the latest release is supported. If a fix matters to you, run it from `main`.

## What the plugin does with your secrets

**The OpenAI key is encrypted with Windows DPAPI**, in
`%LOCALAPPDATA%\transcritranslator\openai-key.xml`. It only opens on the Windows account that
saved it, on that machine — copying the file elsewhere yields nothing. It is deliberately **not**
stored in the Stream Deck settings, which become a plain-text `.json` under `%APPDATA%\Elgato`
that any process of yours can read.

The key travels to PowerShell over **stdin**, never on a command line, so it does not land in a
process list. In memory it is cached for the lifetime of the plugin process. An
`OPENAI_API_KEY` environment variable, if present, takes precedence over the vault.

## What leaves your machine

Your audio and your text, to OpenAI, and nothing else. There is no telemetry, no analytics and
no server belonging to this project — it has no backend at all. See [PRIVACY.md](PRIVACY.md) for
what is sent, when, and what stays on disk.

## Attack surface worth knowing about

**The `streamdeck://` address.** A key with a nickname can be triggered by any program on the
machine that can open a URL — that is how the keyboard shortcut works. What an attacker gets is
a recording they cannot hear: the text is pasted into *your* focused window and written to your
history, never sent anywhere they can read. It still means an unexpected recording and API spend,
which is why the nickname field starts empty: a key with no nickname cannot be reached from
outside, and exposure is one deliberate act per key.

**Prompt injection through the clipboard.** In "rewrite selection only" mode the input is
whatever is on your clipboard, which may have been copied from any page on the internet. The
system prompt states that the user's text is data to transform and never an order to carry out,
and forbids revealing the instructions. Treat that as a mitigation, not a guarantee: a language
model is not a parser.

**PowerShell.** Focus detection, clipboard and pasting go through `powershell.exe`. Every value
interpolated into those scripts is quoted with doubled single quotes, and text always travels
through a UTF-8 file rather than the command line — both to survive accents and to avoid
building commands out of arbitrary content.

**ffmpeg.** Started with an argument array, never through a shell, so a device name with odd
characters cannot become a command.
