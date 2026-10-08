/* Small progressive enhancements. Financial calculations stay on the server. */
window.lomaPublicInit = () => {
  'use strict';
  const root = document.querySelector('[data-public-copy]');
  if (!root) return;
  const copy = JSON.parse(root.textContent);
  const txt = (k) => copy[k] ?? k;
  const messages = copy.errors;
  const show = (form, error) => {
    const p = form.querySelector('[data-error]');
    if (p) {
      p.textContent = messages[error] ?? messages.network;
      p.hidden = false;
    }
  };
  const clear = (form) => {
    const p = form.querySelector('[data-error]');
    if (p) p.hidden = true;
  };
  const busy = (form, value) => {
    form.querySelectorAll('button').forEach((b) => (b.disabled = value));
  };
  const post = async (action, data) => {
    const r = await fetch('/api/public/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const v = await r.json();
    if (!r.ok) throw Object.assign(new Error(), { code: v.error });
    return v;
  };
  const status = (f, s) => {
    const p = f.querySelector('[data-status]');
    if (p) p.textContent = s;
  };
  const money = (v) => {
    const n = BigInt(v);
    return (
      (n / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') +
      ',' +
      (n % 100n).toString().padStart(2, '0') +
      ' MT'
    );
  };
  const cents = (v) => {
    const s = String(v).replace(/[\s\u00a0\u202f]/g, '');
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(s))
      throw Object.assign(new Error(), { code: 'invalid' });
    const a = s.replace(',', '.').split('.');
    return (
      BigInt(a[0]) * 100n +
      BigInt((a[1] ?? '').padEnd(2, '0'))
    ).toString();
  };
  function captchaRefresh(form) {
    const image = form.querySelector('img[src^="/api/public/captcha"]');
    if (image) {
      form.dataset.captchaId = crypto.randomUUID();
      image.src = '/api/public/captcha?id=' + form.dataset.captchaId;
    }
  }
  document.querySelectorAll('[data-simulator]').forEach((form) => {
    if (form.dataset.lomaEnhanced) return;
    form.dataset.lomaEnhanced = 'true';
    const products = JSON.parse(form.dataset.products),
      a = form.elements.principal,
      p = form.elements.periods,
      s = form.elements.product;
    let timer, controller;
    const update = async () => {
      clear(form);
      form.querySelector('[data-amount]').textContent = money(a.value);
      const selected = products.find((x) => x.id === s.value);
      form.querySelector('[data-periods]').textContent =
        p.value + ' ' + copy.periodicity[selected.periodicity];
      const link = form.querySelector('[data-request]');
      link.href =
        '/request?' +
        new URLSearchParams({
          product: s.value,
          principal: a.value,
          periods: p.value,
        });
      link.setAttribute('aria-disabled', 'true');
      controller?.abort();
      controller = new AbortController();
      try {
        const r = await fetch(
          '/api/public/quote?' +
            new URLSearchParams({
              product: s.value,
              principal: a.value,
              periods: p.value,
            }),
          { signal: controller.signal },
        );
        const v = await r.json();
        if (!r.ok) throw Object.assign(new Error(), { code: v.error });
        Object.entries(v).forEach(([key, value]) => {
          const o = form.querySelector(`[data-quote="${key}"]`);
          if (!o) return;
          if (key === 'payment') {
            const separator = value.lastIndexOf(' ');
            const currency = document.createElement('span');
            currency.className = 'money-unit';
            currency.textContent = value.slice(separator + 1);
            o.replaceChildren(value.slice(0, separator + 1), currency);
          } else o.textContent = value;
        });
        link.removeAttribute('aria-disabled');
      } catch (e) {
        if (e.name !== 'AbortError') show(form, e.code);
      }
    };
    form.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(update, 120);
    });
    s.addEventListener('change', () => {
      const v = products.find((x) => x.id === s.value);
      a.min = v.min;
      a.max = v.max;
      a.value = v.min;
      p.min = v.minPeriods;
      p.max = v.maxPeriods;
      p.value = v.minPeriods;
      update();
    });
    form.querySelector('[data-request]').addEventListener('click', (e) => {
      if (e.currentTarget.hasAttribute('aria-disabled')) e.preventDefault();
    });
  });
  document.querySelectorAll('[data-otp]').forEach((form) => {
    if (form.dataset.lomaEnhanced) return;
    form.dataset.lomaEnhanced = 'true';
    let verifying = false;
    form
      .querySelector('[data-captcha-refresh]')
      .addEventListener('click', () => captchaRefresh(form));
    form.querySelector('[data-otp-reset]').addEventListener('click', () => {
      verifying = false;
      form.querySelector('[data-otp-start]').hidden = false;
      form.querySelector('[data-otp-verify]').hidden = true;
      form.elements.captcha.required = true;
      form.elements.code.required = false;
      captchaRefresh(form);
      clear(form);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clear(form);
      busy(form, true);
      try {
        const phone = form.elements.phone.value;
        if (verifying) {
          await post('verify', { phone, code: form.elements.code.value });
          location.reload();
          return;
        }
        await post('otp', {
          phone,
          captcha: form.elements.captcha.value,
          captchaId: form.dataset.captchaId,
          captchaToken: form.querySelector('[name="cf-turnstile-response"]')
            ?.value,
        });
        verifying = true;
        form.querySelector('[data-otp-start]').hidden = true;
        form.querySelector('[data-otp-verify]').hidden = false;
        form.elements.captcha.required = false;
        form.elements.code.required = true;
        form.elements.code.focus();
        status(form, txt('codeSent'));
      } catch (error) {
        show(form, error.code);
        if (!verifying) captchaRefresh(form);
      } finally {
        busy(form, false);
      }
    });
  });
  document.querySelectorAll('[data-lead]').forEach((form) => {
    if (form.dataset.lomaEnhanced) return;
    form.dataset.lomaEnhanced = 'true';
    return form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clear(form);
      busy(form, true);
      try {
        await post('lead', {
          name: form.elements.name.value,
          phone: form.elements.phone.value,
          branch_id: form.elements.branch_id.value,
          consent: form.elements.consent.checked,
          captcha: form.elements.captcha.value,
          captchaId: form.dataset.captchaId,
        });
        status(form, txt('leadSaved'));
        form.reset();
        captchaRefresh(form);
      } catch (error) {
        show(form, error.code);
        captchaRefresh(form);
      } finally {
        busy(form, false);
      }
    });
  });
  document
    .querySelector('[data-logout]')
    ?.addEventListener('click', async () => {
      await post('logout', {});
      location.reload();
    });
  const form = document.querySelector('[data-request-form]');
  if (form && !form.dataset.lomaEnhanced) {
    form.dataset.lomaEnhanced = 'true';
    form.noValidate = true;
    let step = 0;
    const fields = [...form.querySelectorAll('[data-step]')];
    const value = (k) => form.elements[k].value;
    const draw = () => {
      fields.forEach((f, i) => (f.hidden = i !== step));
      document.querySelectorAll('[data-step-marker]').forEach((f, i) => {
        if (i === step) f.setAttribute('aria-current', 'step');
        else f.removeAttribute('aria-current');
      });
      form.querySelector('[data-back]').hidden = step === 0;
      form.querySelector('[data-next]').textContent = txt(
        step === 3 ? 'submit' : 'continue',
      );
      if (step === 3) {
        const panel = form.querySelector('[data-request-summary]');
        panel.replaceChildren();
        for (const [label, val] of [
          ['name', value('name')],
          ['amount', money(value('principal'))],
          ['duration', value('periods')],
          ['purpose', value('purpose')],
        ]) {
          const p = document.createElement('p');
          p.textContent = txt(label) + ': ' + val;
          panel.append(p);
        }
        const query = new URLSearchParams({
          product: form.dataset.product,
          principal: value('principal'),
          periods: value('periods'),
        });
        fetch('/api/public/quote?' + query)
          .then((r) => r.json())
          .then((v) => {
            for (const key of [
              'payment',
              'total',
              'interest',
              'fees',
              'annual',
              'disbursed',
            ]) {
              if (!v[key]) continue;
              const p = document.createElement('p');
              p.textContent = txt(key) + ': ' + v[key];
              panel.append(p);
            }
          })
          .catch(() => show(form, 'network'));
      }
      const legend = fields[step].querySelector('legend');
      legend.tabIndex = -1;
      legend.focus();
    };
    draw();
    const data = () => ({
      name: value('name'),
      birth_date: value('birth_date'),
      branch_id: value('branch_id'),
      product_version_id: form.dataset.version,
      principal: value('principal'),
      periods: Number(value('periods')),
      purpose: value('purpose') || form.dataset.draftPurpose,
      guarantees: [...form.querySelectorAll('[name="guarantees"]:checked')].map(
        (x) => x.value,
      ),
      profile: {
        identities: value('identity_value')
          ? [{ kind: value('identity_kind'), value: value('identity_value') }]
          : [],
        contacts: [{ kind: 'phone', value: form.dataset.phone }],
        province: value('province'),
        district: value('district'),
        neighbourhood: value('neighbourhood'),
        address: value('address'),
        activity: value('activity'),
        employer: value('employer'),
        income: cents(value('income') || '0'),
        expenses: cents(value('expenses') || '0'),
        references: [],
        guarantors: [],
      },
    });
    const save = async () => {
      const v = await post('save', {
        id: form.dataset.draft,
        revision: Number(form.dataset.revision),
        data: data(),
      });
      form.dataset.revision = String(v.revision);
      status(form, txt('saved'));
    };
    form.querySelector('[data-back]').addEventListener('click', () => {
      step--;
      clear(form);
      draw();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clear(form);
      if (
        ![...fields[step].querySelectorAll('input,select,textarea')].every(
          (x) => x.reportValidity(),
        )
      )
        return;
      if (step === 1 && value('purpose').trim().length < 2) {
        show(form, 'invalid');
        form.elements.purpose.focus();
        return;
      }
      busy(form, true);
      try {
        if (step < 3) {
          await save();
          step++;
          draw();
        } else {
          const v = await post('submit', {
            id: form.dataset.draft,
            revision: Number(form.dataset.revision),
            accepted: form.elements.accepted.checked,
          });
          const section = form.closest('section');
          section.replaceChildren();
          const h = document.createElement('h1');
          h.textContent = txt('submitted').replace(
            '{number}',
            v.id.slice(0, 8).toUpperCase(),
          );
          section.append(h);
          const a = document.createElement('a');
          a.href = '/customer';
          a.className = 'ui-button ui-button-primary';
          a.textContent = txt('customerArea');
          section.append(a);
        }
      } catch (error) {
        show(form, error.code);
      } finally {
        busy(form, false);
      }
    });
    form.querySelector('[data-upload]').addEventListener('click', async () => {
      clear(form);
      busy(form, true);
      try {
        let file = form.elements.file.files[0];
        if (!file) throw Object.assign(new Error(), { code: 'file' });
        if (file.type.startsWith('image/')) {
          const bitmap = await createImageBitmap(file);
          const scale = Math.min(
            1,
            1600 / Math.max(bitmap.width, bitmap.height),
          );
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          canvas
            .getContext('2d')
            .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();
          const compressed = await new Promise((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.82),
          );
          if (compressed && compressed.size < file.size)
            file = new File([compressed], 'documento.jpg', {
              type: 'image/jpeg',
            });
        }
        if (file.size > 5242880)
          throw Object.assign(new Error(), { code: 'size' });
        const fd = new FormData();
        fd.set('draft', form.dataset.draft);
        fd.set('title', value('document_title'));
        fd.set('expires', value('document_expires'));
        fd.set('file', file);
        const r = await fetch('/api/public/upload', {
          method: 'POST',
          body: fd,
        });
        const v = await r.json();
        if (!r.ok) throw Object.assign(new Error(), { code: v.error });
        const li = document.createElement('li');
        li.textContent = v.title;
        form.querySelector('[data-documents]').append(li);
        form.elements.file.value = '';
        status(form, txt('uploaded'));
      } catch (error) {
        show(form, error.code);
      } finally {
        busy(form, false);
      }
    });
  }
  document
    .querySelectorAll('[data-request-form],[data-otp],[data-lead]')
    .forEach((form) => busy(form, false));
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('/sw.js').catch(() => {});
};
window.lomaPublicInit();
