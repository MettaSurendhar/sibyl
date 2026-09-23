# Changelog

All notable changes to Sibyl are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - YYYY-MM-DD

<!-- Replace the date above with the actual v1.0.0 release date. -->

Initial public release.

### Added

- Local, offline audio recording with live waveform metering.
- Non-destructive **Trim**, **Merge**, and **Append** editing, powered by FFmpeg.
- Custom color- and icon-coded **tags**, each with an independent, token-based naming template (`{tag}`, `<count>`, `<date>`, `<time>`), plus a fully custom "type it yourself" naming option.
- **Library**: date-grouped browsing, tag + date filtering (including a custom range), and dual-mode search across recording names *or* full transcript text.
- Bulk actions: share, rename, delete.
- **On-demand and automatic AI transcription** via Groq's Whisper API, with a Fast (Turbo) / Accurate (Large v3) model choice, language auto-detect or manual override, and exportable (copy/share/download) transcripts.
- **Analytics dashboard**: total time, average length, peak recording time, day streaks, monthly activity, and per-tag trend/breakdown charts.
- **Playback controls**: 0.5x–2x speed, skip-silence, and set-as-ringtone.
- **6 themes** (3 dark, 3 light) and **6 typefaces**, plus a personalized display name.
- **Optional two-way external folder sync** for backup and importing outside audio files.
- Full in-app Privacy Policy, Terms of Service, and Open Source Licenses.

[Unreleased]: https://github.com/MettaSurendhar/sibyl/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/MettaSurendhar/sibyl/releases/tag/v1.0.0
