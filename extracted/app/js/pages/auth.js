/* Login and Signup — same bones, different copy. Errors are explicit, never silent. */
const ERRORS = {
  invalid_credentials: { fa: 'ایمیل یا گذرواژه درست نیست.', en: 'Email or password is incorrect.' },
  invalid_email: { fa: 'ایمیل معتبر وارد کن.', en: 'Enter a valid email.' },
  user_already_exists: { fa: 'این ایمیل قبلاً ثبت شده است.', en: 'This email is already registered.' },
  auth_unavailable: { fa: 'سرویس ورود در دسترس نیست.', en: 'Authentication is unavailable.' },
  network: { fa: 'اتصال برقرار نشد.', en: 'Network request failed.' },
};

function screen(mode, lang) {
  const isSignup = mode === 'signup';
  const t = (fa, en) => (lang === 'en' ? en : fa);
  return `
  <div class="auth">
    <img class="auth__brand" src="..//brand/final/raster/lockup-horizontal-${document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'}.png" alt="MONAD">
    <h1 class="auth__title">${isSignup ? t('ساخت حساب', 'Create account') : t('ورود', 'Sign in')}</h1>
    <p class="auth__sub">${isSignup ? t('برای ثبت تجربه‌ی روزانه', 'To record your daily experience') : t('به MONAD برگرد', 'Back to MONAD')}</p>

    <form class="auth__form" id="auth-form" novalidate>
      <div class="field">
        <label class="field__label" for="email">${t('ایمیل', 'Email')}</label>
        <input class="input" id="email" name="email" type="email" autocomplete="email" required
               dir="ltr" placeholder="you@example.com">
      </div>
      <div class="field">
        <label class="field__label" for="password">${t('گذرواژه', 'Password')}</label>
        <input class="input" id="password" name="password" type="password" required
               autocomplete="${isSignup ? 'new-password' : 'current-password'}" dir="ltr" minlength="8">
        <span class="field__hint">${t('حداقل ۸ نویسه', 'At least 8 characters')}</span>
      </div>

      <div class="alert alert--negative" id="auth-error" role="alert" hidden></div>

      <button class="btn btn--primary btn--block" id="auth-submit" type="submit">
        <span class="btn__label">${isSignup ? t('ساخت حساب', 'Create account') : t('ورود', 'Sign in')}</span>
      </button>
    </form>

    <p class="auth__switch">
      ${isSignup
        ? `${t('حساب داری؟', 'Already have an account?')} <a href="/login" data-link>${t('وارد شو', 'Sign in')}</a>`
        : `${t('حساب نداری؟', 'No account yet?')} <a href="/signup" data-link>${t('بساز', 'Create one')}</a>`}
    </p>
  </div>`;
}

export function authPage(mode, { auth, navigate, lang = 'fa', next = '/' }) {
  return {
    title: mode === 'signup' ? 'Signup' : 'Login',
    html() { return screen(mode, lang); },
    after(root) {
      const form = root.querySelector('#auth-form');
      const errBox = root.querySelector('#auth-error');
      const btn = root.querySelector('#auth-submit');
      const label = btn.querySelector('.btn__label');
      const original = label.textContent;

      const fail = (code) => {
        const msg = ERRORS[code] || { fa: 'خطای نامشخص رخ داد.', en: 'Something went wrong.' };
        errBox.textContent = lang === 'en' ? msg.en : msg.fa;
        errBox.hidden = false;
        errBox.scrollIntoView({ block: 'nearest' });
      };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        const email = form.email.value.trim();
        const password = form.password.value;
        if (!email.includes('@')) return fail('invalid_email');
        if (password.length < 8) return fail('invalid_credentials');

        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        label.textContent = lang === 'en' ? 'Working…' : 'در حال انجام…';

        try {
          if (mode === 'signup') await auth.signUp({ email, password });
          else await auth.signIn({ email, password });
          navigate(next, { replace: true });
        } catch (err) {
          fail(err?.code || 'network');
        } finally {
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
          label.textContent = original;
        }
      });
    },
  };
}
