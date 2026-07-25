# Sibyl

*speak, and be remembered*

A local-first voice diary app: record, auto-name by tag, browse/search, play back with a
proper waveform + speed/skip-silence controls, trim/merge/append recordings, and transcribe on
demand via Groq's free Whisper API.

Everything except transcription works fully offline. Recordings and metadata never leave your phone.

**Note on the rename:** the Android/iOS package identity changed (`com.mettasurendhar.sibyl`,
was `com.yourname.voicejournal`), since this was renamed from the earlier "Voice Journal" working
title. This means Android treats it as a distinct app - your existing dev client install won't be
"updated" in place; a fresh install will sit alongside it (or replace it if you uninstall the old
one first) after the next `eas build`.

## Why a dev client instead of plain Expo Go

You chose the EAS Dev Client path (for real MP3 export + true audio merging later). That means
you'll build your own "Expo Go" once via EAS, then reuse it like a normal installed app for every
future `expo start` — no more scanning through the public Expo Go app.

## First-time setup

```bash
npm install -g eas-cli   # if you don't have it
cd voice-journal
npm install

# Log in (free Expo account)
eas login

# Build a dev client APK you install once on your phone
eas build --profile development --platform android
```

That last command builds in the cloud and gives you a download link/QR code for an `.apk`.
Install it on your phone like any app (you may need to allow "install unknown apps" once).

From then on, day-to-day development is just:

```bash
npx expo start --dev-client
```

Scan the QR code with your **Voice Journal dev client** app (not regular Expo Go) and it'll load
your JS bundle live, same as Expo Go would.

## Groq transcription setup

1. Go to https://console.groq.com/keys and create a free API key (no credit card needed).
2. Open the app → Library → ⋮ → Settings → paste the key under "Transcription (Groq)".
3. On any recording's Playback screen, use ⋮ → Transcribe. This needs internet; everything else
   in the app doesn't.
4. Free tier covers casual daily journaling comfortably (roughly 2,000 requests/day at time of
   writing) — check current numbers at console.groq.com/settings/limits if you're a heavy user.

## Current status

- Recording with a real live waveform (actual microphone metering, not decorative), tags with
  customizable per-tag naming templates (including date/time format tokens)
- Library: grouped by date, search, filter (tag + date range), multiselect edit mode
- Full playback screen: synced scrolling waveform + ruler, speed, skip-silence, transcript display
- **Trim / Merge / Append**, each its own screen, backed by real audio processing via
  `ffmpeg-kit-react-native-community` (see note below)
- 5 themes (Sibyl default, 1 other dark, 3 light)

## Important: a patched dependency

`ffmpeg-kit-react-native-community`'s own `android/gradle.properties` ships with a typo -
`ffmpegKit.android.main.version=6.0-2` (hyphen), which doesn't match any version actually published
on Maven Central (the real one is `6.0.2`, with a dot). This breaks the Android build with a
"Could not find com.arthenica:ffmpeg-kit-https:6.0-2" error.

This is patched via `patch-package` (see `patches/ffmpeg-kit-react-native-community+6.0.2-fork.1.patch`),
which runs automatically via the `postinstall` script on every `npm install` - including EAS's
cloud build, so you don't need to do anything manually. If you ever bump this dependency's version,
you'll need to regenerate the patch (`npx patch-package ffmpeg-kit-react-native-community` after
fixing the file again in `node_modules`).

## Known limitations

- "Set as ringtone" shares the file via the system share sheet rather than setting it directly —
  Expo doesn't expose a ringtone-setting API, and the reliable cross-platform path is to let the
  OS's own share/set-as-ringtone flow handle it.
- The Sibyl theme's typography spec (Liberation Serif / Inter / Roboto Mono) references font
  *families*, not bundled font files - no `.ttf` assets were provided, so the app currently renders
  with the system default font rather than those specific typefaces. If you have the actual font
  files, I can wire them in via `expo-font`.
- `ffmpeg-kit-react-native-community` is a small, single-maintainer fork (the original
  `ffmpeg-kit-react-native` was retired in 2025). It works, but keep an eye on it; if it ever
  becomes unmaintained, the fallback is reverting Trim to a non-destructive marker-based approach
  (in-app only, no native dependency) discussed earlier.

