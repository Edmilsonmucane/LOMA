export type Channel = 'sms' | 'whatsapp' | 'email';
export interface Message {
  id: string;
  channel: Channel;
  to: string;
  body: string;
  variables: Record<string, string>;
  template: {
    whatsappName: string;
    whatsappLanguage: string;
    whatsappVariables?: string[];
  };
}
export type Delivery = {
  state: 'accepted' | 'retry' | 'failed' | 'uncertain';
  cost: string;
  providerId?: string;
  reason?: string;
};
export interface SmsProvider {
  send(message: Message): Promise<Delivery>;
}
export interface WhatsAppProvider {
  send(message: Message): Promise<Delivery>;
}
export interface EmailProvider {
  send(message: Message): Promise<Delivery>;
}
export class ConsoleProvider
  implements SmsProvider, WhatsAppProvider, EmailProvider
{
  private write: (value: string) => void;
  constructor(write: (value: string) => void = console.log) {
    this.write = write;
  }
  async send(m: Message): Promise<Delivery> {
    this.write(
      JSON.stringify({
        adapter: 'console',
        id: m.id,
        channel: m.channel,
        to: m.to,
        body: m.body,
      }),
    );
    return { state: 'accepted', cost: '0', providerId: `console:${m.id}` };
  }
}
export class MockProvider
  implements SmsProvider, WhatsAppProvider, EmailProvider
{
  messages: Message[] = [];
  private result: Delivery;
  constructor(result: Delivery = { state: 'accepted', cost: '0' }) {
    this.result = result;
  }
  async send(m: Message): Promise<Delivery> {
    this.messages.push(m);
    return this.result;
  }
}
export function renderTemplate(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(/\{([^}]+)\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error('Unknown template variable');
    return values[key]!;
  });
}
export type Integration = {
  provider: 'console' | 'http' | 'whatsapp';
  cost: string;
  url?: string;
  token?: string;
  phoneId?: string;
  graphVersion?: string;
};
export class HttpProvider implements SmsProvider, EmailProvider {
  private settings: Integration;
  private request: typeof fetch;
  constructor(settings: Integration, request: typeof fetch = fetch) {
    if (!/^\d{1,18}$/.test(settings.cost)) throw new Error('Invalid cost');
    this.settings = settings;
    this.request = request;
  }
  protected payload(m: Message): unknown {
    return { id: m.id, to: m.to, body: m.body, channel: m.channel };
  }
  protected endpoint(): string {
    return this.settings.url ?? '';
  }
  async send(m: Message): Promise<Delivery> {
    const url = new URL(this.endpoint());
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      return { state: 'failed', cost: '0', reason: 'endpoint' };
    try {
      const response = await this.request(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.token ?? ''}`,
          'Idempotency-Key': m.id,
        },
        body: JSON.stringify(this.payload(m)),
      });
      // Only explicit rejection is retryable. A timeout may mean the provider accepted the request.
      if (response.status === 429)
        return { state: 'retry', cost: '0', reason: 'rate_limit' };
      if (!response.ok)
        return {
          state: response.status >= 500 ? 'uncertain' : 'failed',
          cost: '0',
          reason: 'provider_error',
        };
      const result: unknown = await response.json();
      const id =
        typeof result === 'object' && result !== null && 'id' in result
          ? String(result.id)
          : null;
      return {
        state: 'accepted',
        cost: this.settings.cost,
        ...(id ? { providerId: id.slice(0, 200) } : {}),
      };
    } catch {
      return { state: 'uncertain', cost: '0', reason: 'connection' };
    }
  }
}
export class WhatsAppCloudProvider implements WhatsAppProvider {
  private settings: Integration;
  private request: typeof fetch;
  constructor(settings: Integration, request: typeof fetch = fetch) {
    this.settings = settings;
    this.request = request;
  }
  async send(m: Message): Promise<Delivery> {
    if (
      m.channel !== 'whatsapp' ||
      !/^[a-z0-9_]+$/.test(m.template.whatsappName) ||
      !/^\d+$/.test(this.settings.phoneId ?? '') ||
      !/^v\d+\.\d+$/.test(this.settings.graphVersion ?? '')
    )
      return { state: 'failed', cost: '0', reason: 'template' };
    try {
      const response = await this.request(
        `https://graph.facebook.com/${this.settings.graphVersion}/${this.settings.phoneId}/messages`,
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.settings.token ?? ''}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: m.to.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: m.template.whatsappName,
              language: { code: m.template.whatsappLanguage },
              components: [
                {
                  type: 'body',
                  parameters: (m.template.whatsappVariables ?? []).map(
                    (key) => ({
                      type: 'text',
                      text: m.variables[key] ?? '',
                    }),
                  ),
                },
              ],
            },
            biz_opaque_callback_data: m.id,
          }),
        },
      );
      if (response.status === 429)
        return { state: 'retry', cost: '0', reason: 'rate_limit' };
      if (!response.ok)
        return {
          state: response.status >= 500 ? 'uncertain' : 'failed',
          cost: '0',
          reason: 'provider_error',
        };
      const data = (await response.json()) as { messages?: { id: string }[] };
      return {
        state: 'accepted',
        cost: this.settings.cost,
        ...(data.messages?.[0] ? { providerId: data.messages[0].id } : {}),
      };
    } catch {
      return { state: 'uncertain', cost: '0', reason: 'connection' };
    }
  }
}
