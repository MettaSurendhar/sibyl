// jest.setup.js — Mocks for all native modules that can't run in Node.js

// ─── React Native Reanimated ──────────────────────────────────────────────────
require('react-native-reanimated/mock');

// ─── react-native-track-player ────────────────────────────────────────────────
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn().mockResolvedValue(undefined),
    updateOptions: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    skip: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    setRate: jest.fn().mockResolvedValue(undefined),
    setRepeatMode: jest.fn().mockResolvedValue(undefined),
    getPlaybackState: jest.fn().mockResolvedValue({ state: 'none' }),
    getProgress: jest.fn().mockResolvedValue({ position: 0, duration: 0, buffered: 0 }),
    getActiveTrackIndex: jest.fn().mockResolvedValue(0),
    registerPlaybackService: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  State: {
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Ended: 'ended',
    None: 'none',
    Buffering: 'buffering',
  },
  Capability: {
    Play: 'play',
    Pause: 'pause',
    SkipToNext: 'skip-to-next',
    SkipToPrevious: 'skip-to-previous',
    SeekTo: 'seek-to',
  },
  AppKilledPlaybackBehavior: {
    StopPlaybackAndRemoveNotification: 'stop-playback-and-remove-notification',
  },
  RepeatMode: { Off: 0, Track: 1, Queue: 2 },
  Event: {
    RemotePlay: 'remote-play',
    RemotePause: 'remote-pause',
    RemoteNext: 'remote-next',
    RemotePrevious: 'remote-previous',
    RemoteStop: 'remote-stop',
  },
}));

// ─── expo-av ─────────────────────────────────────────────────────────────────
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      pauseAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getStatusAsync: jest.fn().mockResolvedValue({ durationMillis: 1000 }),
      getURI: jest.fn(() => 'file:///mock/recording.m4a'),
    })),
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
    AndroidOutputFormat: { MPEG_4: 2 },
    AndroidAudioEncoder: { AAC: 3 },
    IOSOutputFormat: { MPEG4AAC: 'mpeg4aac' },
    IOSAudioQuality: { HIGH: 127 },
  },
}));

// ─── @react-native-async-storage/async-storage ───────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ─── expo-sqlite ──────────────────────────────────────────────────────────────
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue({ c: 0 }),
    prepareAsync: jest.fn().mockResolvedValue({
      executeAsync: jest.fn().mockResolvedValue({ getAllAsync: jest.fn().mockResolvedValue([]) }),
      finalizeAsync: jest.fn().mockResolvedValue(undefined),
    }),
  }),
}));

// ─── @notifee/react-native ────────────────────────────────────────────────────
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue('channel-id'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    stopForegroundService: jest.fn().mockResolvedValue(undefined),
    registerForegroundService: jest.fn(),
    onForegroundEvent: jest.fn(),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AndroidVisibility: { PUBLIC: 1 },
  AndroidForegroundServiceType: { FOREGROUND_SERVICE_TYPE_MICROPHONE: 128 },
}));

// ─── React Native Core Mocks ──────────────────────────────────────────────────
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'android',
  select: jest.fn((dict) => dict.android || dict.default),
}));

// ─── NativeModules — RecordingNotificationModule ──────────────────────────────
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
const { NativeModules } = require('react-native');
NativeModules.RecordingNotificationModule = {
  startNotification: jest.fn(),
  stopNotification: jest.fn(),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

// ─── expo-file-system ─────────────────────────────────────────────────────────
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
}));

// ─── expo-haptics ─────────────────────────────────────────────────────────────
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

// ─── expo-secure-store ────────────────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// ─── Navigation mocks ─────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: jest.fn((cb) => cb()),
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({ params: {} }),
  };
});

// ─── Safe Area ────────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
