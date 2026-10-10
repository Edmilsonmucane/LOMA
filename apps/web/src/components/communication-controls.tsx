'use client';
import { useState, useTransition, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Drawer, Field } from '@loma/ui';
import { formatMoney, parseMoney } from '@loma/loan-engine';
import {
  queueMessage,
  previewMessage,
  saveCommunicationConfig,
  previewCampaign,
  createCampaign,
  cancelCampaign,
  recordCollection,
  assignCollection,
  saveLead,
  setCommunicationConsent,
} from '@/app/communication-actions';
import {
  channels,
  messageVariables,
  emptySegment,
  type Template,
  type Segment,
  type CollectionRow,
  type Lead,
} from '@/lib/domain/communications';
import { formatDate } from '@/lib/domain/dates';
import { renderTemplate } from '../../../../packages/messaging/src/index';
export type Choice = { id: string; name: string };
export type TemplateChoice = { key: string; value: Template };
function ActionDrawer({
  title,
  trigger,
  children,
  open,
  setOpen,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const t = useTranslations('Communications');
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={t('drawerHelp')}
      closeLabel={t('close')}
      trigger={trigger}
    >
      {children}
    </Drawer>
  );
}
export function MessageDrawer({
  templates,
  client,
  loan,
}: {
  templates: TemplateChoice[];
  client?: Choice;
  loan?: string;
}) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const choices = templates.filter(
    (x) =>
      x.value.active && (!!loan || !/\{(valor|numero)\}/.test(x.value.body)),
  );
  const [open, setOpen] = useState(false),
    [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms'),
    [template, setTemplate] = useState(
      choices.find((x) => loan && x.key === 'reminder')?.key ??
        choices[0]?.key ??
        '',
    ),
    [chosen, setChosen] = useState(client ?? null),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<Choice[]>([]),
    [error, setError] = useState(''),
    [sent, setSent] = useState(false),
    [requestId, setRequestId] = useState(''),
    [pending, start] = useTransition();
  const [actualPreview, setActualPreview] = useState<{
    key: string;
    body: string;
    allowed: boolean;
  } | null>(null);
  const previewKey = [chosen?.id, channel, template, loan].join(':');
  useEffect(() => {
    let active = true;
    if (open && chosen && template) {
      void previewMessage({
        client: chosen.id,
        channel,
        template,
        ...(loan ? { loan } : {}),
      }).then((r) => {
        if (active && r.ok) setActualPreview({ key: previewKey, ...r.preview });
      });
    }
    return () => {
      active = false;
    };
  }, [open, chosen, channel, template, loan, previewKey]);
  const currentPreview =
    actualPreview?.key === previewKey ? actualPreview : null;
  const tpl = templates.find((x) => x.key === template);
  const preview = tpl
    ? renderTemplate(tpl.value.body, {
        nome: chosen?.name ?? t('exampleName'),
        valor: t('previewAmount'),
        data: t('previewDate'),
        numero: t('previewNumber'),
        microcredito: t('previewBrand'),
      })
    : '';
  return (
    <ActionDrawer
      title={t('send')}
      open={open}
      setOpen={(v) => {
        setOpen(v);
        setSent(false);
        setError('');
        if (v) setRequestId(crypto.randomUUID());
      }}
      trigger={
        <Button variant="secondary">{t(loan ? 'sendReminder' : 'send')}</Button>
      }
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen) return;
          start(async () => {
            const r = await queueMessage({
              client: chosen.id,
              channel,
              template,
              requestId,
              ...(loan ? { loan } : {}),
            });
            if (!r.ok) setError(r.error);
            else {
              setSent(true);
              router.refresh();
            }
          });
        }}
      >
        {!client && (
          <>
            <Field
              label={t('searchClient')}
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                setChosen(null);
                start(async () => {
                  const res = await fetch(
                    `/api/clients/search?q=${encodeURIComponent(value)}`,
                  );
                  if (res.ok) {
                    const data = (await res.json()) as { clients?: Choice[] };
                    setResults(data.clients ?? []);
                  }
                });
              }}
            />
            <div className="search-results">
              {results.map((x) => (
                <Button
                  key={x.id}
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setChosen(x);
                    setQuery(x.name);
                    setResults([]);
                  }}
                >
                  {x.name}
                </Button>
              ))}
            </div>
          </>
        )}
        {chosen && <p>{chosen.name}</p>}
        <label htmlFor="message-channel">{t('channel')}</label>
        <select
          id="message-channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
        <label htmlFor="message-template">{t('template')}</label>
        <select
          id="message-template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          {choices.map((x) => (
            <option key={x.key} value={x.key}>
              {x.value.name}
            </option>
          ))}
        </select>
        <div className="message-preview">
          <strong>{t('preview')}</strong>
          <p>{currentPreview?.body ?? preview}</p>
          {currentPreview && !currentPreview.allowed && (
            <p className="form-error">{t('errors.consent')}</p>
          )}
          <small>{t('previewHelp')}</small>
        </div>
        <p>{t('consentHelp')}</p>
        {error && (
          <p role="alert" className="form-error">
            {t(`errors.${error}`)}
          </p>
        )}
        {sent ? (
          <p role="status">{t('queuedHelp')}</p>
        ) : (
          <Button
            type="submit"
            disabled={!chosen || !template || !currentPreview?.allowed}
            loading={pending}
          >
            {t('queue')}
          </Button>
        )}
      </form>
    </ActionDrawer>
  );
}
export function TemplateDrawer({ item }: { item?: TemplateChoice }) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [key, setKey] = useState(item?.key ?? ''),
    [value, setValue] = useState<Template>(
      item?.value ?? {
        name: '',
        body: '',
        channel: 'sms',
        active: true,
        whatsappName: '',
        whatsappVariables: [],
        whatsappLanguage: 'pt_PT',
      },
    ),
    [error, setError] = useState(''),
    [pending, start] = useTransition();
  return (
    <ActionDrawer
      title={t(item ? 'editTemplate' : 'newTemplate')}
      open={open}
      setOpen={(v) => {
        setOpen(v);
        if (v && !key)
          setKey(
            'model_' + crypto.randomUUID().replaceAll('-', '').slice(0, 24),
          );
      }}
      trigger={
        <Button variant={item ? 'secondary' : 'primary'}>
          {t(item ? 'edit' : 'newTemplate')}
        </Button>
      }
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveCommunicationConfig({
              category: 'message_template',
              key,
              settings: value,
            });
            if (!r.ok) setError(r.error);
            else {
              setOpen(false);
              router.refresh();
            }
          });
        }}
      >
        <Field
          label={t('name')}
          value={value.name}
          required
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
        <label htmlFor="template-body">{t('body')}</label>
        <textarea
          id="template-body"
          required
          value={value.body}
          rows={6}
          onChange={(e) => setValue({ ...value, body: e.target.value })}
        />
        <small>
          {t('variables', {
            list: messageVariables.map((x) => `{${x}}`).join(' · '),
          })}
        </small>
        <label htmlFor="template-channel">{t('channel')}</label>
        <select
          id="template-channel"
          value={value.channel}
          onChange={(e) =>
            setValue({
              ...value,
              channel: e.target.value as Template['channel'],
            })
          }
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={value.active}
            onChange={(e) => setValue({ ...value, active: e.target.checked })}
          />
          {t('active')}
        </label>
        <details>
          <summary>{t('whatsappOptions')}</summary>
          <Field
            label={t('whatsappName')}
            value={value.whatsappName}
            onChange={(e) =>
              setValue({ ...value, whatsappName: e.target.value })
            }
          />
          <Field
            label={t('whatsappLanguage')}
            value={value.whatsappLanguage}
            onChange={(e) =>
              setValue({ ...value, whatsappLanguage: e.target.value })
            }
          />
          <Field
            label={t('whatsappVariables')}
            help={t('whatsappVariablesHelp')}
            value={value.whatsappVariables.join(', ')}
            onChange={(e) =>
              setValue({
                ...value,
                whatsappVariables: e.target.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean) as Template['whatsappVariables'],
              })
            }
          />
          <p>{t('whatsappHelp')}</p>
        </details>
        <p>{t('newMessagesOnly')}</p>
        {error && (
          <p role="alert" className="form-error">
            {t(`errors.${error}`)}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {t('save')}
        </Button>
      </form>
    </ActionDrawer>
  );
}
export function AutomationDrawer({
  item,
  templates,
}: {
  item: {
    key: string;
    value: {
      enabled: boolean;
      event: string;
      offsetDays: number;
      template: string;
      channel: string;
      activatedAt?: string | undefined;
    };
  };
  templates: TemplateChoice[];
}) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(item.value),
    [error, setError] = useState(''),
    [pending, start] = useTransition();
  return (
    <ActionDrawer
      title={t('automation')}
      open={open}
      setOpen={setOpen}
      trigger={<Button variant="secondary">{t('edit')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveCommunicationConfig({
              category: 'automation',
              key: item.key,
              settings: value,
            });
            if (!r.ok) setError(r.error);
            else {
              setOpen(false);
              router.refresh();
            }
          });
        }}
      >
        <label className="switch-row">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
          />
          {t('enabled')}
        </label>
        <label htmlFor="automation-event">{t('event')}</label>
        <select
          id="automation-event"
          value={value.event}
          onChange={(e) => setValue({ ...value, event: e.target.value })}
        >
          {[
            'due',
            'submitted',
            'approved',
            'declined',
            'disbursed',
            'payment',
          ].map((c) => (
            <option key={c} value={c}>
              {t(`events.${c}`)}
            </option>
          ))}
        </select>
        {value.event === 'due' && (
          <Field
            label={t('offsetDays')}
            help={t('offsetHelp')}
            type="number"
            min={-365}
            max={365}
            value={value.offsetDays}
            onChange={(e) =>
              setValue({ ...value, offsetDays: Number(e.target.value) })
            }
          />
        )}
        <label htmlFor="automation-template">{t('template')}</label>
        <select
          id="automation-template"
          value={value.template}
          onChange={(e) => setValue({ ...value, template: e.target.value })}
        >
          {templates.map((x) => (
            <option key={x.key} value={x.key}>
              {x.value.name}
            </option>
          ))}
        </select>
        <label htmlFor="automation-channel">{t('channel')}</label>
        <select
          id="automation-channel"
          value={value.channel}
          onChange={(e) => setValue({ ...value, channel: e.target.value })}
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
        <p>{t('automationHelp')}</p>
        {error && <p role="alert">{t(`errors.${error}`)}</p>}
        <Button type="submit" loading={pending}>
          {t('save')}
        </Button>
      </form>
    </ActionDrawer>
  );
}
export function CampaignDrawer({
  branches,
  templates,
  products,
}: {
  branches: Choice[];
  templates: TemplateChoice[];
  products: Choice[];
}) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const choices = templates.filter(
    (x) => x.value.active && !/\{(valor|numero)\}/.test(x.value.body),
  );
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [branch, setBranch] = useState(branches[0]?.id ?? ''),
    [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms'),
    [template, setTemplate] = useState(
      choices.find((x) => x.key === 'campaign')?.key ?? choices[0]?.key ?? '',
    ),
    [segment, setSegment] = useState<Segment>(emptySegment),
    [scheduled, setScheduled] = useState(''),
    [preview, setPreview] = useState<{
      count: number;
      body: string;
      sample: Record<string, string> | null;
      active: boolean;
    } | null>(null),
    [requestId, setRequestId] = useState(''),
    [error, setError] = useState(''),
    [pending, start] = useTransition();
  const change = (s: Segment) => {
    setSegment(s);
    setPreview(null);
  };
  return (
    <ActionDrawer
      title={t('newCampaign')}
      open={open}
      setOpen={(v) => {
        setOpen(v);
        if (v) {
          setRequestId(crypto.randomUUID());
          setPreview(null);
          setError('');
        }
      }}
      trigger={<Button>{t('newCampaign')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (!preview) {
              const r = await previewCampaign({
                branch,
                channel,
                template,
                segment,
              });
              if (r.ok) setPreview(r.preview);
              else setError(r.error);
            } else {
              const r = await createCampaign({
                branch,
                name,
                channel,
                template,
                segment,
                scheduled: scheduled
                  ? new Date(`${scheduled}+02:00`).toISOString()
                  : new Date().toISOString(),
                requestId,
              });
              if (r.ok) {
                setOpen(false);
                router.refresh();
              } else setError(r.error);
            }
          });
        }}
      >
        <Field
          label={t('name')}
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="campaign-branch">{t('branch')}</label>
        <select
          id="campaign-branch"
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setPreview(null);
          }}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label htmlFor="campaign-channel">{t('channel')}</label>
        <select
          id="campaign-channel"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as typeof channel);
            setPreview(null);
          }}
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
        <label htmlFor="campaign-template">{t('template')}</label>
        <select
          id="campaign-template"
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            setPreview(null);
          }}
        >
          {choices.map((x) => (
            <option key={x.key} value={x.key}>
              {x.value.name}
            </option>
          ))}
        </select>
        <Field
          label={t('province')}
          value={segment.province}
          onChange={(e) => change({ ...segment, province: e.target.value })}
        />
        <label className="switch-row">
          <input
            type="checkbox"
            checked={segment.noActive}
            onChange={(e) => change({ ...segment, noActive: e.target.checked })}
          />
          {t('noActive')}
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={segment.birthday}
            onChange={(e) => change({ ...segment, birthday: e.target.checked })}
          />
          {t('birthday')}
        </label>
        <details>
          <summary>{t('moreFilters')}</summary>
          <label htmlFor="campaign-product">{t('product')}</label>
          <select
            id="campaign-product"
            value={segment.product}
            onChange={(e) => change({ ...segment, product: e.target.value })}
          >
            <option value="">{t('all')}</option>
            {products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <label htmlFor="campaign-risk">{t('risk')}</label>
          <select
            id="campaign-risk"
            value={segment.risk}
            onChange={(e) =>
              change({ ...segment, risk: e.target.value as Segment['risk'] })
            }
          >
            <option value="">{t('all')}</option>
            {['A', 'B', 'C', 'D', 'E'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <small>{t('riskHelp')}</small>
          <Field
            label={t('settledMonths')}
            type="number"
            min={0}
            max={120}
            value={segment.settledMonths}
            onChange={(e) =>
              change({ ...segment, settledMonths: e.target.value })
            }
          />
        </details>
        <Field
          label={t('schedule')}
          help={t('scheduleHelp')}
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
        />
        {preview && (
          <div className="message-preview">
            <strong>{t('recipients', { count: preview.count })}</strong>
            <p>
              {preview.sample
                ? renderTemplate(preview.body, preview.sample)
                : t('noRecipients')}
            </p>
            <small>{t('consentHelp')}</small>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {t(`errors.${error}`)}
          </p>
        )}
        <Button
          type="submit"
          loading={pending}
          disabled={!!preview && (!preview.count || !preview.active)}
        >
          {t(preview ? 'confirmCampaign' : 'previewCampaign')}
        </Button>
      </form>
    </ActionDrawer>
  );
}
export function CancelCampaign({ id }: { id: string }) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const [error, setError] = useState(''),
    [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelCampaign(id);
            if (r.ok) router.refresh();
            else setError(r.error);
          })
        }
      >
        {t('cancelCampaign')}
      </Button>
      {error && <p role="alert">{t(`errors.${error}`)}</p>}
    </>
  );
}
export function CollectionDrawer({
  row,
  members,
  canAssign,
}: {
  row: CollectionRow;
  members: Choice[];
  canAssign: boolean;
}) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const dates = useTranslations('Dates'),
    months = Array.from({ length: 12 }, (_, i) => dates(`months.${i}`));
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState('contact'),
    [note, setNote] = useState(''),
    [due, setDue] = useState(''),
    [amount, setAmount] = useState(''),
    [user, setUser] = useState(row.assigned_to ?? members[0]?.id ?? ''),
    [target, setTarget] = useState(
      formatMoney(BigInt(row.target)).replace(/ MT$/, ''),
    ),
    [error, setError] = useState(''),
    [pending, start] = useTransition();
  return (
    <ActionDrawer
      title={t('recordContact')}
      open={open}
      setOpen={setOpen}
      trigger={<Button variant="secondary">{t('recordContact')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            let cents = '';
            try {
              if (amount) cents = parseMoney(amount).toString();
            } catch {
              setError('invalid');
              return;
            }
            const r = await recordCollection({
              loan: row.id,
              kind,
              note,
              due,
              amount: cents,
              requestId: crypto.randomUUID(),
            });
            if (r.ok) {
              setNote('');
              setOpen(false);
              router.refresh();
            } else setError(r.error);
          });
        }}
      >
        <p>{row.name}</p>
        <label htmlFor="collection-kind">{t('activity')}</label>
        <select
          id="collection-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {['contact', 'promise', 'visit', 'completed'].map((x) => (
            <option key={x} value={x}>
              {t(`activities.${x}`)}
            </option>
          ))}
        </select>
        <Field
          label={t('note')}
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {['promise', 'visit'].includes(kind) && (
          <Field
            label={t('date')}
            required
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        )}{' '}
        {kind === 'promise' && (
          <Field
            label={t('amount')}
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
        <Button type="submit" loading={pending}>
          {t('save')}
        </Button>
        {canAssign && (
          <details>
            <summary>{t('assign')}</summary>
            <p className="muted">{t('assignmentHelp')}</p>
            <label htmlFor="collection-user">{t('agent')}</label>
            <select
              id="collection-user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              {members.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <Field
              label={t('target')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              onClick={() =>
                start(async () => {
                  try {
                    const r = await assignCollection({
                      loan: row.id,
                      user,
                      target: parseMoney(target).toString(),
                    });
                    if (r.ok) {
                      router.refresh();
                      setOpen(false);
                    } else setError(r.error);
                  } catch {
                    setError('invalid');
                  }
                })
              }
            >
              {t('saveAssignment')}
            </Button>
          </details>
        )}
        {error && (
          <p role="alert" className="form-error">
            {t(`errors.${error}`)}
          </p>
        )}
        <div className="timeline">
          {row.activities.map((a) => (
            <div key={a.id}>
              <strong>{t(`activities.${a.kind}`)}</strong>
              <p>{a.note}</p>
              {a.due && (
                <small>
                  {formatDate(a.due, months)}
                  {a.amount ? ` · ${formatMoney(BigInt(a.amount))}` : ''}
                </small>
              )}
            </div>
          ))}
        </div>
      </form>
    </ActionDrawer>
  );
}
export function LeadDrawer({
  branches,
  item,
}: {
  branches: Choice[];
  item?: { id: string; revision: number; value: Lead };
}) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState<Lead>(
      item?.value ?? {
        name: '',
        phone: '',
        branch: branches[0]?.id ?? '',
        origin: '',
        status: 'new',
        client: '',
        consent: { sms: false, whatsapp: false, email: false, source: '' },
      },
    ),
    [clientQuery, setClientQuery] = useState(''),
    [clientResults, setClientResults] = useState<Choice[]>([]),
    [error, setError] = useState(''),
    [pending, start] = useTransition();
  return (
    <ActionDrawer
      title={t(item ? 'editLead' : 'newLead')}
      open={open}
      setOpen={setOpen}
      trigger={
        <Button variant={item ? 'secondary' : 'primary'}>
          {t(item ? 'edit' : 'newLead')}
        </Button>
      }
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveLead(value, item?.id, item?.revision);
            if (r.ok) {
              setOpen(false);
              router.refresh();
            } else setError(r.error);
          });
        }}
      >
        <Field
          label={t('name')}
          required
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
        <Field
          label={t('phone')}
          required
          type="tel"
          value={value.phone}
          onChange={(e) => setValue({ ...value, phone: e.target.value })}
        />
        <Field
          label={t('origin')}
          required
          value={value.origin}
          onChange={(e) => setValue({ ...value, origin: e.target.value })}
        />
        <label htmlFor="lead-branch">{t('branch')}</label>
        <select
          id="lead-branch"
          value={value.branch}
          onChange={(e) => setValue({ ...value, branch: e.target.value })}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label htmlFor="lead-status">{t('status')}</label>
        <select
          id="lead-status"
          value={value.status}
          onChange={(e) =>
            setValue({ ...value, status: e.target.value as Lead['status'] })
          }
        >
          {['new', 'contacted', 'simulated', 'submitted', 'approved'].map(
            (x) => (
              <option key={x} value={x}>
                {t(`leadStates.${x}`)}
              </option>
            ),
          )}
        </select>
        <Field
          label={t('searchClient')}
          help={t('conversionHelp')}
          value={clientQuery}
          onChange={(e) => {
            const text = e.target.value;
            setClientQuery(text);
            start(async () => {
              const response = await fetch(
                `/api/clients/search?q=${encodeURIComponent(text)}`,
              );
              if (response.ok) {
                const result = (await response.json()) as { clients: Choice[] };
                setClientResults(result.clients);
              }
            });
          }}
        />
        <div className="search-results">
          {clientResults.map((x) => (
            <Button
              type="button"
              variant="ghost"
              key={x.id}
              onClick={() => {
                setValue({ ...value, client: x.id });
                setClientQuery(x.name);
                setClientResults([]);
              }}
            >
              {x.name}
            </Button>
          ))}
        </div>
        {value.client && (
          <>
            <a
              href={`/app/clients/${value.client}`}
              className="ui-button ui-button-secondary"
            >
              {t('viewClient')}
            </a>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setValue({ ...value, client: '' });
                setClientQuery('');
              }}
            >
              {t('unlinkClient')}
            </Button>
          </>
        )}
        {channels.map((c) => (
          <label key={c} className="switch-row">
            <input
              type="checkbox"
              checked={value.consent[c]}
              onChange={(e) =>
                setValue({
                  ...value,
                  consent: { ...value.consent, [c]: e.target.checked },
                })
              }
            />
            {t('channelConsent', { channel: t(c) })}
          </label>
        ))}
        <Field
          label={t('consentSource')}
          value={value.consent.source}
          onChange={(e) =>
            setValue({
              ...value,
              consent: { ...value.consent, source: e.target.value },
            })
          }
        />
        <p>{t('leadHelp')}</p>
        {error && (
          <p role="alert" className="form-error">
            {t(`errors.${error}`)}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {t('save')}
        </Button>
      </form>
    </ActionDrawer>
  );
}
export function ConsentDrawer({ client }: { client: Choice }) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms'),
    [enabled, setEnabled] = useState(false),
    [source, setSource] = useState(''),
    [error, setError] = useState(''),
    [pending, start] = useTransition();
  return (
    <ActionDrawer
      title={t('consent')}
      open={open}
      setOpen={setOpen}
      trigger={<Button variant="secondary">{t('consent')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await setCommunicationConsent({
              client: client.id,
              channel,
              enabled,
              source,
            });
            if (r.ok) {
              setOpen(false);
              router.refresh();
            } else setError(r.error);
          });
        }}
      >
        <p>{client.name}</p>
        <label htmlFor="consent-channel">{t('channel')}</label>
        <select
          id="consent-channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t('newAuthorisation')}
        </label>
        <Field
          label={t('consentSource')}
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <p>{t('optOutHelp')}</p>
        {error && <p role="alert">{t(`errors.${error}`)}</p>}
        <Button type="submit" loading={pending}>
          {t('save')}
        </Button>
      </form>
    </ActionDrawer>
  );
}
