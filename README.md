<div align="center">
  <img src="assets/header-icon.png"  height="128" alt="Sibyl Icon">
  <h1>Sibyl: Speak, and be remembered</h1>
  <p><strong>A local-first, privacy-respecting voice diary and audio manager.</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![F-Droid](https://img.shields.io/badge/F--Droid-Get_it_on-blue?logo=f-droid)](https://f-droid.org/)
</div>

---

Sibyl allows you to record audio, automatically name files using custom tag templates, browse and search your archive, and transcribe recordings on-demand.

All core features, including audio storage, playback, and editing, work **100% offline**. Your personal recordings never leave your device unless you explicitly choose to share them.

## Screenshots

|                                Dashboard & Analytics                                |                                   Library & Organization                                    |
| :---------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: |
|    <img src="assets/screenshots/home_screen.jpeg" width="300" alt="Home Screen">    |       <img src="assets/screenshots/library_main.jpeg" width="300" alt="Library View">       |
| <img src="assets/screenshots/analytics_breakdown.jpeg" width="300" alt="Analytics"> | <img src="assets/screenshots/recording_playback.jpeg" width="300" alt="Recording Playback"> |

<div align="center">
  <img src="assets/screenshots/transcript_highlighted.jpeg" width="300" alt="AI Transcription">
  <p><em>Lightning-fast on-device audio transcription</em></p>
</div>

## Features

- **Local-first Architecture:** SQLite storage with absolute privacy. No cloud lock-in.
- **Advanced Audio Engine:** Real microphone metering and high-performance scrolling waveforms.
- **Audio Editing:** Trim, merge, and append recordings natively right from your device (powered by FFmpeg).
- **Playback Controls:** Granular playback speed adjustment (0.5x to 2x) and skip-silence.
- **Smart Organization:** Group by date, powerful search, filter by color-coded tags, and edit in bulk.
- **On-Demand AI Transcription:** Convert speech to text securely using Groq's insanely fast Whisper API.
- **Dynamic Theming:** 5 beautifully crafted themes (2 dark, 3 light) with gorgeous typography that adapts to your system preferences.
- **Detailed Analytics:** Track your recording habits with beautiful, interactive charts.

## Get Sibyl

### Download the APK

You can grab the latest lightweight APK directly from the [Releases](https://github.com/MettaSurendhar/sibyl/releases/tag/v1.0.0) page. The APK is heavily optimized and compiled exclusively for `arm64-v8a` for a ~50% size reduction.

### F-Droid & IzzyOnDroid

Sibyl is fully open-source and ready for the F-Droid ecosystem repositories like IzzyOnDroid. The app bundles all necessary fonts, assets, and libraries internally to satisfy open-source compliance.

---

## Building from Source

This app is built using React Native and Expo (Bare Workflow).

### Prerequisites

- Node.js (v18+)
- Android SDK & NDK

### Local Setup

```bash
# Clone the repository
git clone https://github.com/MettaSurendhar/sibyl.git
cd sibyl

# Install dependencies
npm install

# Start the metro bundler
npx expo start --dev-client
```

## Groq Transcription Setup (Optional)

If you wish to use the ultra-fast transcription feature:

1. Generate a free API key at [console.groq.com/keys](https://console.groq.com/keys).
2. Open the app → Library → Settings ⚙️ → paste the key under "Transcription (Groq)".
3. The app automatically compresses and chunks your audio before securely sending it for transcription.

## License

Sibyl is released under the **MIT License**. See the `LICENSE` file for more details.
