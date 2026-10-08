'use client';
import { useEffect } from 'react';
export function PublicEnhancements() {
  useEffect(() => {
    if (document.querySelector('script[data-loma-public]')) return;
    const script = document.createElement('script');
    script.src = '/site.js';
    script.async = true;
    script.dataset.lomaPublic = 'true';
    document.body.append(script);
    if (document.querySelector('.cf-turnstile')) {
      const captcha = document.createElement('script');
      captcha.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      captcha.async = true;
      document.body.append(captcha);
    }
  }, []);
  return null;
}
