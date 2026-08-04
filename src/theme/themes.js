export const themes = {
  // Sibyl theme — extracted from splash screen artwork + accessible text hierarchy.
  sibyl: {
    key: 'sibyl',
    label: 'Sibyl',
    isDark: true,
    bg: '#0C1525',           // deep navy — splash background
    surface: '#132038',      // slightly lighter navy for cards/sheets
    surfaceAlt: '#1A2E50',   // mid-navy for selected/hover surfaces
    border: '#243D60',       // subtle blue-navy border
    text: '#F0F4FF',         // bright white-blue — primary readable text
    textSecondary: '#C8DAEE',// soft blue-white — for labels, subtitles
    textMuted: '#7A99BB',    // desaturated blue-grey for secondary/muted text
    accent: '#C9A458',       // rich gold — the logo ring & lettering gold
    accentDeep: '#A07C30',   // deeper gold for pressed states
    teal: '#2ABCCE',         // cerulean teal — the hair highlight color
    tealDeep: '#1A8A9A',     // deeper teal for secondary teal elements
    danger: '#E07070',       // muted red for destructive actions
    success: '#5DC4A8',      // teal-green for success states
    waveform: '#2ABCCE',     // teal when idle
    waveformRecording: '#C9A458', // gold when actively recording
    waveformMuted: '#1A2E50',// muted waveform bg
  },

  // The original dark-green Sibyl palette, kept for those who prefer it.
  sibylClassic: {
    key: 'sibylClassic',
    label: 'Sibyl Classic',
    isDark: true,
    bg: '#0D1B14',
    surface: '#142A1F',
    surfaceAlt: '#1C3B2A',
    border: '#2A4A38',
    text: '#F3ECDC',
    textSecondary: '#D8CEBC',
    textMuted: '#8FA895',
    accent: '#C9973F',
    accentDeep: '#A67C2E',
    teal: '#3FAE8A',
    tealDeep: '#2C7A5F',
    danger: '#E38585',
    success: '#6FC2A6',
    waveform: '#3FAE8A',
    waveformRecording: '#C9973F',
    waveformMuted: '#33443C',
  },
  midnight: {
    key: 'midnight',
    label: 'Midnight (Dark)',
    isDark: true,
    bg: '#0F1115',
    surface: '#1B1E24',
    surfaceAlt: '#242832',
    border: '#2E323C',
    text: '#F2F3F5',
    textMuted: '#9AA0AC',
    accent: '#E5605A',
    waveform: '#E5605A',
    waveformMuted: '#3A3F4A',
  },
  paper: {
    key: 'paper',
    label: 'Paper (Light)',
    isDark: false,
    bg: '#FBF6EE',
    surface: '#FFFFFF',
    surfaceAlt: '#F3ECDD',
    border: '#E7DDC7',
    text: '#2B2620',
    textMuted: '#8A8070',
    accent: '#C1502E',
    waveform: '#C1502E',
    waveformMuted: '#E0D6C0',
  },
  slate: {
    key: 'slate',
    label: 'Slate (Light)',
    isDark: false,
    bg: '#F4F6F8',
    surface: '#FFFFFF',
    surfaceAlt: '#E9EDF1',
    border: '#DCE2E8',
    text: '#20242A',
    textMuted: '#767E88',
    accent: '#3A6DE0',
    waveform: '#3A6DE0',
    waveformMuted: '#D6DCE2',
  },
  sand: {
    key: 'sand',
    label: 'Sand (Light)',
    isDark: false,
    bg: '#F7F1E8',
    surface: '#FFFDF8',
    surfaceAlt: '#EFE4D2',
    border: '#E3D5BC',
    text: '#3A2F22',
    textMuted: '#8F7E64',
    accent: '#B8813A',
    waveform: '#B8813A',
    waveformMuted: '#E6D8BE',
  },
};

export const themeList = Object.values(themes);
export const DEFAULT_THEME_KEY = 'sibyl';
