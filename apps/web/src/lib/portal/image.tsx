import type { ComponentProps } from 'react';
// These private CAPTCHA and tenant-hosted images require no browser image library.
export function PublicImage({
  alt,
  ...props
}: ComponentProps<'img'> & { alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- Keep the mobile public JavaScript budget; dimensions and loading are explicit at each use.
  return <img alt={alt} {...props} />;
}
