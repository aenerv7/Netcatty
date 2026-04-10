import { Host } from './models';

const hasLegacyStringValue = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const hasLegacyNumberValue = (value: number | undefined): boolean =>
  typeof value === 'number' && !Number.isNaN(value);

const hasEffectiveOverride = (
  explicitOverride: boolean | undefined,
  legacyValuePresent: boolean,
): boolean => explicitOverride === true || (explicitOverride === undefined && legacyValuePresent);

export const hasHostThemeOverride = (host?: Pick<Host, 'themeOverride' | 'theme'> | null): boolean =>
  hasEffectiveOverride(host?.themeOverride, hasLegacyStringValue(host?.theme));

export const hasHostFontFamilyOverride = (host?: Pick<Host, 'fontFamilyOverride' | 'fontFamily'> | null): boolean =>
  hasEffectiveOverride(host?.fontFamilyOverride, hasLegacyStringValue(host?.fontFamily));

export const hasHostFontSizeOverride = (host?: Pick<Host, 'fontSizeOverride' | 'fontSize'> | null): boolean =>
  hasEffectiveOverride(host?.fontSizeOverride, hasLegacyNumberValue(host?.fontSize));

export const clearHostThemeOverride = (host: Host): Host => ({
  ...host,
  theme: undefined,
  themeOverride: false,
});

export const clearHostFontFamilyOverride = (host: Host): Host => ({
  ...host,
  fontFamily: undefined,
  fontFamilyOverride: false,
});

export const clearHostFontSizeOverride = (host: Host): Host => ({
  ...host,
  fontSize: undefined,
  fontSizeOverride: false,
});

export const resolveHostTerminalThemeId = (host: Pick<Host, 'theme' | 'themeOverride'> | null | undefined, defaultThemeId: string): string =>
  hasHostThemeOverride(host) && host?.theme ? host.theme : defaultThemeId;

/**
 * Map a UI theme preset ID to the terminal theme whose background matches
 * it exactly. Used when "Follow Application Theme" is enabled so the
 * terminal blends seamlessly with the app chrome. Returns undefined if no
 * match exists (caller should fall back to the global terminal theme).
 */
const UI_TO_TERMINAL_THEME: Record<string, string> = {
  // Light
  'snow': 'ui-snow',
  'pure-white': 'ui-pure-white',
  'ivory': 'ui-ivory',
  'mist': 'ui-mist',
  'mint': 'ui-mint',
  'sand': 'ui-sand',
  'lavender': 'ui-lavender',
  // Dark
  'pure-black': 'ui-pure-black',
  'midnight': 'ui-midnight',
  'deep-blue': 'ui-deep-blue',
  'vscode': 'ui-vscode',
  'graphite': 'ui-graphite',
  'obsidian': 'ui-obsidian',
  'forest': 'ui-forest',
};

export const getTerminalThemeForUiTheme = (uiThemeId: string): string | undefined =>
  UI_TO_TERMINAL_THEME[uiThemeId];

export const resolveHostTerminalFontFamilyId = (host: Host | null | undefined, defaultFontFamilyId: string): string =>
  hasHostFontFamilyOverride(host) && host?.fontFamily ? host.fontFamily : defaultFontFamilyId;

export const resolveHostTerminalFontSize = (host: Host | null | undefined, defaultFontSize: number): number =>
  hasHostFontSizeOverride(host) && host?.fontSize != null ? host.fontSize : defaultFontSize;

export const hasHostFontWeightOverride = (host?: Pick<Host, 'fontWeightOverride' | 'fontWeight'> | null): boolean =>
  hasEffectiveOverride(host?.fontWeightOverride, hasLegacyNumberValue(host?.fontWeight));

export const clearHostFontWeightOverride = (host: Host): Host => ({
  ...host,
  fontWeight: undefined,
  fontWeightOverride: false,
});

export const resolveHostTerminalFontWeight = (host: Host | null | undefined, defaultFontWeight: number): number =>
  hasHostFontWeightOverride(host) && host?.fontWeight != null ? host.fontWeight : defaultFontWeight;

