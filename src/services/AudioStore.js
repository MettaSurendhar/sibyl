// Module-level singleton that holds the currently active audio player.
// This lives OUTSIDE React components so that Notifee's onBackgroundEvent
// can control playback directly — background events run before React mounts
// or after components re-render, so component refs are not reliable there.
//
// The recorder ref is also stored here so recording notifications can
// pause/resume/discard without going through React state.

let _recorder = null;    // { pause, resume, discard, stop }
let _isRecording = false;
let _recordingElapsedMs = 0;

export const AudioStore = {

	// ─── Recording ─────────────────────────────────────────────────────────────
	setRecorder(recorder) {
		_recorder = recorder;
		_isRecording = true;
		_recordingElapsedMs = 0;
	},
	updateRecording(elapsedMs, isRecording) {
		_recordingElapsedMs = elapsedMs;
		_isRecording = isRecording;
	},
	clearRecorder() {
		_recorder = null;
		_isRecording = false;
		_recordingElapsedMs = 0;
	},

	getRecorder()          { return _recorder; },
	isRecording()          { return _isRecording; },
	getRecordingElapsedMs() { return _recordingElapsedMs; },
};
