import { getRequestConfig } from 'next-intl/server';
export default getRequestConfig(async () => ({
  locale: 'pt-MZ',
  timeZone: 'Africa/Maputo',
  messages: (await import('../../messages/pt-MZ.json')).default,
}));
