import { Platform } from 'react-native';

export const colors = {
  bg: '#fbf6f1',
  card: '#ffffff',
  cardAlt: '#f5ece5',
  text: '#2f221c',
  muted: '#8a756a',
  border: '#ecdfd6',
  primary: '#b5654a',
  primaryDark: '#9c533b',
  primarySoft: '#f7e6de',
  success: '#2f855a',
  successSoft: '#e6f4ea',
  warning: '#a86a12',
  warningSoft: '#fff4dc',
  danger: '#c53030',
  dangerSoft: '#fdecec',
  white: '#ffffff',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  title: { fontSize: 26, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.muted },
  price: { fontSize: 17, fontWeight: '800' as const, color: colors.text },
};

export const shadow = Platform.select({
  ios: { shadowColor: '#2f221c', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 4px 16px rgba(47,34,28,0.08)' },
}) as object;
