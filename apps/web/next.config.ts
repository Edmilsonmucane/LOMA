import createNextIntlPlugin from 'next-intl/plugin';
export default createNextIntlPlugin('./src/i18n/request.ts')({
  transpilePackages: ['@loma/ui', '@loma/loan-engine'],
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1', '*.localhost'],
});
