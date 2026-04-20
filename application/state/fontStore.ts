import { useSyncExternalStore } from 'react';
import { TERMINAL_FONTS, type TerminalFont } from '../../infrastructure/config/fonts';
import { getMonospaceFonts } from '../../lib/localFonts';

/**
 * Font IDs that are bundled via @fontsource and always available
 * regardless of system font installation.
 */
const BUNDLED_FONT_IDS = new Set(['jetbrains-mono']);

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

      // Index of built-in font metadata by lowercase name for enrichment
      const builtinByName = new Map(
        TERMINAL_FONTS.map(f => [f.name.toLowerCase(), f]),
      );

      const fontMap = new Map<string, TerminalFont>();

      // 1. Always include bundled @fontsource fonts
      for (const font of TERMINAL_FONTS) {
        if (BUNDLED_FONT_IDS.has(font.id)) {
          fontMap.set(font.id, font);
        }
      }

      // 2. Add locally detected fonts. If a local font matches a built-in
      //    entry, use the built-in metadata (nicer description, CJK fallback
      //    stack). Otherwise add it as a local-prefixed entry.
      for (const local of localFonts) {
        const builtin = builtinByName.get(local.name.toLowerCase());
        if (builtin) {
          // Use built-in metadata (has CJK fallback, description, etc.)
          if (!fontMap.has(builtin.id)) {
            fontMap.set(builtin.id, builtin);
          }
        } else {
          const localId = local.id.startsWith('local-') ? local.id : `local-${local.id}`;
          if (!fontMap.has(localId)) {
            fontMap.set(localId, { ...local, id: localId });
          }
        }
      }

      this.setState({
        availableFonts: Array.from(fontMap.values()),
        isLoading: false,
        isLoaded: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load local fonts';
      console.warn('Failed to fetch local fonts, using bundled only:', error);
      // On error, show only bundled fonts
      const bundled = TERMINAL_FONTS.filter(f => BUNDLED_FONT_IDS.has(f.id));
      this.setState({
        availableFonts: bundled.length > 0 ? bundled : TERMINAL_FONTS,
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
