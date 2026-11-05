/* MONAD — authentication adapter.
 *
 * Production: the platform session (Base44 SDK). Passwords never touch our code,
 * never enter an entity, and there is no custom credential store.
 *
 * `testAdapter` is a routing-harness double. It is only reachable on localhost with
 * ?test=1 and is never selected in a deployed build. It performs NO authentication.
 */
const isLocal = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

function testAdapter() {
  const KEY = 'monad.test.session';
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; } };
  const write = (v) => v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY);
  return {
    kind: 'test-double',
    async session() { return read(); },
    async signUp({ email }) {
      if (!email) throw Object.assign(new Error('invalid_email'), { code: 'invalid_email' });
      const s = { user: { id: 'test_' + email.split('@')[0], email } };
      write(s); return s;
    },
    async signIn({ email, password }) {
      if (!email) throw Object.assign(new Error('invalid_credentials'), { code: 'invalid_credentials' });
      if (password === 'wrong') throw Object.assign(new Error('invalid_credentials'), { code: 'invalid_credentials' });
      const s = { user: { id: 'test_' + email.split('@')[0], email } };
      write(s); return s;
    },
    async signOut() { write(null); },
    onChange() { return () => {}; },
  };
}

function platformAdapter() {
  let sdk = null;
  const load = async () => {
    if (!sdk) sdk = await import('https://base44.app/api/sdk.js').catch(() => null);
    return sdk;
  };
  return {
    kind: 'platform',
    async session() {
      const s = await load();
      try { return s?.auth ? { user: await s.auth.me() } : null; } catch { return null; }
    },
    async signUp({ email, password }) {
      const s = await load();
      if (!s?.auth) throw Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable' });
      return { user: await s.auth.signUp({ email, password }) };
    },
    async signIn({ email, password }) {
      const s = await load();
      if (!s?.auth) throw Object.assign(new Error('auth_unavailable'), { code: 'auth_unavailable' });
      return { user: await s.auth.login({ email, password }) };
    },
    async signOut() {
      const s = await load();
      if (s?.auth) await s.auth.logout();
    },
    onChange(cb) { return () => {}; },
  };
}

export function createAuth() {
  const useTest = isLocal() && new URLSearchParams(location.search).get('test') === '1';
  const adapter = useTest ? testAdapter() : platformAdapter();
  let cached = null;
  let resolved = false;

  return {
    kind: adapter.kind,
    async getSession({ force = false } = {}) {
      if (!resolved || force) { cached = await adapter.session(); resolved = true; }
      return cached;
    },
    async signUp(creds) { const s = await adapter.signUp(creds); cached = s; resolved = true; return s; },
    async signIn(creds) { const s = await adapter.signIn(creds); cached = s; resolved = true; return s; },
    async signOut() { await adapter.signOut(); cached = null; resolved = true; },
  };
}
