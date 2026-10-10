// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  applicationSchema,
  decisionSchema,
  templateSchema,
  contractText,
  contractQuote,
  paymentCapacity,
  type ContractSnapshot,
} from './applications';
import { simulateContract, type Terms } from '@loma/loan-engine';
const terms: Terms = {
  method: 'flat',
  periodicity: 'monthly',
  rate: '0.1',
  minPrincipal: '100000',
  maxPrincipal: '5000000',
  minPeriods: 1,
  maxPeriods: 12,
  grace: { periods: 0, treatment: 'free' },
  fees: [],
  taxes: [],
  penalty: {
    toleranceDays: 3,
    dailyRate: '0.005',
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
  approvalLevels: [{ upTo: '5000000', role: 'manager' }],
};
const snapshot: ContractSnapshot = {
  principal: '1000000',
  periods: 6,
  startDate: '2026-10-07',
  terms,
  productName: 'Comércio mensal',
  productVersion: 1,
  client: { name: 'Amélia Cossa', birthDate: '1990-01-01', profile: {} },
  brand: {
    name: 'Demo Microcrédito',
    legalName: '',
    license: '',
    contact: '',
    footer: '',
    currency: 'MZN',
  },
  template: {
    title: 'Contrato',
    body: '{nome} recebe {desembolso}. Total: {total}, juros: {juros}. {finalidade}',
  },
  purpose: 'Mercadoria',
  guarantees: [],
};
describe('Approved contract inputs', () => {
  it('reproduces the mandatory exact flat vector from immutable inputs', () => {
    const q = contractQuote(snapshot, 1);
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
  it('rejects unsupported historical calculation versions', () => {
    expect(() =>
      simulateContract(2, {
        principal: 1000000n,
        periods: 6,
        startDate: snapshot.startDate,
        terms,
      }),
    ).toThrow();
  });
  it('later configuration changes cannot mutate an existing copied snapshot', () => {
    const saved = structuredClone(snapshot);
    const current = structuredClone(snapshot);
    current.terms.rate = '0.2';
    current.client.name = 'Novo nome';
    current.template.body = 'Novo texto';
    expect(contractText(saved, 'C1', 1)).toContain('Total: 16 000,00 MT');
    expect(contractText(saved, 'C1', 1)).toContain('Amélia Cossa');
  });
  it('replaces variables once without interpreting customer input', () => {
    expect(
      contractText(
        { ...snapshot, client: { ...snapshot.client, name: '{total}' } },
        'C1',
        1,
      ),
    ).toMatch(/^\{total\} recebe/);
  });
  it('validates known variables but leaves ordinary document text unchanged', () => {
    expect(
      templateSchema.safeParse({ title: 'Contrato', body: 'Olá {nome}' })
        .success,
    ).toBe(true);
    expect(
      templateSchema.safeParse({ title: 'Contrato', body: '{taxa_fixa_legal}' })
        .success,
    ).toBe(false);
  });
  it('computes capacity with bigint, including zero income and above safe integer range', () => {
    expect(paymentCapacity(266667n, 1500000n)).toBe('17,78%');
    expect(paymentCapacity(1n, 0n)).toBeNull();
    expect(paymentCapacity(1n, 1000000n)).toBe('0,00%');
    expect(paymentCapacity(180000000000000000n, 90000000000000000n)).toBe(
      '200,00%',
    );
  });
  it('requires a reason for approving or refusing and validates the input shape', () => {
    const id = '10000000-0000-4000-8000-000000000001';
    expect(
      decisionSchema.safeParse({
        id,
        revision: 1,
        status: 'declined',
        note: '',
      }).success,
    ).toBe(false);
    expect(
      applicationSchema.safeParse({
        client_id: id,
        product_id: id,
        principal: '1.25',
        periods: 6,
        start_date: '2026-10-07',
        purpose: 'Compra',
        guarantees: [],
      }).success,
    ).toBe(false);
  });
});
