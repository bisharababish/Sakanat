/** Changes when the intro should play again (app open, or automatic sign-out). */
let token = 'start';
/** Manual logout goes to the login page. Automatic sign-out replays the intro. */
let manualLogout = false;

export function bumpIntroToken() {
  token = String(Date.now());
}

export function currentIntroToken() {
  return token;
}

export function markManualLogout() {
  manualLogout = true;
}

export function markIdleLogout() {
  manualLogout = false;
  bumpIntroToken();
}

export function isManualLogout() {
  return manualLogout;
}

export function clearManualLogout() {
  manualLogout = false;
}
