import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TERMINAL_FONTS } from './fonts';

/**
 * Proportional (non-monospace) fonts must never appear in the terminal
 * primary font dropdown. They produce broken cell-grid alignment because
 * xterm.js samples cell width from a single probe glyph, and a font with
 * variable-width Latin glyphs renders other characters with inconsistent
 * widths around (or beyond) that cell.
 */
const KNOWN_PROPORTIONAL_FONTS = [
  // CJK system fonts — proportional sans-serif designed for body text.
  'PingFang SC',
  'PingFang TC',
  'PingFang HK',
  'Microsoft YaHei',
  'Microsoft YaHei UI',
  'Hiragino Sans GB',
  'Hiragino Sans',
  'Heiti SC',
  'Heiti TC',
  // Latin proportional fonts that get mistakenly listed as "terminal
  // fonts". Comic Sans MS was historically in this dropdown labeled
  // "non-traditional terminal font" — picking it produced bloated cell
  // widths because Comic Sans is a handwriting-style proportional face.
  'Comic Sans MS',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Times',
  'Georgia',
  'Verdana',
  'Trebuchet MS',
  'Tahoma',
];

describe('TERMINAL_FONTS dropdown contents', () => {
  it('does not list any known proportional font as a primary choice', () => {
    for (const banned of KNOWN_PROPORTIONAL_FONTS) {
      const matches = TERMINAL_FONTS.filter((f) =>
        f.name === banned ||
        f.family.includes(`"${banned}"`) ||
        f.family.split(',')[0].trim() === banned,
      );
      assert.deepEqual(
        matches,
        [],
        `${banned} must not appear in TERMINAL_FONTS — it is proportional and breaks terminal grid alignment`,
      );
    }
  });

  it('every entry has a non-empty id, name, and family', () => {
    for (const font of TERMINAL_FONTS) {
      assert.ok(font.id.length > 0, `${JSON.stringify(font)} missing id`);
      assert.ok(font.name.length > 0, `${font.id} missing name`);
      assert.ok(font.family.length > 0, `${font.id} missing family`);
    }
  });

  it('font ids are unique', () => {
    const seen = new Set<string>();
    for (const font of TERMINAL_FONTS) {
      assert.equal(seen.has(font.id), false, `duplicate id: ${font.id}`);
      seen.add(font.id);
    }
  });
});
