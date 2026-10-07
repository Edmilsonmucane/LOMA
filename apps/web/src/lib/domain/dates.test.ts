import { it, expect } from 'vitest';
import { formatDate } from './dates';
const months = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];
it('uses translated month labels and Maputo dates without relying on abbreviated ICU data', () => {
  expect(formatDate('2026-10-07', months)).toBe('7 out 2026');
  expect(formatDate('2026-10-07T23:00:00Z', months)).toBe('8 out 2026');
  expect(formatDate('2028-02-29', months)).toBe('29 fev 2028');
});
it('rejects missing labels and invalid dates', () => {
  expect(() => formatDate('2026-10-07', [])).toThrow();
  expect(() => formatDate('bad', months)).toThrow();
});
