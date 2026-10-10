// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  simulate,
  validateTerms,
  formatMoney,
  parseMoney,
  percentRate,
  percentValue,
  formatPercent,
  dueDate,
  daysBetween,
  validDate,
  cents,
  annualRate,
  lateCharges,
  allocatePayment,
  settlementAmount,
  eligibility,
  methods,
  type Terms,
  type Debt,
} from './index';
export function terms(overrides: Partial<Terms> = {}): Terms {
  return {
    method: 'flat',
    periodicity: 'monthly',
    rate: '0.1',
    minPrincipal: '1',
    maxPrincipal: '9999999999999999999999',
    minPeriods: 1,
    maxPeriods: 1200,
    grace: { periods: 0, treatment: 'free' },
    fees: [],
    taxes: [],
    penalty: {
      toleranceDays: 3,
      dailyRate: '0.005',
      fine: { kind: 'fixed', value: '0' },
    },
    calendar: { weekendDays: [], holidays: [], adjustment: 'none' },
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
    approvalLevels: [{ upTo: '9999999999999999999999', role: 'manager' }],
    ...overrides,
  };
}
const quote = (t = terms(), principal = 1000000n, periods = 6) =>
  simulate({ principal, periods, startDate: '2026-01-07', terms: t });
describe('mandatory financial vectors', () => {
  it('flat has exact total and last-cent correction', () => {
    const q = quote();
    expect(q.interest).toBe(600000n);
    expect(q.total).toBe(1600000n);
    expect(q.instalments.map((x) => x.total)).toEqual([
      266667n,
      266667n,
      266667n,
      266667n,
      266667n,
      266665n,
    ]);
  });
  it('Price uses actual rounded interest and closes at zero', () => {
    const q = quote(terms({ method: 'annuity', rate: '0.05' }));
    expect(q.interest).toBe(182105n);
    expect(q.instalments.map((x) => x.total)).toEqual([
      197017n,
      197017n,
      197017n,
      197017n,
      197017n,
      197020n,
    ]);
    expect(q.instalments.at(-1)?.balance).toBe(0n);
  });
  it('SAC preserves equal theoretical capital for interest calculation', () => {
    expect(quote(terms({ method: 'sac', rate: '0.05' })).interest).toBe(
      175000n,
    );
  });
  it('late interest starts after tolerance', () => {
    expect(
      lateCharges({
        dueDate: '2026-10-01',
        asOf: '2026-10-11',
        overdue: 266667n,
        policy: terms().penalty,
        fineAlreadyAssessed: false,
      }),
    ).toEqual({
      overdueDays: 10,
      chargeableDays: 7,
      lateInterest: 9333n,
      fine: 0n,
    });
  });
});
describe('schedule, fees, taxes, calendars and annual cost', () => {
  it.each(methods)('zero interest works for %s', (method) => {
    const q = quote(terms({ method, rate: '0' }));
    expect(q.interest).toBe(0n);
    expect(q.total).toBe(1000000n);
    expect(q.annualRate).toBe('0');
  });
  it('interest only and bullet return capital at the end', () => {
    for (const method of ['interest_only', 'bullet'] as const) {
      const q = quote(terms({ method }));
      expect(q.instalments.slice(0, 5).every((x) => x.principal === 0n)).toBe(
        true,
      );
      expect(q.instalments.at(-1)?.principal).toBe(1000000n);
      expect(q.interest).toBe(600000n);
    }
    expect(quote(terms({ method: 'bullet' })).instalments[0]?.total).toBe(0n);
  });
  it.each(['deducted', 'financed', 'separate'] as const)(
    'commission treatment %s',
    (treatment) => {
      const q = quote(
        terms({
          fees: [
            { key: 'opening', kind: 'percentage', value: '0.02', treatment },
          ],
        }),
      );
      expect(q.fees).toBe(20000n);
      expect(q.disbursed).toBe(treatment === 'deducted' ? 980000n : 1000000n);
      expect(q.financed).toBe(treatment === 'financed' ? 1020000n : 1000000n);
      expect(q.separate).toBe(treatment === 'separate' ? 20000n : 0n);
      expect(q.cost).toBe(q.total - q.disbursed);
    },
  );
  it('fixed charge and date-effective tax bases are auditable', () => {
    const q = quote(
      terms({
        fees: [
          {
            key: 'opening',
            kind: 'fixed',
            value: '10000',
            treatment: 'separate',
          },
        ],
        taxes: [
          {
            key: 'principal_tax',
            kind: 'percentage',
            value: '0.01',
            treatment: 'financed',
            from: '2026-01-01',
            until: '2026-01-07',
            basis: 'principal',
          },
          {
            key: 'fee_tax',
            kind: 'percentage',
            value: '0.1',
            treatment: 'separate',
            from: '2026-01-01',
            until: null,
            basis: 'fees',
          },
          {
            key: 'interest_tax',
            kind: 'percentage',
            value: '0.1',
            treatment: 'deducted',
            from: '2026-01-01',
            until: null,
            basis: 'interest',
          },
          {
            key: 'future_tax',
            kind: 'fixed',
            value: '123',
            treatment: 'separate',
            from: '2027-01-01',
            until: null,
            basis: 'principal',
          },
        ],
      }),
    );
    expect(q.financed).toBe(1010000n);
    expect(q.taxes).toBe(71600n);
    expect(q.charges.some((x) => x.key === 'future_tax')).toBe(false);
    expect(q.separate).toBe(11000n);
  });
  it.each(['free', 'interest_only', 'capitalise'] as const)(
    'grace treatment %s',
    (treatment) => {
      const q = quote(terms({ grace: { periods: 2, treatment } }));
      expect(q.instalments.at(-1)?.dueDate).toBe('2026-09-07');
      expect(q.instalments.reduce((s, x) => s + x.principal, 0n)).toBe(
        treatment === 'capitalise' ? 1210000n : 1000000n,
      );
      expect(q.instalments.reduce((s, x) => s + x.total, 0n)).toBe(q.total);
      if (treatment === 'free') expect(q.interest).toBe(600000n);
      if (treatment === 'interest_only') expect(q.interest).toBe(800000n);
      if (treatment === 'capitalise') expect(q.interest).toBe(936000n);
    },
  );
  it('month-end anchor, leap year, fortnight/week/day and holidays', () => {
    const calendar = {
      adjustment: 'next_business_day' as const,
      weekendDays: [0, 6],
      holidays: ['2026-02-02'],
    };
    expect(dueDate('2026-01-31', 1, 'daily', calendar)).toBe('2026-02-03');
    expect(dueDate('2024-01-31', 1, 'monthly', terms().calendar)).toBe(
      '2024-02-29',
    );
    expect(dueDate('2024-01-31', 2, 'monthly', terms().calendar)).toBe(
      '2024-03-31',
    );
    expect(dueDate('2026-01-01', 1, 'weekly', terms().calendar)).toBe(
      '2026-01-08',
    );
    expect(dueDate('2026-01-01', 1, 'fortnightly', terms().calendar)).toBe(
      '2026-01-15',
    );
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
  });
  it('XIRR agrees with annual cash flow and charges increase effective cost', () => {
    expect(
      annualRate(
        [
          { date: '2026-01-01', amount: -10000n },
          { date: '2027-01-01', amount: 11000n },
        ],
        365,
      ),
    ).toBe('0.1');
    expect(
      Number(
        quote(
          terms({
            fees: [
              {
                key: 'fee',
                kind: 'fixed',
                value: '1000',
                treatment: 'deducted',
              },
            ],
          }),
        ).annualRate,
      ),
    ).toBeGreaterThan(Number(quote().annualRate));
  });
  it('thousands of deterministic combinations conserve every cent', () => {
    let seed = 24873;
    const next = () => {
      seed = (seed * 16807) % 2147483647;
      return seed;
    };
    for (let i = 0; i < 3000; i++) {
      const method = methods[next() % methods.length]!;
      const principal = BigInt(10000 + (next() % 100000000));
      const periods = 1 + (next() % 36);
      const q = quote(
        terms({
          method,
          rate: `0.${(next() % 1000).toString().padStart(4, '0')}`,
        }),
        principal,
        periods,
      );
      expect(q.instalments.reduce((s, x) => s + x.total, 0n)).toBe(q.total);
      expect(q.instalments.reduce((s, x) => s + x.principal, 0n)).toBe(
        principal,
      );
      expect(q.instalments.at(-1)?.balance).toBe(0n);
      expect(
        q.instalments.every(
          (x) => x.principal >= 0n && x.interest >= 0n && x.balance >= 0n,
        ),
      ).toBe(true);
    }
  }, 120000);
  it('bigint values exceed Number.MAX_SAFE_INTEGER without loss', () => {
    const q = quote(terms({ rate: '0' }), 999999999999999999n);
    expect(q.total).toBe(999999999999999999n);
  });
});
const debts = (): Debt[] => [
  {
    id: 'old',
    from: '2026-09-01',
    dueDate: '2026-10-01',
    fine: 1000n,
    lateInterest: 2000n,
    interest: 3000n,
    principal: 4000n,
  },
  {
    id: 'next',
    from: '2026-10-01',
    dueDate: '2026-10-31',
    fine: 0n,
    lateInterest: 0n,
    interest: 6000n,
    principal: 10000n,
  },
];
describe('payments and early settlement', () => {
  it('partial payment follows waterfall in oldest instalment', () => {
    const result = allocatePayment({
      amount: 4500n,
      asOf: '2026-10-16',
      debts: debts().reverse(),
      order: terms().allocation,
      excess: 'advance',
    });
    expect(result.allocations).toEqual([
      { id: 'old', component: 'fine', amount: 1000n },
      { id: 'old', component: 'lateInterest', amount: 2000n },
      { id: 'old', component: 'interest', amount: 1500n },
    ]);
    expect(result.debts[0]?.interest).toBe(1500n);
    expect(result.credit).toBe(0n);
    expect(debts()[0]?.interest).toBe(3000n);
  });
  it('excess can advance instalments or stay as credit', () => {
    for (const excess of ['advance', 'credit'] as const) {
      const result = allocatePayment({
        amount: 12000n,
        asOf: '2026-10-16',
        debts: debts(),
        order: terms().allocation,
        excess,
      });
      expect(result.credit).toBe(excess === 'credit' ? 2000n : 0n);
      expect(
        result.allocations.reduce((s, x) => s + x.amount, 0n) + result.credit,
      ).toBe(12000n);
    }
    expect(
      allocatePayment({
        amount: 30000n,
        asOf: '2026-10-16',
        debts: debts(),
        order: [...terms().allocation].reverse(),
        excess: 'advance',
      }).credit,
    ).toBe(4000n);
  });
  it.each([
    ['contract_interest', 26000n],
    ['proportional_interest', 23000n],
    ['due_interest', 20000n],
  ] as const)('settlement %s', (mode, total) => {
    expect(
      settlementAmount({ debts: debts(), asOf: '2026-10-16', mode }).total,
    ).toBe(total);
  });
  it('fixed/percentage fine applied once and future/on-time debts accrue none', () => {
    const base = {
      dueDate: '2026-10-01',
      asOf: '2026-10-11',
      overdue: 10000n,
      policy: {
        ...terms().penalty,
        fine: { kind: 'percentage' as const, value: '0.02' },
      },
      fineAlreadyAssessed: false,
    };
    expect(lateCharges(base).fine).toBe(200n);
    expect(lateCharges({ ...base, fineAlreadyAssessed: true }).fine).toBe(0n);
    expect(
      lateCharges({
        ...base,
        policy: { ...base.policy, fine: { kind: 'fixed', value: '500' } },
      }).fine,
    ).toBe(500n);
    expect(lateCharges({ ...base, asOf: '2026-09-30' }).lateInterest).toBe(0n);
    expect(lateCharges({ ...base, overdue: 0n }).fine).toBe(0n);
  });
  it('eligibility and approval thresholds are data', () => {
    const t = terms({
      requirements: {
        documents: ['BI'],
        guarantees: ['Fiador'],
        minAge: 18,
        minIncome: '10000',
      },
      approvalLevels: [
        { upTo: '1000000', role: 'analyst' },
        { upTo: '9999999999999999999999', role: 'manager' },
      ],
    });
    expect(
      eligibility(
        t,
        { age: 20, income: 10000n, documents: ['BI'], guarantees: ['Fiador'] },
        1000000n,
      ),
    ).toEqual({ eligible: true, approvalRole: 'analyst' });
    expect(
      eligibility(
        t,
        { age: 17, income: 9999n, documents: [], guarantees: [] },
        1000001n,
      ),
    ).toEqual({ eligible: false, approvalRole: 'manager' });
    expect(
      eligibility(
        t,
        { age: 30, income: 10000n, documents: ['BI'], guarantees: ['Fiador'] },
        999999999999999999999999n,
      ).approvalRole,
    ).toBeNull();
  });
});
describe('validation and exact formats', () => {
  it('half up, comma input, no float formatting', () => {
    expect(cents('1.5')).toBe(2n);
    expect(parseMoney('10000,01')).toBe(1000001n);
    expect(formatMoney(1000001n)).toBe('10 000,01 MT');
    expect(formatMoney(-1n)).toBe('-0,01 MT');
    expect(percentRate('0,5')).toBe('0.005');
  });
  it.each(['2026-02-30', 'bad', '2026-13-01'])('rejects date %s', (date) =>
    expect(() => validDate(date)).toThrow(),
  );
  it.each(['-1', '1.123', 'NaN', '1e10'])('rejects money %s', (x) =>
    expect(() => parseMoney(x)).toThrow(),
  );
  it.each([
    { method: 'bad' },
    { periodicity: 'bad' },
    { minPrincipal: '0' },
    { maxPrincipal: '0' },
    { rate: 'NaN' },
    { rate: '-1' },
    { minPeriods: 0 },
    { maxPeriods: 0 },
    { grace: { periods: -1, treatment: 'free' } },
    { grace: { periods: 0, treatment: 'bad' } },
    { fees: [{ key: '', kind: 'fixed', value: '1', treatment: 'separate' }] },
    { fees: [{ key: 'x', kind: 'bad', value: '1', treatment: 'separate' }] },
    { fees: [{ key: 'x', kind: 'fixed', value: '-1', treatment: 'separate' }] },
    { fees: [{ key: 'x', kind: 'fixed', value: '1', treatment: 'bad' }] },
    {
      fees: [
        { key: 'x', kind: 'percentage', value: 'x', treatment: 'separate' },
      ],
    },
    {
      penalty: {
        toleranceDays: -1,
        dailyRate: '0',
        fine: { kind: 'fixed', value: '0' },
      },
    },
    {
      penalty: {
        toleranceDays: 0,
        dailyRate: '-1',
        fine: { kind: 'fixed', value: '0' },
      },
    },
    {
      penalty: {
        toleranceDays: 0,
        dailyRate: '0',
        fine: { kind: 'bad', value: '0' },
      },
    },
    {
      penalty: {
        toleranceDays: 0,
        dailyRate: '0',
        fine: { kind: 'fixed', value: '-1' },
      },
    },
    {
      calendar: {
        weekendDays: [0, 1, 2, 3, 4, 5, 6],
        holidays: [],
        adjustment: 'none',
      },
    },
    { calendar: { weekendDays: [7], holidays: [], adjustment: 'none' } },
    { calendar: { weekendDays: [], holidays: [], adjustment: 'bad' } },
    { allocation: [] },
    { allocation: ['fine', 'fine', 'principal', 'interest'] },
    { allocation: ['fine', 'bad', 'principal', 'interest'] },
    { excess: 'bad' },
    { settlement: 'bad' },
    { yearDays: 0 },
    {
      requirements: {
        documents: [],
        guarantees: [],
        minAge: -1,
        minIncome: null,
      },
    },
    {
      requirements: {
        documents: [],
        guarantees: [],
        minAge: null,
        minIncome: '-1',
      },
    },
    {
      requirements: {
        documents: [''],
        guarantees: [],
        minAge: null,
        minIncome: null,
      },
    },
    { approvalLevels: [] },
    { approvalLevels: [{ upTo: '1', role: '' }] },
    {
      approvalLevels: [
        { upTo: '2', role: 'x' },
        { upTo: '1', role: 'x' },
      ],
    },
  ])('rejects invalid configuration %#', (patch) =>
    expect(() => validateTerms(terms(patch as Partial<Terms>))).toThrow(),
  );
  it('rejects unpayable cashflows, out-of-range principal and duration', () => {
    expect(() =>
      quote(
        terms({
          fees: [
            {
              key: 'x',
              kind: 'fixed',
              value: '1000000',
              treatment: 'deducted',
            },
          ],
        }),
      ),
    ).toThrow();
    expect(() => quote(terms(), 0n)).toThrow();
    expect(() => quote(terms(), 100n, 0)).toThrow();
  });
});
describe('boundary and rejection coverage', () => {
  it('financed interest-based taxes converge without float or circular estimates', () => {
    const q = quote(
      terms({
        taxes: [
          {
            key: 'tax',
            kind: 'percentage',
            value: '0.1',
            treatment: 'financed',
            from: '2026-01-01',
            until: null,
            basis: 'interest',
          },
        ],
      }),
    );
    expect(q.financed).toBe(1063830n);
    expect(q.interest).toBe(638298n);
    expect(q.taxes).toBe(63830n);
    expect(q.instalments.reduce((s, r) => s + r.total, 0n)).toBe(q.total);
  });
  it('small principal and zero rate still conserve principal', () => {
    for (const method of methods) {
      const q = quote(terms({ method, rate: '0' }), 4n, 6);
      expect(q.total).toBe(4n);
      expect(q.instalments.at(-1)?.balance).toBe(0n);
    }
  });
  it.each([
    {
      taxes: [
        {
          key: 'x',
          kind: 'fixed',
          value: '1',
          treatment: 'separate',
          from: 'bad',
          until: null,
          basis: 'principal',
        },
      ],
    },
    {
      taxes: [
        {
          key: 'x',
          kind: 'fixed',
          value: '1',
          treatment: 'separate',
          from: '2026-01-01',
          until: 'bad',
          basis: 'principal',
        },
      ],
    },
    {
      taxes: [
        {
          key: 'x',
          kind: 'fixed',
          value: '1',
          treatment: 'separate',
          from: '2026-01-01',
          until: '2025-01-01',
          basis: 'principal',
        },
      ],
    },
    {
      taxes: [
        {
          key: 'x',
          kind: 'fixed',
          value: '1',
          treatment: 'separate',
          from: '2026-01-01',
          until: null,
          basis: 'bad',
        },
      ],
    },
    {
      fees: [
        { key: 'x', kind: 'fixed', value: '1', treatment: 'separate' },
        { key: 'x', kind: 'fixed', value: '1', treatment: 'separate' },
      ],
    },
    {
      penalty: {
        toleranceDays: 0,
        dailyRate: '0',
        fine: { kind: 'percentage', value: '-1' },
      },
    },
    {
      requirements: {
        documents: [],
        guarantees: [''],
        minAge: null,
        minIncome: null,
      },
    },
    { approvalLevels: [{ upTo: '-1', role: 'manager' }] },
  ])('rejects invalid tax and requirement %#', (patch) =>
    expect(() => validateTerms(terms(patch as Partial<Terms>))).toThrow(),
  );
  it('payment validation rejects duplicates, unknown waterfall and negative balances', () => {
    const b = {
      amount: 1n,
      asOf: '2026-10-16',
      debts: debts(),
      order: terms().allocation,
      excess: 'advance' as const,
    };
    expect(() => allocatePayment({ ...b, amount: -1n })).toThrow();
    expect(() => allocatePayment({ ...b, order: [] })).toThrow();
    expect(() =>
      allocatePayment({
        ...b,
        order: ['fine', 'fine', 'interest', 'principal'],
      }),
    ).toThrow();
    expect(() =>
      allocatePayment({
        ...b,
        order: ['fine', 'bad', 'interest', 'principal'] as never,
      }),
    ).toThrow();
    expect(() => allocatePayment({ ...b, excess: 'bad' as never })).toThrow();
    expect(() =>
      allocatePayment({ ...b, debts: [debts()[0]!, debts()[0]!] }),
    ).toThrow();
    expect(() =>
      allocatePayment({ ...b, debts: [{ ...debts()[0]!, principal: -1n }] }),
    ).toThrow();
    expect(allocatePayment({ ...b, amount: 0n }).allocations).toEqual([]);
  });
  it('settlement and eligibility reject impossible inputs', () => {
    expect(() =>
      settlementAmount({
        debts: debts(),
        asOf: '2026-10-16',
        mode: 'bad' as never,
      }),
    ).toThrow();
    expect(() =>
      settlementAmount({
        debts: [{ ...debts()[0]!, fine: -1n }],
        asOf: '2026-10-16',
        mode: 'due_interest',
      }),
    ).toThrow();
    expect(
      settlementAmount({
        debts: debts(),
        asOf: '2026-08-01',
        mode: 'proportional_interest',
      }).interest,
    ).toBe(0n);
    expect(() =>
      settlementAmount({
        debts: [{ ...debts()[0]!, from: '2026-11-01' }],
        asOf: '2026-10-16',
        mode: 'proportional_interest',
      }),
    ).toThrow();
    for (const customer of [
      { age: NaN, income: 1n, documents: [], guarantees: [] },
      { age: 20, income: -1n, documents: [], guarantees: [] },
    ])
      expect(() => eligibility(terms(), customer, 1n)).toThrow();
    expect(() =>
      eligibility(
        terms(),
        { age: 20, income: 1n, documents: [], guarantees: [] },
        -1n,
      ),
    ).toThrow();
  });
  it('late and calendar reject impossible values', () => {
    for (const fine of [
      { kind: 'fixed', value: '-1' },
      { kind: 'percentage', value: '-0.1' },
      { kind: 'bad', value: '1' },
    ])
      expect(() =>
        lateCharges({
          dueDate: '2026-01-01',
          asOf: '2026-01-02',
          overdue: 1n,
          policy: { ...terms().penalty, fine } as Terms['penalty'],
          fineAlreadyAssessed: true,
        }),
      ).toThrow();
    expect(() =>
      lateCharges({
        dueDate: '2026-01-01',
        asOf: '2026-01-02',
        overdue: -1n,
        policy: terms().penalty,
        fineAlreadyAssessed: false,
      }),
    ).toThrow();
    expect(() =>
      dueDate('2026-01-01', 1, 'daily', {
        holidays: [],
        weekendDays: [0, 1, 2, 3, 4, 5, 6],
        adjustment: 'next_business_day',
      }),
    ).toThrow();
  });
  it('annual rate requires a valid lending cashflow', () => {
    for (const flows of [
      [],
      [
        { date: '2026-01-01', amount: 1n },
        { date: '2027-01-01', amount: 2n },
      ],
      [
        { date: '2026-01-01', amount: -1n },
        { date: '2027-01-01', amount: -2n },
      ],
      [
        { date: '2026-01-01', amount: -2n },
        { date: '2027-01-01', amount: 1n },
      ],
      [
        { date: '2026-01-01', amount: -1n },
        { date: '2025-01-01', amount: 2n },
      ],
      [
        { date: '2026-01-01', amount: -1n },
        { date: '2026-01-01', amount: 2n },
      ],
    ])
      expect(() => annualRate(flows, 365)).toThrow();
    expect(() =>
      annualRate(
        [
          { date: '2026-01-01', amount: -1n },
          { date: '2026-01-01', amount: 2n },
          { date: '2027-01-01', amount: 1n },
        ],
        365,
      ),
    ).toThrow();
  });
});

