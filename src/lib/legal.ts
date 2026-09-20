export const LEGAL_VERSION = 1;

export function needsLegalAccept(profile: { accepted_legal_version?: number | null } | null | undefined) {
  if (!profile) return false;
  return (profile.accepted_legal_version ?? 0) < LEGAL_VERSION;
}
