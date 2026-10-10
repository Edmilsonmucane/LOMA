import { NextIntlClientProvider } from 'next-intl';
export function InternalIntlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
