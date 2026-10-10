// @vitest-environment node
import { it, expect } from 'vitest';
import { validateProduct, productSchema } from './products';
import type { Terms } from '@loma/loan-engine';
const conditions: Terms = {
  method: 'flat',
  periodicity: 'monthly',
  rate: '0.1',
  minPrincipal: '100000',
  maxPrincipal: '1000000',
  minPeriods: 3,
  maxPeriods: 12,
  grace: { periods: 0, treatment: 'free' },
  fees: [],
  taxes: [],
  penalty: {
    toleranceDays: 3,
    dailyRate: '0',
    fine: { kind: 'fixed', value: '0' },
  },
  calendar: { holidays: [], weekendDays: [], adjustment: 'none' },
  allocation: ['fine', 'lateInterest', 'interest', 'principal'],
  excess: 'advance',
  settlement: 'due_interest',
  yearDays: 365,
  requirements: {
    documents: [],
    guarantees: [],
    minAge: null,
    minIncome: null,
  },
  approvalLevels: [{ upTo: '1000000', role: 'manager' }],
};
it('shared schema accepts complete terms and rejects unknown / incomplete fields', () => {
  expect(
    validateProduct({ name: 'Crédito Maputo', terms: conditions }).terms.rate,
  ).toBe('0.1');
  expect(
    productSchema.safeParse({
      name: 'Crédito',
      terms: { ...conditions, rate: null },
    }).success,
  ).toBe(false);
  expect(
    productSchema.safeParse({
      name: 'Crédito',
      terms: { ...conditions, unexpected: true },
    }).success,
  ).toBe(false);
  expect(
    productSchema.safeParse({
      name: 'Crédito',
      terms: { ...conditions, maxPrincipal: '1' },
    }).success,
  ).toBe(false);
});
it('publication checks future effective taxes, not just the current date', () => {
  expect(() =>
    validateProduct({
      name: 'Crédito',
      terms: {
        ...conditions,
        taxes: [
          {
            key: 'tax',
            kind: 'fixed',
            value: '100000',
            treatment: 'deducted',
            basis: 'principal',
            from: '2090-01-01',
            until: null,
          },
        ],
      },
    }),
  ).toThrow();
});
it('publication rejects a financed interest tax with no convergent solution', () => {
  expect(() =>
    validateProduct({
      name: 'Crédito',
      terms: {
        ...conditions,
        taxes: [
          {
            key: 'tax',
            kind: 'percentage',
            value: '2',
            treatment: 'financed',
            basis: 'interest',
            from: '2020-01-01',
            until: null,
          },
        ],
      },
    }),
  ).toThrow();
});
