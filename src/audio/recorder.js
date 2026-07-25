import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export const RECORDINGS_DIR = FileSystem.documentDirectory + 'recordings/';

export async function ensureRecordingsDir() {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

// High quality AAC (.m4a) recording preset - true native format supported on both platforms.
// (Real MP3 output, if enabled, is produced as a post-processing transcode step - see audio/transcode.js)
const RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

// Creates a recorder instance. Call .start(), .pause(), .resume(), .stop().
// onMeter(dbLevel, positionMillis) fires roughly every 100ms while recording for the live waveform.
export function createRecorder({ onMeter }) {
  let recording = null;

  async function requestPermissions() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission not granted');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }

  async function start() {
    await requestPermissions();
    await ensureRecordingsDir();
    recording = new Audio.Recording();
    await recording.prepareToRecordAsync(RECORDING_OPTIONS);
    recording.setProgressUpdateInterval(100);
    recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && typeof status.metering === 'number') {
        onMeter && onMeter(status.metering, status.durationMillis);
      }
    });
    await recording.startAsync();
  }

  async function pause() {
    if (recording) await recording.pauseAsync();
  }

  async function resume() {
    if (recording) await recording.startAsync();
  }

  // Stops recording, moves the temp file into permanent storage, returns { uri, durationMs }
  async function stop() {
    if (!recording) return null;
    await recording.stopAndUnloadAsync();
    const status = await recording.getStatusAsync();
    const tempUri = recording.getURI();
    const filename = `rec_${Date.now()}.m4a`;
    const finalUri = RECORDINGS_DIR + filename;
    await FileSystem.moveAsync({ from: tempUri, to: finalUri });
    recording = null;
    return { uri: finalUri, durationMs: status.durationMillis || 0 };
  }

  async function discard() {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const tempUri = recording.getURI();
      if (tempUri) await FileSystem.deleteAsync(tempUri, { idempotent: true });
    } catch (e) {
      // already stopped, ignore
    }
    recording = null;
  }

  return { start, pause, resume, stop, discard };
}
