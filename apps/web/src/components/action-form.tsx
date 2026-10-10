'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Field, useHydrated } from '@loma/ui';
import {
  loginSchema,
  tenantSchema,
  brandSchema,
  securitySchema,
} from '@/lib/domain/tenancy';
import type { ActionResult } from '@/app/actions';
export type FormField = {
  name: string;
  label?: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'color'
    | 'hidden'
    | 'select'
    | 'switch';
  value?: string;
  required?: boolean;
  help?: string;
  disabled?: boolean;
  options?: { value: string; label: string }[];
};
const valuesSchema = z.record(z.string(), z.string());
export function ActionForm({
  fields,
  action,
  submitLabel,
  kind = 'generic',
  onSuccess,
}: {
  fields: FormField[];
  action: (values: Record<string, string>) => Promise<ActionResult>;
  submitLabel: string;
  kind?: 'generic' | 'login' | 'tenant' | 'brand' | 'security';
  onSuccess?: () => void;
}) {
  const t = useTranslations('App');
  const router = useRouter();
  const ready = useHydrated();
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(valuesSchema),
    defaultValues: Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.value ??
          (field.type === 'select' ? (field.options?.[0]?.value ?? '') : ''),
      ]),
    ),
  });
  const submit = handleSubmit(async (values) => {
    setMessage('');
    setSuccess(false);
    const parsed =
      kind === 'login'
        ? loginSchema.safeParse(values)
        : kind === 'tenant'
          ? tenantSchema.safeParse(values)
          : kind === 'brand'
            ? brandSchema.safeParse(values)
            : kind === 'security'
              ? securitySchema.safeParse({
                  require_mfa: values.require_mfa === 'true',
                  session_hours: Number(values.session_hours),
                  password_min_length: Number(values.password_min_length),
                })
              : valuesSchema.safeParse(values);
    if (!parsed.success) {
      setMessage('invalid');
      return;
    }
    try {
      const result = await action(values);
      if (!result.ok) {
        setMessage(result.error ?? 'failed');
        return;
      }
      setSuccess(true);
      router.refresh();
      onSuccess?.();
      if (result.redirect) router.push(result.redirect);
    } catch {
      setMessage('failed');
    }
  });
  return (
    <form className="action-form" onSubmit={submit} data-ready={ready}>
      {fields.map((field) => {
        if (field.type === 'hidden')
          return (
            <input type="hidden" key={field.name} {...register(field.name)} />
          );
        if (field.type === 'switch')
          return (
            <SwitchField
              key={field.name}
              field={field}
              ready={ready && !isSubmitting}
              onValue={(value) =>
                register(field.name).onChange({
                  target: { name: field.name, value },
                })
              }
              label={t(field.label ?? field.name)}
            />
          );
        if (field.type === 'select')
          return (
            <div className="ui-field" key={field.name}>
              <label className="ui-label" htmlFor={field.name}>
                {t(field.label ?? field.name)}
              </label>
              <select
                id={field.name}
                className="ui-input"
                {...register(field.name)}
                disabled={!ready || isSubmitting || field.disabled}
                required={field.required}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {field.help && <p className="ui-help">{t(field.help)}</p>}
            </div>
          );
        return (
          <Field
            key={field.name}
            label={t(field.label ?? field.name)}
            type={field.type ?? 'text'}
            {...register(field.name)}
            required={field.required}
            disabled={isSubmitting || field.disabled}
            {...(field.help ? { help: t(field.help) } : {})}
            autoComplete={
              field.type === 'password'
                ? kind === 'login'
                  ? 'current-password'
                  : 'new-password'
                : field.type === 'email'
                  ? 'email'
                  : 'off'
            }
          />
        );
      })}
      {message && (
        <p className="ui-error" role="alert">
          {t(`errors.${message}`)}
        </p>
      )}
      {success && (
        <p className="ui-help" role="status">
          {t('saved')}
        </p>
      )}
      <Button type="submit" loading={isSubmitting}>
        {t(submitLabel)}
      </Button>
    </form>
  );
}
function SwitchField({
  field,
  ready,
  onValue,
  label,
}: {
  field: FormField;
  ready: boolean;
  onValue: (value: string) => void;
  label: string;
}) {
  const [checked, setChecked] = useState(field.value === 'true');
  return (
    <label className="switch-field">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={!ready || field.disabled}
        onChange={(event) => {
          setChecked(event.target.checked);
          void onValue(event.target.checked ? 'true' : 'false');
        }}
      />
    </label>
  );
}
