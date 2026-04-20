import { useSyncExternalStore } from 'react';
import { TERMINAL_FONTS, type TerminalFont } from '../../infrastructure/config/fonts';
import { getMonospaceFonts } from '../../lib/localFonts';

/**
 * Font IDs that are bundled via @fontsource and always available
 * regardless of system font installation.
 */
const BUNDLED_FONT_IDS = new Set(['jetbrains-mono']);

/**
 * Check if a font family is actually installed by comparing its rendered
 * width against a generic monospace fallback. `document.fonts.check()` is
 * unreliable for system fonts — it returns true even for missing fonts
 * because the browser falls back silently.
 */
function isFontAvailable(family: string): boolean {
  const primary = family.split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (!primary) return false;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    // Use a string with varied glyph widths to reduce false positives
    const testStr = 'mmmmmmmmmmlli1|WMwij';
    ctx.font = `72px monospace`;
    const fallbackWidth = ctx.measureText(testStr).width;
    ctx.font = `72px "${primary}", monospace`;
    const testWidth = ctx.measureText(testStr).width;
    return testWidth !== fallbackWidth;
  } catch {
    return false;
  }
}

/**
 * Global font store - singleton pattern using useSyncExternalStore
 * Ensures fonts are loaded only once and shared across all components
 */
type Listener = () => void;

interface FontStoreState {
  availableFonts: TerminalFont[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

class FontStore {
  private state: FontStoreState = {
    availableFonts: TERMINAL_FONTS,
    isLoading: false,
    isLoaded: false,
    error: null,
  };
  private listeners = new Set<Listener>();

  // Getters for individual state slices
  getAvailableFonts = (): TerminalFont[] => this.state.availableFonts;
  getIsLoading = (): boolean => this.state.isLoading;
  getIsLoaded = (): boolean => this.state.isLoaded;
  getError = (): string | null => this.state.error;

  private notify = () => {
    // Defer listener notification to avoid "setState during render"
    Promise.resolve().then(() => {
      this.listeners.forEach(listener => listener());
    });
  };

  private setState = (partial: Partial<FontStoreState>) => {
    this.state = { ...this.state, ...partial };
    this.notify();
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * Initialize font loading - safe to call multiple times,
   * will only load once
   */
  initialize = async (): Promise<void> => {
    // Already loaded or currently loading
    if (this.state.isLoaded || this.state.isLoading) {
      return;
    }

    this.setState({ isLoading: true, error: null });

    try {
      const localFonts = await getMonospaceFonts();
      
      // Build a set of locally detected font family names (case-insensitive)
      const localFontNames = new Set(
        localFonts.map(f => f.name.toLowerCase())
      );

      // Filter built-in fonts: keep only bundled (@fontsource) or locally installed
      const availableBuiltins = TERMINAL_FONTS.filter(font =>
        BUNDLED_FONT_IDS.has(font.id) || localFontNames.has(font.name.toLowerCase()) || isFontAvailable(font.family)
      );

      // Combine with local fonts, deduplicate by id
      const fontMap = new Map<string, TerminalFont>();

      availableBuiltins.forEach(font => fontMap.set(font.id, font));

      // Build a set of included font family names for dedup (case-insensitive)
      const includedFamilyNames = new Set(
        availableBuiltins.map(f => f.name.toLowerCase())
      );

      // Add local fonts, skipping those already covered by built-in fonts
      localFonts.forEach(font => {
        if (includedFamilyNames.has(font.name.toLowerCase())) return;
        const localId = font.id.startsWith('local-') ? font.id : `local-${font.id}`;
        fontMap.set(localId, { ...font, id: localId });
      });

      this.setState({
        availableFonts: Array.from(fontMap.values()),
        isLoading: false,
        isLoaded: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load local fonts';
      console.warn('Failed to fetch local fonts, using defaults:', error);
      // On error, still filter built-in fonts by availability
      const availableBuiltins = TERMINAL_FONTS.filter(font =>
        BUNDLED_FONT_IDS.has(font.id) || isFontAvailable(font.family)
      );
      this.setState({
        availableFonts: availableBuiltins.length > 0 ? availableBuiltins : TERMINAL_FONTS,
        isLoading: false,
        isLoaded: true,
        error: errorMessage,
      });
    }
  };

  /**
   * Find a font by ID with fallback
   */
  getFontById = (fontId: string): TerminalFont => {
    const fonts = this.state.availableFonts;
    return fonts.find(f => f.id === fontId) || fonts[0] || TERMINAL_FONTS[0];
  };
}

// Singleton instance
export const fontStore = new FontStore();

// ============== Hooks ==============

/**
 * Get available fonts - triggers initialization on first use
 */
export const useAvailableFonts = (): TerminalFont[] => {
  // Trigger initialization on first use
  if (!fontStore.getIsLoaded() && !fontStore.getIsLoading()) {
    fontStore.initialize();
  }
  
  return useSyncExternalStore(
    fontStore.subscribe,
    fontStore.getAvailableFonts
  );
};

/**
 * Get font loading state
 */
export const useFontsLoading = (): boolean => {
  return useSyncExternalStore(
    fontStore.subscribe,
    fontStore.getIsLoading
  );
};

/**
 * Get font by ID with fallback - useful for components that need a specific font
 */
export const useFontById = (fontId: string): TerminalFont => {
  const fonts = useAvailableFonts();
  return fonts.find(f => f.id === fontId) || fonts[0] || TERMINAL_FONTS[0];
};

/**
 * Initialize fonts eagerly (call at app startup)
 */
export const initializeFonts = (): void => {
  fontStore.initialize();
};
