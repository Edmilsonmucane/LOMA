import { it, expect } from 'vitest';
import { simulateContract, type Terms } from './index';
const terms: Terms = {
  method: 'flat',
  periodicity: 'monthly',
  rate: '0.1',
  minPrincipal: '100000',
  maxPrincipal: '1000000',
  minPeriods: 1,
  maxPeriods: 12,
  grace: { periods: 0, treatment: 'free' },
  fees: [],
  taxes: [],
  penalty: {
    toleranceDays: 0,
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
const input = {
  principal: 1000000n,
  periods: 6,
  startDate: '2026-10-07',
  terms,
};
it('historical v1 dispatch retains exact contract totals and the last instalment', () => {
  const quote = simulateContract(1, input);
  expect(quote.total).toBe(1600000n);
  expect(quote.instalments.at(-1)?.total).toBe(266665n);
});
it('unknown contract versions are refused rather than recalculated with current rules', () => {
  expect(() => simulateContract(2, input)).toThrow(
    'Unsupported contract engine version',
  );
});
