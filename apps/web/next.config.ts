import createNextIntlPlugin from 'next-intl/plugin';
export default createNextIntlPlugin('./src/i18n/request.ts')({
  transpilePackages: ['@loma/ui', '@loma/loan-engine'],
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/api/receipts/*': [
      './node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff',
    ],
    '/api/contracts/*': [
      './node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff',
    ],
  },
  logging: {
    serverFunctions: false,
    incomingRequests: {
      ignore: [/\/auth\/callback/, /\/api\/message-webhooks\//],
    },
  },
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1', '*.localhost'],
});
