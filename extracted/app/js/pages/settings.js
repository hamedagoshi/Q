import { JournalApi, ProfileApi } from '../api.js';

const TZ = ['UTC', 'Asia/Tehran', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo'];

export default {
  title: 'تنظیمات',
  html({ profile, lang }) {
    const t = (fa, en) => (lang === 'en' ? en : fa);
    const p = profile || {};
    return `
    <section class="section-header"><h1 class="section-header__title">${t('تنظیمات', 'Settings')}</h1>
      <span class="section-header__hint">${t('فقط پروفایل', 'profile only')}</span></section>

    <form class="card stack" id="profile-form" novalidate>
      <div class="field">
        <label class="field__label" for="display_name">${t('نام نمایشی', 'Display name')}</label>
        <input class="input" id="display_name" name="display_name" maxlength="60" value="${(p.display_name || '').replace(/"/g, '&quot;')}">
      </div>

      <div class="field">
        <label class="field__label" for="language">${t('زبان', 'Language')}</label>
        <select class="select" id="language" name="language">
          <option value="fa" ${p.language === 'fa' ? 'selected' : ''}>فارسی</option>
          <option value="en" ${p.language === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>

      <div class="field">
        <label class="field__label" for="timezone">${t('منطقه زمانی', 'Timezone')}</label>
        <select class="select" id="timezone" name="timezone">
          ${TZ.map((z) => `<option value="${z}" ${p.timezone === z ? 'selected' : ''}>${z}</option>`).join('')}
        </select>
        <span class="field__hint">${t('پیش‌فرض ساخت پروفایل: UTC', 'Bootstrap default: UTC')}</span>
      </div>

      <div class="divider"></div>
      <div class="stack">
        <div class="field__label">${t('بکاپ داده‌ها', 'Data backup')}</div>
        <p class="t-caption">${t('همهٔ روزها و همهٔ ورودی‌ها در یک فایل JSON. برای نگهداری یا انتقال.', 'Every day and every entry in one JSON file, for safekeeping or migration.')}</p>
        <button class="btn btn--secondary" type="button" id="export">${t('دریافت فایل JSON', 'Download JSON')}</button>
        <p class="t-caption" id="export-msg" aria-live="polite"></p>
      </div>

      <div class="divider"></div>
      <div class="field">
        <label class="field__label">${t('تم', 'Theme')}</label>
        <div class="seg" role="group" aria-label="${t('تم', 'Theme')}" id="theme-seg">
          ${['dark', 'light', 'system'].map((m) => `<button type="button" data-theme-mode-btn="${m}" aria-pressed="${(p.theme || 'system') === m}">${m}</button>`).join('')}
        </div>
      </div>

      <div class="alert alert--negative" id="form-error" role="alert" hidden></div>
      <div class="row" style="gap:8px;justify-content:flex-start">
        <button class="btn btn--primary" id="save" type="submit"><span class="btn__label">${t('ذخیره', 'Save')}</span></button>
        <button class="btn btn--ghost" type="button" id="signout">${t('خروج از حساب', 'Sign out')}</button>
      </div>
      <p class="t-caption">${t('حذف حساب در این فاز فعال نیست.', 'Account deletion is not part of this phase.')}</p>
    </form>`;
  },

  after(root, ctx) {
    const form = root.querySelector('#profile-form');
    const errBox = root.querySelector('#form-error');
    const save = root.querySelector('#save');
    const label = save.querySelector('.btn__label');
    const original = label.textContent;
    let theme = ctx.profile?.theme || 'system';

    root.querySelectorAll('[data-theme-mode-btn]').forEach((b) => b.addEventListener('click', () => {
      theme = b.dataset.themeModeBtn;
      root.querySelectorAll('[data-theme-mode-btn]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      window.MonadTheme?.set(theme);
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      save.disabled = true; save.setAttribute('aria-busy', 'true');
      label.textContent = ctx.lang === 'en' ? 'Saving…' : 'در حال ذخیره…';
      try {
        const patch = {
          display_name: form.display_name.value.trim(),
          language: form.language.value,
          timezone: form.timezone.value,
          theme,
        };
        const { profile } = await ProfileApi.update(patch);
        ctx.onProfile(profile);
        window.MonadUI?.toast(ctx.lang === 'en' ? 'Saved' : 'ذخیره شد', 'ok');
      } catch (err) {
        errBox.textContent = err.code === 'unauthenticated'
          ? (ctx.lang === 'en' ? 'Session expired. Sign in again.' : 'نشست منقضی شده است. دوباره وارد شو.')
          : (ctx.lang === 'en' ? 'Could not save.' : 'ذخیره نشد.');
        errBox.hidden = false;
        if (err.code === 'unauthenticated') setTimeout(() => ctx.navigate('/login'), 900);
      } finally {
        save.disabled = false; save.removeAttribute('aria-busy');
        label.textContent = original;
      }
    });

    const exportBtn = root.querySelector('#export');
    const exportMsg = root.querySelector('#export-msg');
    if (exportBtn) exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true; exportBtn.setAttribute('aria-busy', 'true');
      exportMsg.textContent = t('در حال ساختن فایل…', 'Building the file…');
      try {
        const { export: payload } = await JournalApi.exportBackup();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `monad-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        exportMsg.textContent = t(
          `${payload.counts.days} روز، ${payload.counts.observations} مشاهده، ${payload.counts.events} رویداد، ${payload.counts.sessions} جلسه، ${payload.counts.reflections} بازنگری`,
          `${payload.counts.days} days, ${payload.counts.observations} observations, ${payload.counts.events} events, ${payload.counts.sessions} sessions, ${payload.counts.reflections} reflections`,
        );
        window.MonadUI?.toast(t('بکاپ آماده شد', 'Backup ready'), 'ok');
      } catch (err) {
        exportMsg.textContent = t('ساخته نشد. دوباره تلاش کن.', 'Could not build it. Try again.');
      } finally {
        exportBtn.disabled = false; exportBtn.removeAttribute('aria-busy');
      }
    });

    root.querySelector('#signout').addEventListener('click', async () => {
      await ctx.auth.signOut();
      ctx.navigate('/login', { replace: true });
    });
  },
};
