'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Drawer } from '@loma/ui';
import { PlusIcon } from '@phosphor-icons/react';
import { ActionForm, type FormField } from './action-form';
import type { ActionResult } from '@/app/actions';
export function FormDrawer({
  title,
  description,
  trigger,
  fields,
  action,
  submitLabel,
  kind = 'generic',
  secondary = false,
}: {
  title: string;
  description: string;
  trigger: string;
  fields: FormField[];
  action: (values: Record<string, string>) => Promise<ActionResult>;
  submitLabel: string;
  kind?: 'generic' | 'tenant' | 'brand' | 'security';
  secondary?: boolean;
}) {
  const t = useTranslations('App');
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t(title)}
      description={t(description)}
      closeLabel={t('close')}
      trigger={
        <Button variant={secondary ? 'secondary' : 'primary'}>
          {!secondary && <PlusIcon aria-hidden />}
          {t(trigger)}
        </Button>
      }
    >
      <ActionForm
        fields={fields}
        action={action}
        submitLabel={submitLabel}
        kind={kind}
        onSuccess={() => setOpen(false)}
      />
    </Drawer>
  );
}