it('percentage display accepts computed scientific notation but rejects non-finite values', () => {
  expect(percentValue('1e3')).toBe('100000');
  expect(() => percentValue('NaN')).toThrow();
  expect(() => percentValue('-1')).toThrow();
});

it('formatted effective rate rounds half up for display only', () => {
  expect(formatPercent('0.05005')).toBe('5,01%');
  expect(() => formatPercent('Infinity')).toThrow();
  expect(() => formatPercent('-1')).toThrow();
});

it('SAC after capitalised grace retains constant amortisation and explicit capitalisation history', () => {
  const q = quote(
    terms({
      method: 'sac',
      rate: '0.05',
      grace: { periods: 2, treatment: 'capitalise' },
    }),
  );
  expect(q.capitalisedInterest).toBe(102500n);
  expect(q.instalments.slice(0, 2).map((r) => r.total)).toEqual([0n, 0n]);
  expect(q.instalments[2]!.from).toBe('2026-03-07');
  expect(q.instalments[2]!.principal).toBe(183750n);
  expect(q.instalments.reduce((s, r) => s + r.principal, 0n)).toBe(
    q.financed + q.capitalisedInterest,
  );
  expect(
    q.instalments.reduce((s, r) => s + r.interest + r.capitalisedInterest, 0n),
  ).toBe(q.interest);
});
