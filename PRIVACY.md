# Privacy Policy

**Last updated:** 2026

Your privacy is Sibyl's starting design constraint, not an afterthought. This document explains exactly what stays on your device, what (if anything) ever leaves it, and why.

## The short version

- Sibyl does not collect, store, or share your personal data, recordings, or transcripts.
- There is no Sibyl server or Sibyl account. There's nothing to sync *to*.
- The only data that ever leaves your device is audio you explicitly send for transcription — and it goes straight to Groq, not to us.

## What stays on your device

All recordings, transcripts, tags, and settings are stored locally, in a SQLite database on your phone (via `expo-sqlite`). If you add a Groq API key, it's stored in the device's encrypted secure storage (`expo-secure-store`), not in plain text and not anywhere Sibyl's own code can read it back out except to make the transcription request you asked for.

Sibyl includes no analytics, crash-reporting, or advertising SDKs. Deleting the app deletes this data permanently — see [Optional external folder backup](#optional-external-folder-backup) below for the one way to avoid that.

## Transcription (Groq)

Transcription is entirely opt-in and requires you to supply your own free Groq API key. When you transcribe a recording — either manually or via the auto-transcribe setting — that recording's audio is sent directly from your device to Groq's API, solely to generate the text of that transcript. Nothing else about your library (other recordings, tags, settings) is sent. Sibyl does not run its own server in this path, so there is no intermediary that logs or stores the request.

Once Groq's API returns the transcript, it's saved locally like everything else. What Groq itself does with the audio during and after that request is governed by [Groq's own privacy policy](https://groq.com/privacy-policy/) — Sibyl has no visibility into or control over that.

If you never add a Groq key, this entire section simply doesn't apply to you: no audio ever leaves the device.

## Optional external folder backup

Sibyl can optionally sync your recordings to a folder you choose on your device (Settings → Recording → Sync with folder). This is off by default. Turning it on is a deliberate trade-off: your recordings are copied to a public, other-app-accessible folder, in exchange for a backup that survives deleting the app and for the ability to import audio from outside Sibyl. This never involves the network — it's a device-to-device-storage copy, not a cloud upload.

## Sharing recordings

If you use Share, Set as ringtone, or download a transcript, you're handing that specific file to another app or to Android's own share/ringtone system, the same way any app does. That's your explicit action, not something Sibyl does on its own.

## Changes to this policy

If Sibyl's data handling ever changes — for example, a new optional integration — this file and the in-app copy (Settings → About → Privacy Policy) will be updated together, and the change will be called out in [CHANGELOG.md](CHANGELOG.md).

## Questions

Open an [issue](https://github.com/MettaSurendhar/sibyl/issues) if anything here is unclear or you think something doesn't match what the app actually does — that's a bug worth fixing on either the code or this document.
