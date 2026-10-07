import Decimal from 'decimal.js';
const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
export type Money = bigint;
export type Rate = string;
export const methods = [
  'flat',
  'annuity',
  'sac',
  'interest_only',
  'bullet',
] as const;
export const periodicities = [
  'daily',
  'weekly',
  'fortnightly',
  'monthly',
] as const;
export type Method = (typeof methods)[number];
export type Periodicity = (typeof periodicities)[number];
export type Component = 'fine' | 'lateInterest' | 'interest' | 'principal';
export type Charge = {
  key: string;
  kind: 'fixed' | 'percentage';
  value: string;
  treatment: 'deducted' | 'financed' | 'separate';
};
export type Tax = Charge & {
  from: string;
  until: string | null;
  basis: 'principal' | 'interest' | 'fees';
};
export type Terms = {
  method: Method;
  periodicity: Periodicity;
  rate: Rate;
  minPrincipal: string;
  maxPrincipal: string;
  minPeriods: number;
  maxPeriods: number;
  grace: {
    periods: number;
    treatment: 'free' | 'interest_only' | 'capitalise';
  };
  fees: Charge[];
  taxes: Tax[];
  penalty: {
    toleranceDays: number;
    dailyRate: Rate;
    fine: { kind: 'fixed' | 'percentage'; value: string };
  };
  calendar: {
    holidays: string[];
    weekendDays: number[];
    adjustment: 'none' | 'next_business_day';
  };
  allocation: Component[];
  excess: 'advance' | 'credit';
  settlement: 'contract_interest' | 'proportional_interest' | 'due_interest';
  yearDays: number;
  requirements: {
    documents: string[];
    guarantees: string[];
    minAge: number | null;
    minIncome: string | null;
  };
  approvalLevels: { upTo: string; role: string }[];
};
export type Instalment = {
  number: number;
  from: string;
  dueDate: string;
  principal: Money;
  interest: Money;
  capitalisedInterest: Money;
  total: Money;
  balance: Money;
};
export type Quote = {
  requested: Money;
  financed: Money;
  disbursed: Money;
  separate: Money;
  fees: Money;
  taxes: Money;
  capitalisedInterest: Money;
  interest: Money;
  total: Money;
  cost: Money;
  annualRate: string;
  instalments: Instalment[];
  charges: (Charge & { amount: Money })[];
};
function fail(): never {
  throw new Error('Invalid loan terms');
}
export function cents(value: string | Decimal): Money {
  return BigInt(new D(value).toDecimalPlaces(0).toFixed(0));
}
function decimal(value: Money): Decimal {
  return new D(value.toString());
}
function natural(value: string): boolean {
  return /^\d+$/.test(value);
}
function rate(value: string): Decimal {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) fail();
  return new D(value);
}
function integer(value: number, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail();
}
export function validDate(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    fail();
}
export function daysBetween(from: string, to: string): number {
  validDate(from);
  validDate(to);
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  );
}
export function validateTerms(t: Terms): void {
  if (
    !methods.includes(t.method) ||
    !periodicities.includes(t.periodicity) ||
    !natural(t.minPrincipal) ||
    !natural(t.maxPrincipal) ||
    BigInt(t.minPrincipal) < 1n ||
    BigInt(t.maxPrincipal) < BigInt(t.minPrincipal)
  )
    fail();
  rate(t.rate);
  integer(t.minPeriods, 1, 1200);
  integer(t.maxPeriods, t.minPeriods, 1200);
  integer(t.grace.periods, 0, 1200);
  if (!['free', 'interest_only', 'capitalise'].includes(t.grace.treatment))
    fail();
  for (const c of [...t.fees, ...t.taxes]) {
    if (
      !c.key ||
      !['fixed', 'percentage'].includes(c.kind) ||
      !['deducted', 'financed', 'separate'].includes(c.treatment)
    )
      fail();
    if (c.kind === 'fixed') {
      if (!natural(c.value)) fail();
    } else rate(c.value);
  }
  for (const tax of t.taxes) {
    validDate(tax.from);
    if (tax.until !== null) {
      validDate(tax.until);
      if (tax.until < tax.from) fail();
    }
    if (!['principal', 'interest', 'fees'].includes(tax.basis)) fail();
  }
  if (
    new Set([...t.fees, ...t.taxes].map((c) => c.key)).size !==
    t.fees.length + t.taxes.length
  )
    fail();
  integer(t.penalty.toleranceDays, 0, 36500);
  rate(t.penalty.dailyRate);
  if (!['fixed', 'percentage'].includes(t.penalty.fine.kind)) fail();
  if (t.penalty.fine.kind === 'fixed') {
    if (!natural(t.penalty.fine.value)) fail();
  } else rate(t.penalty.fine.value);
  for (const date of t.calendar.holidays) validDate(date);
  for (const day of t.calendar.weekendDays) integer(day, 0, 6);
  if (
    new Set(t.calendar.weekendDays).size === 7 ||
    !['none', 'next_business_day'].includes(t.calendar.adjustment)
  )
    fail();
  if (
    t.allocation.length !== 4 ||
    new Set(t.allocation).size !== 4 ||
    !t.allocation.every((c) =>
      ['fine', 'lateInterest', 'interest', 'principal'].includes(c),
    )
  )
    fail();
  if (
    !['advance', 'credit'].includes(t.excess) ||
    !['contract_interest', 'proportional_interest', 'due_interest'].includes(
      t.settlement,
    )
  )
    fail();
  integer(t.yearDays, 1, 1000);
  if (t.requirements.minAge !== null) integer(t.requirements.minAge, 0, 150);
  if (t.requirements.minIncome !== null && !natural(t.requirements.minIncome))
    fail();
  if (
    !t.requirements.documents.every(
      (x) => typeof x === 'string' && x.length > 0,
    ) ||
    !t.requirements.guarantees.every(
      (x) => typeof x === 'string' && x.length > 0,
    )
  )
    fail();
  let threshold = 0n;
  for (const level of t.approvalLevels) {
    if (!natural(level.upTo) || BigInt(level.upTo) <= threshold || !level.role)
      fail();
    threshold = BigInt(level.upTo);
  }
  if (threshold < BigInt(t.maxPrincipal)) fail();
}
export function parseMoney(value: string): Money {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) fail();
  return cents(new D(value.replace(',', '.')).mul(100));
}
export function formatMoney(value: Money, currency = 'MT'): string {
  const negative = value < 0n;
  const v = negative ? -value : value;
  return `${negative ? '-' : ''}${(v / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${(v % 100n).toString().padStart(2, '0')} ${currency}`;
}
export function percentValue(value: string): string {
  const result = new D(value);
  if (!result.isFinite() || result.lt(0)) fail();
  return result.mul(100).toFixed();
}
export function formatPercent(value: string): string {
  const result = new D(value);
  if (!result.isFinite() || result.lt(0)) fail();
  return `${result.mul(100).toFixed(2).replace('.', ',')}%`;
}
export function percentRate(value: string): string {
  return rate(value.replace(',', '.')).div(100).toString();
}
function rawDate(
  start: string,
  index: number,
  periodicity: Periodicity,
): string {
  validDate(start);
  integer(index, 0, 2400);
  const date = new Date(`${start}T00:00:00Z`);
  if (periodicity === 'monthly') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + index);
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else
    date.setUTCDate(
      date.getUTCDate() +
        index * { daily: 1, weekly: 7, fortnightly: 14 }[periodicity],
    );
  return date.toISOString().slice(0, 10);
}
export function dueDate(
  start: string,
  index: number,
  periodicity: Periodicity,
  calendar: Terms['calendar'],
): string {
  let date = rawDate(start, index, periodicity);
  if (calendar.adjustment === 'none') return date;
  if (new Set(calendar.weekendDays).size === 7) fail();
  for (let tries = 0; tries < 36600; tries++) {
    if (
      !calendar.holidays.includes(date) &&
      !calendar.weekendDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
    )
      return date;
    date = rawDate(date, 1, 'daily');
  }
  return fail();
}
function amount(c: Charge, base: Money): Money {
  return c.kind === 'fixed'
    ? BigInt(c.value)
    : cents(decimal(base).mul(rate(c.value)));
}
function buildSchedule(
  capital: Money,
  periods: number,
  start: string,
  t: Terms,
): Instalment[] {
  const rows: Instalment[] = [];
  let balance = capital;
  let previous = start;
  const r = rate(t.rate);
  for (let i = 1; i <= t.grace.periods; i++) {
    const accrued =
      t.grace.treatment === 'free' ? 0n : cents(decimal(balance).mul(r));
    const capitalisedInterest =
      t.grace.treatment === 'capitalise' ? accrued : 0n;
    balance += capitalisedInterest;
    const interest = t.grace.treatment === 'interest_only' ? accrued : 0n;
    const due = dueDate(start, i, t.periodicity, t.calendar);
    rows.push({
      number: rows.length + 1,
      from: previous,
      dueDate: due,
      principal: 0n,
      interest,
      capitalisedInterest,
      total: interest,
      balance,
    });
    previous = due;
  }
  const basis = balance;
  const flatInterest = cents(decimal(basis).mul(r).mul(periods));
  const flatPayment = cents(decimal(basis + flatInterest).div(periods));
  const payment = r.isZero()
    ? cents(decimal(basis).div(periods))
    : cents(
        decimal(basis)
          .mul(r)
          .div(new D(1).minus(new D(1).plus(r).pow(-periods))),
      );
  let charged = 0n;
  for (let i = 1; i <= periods; i++) {
    let interest: Money;
    let principal: Money;
    if (t.method === 'flat') {
      interest =
        i === periods
          ? flatInterest - charged
          : cents(decimal(flatInterest).div(periods));
      if (interest > flatInterest - charged) interest = flatInterest - charged;
      principal = i === periods ? balance : flatPayment - interest;
    } else if (t.method === 'sac') {
      interest = cents(
        decimal(basis)
          .mul(new D(periods - i + 1).div(periods))
          .mul(r),
      );
      principal = i === periods ? balance : cents(decimal(basis).div(periods));
    } else if (t.method === 'interest_only' || t.method === 'bullet') {
      interest =
        t.method === 'bullet'
          ? i === periods
            ? flatInterest
            : 0n
          : cents(decimal(basis).mul(r));
      principal = i === periods ? balance : 0n;
    } else {
      interest = cents(decimal(balance).mul(r));
      principal = i === periods ? balance : payment - interest;
    }
    if (principal < 0n) fail();
    if (principal > balance) principal = balance;
    balance -= principal;
    charged += interest;
    const due = dueDate(start, i + t.grace.periods, t.periodicity, t.calendar);
    rows.push({
      number: rows.length + 1,
      from: previous,
      dueDate: due,
      principal,
      interest,
      capitalisedInterest: 0n,
      total: principal + interest,
      balance,
    });
    previous = due;
  }
  return rows;
}
export function annualRate(
  flows: { date: string; amount: Money }[],
  yearDays: number,
): string {
  integer(yearDays, 1, 1000);
  if (
    flows.length < 2 ||
    flows[0]!.amount >= 0n ||
    flows.slice(1).some((f) => f.amount < 0n)
  )
    fail();
  const first = flows[0]!;
  const dated = flows.map((f) => {
    const days = daysBetween(first.date, f.date);
    if (days < 0) fail();
    return { amount: decimal(f.amount), days };
  });
  if (!dated.some((f) => f.days > 0 && f.amount.gt(0))) fail();
  const npv = (discount: Decimal) =>
    dated.reduce(
      (sum, f) => sum.plus(f.amount.mul(discount.pow(f.days))),
      new D(0),
    );
  if (npv(new D(1)).isZero()) return '0';
  if (npv(new D(1)).lt(0) || npv(new D(0)).gte(0)) fail();
  let low = new D(0),
    high = new D(1),
    discount = new D('0.99');
  for (let i = 0; i < 100; i++) {
    let value = new D(0),
      derivative = new D(0);
    for (const f of dated) {
      const term = f.amount.mul(discount.pow(f.days));
      value = value.plus(term);
      if (f.days > 0)
        derivative = derivative.plus(term.mul(f.days).div(discount));
    }
    if (value.abs().lte(dated[0]!.amount.abs().mul('1e-35')))
      return discount
        .pow(-yearDays)
        .minus(1)
        .toSignificantDigits(12)
        .toString();
    if (value.gt(0)) high = discount;
    else low = discount;
    const candidate = discount.minus(value.div(derivative));
    discount =
      candidate.gt(low) && candidate.lt(high)
        ? candidate
        : low.plus(high).div(2);
  }
  return discount.pow(-yearDays).minus(1).toSignificantDigits(12).toString();
}
export function simulate(input: {
  principal: Money;
  periods: number;
  startDate: string;
  terms: Terms;
}): Quote {
  const { principal, periods, startDate, terms: t } = input;
  validateTerms(t);
  validDate(startDate);
  integer(periods, t.minPeriods, t.maxPeriods);
  if (principal < BigInt(t.minPrincipal) || principal > BigInt(t.maxPrincipal))
    fail();
  const charges: (Charge & { amount: Money })[] = t.fees.map((c) => ({
    ...c,
    amount: amount(c, principal),
  }));
  const feeTotal = charges.reduce((sum, c) => sum + c.amount, 0n);
  const taxes = t.taxes.filter(
    (tax) =>
      tax.from <= startDate && (tax.until === null || tax.until >= startDate),
  );
  for (const tax of taxes.filter((x) => x.basis !== 'interest'))
    charges.push({
      ...tax,
      amount: amount(tax, tax.basis === 'fees' ? feeTotal : principal),
    });
  const baseFinanced =
    principal +
    charges
      .filter((c) => c.treatment === 'financed')
      .reduce((sum, c) => sum + c.amount, 0n);
  let financed = baseFinanced;
  let instalments = buildSchedule(financed, periods, startDate, t);
  let interest = instalments.reduce(
    (sum, row) => sum + row.interest + row.capitalisedInterest,
    0n,
  );
  for (let i = 0; i < 256; i++) {
    const target =
      baseFinanced +
      taxes
        .filter((x) => x.basis === 'interest' && x.treatment === 'financed')
        .reduce((sum, tax) => sum + amount(tax, interest), 0n);
    if (target === financed) break;
    if (i === 255) fail();
    financed = target;
    instalments = buildSchedule(financed, periods, startDate, t);
    interest = instalments.reduce(
      (sum, row) => sum + row.interest + row.capitalisedInterest,
      0n,
    );
  }
  for (const tax of taxes.filter((x) => x.basis === 'interest'))
    charges.push({ ...tax, amount: amount(tax, interest) });
  const deducted = charges
    .filter((c) => c.treatment === 'deducted')
    .reduce((sum, c) => sum + c.amount, 0n);
  const separate = charges
    .filter((c) => c.treatment === 'separate')
    .reduce((sum, c) => sum + c.amount, 0n);
  const disbursed = principal - deducted;
  if (disbursed - separate <= 0n) fail();
  const total =
    instalments.reduce((sum, row) => sum + row.total, 0n) + separate;
  const taxTotal = charges
    .filter((c) => taxes.some((x) => x.key === c.key))
    .reduce((sum, c) => sum + c.amount, 0n);
  return {
    requested: principal,
    financed,
    disbursed,
    separate,
    fees: feeTotal,
    taxes: taxTotal,
    capitalisedInterest: instalments.reduce(
      (sum, row) => sum + row.capitalisedInterest,
      0n,
    ),
    interest,
    total,
    cost: total - disbursed,
    annualRate: annualRate(
      [
        { date: startDate, amount: -(disbursed - separate) },
        ...instalments.map((row) => ({ date: row.dueDate, amount: row.total })),
      ],
      t.yearDays,
    ),
    instalments,
    charges,
  };
}
export function lateCharges(input: {
  dueDate: string;
  asOf: string;
  overdue: Money;
  policy: Terms['penalty'];
  fineAlreadyAssessed: boolean;
}) {
  const { policy, overdue } = input;
  if (overdue < 0n) fail();
  integer(policy.toleranceDays, 0, 36500);
  if (!['fixed', 'percentage'].includes(policy.fine.kind)) fail();
  if (policy.fine.kind === 'fixed') {
    if (!natural(policy.fine.value)) fail();
  } else rate(policy.fine.value);
  const overdueDays = Math.max(0, daysBetween(input.dueDate, input.asOf));
  const chargeableDays = Math.max(0, overdueDays - policy.toleranceDays);
  const lateInterest = cents(
    decimal(overdue).mul(rate(policy.dailyRate)).mul(chargeableDays),
  );
  const fine =
    chargeableDays > 0 && overdue > 0n && !input.fineAlreadyAssessed
      ? amount({ ...policy.fine, key: 'fine', treatment: 'separate' }, overdue)
      : 0n;
  return { overdueDays, chargeableDays, lateInterest, fine };
}
export type Debt = {
  id: string;
  from: string;
  dueDate: string;
  fine: Money;
  lateInterest: Money;
  interest: Money;
  principal: Money;
};
export function allocatePayment(input: {
  amount: Money;
  asOf: string;
  debts: Debt[];
  order: Component[];
  excess: Terms['excess'];
}) {
  if (
    input.amount < 0n ||
    input.order.length !== 4 ||
    new Set(input.order).size !== 4 ||
    !input.order.every((c) =>
      ['fine', 'lateInterest', 'interest', 'principal'].includes(c),
    ) ||
    !['advance', 'credit'].includes(input.excess) ||
    new Set(input.debts.map((d) => d.id)).size !== input.debts.length
  )
    fail();
  validDate(input.asOf);
  let remaining = input.amount;
  const allocations: { id: string; component: Component; amount: Money }[] = [];
  const debts = input.debts
    .map((d) => {
      validDate(d.from);
      validDate(d.dueDate);
      for (const key of input.order) if (d[key] < 0n) fail();
      return { ...d };
    })
    .sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
    );
  for (const debt of debts) {
    if (debt.dueDate > input.asOf && input.excess === 'credit') continue;
    for (const component of input.order) {
      const value = remaining < debt[component] ? remaining : debt[component];
      if (value > 0n) {
        allocations.push({ id: debt.id, component, amount: value });
        debt[component] -= value;
        remaining -= value;
      }
    }
  }
  return { debts, allocations, credit: remaining };
}
export function settlementAmount(input: {
  debts: Debt[];
  asOf: string;
  mode: Terms['settlement'];
}) {
  validDate(input.asOf);
  if (
    !['contract_interest', 'proportional_interest', 'due_interest'].includes(
      input.mode,
    )
  )
    fail();
  let principal = 0n,
    interest = 0n,
    charges = 0n;
  for (const debt of input.debts) {
    validDate(debt.from);
    validDate(debt.dueDate);
    if (debt.from > debt.dueDate) fail();
    for (const key of [
      'principal',
      'interest',
      'fine',
      'lateInterest',
    ] as const)
      if (debt[key] < 0n) fail();
    principal += debt.principal;
    charges += debt.fine + debt.lateInterest;
    if (input.mode === 'contract_interest' || debt.dueDate <= input.asOf)
      interest += debt.interest;
    else if (input.mode === 'proportional_interest' && debt.from < input.asOf) {
      const elapsed = daysBetween(debt.from, input.asOf),
        period = daysBetween(debt.from, debt.dueDate);
      interest += cents(decimal(debt.interest).mul(elapsed).div(period));
    }
  }
  return {
    principal,
    interest,
    charges,
    total: principal + interest + charges,
  };
}
export function eligibility(
  t: Terms,
  customer: {
    age: number;
    income: Money;
    documents: string[];
    guarantees: string[];
  },
  principal: Money,
) {
  validateTerms(t);
  if (
    !Number.isFinite(customer.age) ||
    customer.age < 0 ||
    customer.income < 0n ||
    principal < 0n
  )
    fail();
  return {
    eligible:
      (t.requirements.minAge === null ||
        customer.age >= t.requirements.minAge) &&
      (t.requirements.minIncome === null ||
        customer.income >= BigInt(t.requirements.minIncome)) &&
      t.requirements.documents.every((d) => customer.documents.includes(d)) &&
      t.requirements.guarantees.every((g) => customer.guarantees.includes(g)),
    approvalRole:
      t.approvalLevels.find((level) => principal <= BigInt(level.upTo))?.role ??
      null,
  };
}
