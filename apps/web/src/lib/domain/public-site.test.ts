import { describe, it, expect } from 'vitest';
import { publicPhone, siteSchema } from './public-site';
const site = {
  enabled: true,
  theme: 'classic',
  title: 'Crédito com condições claras.',
  intro: 'Veja os custos antes de enviar.',
  image: '',
  sections: ['simulator', 'products', 'steps', 'faq', 'branches'],
  steps: ['Envie o pedido.'],
  faq: [],
  terms: 'Condições da agência.',
  privacy: 'Dados usados para análise.',
  limits: {
    otpPerHour: 5,
    requestsPerDay: 5,
    leadsPerDay: 3,
    sessionHours: 24,
  },
};
describe('public boundary', () => {
  it('normalises Mozambican phones before identity lookup', () => {
    expect(publicPhone.parse('84 123 4567')).toBe('+258841234567');
    expect(publicPhone.parse('00258 84 123 4567')).toBe('+258841234567');
  });
  it('rejects foreign or incomplete numbers for the initial SMS workflow', () => {
    expect(publicPhone.safeParse('+27841234567').success).toBe(false);
    expect(publicPhone.safeParse('84123').success).toBe(false);
  });
  it('requires each public section exactly once', () => {
    expect(siteSchema.safeParse(site).success).toBe(true);
    expect(
      siteSchema.safeParse({
        ...site,
        sections: ['simulator', 'simulator', 'steps', 'faq', 'branches'],
      }).success,
    ).toBe(false);
  });
  it('rejects executable image links and non-integral access limits', () => {
    expect(
      siteSchema.safeParse({ ...site, image: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(
      siteSchema.safeParse({
        ...site,
        limits: { ...site.limits, requestsPerDay: 1.5 },
      }).success,
    ).toBe(false);
  });
});
