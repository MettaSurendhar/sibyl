// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@notifee|react-native-track-player|ffmpeg-kit-react-native-community)',
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
};
