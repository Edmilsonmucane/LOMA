import { describe, it, expect } from 'vitest';
import { deriveBrandTokens, contrastRatio } from './theme';
describe('brand contrast', () => {
  it.each([
    '#0e5a4a',
    '#ffffff',
    '#000000',
    '#ffcc00',
    '#b4452f',
    '#6b6f76',
    '#aabbcc',
  ])('keeps text readable for %s', (color) => {
    const tokens = deriveBrandTokens(color);
    expect(
      contrastRatio(tokens.accent, tokens.onAccent),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(tokens.accentHover, tokens.onAccent),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it('preserves AA across a deterministic RGB grid', () => {
    for (let r = 0; r < 256; r += 17)
      for (let g = 0; g < 256; g += 17)
        for (let b = 0; b < 256; b += 17) {
          const color =
            '#' +
            [r, g, b]
              .map((value) => value.toString(16).padStart(2, '0'))
              .join('');
          const tokens = deriveBrandTokens(color);
          expect(contrastRatio(color, tokens.onAccent)).toBeGreaterThanOrEqual(
            4.5,
          );
          expect(
            contrastRatio(tokens.accentHover, tokens.onAccent),
          ).toBeGreaterThanOrEqual(4.5);
        }
  });
  it('rejects malformed colours', () => {
    expect(() => deriveBrandTokens('red')).toThrow();
    expect(() => contrastRatio('#abc', '#ffffff')).toThrow();
  });
  it('computes known black/white contrast', () =>
    expect(contrastRatio('#000000', '#ffffff')).toBe(21));
});
