# Contributing to Sibyl

Thanks for considering a contribution — bug reports, feature ideas, docs fixes, and code are all welcome.

## Project layout

```
src/
├── audio/        # Recording, playback, and FFmpeg trim/merge/append (recorder.js, player.js, ffmpegModule.js)
├── components/   # Shared UI: sheets, modals, waveform, tag editor, etc.
├── db/           # SQLite access layer (entries, categories)
├── groq/         # The one network call in the app — transcription via Groq's Whisper API
├── navigation/    # Screen routing
├── screens/      # One file per app screen (Record, Playback, Library, Analytics, Settings, ...)
├── services/     # Background-ish concerns: audio store, media controller, notifications
├── theme/        # Theme/typography context and definitions
└── utils/        # Naming templates, formatting, external-folder sync, settings store
```

`patches/` and `plugins/` handle native-side integration: `patches/` holds `patch-package` fixes for `expo-sqlite` and `ffmpeg-kit-react-native-community` (applied automatically by `npm install` via the `postinstall` script — no manual step needed); `plugins/` holds small Expo config plugins (`withFfmpegKitFix`, `withNotifee`, `withNotificationIcons`) that adjust the native Android build. If you're changing anything audio- or notification-related, these two folders are usually where the real native wiring lives.

## Setup

See the [README](README.md#building-from-source) for cloning and running the app. In short: `npm install`, then `npx expo start --dev-client`.

## Running tests

Tests live under `__tests__/`, mirroring the `src/` layout (`audio/`, `screens/`, `services/`, `utils/`).

```bash
npm test              # run the full suite once (jest --forceExit)
npm run test:watch    # watch mode
npm run test:coverage # with coverage
```

## Linting

The project ships an ESLint config (`.eslintrc.js`, React + React Hooks + React Native rules) but no `npm run lint` script yet — run it directly:

```bash
npx eslint .
```

(If you're looking for a small, genuinely useful first PR: adding a `lint` script to `package.json` is one.)

## Making a change

1. Fork the repo and create a branch off `main`.
2. Keep PRs focused — one fix or feature per PR is easier to review than a bundle of unrelated changes.
3. Add or update a test under `__tests__/` for any behavior you change, where practical.
4. Make sure `npm test` and `npx eslint .` are clean before opening the PR.
5. Describe *what* changed and *why* in the PR description — a screenshot or short clip is especially helpful for anything UI-facing.

## Reporting bugs / suggesting features

Open an [issue](https://github.com/MettaSurendhar/sibyl/issues). For bugs, include your Android version, the Sibyl version (Settings → About), and steps to reproduce. For feature ideas, a short description of the problem you're hitting is more useful than a fully-designed solution — happy to discuss the shape of it together.

## License

By contributing, you agree your contributions will be licensed under the project's [MIT License](LICENSE).
