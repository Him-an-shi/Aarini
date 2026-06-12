/**
 * Aarini Design System Theme Tokens
 * Contains the visual style parameters for color palettes, spacing, typography, and premium elements.
 */

export const LIGHT_COLORS = {
  // Primary Brand Pastel Palette
  primary: '#E6E2F8',
  primaryDark: '#6F5BC5',
  primaryLight: '#F3F0FC',

  secondary: '#FFDFE5',
  secondaryDark: '#A9344E',

  accent: '#FFE5D9',
  accentDark: '#B5641E',

  success: '#E8F5E9',
  successDark: '#2E7D32',

  error: '#FFEBEE',
  errorDark: '#C62828',

  white: '#FFFFFF',
  background: '#F9F8FD',
  cardBackground: '#FFFFFF',
  inputBackground: '#FFFFFF',
  mutedBackground: '#F3F0FC',
  border: '#E6E2F8',
  borderStrong: '#B9AEE5',
  shadow: '#B9AEE5',

  textDark: '#2C2543',
  textMedium: '#5C5470',
  textLight: '#8A819F',
  textOnPrimary: '#FFFFFF',
  textOnSoft: '#4B3F72',
};

export const DARK_COLORS = {
  primary: '#4D416E',
  primaryDark: '#D7CAFF',
  primaryLight: '#2D2640',

  secondary: '#59303D',
  secondaryDark: '#FFB3C0',

  accent: '#5A3827',
  accentDark: '#FFC18B',

  success: '#183C28',
  successDark: '#89D18E',

  error: '#4F1F2A',
  errorDark: '#FF9BA8',

  white: '#FFFFFF',
  background: '#14111C',
  cardBackground: '#211B2D',
  inputBackground: '#1A1524',
  mutedBackground: '#2D2640',
  border: '#403752',
  borderStrong: '#7F70B6',
  shadow: '#07050A',

  textDark: '#F8F4FF',
  textMedium: '#D6CFE5',
  textLight: '#B6ABC9',
  textOnPrimary: '#211B2D',
  textOnSoft: '#F8F4FF',
};

export const COLORS = LIGHT_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 14,                     // Calm, friendly rounded inputs
  lg: 24,                     // Highly aesthetic rounded cards
  xl: 32,                     // Soft round button profiles
  round: 999,
};

const createShadows = (colors, isDark = false) => ({
  // Premium subtle shadows to convey professional card elevations
  light: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.32 : 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.38 : 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  glass: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.24 : 0.08,
    shadowRadius: 6,
    elevation: 2,
  }
});

const createTypography = (colors) => ({
  // Standard scale relying on system fonts, optimized for Android & iOS readability
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textDark,
    lineHeight: 34,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textDark,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
    lineHeight: 24,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textMedium,
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textMedium,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textLight,
    lineHeight: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textLight,
    letterSpacing: 0,
  }
});

export const SHADOWS = createShadows(LIGHT_COLORS);
export const TYPOGRAPHY = createTypography(LIGHT_COLORS);

export const createAppTheme = (mode = 'light') => {
  const isDark = mode === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return {
    mode,
    isDark,
    colors,
    spacing: SPACING,
    borderRadius: BORDER_RADIUS,
    shadows: createShadows(colors, isDark),
    typography: createTypography(colors),
    gradient: isDark
      ? [colors.background, '#1B1626', colors.primaryLight]
      : [colors.background, colors.primaryLight],
    splashGradient: isDark
      ? [colors.background, '#211B2D', colors.primaryLight]
      : [colors.white, colors.primaryLight, colors.primary],
    navigation: {
      dark: isDark,
      colors: {
        primary: colors.primaryDark,
        background: colors.background,
        card: colors.cardBackground,
        text: colors.textDark,
        border: colors.border,
        notification: colors.secondaryDark,
      },
    },
  };
};

export const LIGHT_THEME = createAppTheme('light');
export const DARK_THEME = createAppTheme('dark');
