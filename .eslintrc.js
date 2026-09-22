module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  env: {
    'react-native/react-native': true,
    jest: true,
  },
  plugins: ['react', 'react-hooks', 'react-native'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['babel-preset-expo'],
    },
  },
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react-native/no-unused-styles': 'warn',
    'react-native/no-inline-styles': 'off', // User might use inline styles heavily
    'react-native/no-color-literals': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'no-unreachable': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
