import { describe, it, expect } from 'vitest';
import {
  centsSchema,
  paymentSchema,
  receiptTemplateSchema,
  previewSchema,
} from './payments';
describe('Financial command boundaries', () => {
  const command = {
    loan: '10000000-0000-4000-8000-000000000001',
    amount: '9007199254740993',
    method: 'mpesa',
    reference: 'MZ-VERIFICADO',
    requestId: '10000000-0000-4000-8000-000000000002',
    revision: 3,
    day: '2026-10-08',
  };
  it('preserves cents above JavaScript safe integers without conversion', () => {
    expect(paymentSchema.parse(command).amount).toBe('9007199254740993');
    expect(centsSchema.parse('9223372036854775807')).toBe(
      '9223372036854775807',
    );
  });
  it('rejects unsafe transport, negative, fractional and out-of-range amounts', () => {
    for (const value of [
      9007199254740993,
      '0',
      '-1',
      '1.01',
      '1e6',
      '9223372036854775808',
    ])
      expect(centsSchema.safeParse(value).success).toBe(false);
  });
  it('refuses browser-supplied allocation and receipt number', () => {
    for (const extra of [
      { allocations: [{ amount: '1' }] },
      { receipt_number: '1' },
      { tenant_id: command.loan },
    ])
      expect(paymentSchema.safeParse({ ...command, ...extra }).success).toBe(
        false,
      );
  });
  it('requires a known channel, reference and complete preview revision', () => {
    expect(
      paymentSchema.safeParse({ ...command, method: 'online' }).success,
    ).toBe(false);
    expect(
      paymentSchema.safeParse({ ...command, reference: ' ' }).success,
    ).toBe(false);
    expect(
      previewSchema.safeParse({ credit: '0', allocations: [] }).success,
    ).toBe(false);
  });
  it('validates editable receipt variables without admitting arbitrary placeholders', () => {
    expect(
      receiptTemplateSchema.safeParse({
        title: 'Recibo',
        body: 'Recebemos de {nome} {valor}, recibo {numero}.',
      }).success,
    ).toBe(true);
    expect(
      receiptTemplateSchema.safeParse({ title: 'Recibo', body: '{password}' })
        .success,
    ).toBe(false);
  });
});
