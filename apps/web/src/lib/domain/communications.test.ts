import { it, expect } from 'vitest';
import {
  templateSchema,
  rulesSchema,
  segmentSchema,
  emptySegment,
  integrationSchema,
  leadSchema,
} from './communications';
const rules = {
  timezone: 'Africa/Maputo',
  startHour: 8,
  endHour: 19,
  maxPerDay: 3,
  maxAttempts: 3,
  retrySeconds: 60,
  optOutText: 'Responda SAIR.',
  buckets: [7, 15, 30, 60],
};
it('validates editable windows, limits and strictly increasing buckets', () => {
  expect(rulesSchema.safeParse(rules).success).toBe(true);
  for (const x of [
    { ...rules, endHour: 8 },
    { ...rules, timezone: 'invalid' },
    { ...rules, maxPerDay: 0 },
    { ...rules, buckets: [15, 7] },
    { ...rules, startHour: null },
  ])
    expect(rulesSchema.safeParse(x).success).toBe(false);
});
it('templates reject unknown variables and preserve approved variable order', () => {
  const t = {
    name: 'Lembrete',
    body: 'Olá {nome}, {valor}.',
    channel: 'sms',
    active: true,
    whatsappName: '',
    whatsappLanguage: 'pt_PT',
    whatsappVariables: ['valor', 'nome'],
  };
  expect(templateSchema.parse(t).whatsappVariables).toEqual(['valor', 'nome']);
  expect(templateSchema.safeParse({ ...t, body: 'Olá {token}' }).success).toBe(
    false,
  );
});
it('segments use optional real stored risk and dates, never invented scoring', () => {
  expect(segmentSchema.safeParse(emptySegment).success).toBe(true);
  expect(segmentSchema.safeParse({ ...emptySegment, risk: 'F' }).success).toBe(
    false,
  );
  expect(
    segmentSchema.safeParse({ ...emptySegment, settledMonths: '121' }).success,
  ).toBe(false);
});
it('integrations validate HTTPS, secrets and exact costs', () => {
  const x = {
    provider: 'console',
    cost: '9007199254740993',
    url: '',
    token: '',
    phoneId: '',
    graphVersion: '',
    webhookSecret: '',
    verifyToken: '',
  };
  expect(integrationSchema.safeParse(x).success).toBe(true);
  expect(
    integrationSchema.safeParse({
      ...x,
      provider: 'http',
      url: 'http://host',
      token: 'mock',
    }).success,
  ).toBe(false);
  expect(
    integrationSchema.safeParse({ ...x, webhookSecret: 'short' }).success,
  ).toBe(false);
});
it('leads need explicit consent source', () => {
  const x = {
    branch: '11111111-1111-4111-8111-111111111111',
    name: 'Lurdes Machel',
    phone: '+258841234567',
    origin: 'Agência',
    status: 'new',
    client: '',
    consent: { sms: false, whatsapp: false, email: false, source: '' },
  };
  expect(leadSchema.safeParse(x).success).toBe(true);
  expect(
    leadSchema.safeParse({ ...x, consent: { ...x.consent, sms: true } })
      .success,
  ).toBe(false);
});
