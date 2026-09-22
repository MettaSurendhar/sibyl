# Sibyl: Speak, and be remembered

A local-first, privacy-respecting voice diary app. Sibyl allows you to record audio, automatically name files using custom tag templates, browse and search your archive, and transcribe recordings on-demand. 

All core features, including audio storage, playback, and editing, work **100% offline**. Your personal recordings never leave your device unless you explicitly choose to share them.

## Features
- **Local-first Architecture:** SQLite storage with absolute privacy.
- **Advanced Audio Engine:** Real microphone metering and waveforms.
- **Audio Editing:** Trim, merge, and append recordings natively (powered by FFmpeg).
- **Playback Controls:** Synced scrolling waveform, playback speed adjustment, and skip-silence.
- **Smart Organization:** Group by date, search, filter by tag, and edit in bulk.
- **On-Demand Transcription:** Convert speech to text securely using Groq's free Whisper API (requires internet).
- **Theming:** 5 beautifully crafted themes (2 dark, 3 light) adapting to system preferences.

## Building from Source

This app is built using React Native and Expo (Bare Workflow). It does not rely on Expo Go. 

### Prerequisites
- Node.js (v18+)
- Android SDK & NDK

### Local Setup
```bash
# Clone the repository
git clone https://github.com/YourUsername/voice-journal.git
cd voice-journal

# Install dependencies
npm install

# Start the metro bundler
npx expo start --dev-client
```

### Building the APK (Locally or via EAS)
To build a standalone APK, you can use Expo Application Services (EAS):
```bash
eas build --profile preview --platform android
```
*(Note: The build is heavily optimized for `arm64-v8a` and utilizes an audio-only FFmpeg package to keep the APK size extremely lightweight).*

## Groq Transcription Setup (Optional)
If you wish to use the transcription feature:
1. Generate a free API key at [console.groq.com/keys](https://console.groq.com/keys).
2. Open the app → Library → ⋮ → Settings → paste the key under "Transcription (Groq)".
3. The app will compress and chunk your audio before securely sending it for transcription.

## F-Droid & IzzyOnDroid Availability
Sibyl is fully open-source and compatible with F-Droid ecosystem repositories like IzzyOnDroid. The app bundles all necessary fonts, assets, and libraries internally to satisfy open-source compliance. 

## License
Sibyl is released under the **MIT License**. See the `LICENSE` file for more details.
