import type { TFunction } from 'i18next';

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'auth.invalidLogin',
  email_not_confirmed: 'auth.emailNotConfirmed',
  user_already_exists: 'auth.emailTaken',
  email_exists: 'auth.emailTaken',
  over_email_send_rate_limit: 'auth.rateLimit',
  over_request_rate_limit: 'auth.rateLimit',
  validation_failed: 'auth.missingEmailOrPhone',
  weak_password: 'auth.weakPassword',
  same_password: 'auth.samePassword',
};

const BY_TEXT: { test: RegExp; key: string }[] = [
  { test: /invalid login|invalid_credentials|invalid credentials/i, key: 'auth.invalidLogin' },
  { test: /missing email or phone/i, key: 'auth.missingEmailOrPhone' },
  { test: /email not confirmed/i, key: 'auth.emailNotConfirmed' },
  { test: /already registered|already exists/i, key: 'auth.emailTaken' },
  { test: /unable to validate email|invalid email/i, key: 'auth.invalidEmail' },
  { test: /password should be at least|weak password|valid password/i, key: 'auth.weakPassword' },
  { test: /rate limit|only request this once/i, key: 'auth.rateLimit' },
  { test: /new password should be different|same_password/i, key: 'auth.samePassword' },
];

function authBits(err: unknown) {
  if (!err || typeof err !== 'object') {
    return { code: '', text: typeof err === 'string' ? err : '' };
  }
  const row = err as { code?: unknown; message?: unknown; error_description?: unknown };
  return {
    code: typeof row.code === 'string' ? row.code : '',
    text: [row.message, row.error_description].filter((item) => typeof item === 'string').join(' '),
  };
}

export function authErrorMessage(err: unknown, t: TFunction) {
  if (err instanceof Error) {
    if (err.message === 'studentEmailRequired') return t('auth.studentEmailRequired');
    if (err.message === 'invalidEmail') return t('auth.invalidEmail');
    if (err.message === 'accountSuspended') return t('auth.accountSuspended');
  }
  const { code, text } = authBits(err);
  if (code && BY_CODE[code]) return t(BY_CODE[code]);
  const hit = BY_TEXT.find((item) => item.test.test(`${code} ${text}`));
  if (hit) return t(hit.key);
  return t('common.error');
}
