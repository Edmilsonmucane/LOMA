import { randomUUID } from 'node:crypto';
import { PublicImage as Image } from './image';
import { getTranslations } from 'next-intl/server';
export async function CustomerLogin() {
  const t = await getTranslations('Public');
  const captchaId = randomUUID();
  return (
    <section className="public-login">
      <p className="eyebrow">{t('customerArea')}</p>
      <h1>{t('loginTitle')}</h1>
      <p>{t('loginHelp')}</p>
      <form method="post" data-otp data-captcha-id={captchaId}>
        <div data-otp-start>
          <label htmlFor="customer-phone">{t('phone')}</label>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+258 84 123 4567"
            required
          />
          <Image
            loading="eager"
            src={`/api/public/captcha?id=${captchaId}`}
            width="240"
            height="64"
            alt={t('captchaImage')}
          />
          <button
            disabled
            data-captcha-refresh
            type="button"
            className="public-text-button"
          >
            {t('newCaptcha')}
          </button>
          <label htmlFor="customer-captcha">{t('captcha')}</label>
          <input
            id="customer-captcha"
            name="captcha"
            pattern="[0-9]{6}"
            inputMode="numeric"
            maxLength={6}
            required
          />
          {process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY && (
            <div
              className="cf-turnstile"
              data-sitekey={process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY}
            />
          )}
          <button
            disabled
            type="submit"
            className="ui-button ui-button-primary"
          >
            {t('sendCode')}
          </button>
        </div>
        <div data-otp-verify hidden>
          <p>{t('codeHelp')}</p>
          <label htmlFor="customer-code">{t('code')}</label>
          <input
            id="customer-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
          />
          <button
            disabled
            type="submit"
            className="ui-button ui-button-primary"
          >
            {t('verifyCode')}
          </button>
          <button data-otp-reset className="public-text-button" type="button">
            {t('changePhone')}
          </button>
        </div>
        <p data-error role="alert" hidden />
        <p data-status role="status" />
      </form>
      <p className="ui-help">{t('privateCode')}</p>
      <noscript>
        <p>{t('jsRequired')}</p>
      </noscript>
    </section>
  );
}
