export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 12;

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  match: boolean;
};

export function passwordChecks(password: string, confirm?: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    match: confirm == null ? true : password.length > 0 && password === confirm,
  };
}

export function isPasswordValid(password: string, confirm?: string) {
  const next = passwordChecks(password, confirm);
  return next.length && next.upper && next.lower && next.number && next.match;
}
