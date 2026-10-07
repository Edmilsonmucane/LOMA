import { describe, it, expect } from 'vitest';
import { resolveTenantSlug, tenantSchema, can } from './tenancy';
describe('tenant boundary', () => {
  it('resolves only a direct subdomain of the configured base', () => {
    expect(resolveTenantSlug('macuti.loma.co.mz:3000', 'loma.co.mz')).toBe(
      'macuti',
    );
    expect(resolveTenantSlug('demo.localhost:3000', 'localhost')).toBe('demo');
    expect(resolveTenantSlug('loma.co.mz', 'loma.co.mz')).toBeNull();
  });
  it.each([
    'evil.com',
    'a.b.loma.co.mz',
    'loma.co.mz.evil.com',
    'admin.loma.co.mz',
    'a.loma.co.mz',
    'demo.loma.co.mz/attack',
  ])('rejects unsupported host %s', (host) =>
    expect(() => resolveTenantSlug(host, 'loma.co.mz')).toThrow(),
  );
  it('allows loopback only with a localhost configuration', () => {
    expect(resolveTenantSlug('127.0.0.1:3000', 'localhost')).toBeNull();
    expect(() => resolveTenantSlug('127.0.0.1', 'loma.co.mz')).toThrow();
  });
  it('validates configurable tenant inputs', () => {
    expect(
      tenantSchema.safeParse({
        name: 'Macuti Microcrédito',
        slug: 'macuti',
        presetId: '20000000-0000-4000-8000-000000000001',
        planId: '10000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true);
    expect(tenantSchema.safeParse({ name: 'X', slug: 'admin' }).success).toBe(
      false,
    );
  });
  it('does not infer privileges from a profile label', () => {
    expect(can(['tenant.read'], 'tenant.manage')).toBe(false);
    expect(can(['tenant.manage'], 'tenant.manage')).toBe(true);
  });
});
