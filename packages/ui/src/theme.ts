export type BrandTokens = {
  accent: string;
  onAccent: string;
  accentHover: string;
  accentSoft: string;
};
function channels(hex: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Invalid brand colour');
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function mix(hex: string, target: number, weight: number): string {
  return (
    '#' +
    channels(hex)
      .map((value) =>
        Math.round(value * (1 - weight) + target * weight)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function deriveBrandTokens(accent: string): BrandTokens {
  channels(accent);
  const onAccent =
    contrastRatio(accent, '#ffffff') >= contrastRatio(accent, '#000000')
      ? '#ffffff'
      : '#000000';
  return {
    accent,
    onAccent,
    accentHover: mix(accent, onAccent === '#ffffff' ? 0 : 255, 0.12),
    accentSoft: mix(accent, 255, 0.94),
  };
}
