import { describe, it, expect, vi } from 'vitest';
import {
  ConsoleProvider,
  MockProvider,
  HttpProvider,
  WhatsAppCloudProvider,
  renderTemplate,
  type Message,
} from './index';
const message: Message = {
  id: 'verification-id',
  channel: 'sms',
  to: '+258841234567',
  body: 'Olá Amélia. Prestação 2 666,67 MT.',
  variables: { nome: 'Amélia', valor: '2 666,67 MT' },
  template: {
    whatsappName: 'payment_reminder',
    whatsappLanguage: 'pt_PT',
    whatsappVariables: ['valor', 'nome'],
  },
};
describe('provider outcomes and exact cost', () => {
  it('console needs no paid account and writes only the message', async () => {
    const write = vi.fn();
    expect(await new ConsoleProvider(write).send(message)).toEqual({
      state: 'accepted',
      cost: '0',
      providerId: 'console:verification-id',
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toContain('2 666,67 MT');
  });
  it('mock records the submitted payload', async () => {
    const p = new MockProvider({ state: 'retry', cost: '0' });
    expect((await p.send(message)).state).toBe('retry');
    expect(p.messages).toEqual([message]);
  });
  it('renders repeated variables literally without evaluating contents', () => {
    expect(
      renderTemplate('{nome} {nome} {valor}', {
        nome: '$& {data}',
        valor: '1,00 MT',
      }),
    ).toBe('$& {data} $& {data} 1,00 MT');
    expect(() => renderTemplate('{unknown}', {})).toThrow();
  });
  it('HTTP passes idempotency, private bearer and exact large cents', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"id":"provider-id"}', { status: 200 }));
    const r = await new HttpProvider(
      {
        provider: 'http',
        url: 'https://sms.example.org/send',
        token: 'mock-token',
        cost: '9007199254740993',
      },
      request,
    ).send(message);
    expect(r).toEqual({
      state: 'accepted',
      cost: '9007199254740993',
      providerId: 'provider-id',
    });
    expect(request.mock.calls[0]?.[1]?.headers).toMatchObject({
      'Idempotency-Key': 'verification-id',
    });
    expect(request.mock.calls[0]?.[1]?.redirect).toBe('error');
  });
  it.each([
    [400, 'failed'],
    [401, 'failed'],
    [429, 'retry'],
    [500, 'uncertain'],
    [503, 'uncertain'],
  ] as const)('HTTP %s gives %s', async (status, state) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status }));
    expect(
      (
        await new HttpProvider(
          { provider: 'http', url: 'https://sms.example.org/send', cost: '10' },
          request,
        ).send(message)
      ).state,
    ).toBe(state);
  });
  it('does not retry ambiguous network failure', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('Secret-bearing provider details'));
    const result = await new HttpProvider(
      { provider: 'http', url: 'https://sms.example.org/send', cost: '10' },
      request,
    ).send(message);
    expect(result).toEqual({
      state: 'uncertain',
      cost: '0',
      reason: 'connection',
    });
    expect(JSON.stringify(result)).not.toContain('Secret');
  });
  it.each(['http://sms.example.org', 'https://user:pass@sms.example.org'])(
    'refuses unsafe URL %s',
    async (url) => {
      const request = vi.fn<typeof fetch>();
      expect(
        (
          await new HttpProvider(
            { provider: 'http', url, cost: '0' },
            request,
          ).send(message)
        ).state,
      ).toBe('failed');
      expect(request).not.toHaveBeenCalled();
    },
  );
  it('WhatsApp sends approved template and explicit variable order', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"messages":[{"id":"wamid.test"}]}', { status: 200 }),
      );
    const p = new WhatsAppCloudProvider(
      {
        provider: 'whatsapp',
        phoneId: '12345',
        graphVersion: 'v24.0',
        token: 'mock-token',
        cost: '23',
      },
      request,
    );
    expect(await p.send({ ...message, channel: 'whatsapp' })).toEqual({
      state: 'accepted',
      cost: '23',
      providerId: 'wamid.test',
    });
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(body.template.components[0].parameters).toEqual([
      { type: 'text', text: '2 666,67 MT' },
      { type: 'text', text: 'Amélia' },
    ]);
    expect(body.type).toBe('template');
    expect(body.to).toBe('258841234567');
  });
  it('WhatsApp refuses unapproved identifiers', async () => {
    const request = vi.fn<typeof fetch>();
    const p = new WhatsAppCloudProvider(
      {
        provider: 'whatsapp',
        phoneId: '12345',
        graphVersion: 'v24.0',
        cost: '0',
      },
      request,
    );
    expect(
      (
        await p.send({
          ...message,
          channel: 'whatsapp',
          template: { ...message.template, whatsappName: '' },
        })
      ).state,
    ).toBe('failed');
    expect(request).not.toHaveBeenCalled();
  });
});
