/* global supabase, Matra7I18n, MATRA7 */
(function () {
'use strict';

const createClient = window.supabase && window.supabase.createClient;
if (!createClient) {
  document.body.innerHTML =
    '<main class="card" style="margin:40px auto"><h1>Admin</h1><p class="err">Failed to load Supabase SDK. Hard-refresh and try again.</p></main>';
  throw new Error('supabase UMD missing');
}

const t = (key, fallback) =>
  (window.Matra7I18n && window.Matra7I18n.t(key, fallback)) || fallback || key;

const cfg = window.MATRA7 || {};
const body = document.getElementById('body');
const loginCard = document.getElementById('loginCard');
const shell = document.getElementById('shell');
const loginErr = document.getElementById('loginErr');
const dashErr = document.getElementById('dashErr');
const toast = document.getElementById('toast');
const cfgHint = document.getElementById('cfgHint');

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || String(cfg.supabaseUrl).includes('REPLACE')) {
    cfgHint.textContent = t('admin.cfgHint');
  }

const supabase = createClient(cfg.supabaseUrl || '', cfg.supabaseAnonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let adminProfile = null;
let cache = {
  users: [],
  listings: [],
  bookings: [],
  ids: [],
  reports: [],
};

function show(el, msg, kind = 'err') {
  if (!el) return;
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.className = kind === 'ok' ? 'okbox' : 'err';
  el.classList.remove('hidden');
}

function flash(msg) {
  show(toast, msg, 'ok');
  setTimeout(() => show(toast, ''), 2800);
}

function chip(status) {
  const s = String(status || '—');
  return `<span class="chip ${s}">${s}</span>`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleOf(apt) {
  if (!apt) return '—';
  return apt.title_ar || apt.title_en || apt.id?.slice(0, 8) || '—';
}

function nameOf(p) {
  if (!p) return '—';
  return p.full_name || p.full_name_en || p.email || p.id?.slice(0, 8) || '—';
}

async function audit(action, meta = {}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action,
      target_user_id: meta.targetUserId ?? null,
      target_id: meta.targetId ?? null,
      note: meta.note ?? null,
      detail: meta.detail ?? {},
    });
  } catch {
    /* best-effort */
  }
}

const FAIL_KEY = 'matra7.admin.fails';
const LOCK_KEY = 'matra7.admin.lockUntil';
const MAX_FAILS = 5;
const LOCK_MS = 60 * 1000;
const IDLE_MS = 15 * 60 * 1000;
let idleTimer = null;

function allowedAdminEmail(email) {
  const allow = String(cfg.adminEmail || '')
    .trim()
    .toLowerCase();
  if (!allow || allow.includes('REPLACE')) return true;
  return String(email || '')
    .trim()
    .toLowerCase() === allow;
}

function lockRemainingMs() {
  try {
    const until = Number(localStorage.getItem(LOCK_KEY) || 0);
    return Math.max(0, until - Date.now());
  } catch {
    return 0;
  }
}

function recordLoginFail() {
  try {
    const n = Number(localStorage.getItem(FAIL_KEY) || 0) + 1;
    localStorage.setItem(FAIL_KEY, String(n));
    if (n >= MAX_FAILS) {
      localStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS));
      localStorage.setItem(FAIL_KEY, '0');
    }
  } catch {
    /* ignore */
  }
}

function clearLoginFails() {
  try {
    localStorage.removeItem(FAIL_KEY);
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

function bumpIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  if (!adminProfile) return;
  idleTimer = setTimeout(() => {
    void (async () => {
      await supabase.auth.signOut();
      adminProfile = null;
      showLogin();
      show(loginErr, t('admin.idle'));
    })();
  }, IDLE_MS);
}

['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach((evt) => {
  document.addEventListener(evt, () => bumpIdle(), { passive: true });
});

async function requireAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const email = session.user.email || '';
  if (!allowedAdminEmail(email)) {
    await supabase.auth.signOut();
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, account_status')
    .eq('id', session.user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    profile.role !== 'admin' ||
    profile.account_status === 'suspended' ||
    !allowedAdminEmail(profile.email || email)
  ) {
    await supabase.auth.signOut();
    return null;
  }
  return profile;
}

function setPanel(name) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
  const loaders = {
    overview: loadOverview,
    users: loadUsers,
    listings: loadListings,
    bookings: loadBookings,
    ids: loadIds,
    reports: loadReports,
    reviews: loadReviews,
    payouts: loadPayouts,
    chats: loadChats,
    catalog: loadCatalog,
    settings: loadSettings,
    audit: loadAudit,
  };
  void loaders[name]?.();
}

function showLogin() {
  adminProfile = null;
  pendingMfaFactorId = '';
  if (idleTimer) clearTimeout(idleTimer);
  shell.classList.add('hidden');
  loginCard.classList.remove('hidden');
  body.classList.add('centered');
  showPasswordStep();
}

function showShell(profile) {
  adminProfile = profile;
  loginCard.classList.add('hidden');
  shell.classList.remove('hidden');
  body.classList.remove('centered');
  document.getElementById('who').textContent = profile.full_name || profile.email || 'Admin';
  bumpIdle();
  setPanel('overview');
}

/* —— Overview —— */
async function loadOverview() {
  show(dashErr, '');
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [
    apartments,
    bookings,
    profiles,
    conversations,
    eventsRes,
    pendingOwners,
    pendingListings,
    pendingBookings,
    pendingIds,
    openReports,
  ] = await Promise.all([
    supabase.from('apartments').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('id, status, commission_amount, payment_method, created_at'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('app_events').select('name').gte('created_at', since).limit(5000),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner').eq('owner_status', 'pending'),
    supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('id_verify_status', 'pending')
      .or('national_id_url.not.is.null,university_card_url.not.is.null'),
    supabase.from('app_reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'reviewing']),
  ]);

  const firstErr =
    apartments.error ||
    bookings.error ||
    profiles.error ||
    conversations.error ||
    eventsRes.error;
  if (firstErr) show(dashErr, firstErr.message);

  const earned = (bookings.data || []).filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const commission = earned.reduce((s, b) => s + Number(b.commission_amount || 0), 0);

  document.getElementById('stats').innerHTML = [
    [t('admin.stat.listings'), apartments.count ?? '—'],
    [t('admin.stat.bookings'), (bookings.data || []).length],
    [t('admin.stat.users'), profiles.count ?? '—'],
    [t('admin.stat.chats'), conversations.count ?? '—'],
    [t('admin.stat.commission'), Math.round(commission)],
    [t('admin.stat.pendingOwners'), pendingOwners.count ?? 0],
    [t('admin.stat.pendingListings'), pendingListings.count ?? 0],
    [t('admin.stat.openReports'), openReports.count ?? 0],
  ]
    .map(([label, value]) => `<div class="stat"><b>${esc(value)}</b><span>${label}</span></div>`)
    .join('');

  const counts = {};
  for (const row of eventsRes.data || []) counts[row.name] = (counts[row.name] || 0) + 1;
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  document.getElementById('eventRows').innerHTML =
    sorted.map(([n, c]) => `<tr><td dir="ltr">${esc(n)}</td><td>${c}</td></tr>`).join('') ||
    `<tr><td colspan="2" class="empty">${t('admin.noEvents')}</td></tr>`;

  document.getElementById('queueRows').innerHTML = [
    [t('admin.queue.owners'), pendingOwners.count || 0, 'users'],
    [t('admin.queue.listings'), pendingListings.count || 0, 'listings'],
    [t('admin.queue.bookings'), pendingBookings.count || 0, 'bookings'],
    [t('admin.queue.ids'), pendingIds.count || 0, 'ids'],
    [t('admin.queue.reports'), openReports.count || 0, 'reports'],
  ]
    .map(
      ([label, n, panel]) =>
        `<tr><td>${label}</td><td><b>${n}</b></td><td><button class="btn sm ghost" data-goto="${panel}">${t('admin.openQueue')}</button></td></tr>`,
    )
    .join('');

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.onclick = () => setPanel(btn.dataset.goto);
  });
}

/* —— Users —— */
let catalog = { cities: [], universities: [] };
let editingUser = null;

async function ensureCatalog() {
  if (catalog.cities.length) return;
  const [c, u] = await Promise.all([
    supabase.from('cities').select('id, name_ar, name_en').order('name_ar'),
    supabase.from('universities').select('id, name_ar, name_en, city_id').order('name_ar'),
  ]);
  catalog.cities = c.data || [];
  catalog.universities = u.data || [];
}

function optList(items, value, labelFn) {
  return items
    .map((item) => {
      const v = item.id ?? item.value;
      const label = labelFn ? labelFn(item) : item.name_ar || item.label || v;
      return `<option value="${esc(v)}" ${String(v) === String(value || '') ? 'selected' : ''}>${esc(label)}</option>`;
    })
    .join('');
}

function field(id, label, inputHtml, span2 = false) {
  return `<div class="field${span2 ? ' span2' : ''}"><label for="${id}">${label}</label>${inputHtml}</div>`;
}

function inp(id, value, extra = '') {
  return `<input id="${id}" value="${esc(value ?? '')}" ${extra} />`;
}

function sel(id, optionsHtml) {
  return `<select id="${id}">${optionsHtml}</select>`;
}

function boolSel(id, value) {
  const on = value === true || value === 'true';
  return sel(
    id,
    `<option value="true" ${on ? 'selected' : ''}>Yes</option><option value="false" ${!on ? 'selected' : ''}>No</option>`,
  );
}

function val(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  if (el.type === 'checkbox') return el.checked;
  return el.value;
}

function emptyToNull(s) {
  const trimmed = String(s ?? '').trim();
  return trimmed ? trimmed : null;
}

function numOrNull(s) {
  const trimmed = String(s ?? '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function showUsersList() {
  editingUser = null;
  document.getElementById('usersListWrap').classList.remove('hidden');
  document.getElementById('userDetailWrap').classList.add('hidden');
}

async function loadUsers() {
  show(dashErr, '');
  showUsersList();
  await ensureCatalog();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, full_name_en, email, phone, role, owner_status, account_status, id_verify_status, national_id_number, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(800);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  cache.users = data || [];
  renderUsers();
}

function renderUsers() {
  const q = (document.getElementById('userQ').value || '').trim().toLowerCase();
  const role = document.getElementById('userRole').value;
  const filter = document.getElementById('userFilter').value;
  let rows = cache.users;
  if (role) rows = rows.filter((u) => u.role === role);
  if (filter === 'owner_pending') rows = rows.filter((u) => u.role === 'owner' && u.owner_status === 'pending');
  if (filter === 'suspended') rows = rows.filter((u) => u.account_status === 'suspended');
  if (filter === 'id_pending') rows = rows.filter((u) => u.id_verify_status === 'pending');
  if (q) {
    rows = rows.filter((u) =>
      [u.full_name, u.full_name_en, u.email, u.phone, u.national_id_number, u.id].some((x) =>
        String(x || '').toLowerCase().includes(q),
      ),
    );
  }
  document.getElementById('userRows').innerHTML =
    rows
      .map((u) => {
        const statusBits = [];
        if (u.account_status === 'suspended') statusBits.push(chip('suspended'));
        else statusBits.push(chip(u.account_status || 'active'));
        if (u.role === 'owner') statusBits.push(chip(u.owner_status || '—'));
        if (u.id_verify_status) statusBits.push(chip(u.id_verify_status));
        const actions = [];
        if (u.role === 'owner' && u.owner_status === 'pending') {
          actions.push(`<button class="btn sm ok" data-act="owner-ok" data-id="${u.id}">${t('admin.approve')}</button>`);
          actions.push(`<button class="btn sm danger" data-act="owner-no" data-id="${u.id}">${t('admin.reject')}</button>`);
        }
        if (u.account_status === 'suspended') {
          actions.push(`<button class="btn sm" data-act="restore" data-id="${u.id}">${t('admin.restore')}</button>`);
        } else if (u.role !== 'admin') {
          actions.push(`<button class="btn sm warn" data-act="suspend" data-id="${u.id}">${t('admin.suspend')}</button>`);
        }
        actions.push(`<button class="btn sm" data-act="edit-user" data-id="${u.id}">${t('admin.fullControl')}</button>`);
        return `<tr>
          <td><b>${esc(nameOf(u))}</b><div class="muted" dir="ltr">${esc(u.email || '')}</div></td>
          <td>${esc(u.role)}</td>
          <td>${statusBits.join(' ')}</td>
          <td dir="ltr">${esc(u.phone || '—')}</td>
          <td><div class="row-actions">${actions.join('')}</div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="5" class="empty">${t('admin.noResults')}</td></tr>`;

  bindUserActions();
}

async function setOwnerStatus(id, owner_status) {
  const { error } = await supabase.from('profiles').update({ owner_status }).eq('id', id);
  if (error) throw error;
  if (owner_status === 'rejected') {
    await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', id);
  }
  await audit('user.update', { targetUserId: id, detail: { owner_status } });
}

async function setSuspended(user, suspended, reason) {
  const patch = {
    account_status: suspended ? 'suspended' : 'active',
  };
  if (suspended) patch.expo_push_token = null;
  if (user.role === 'owner') patch.owner_status = suspended ? 'rejected' : 'approved';
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
  if (user.role === 'owner') {
    if (suspended) await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', user.id);
    else await supabase.from('apartments').update({ status: 'pending' }).eq('owner_id', user.id).eq('status', 'rejected');
  }
  await audit(suspended ? 'user.suspend' : 'user.restore', {
    targetUserId: user.id,
    note: reason || null,
  });
}

function bindUserActions() {
  document.querySelectorAll('#userRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const user = cache.users.find((u) => u.id === id);
      if (!user) return;
      try {
        if (btn.dataset.act === 'owner-ok') await setOwnerStatus(id, 'approved');
        if (btn.dataset.act === 'owner-no') await setOwnerStatus(id, 'rejected');
        if (btn.dataset.act === 'suspend') {
          if (!confirm('Suspend this account?')) return;
          const reason = prompt('Suspension reason (optional)') || '';
          await setSuspended(user, true, reason);
        }
        if (btn.dataset.act === 'restore') await setSuspended(user, false);
        if (btn.dataset.act === 'edit-user') {
          await openUserDetail(id);
          return;
        }
        flash(t('admin.done'));
        await loadUsers();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

async function openUserDetail(userId) {
  show(dashErr, '');
  show(document.getElementById('udMsg'), '');
  await ensureCatalog();
  const { data, error } = await supabase
    .from('profiles')
    .select('*, cities(name_ar), universities(name_ar)')
    .eq('id', userId)
    .single();
  if (error || !data) {
    show(dashErr, error?.message || 'User not found');
    return;
  }
  editingUser = data;
  document.getElementById('usersListWrap').classList.add('hidden');
  document.getElementById('userDetailWrap').classList.remove('hidden');
  document.getElementById('udTitle').textContent = nameOf(data);
  document.getElementById('udMeta').innerHTML = `
    <span>${chip(data.role)}</span>
    <span>${chip(data.account_status || 'active')}</span>
    <span>${chip(data.owner_status || '—')}</span>
    <span>${chip(data.id_verify_status || 'none')}</span>
    <code>${esc(data.id)}</code>
    <span dir="ltr">${esc(data.email || '')}</span>
  `;

  const u = data;
  const cityOpts =
    `<option value="">—</option>` +
    optList(catalog.cities, u.city_id, (c) => c.name_en || c.name_ar);
  const uniOpts =
    `<option value="">—</option>` +
    optList(catalog.universities, u.university_id, (x) => x.name_en || x.name_ar);
  const langs = Array.isArray(u.spoken_languages) ? u.spoken_languages.join(', ') : u.spoken_languages || '';
  const opt = (values, current, blank) =>
    (blank ? '<option value="">-</option>' : '') +
    values
      .map((r) => '<option value="' + r + '"' + (String(current || '') === String(r) ? ' selected' : '') + '>' + r + '</option>')
      .join('');

  document.getElementById('udForm').innerHTML = [
    '<div class="section-label">Identity & account</div>',
    field('ud_full_name', 'Full name (AR)', inp('ud_full_name', u.full_name)),
    field('ud_full_name_en', 'Full name (EN)', inp('ud_full_name_en', u.full_name_en, 'dir="ltr"')),
    field('ud_email', 'Email (read-only)', inp('ud_email', u.email, 'dir="ltr" disabled')),
    field('ud_role', 'Role', sel('ud_role', opt(['student', 'renter', 'owner', 'admin'], u.role))),
    field('ud_owner_status', 'Owner status', sel('ud_owner_status', opt(['pending', 'approved', 'rejected'], u.owner_status))),
    field('ud_account_status', 'Account status', sel('ud_account_status', opt(['active', 'suspended'], u.account_status || 'active'))),
    field('ud_language', 'App language', sel('ud_language', opt(['ar', 'en'], u.language || 'ar'))),
    field('ud_avatar_url', 'Avatar URL', inp('ud_avatar_url', u.avatar_url, 'dir="ltr"'), true),
    '<div class="section-label">Contact</div>',
    field('ud_phone', 'Phone', inp('ud_phone', u.phone, 'dir="ltr"')),
    field('ud_whatsapp', 'WhatsApp', inp('ud_whatsapp', u.whatsapp, 'dir="ltr"')),
    field('ud_recovery_email', 'Recovery email', inp('ud_recovery_email', u.recovery_email, 'dir="ltr"')),
    field('ud_recovery_phone', 'Recovery phone', inp('ud_recovery_phone', u.recovery_phone, 'dir="ltr"')),
    field('ud_phone_visibility', 'Phone visibility', sel('ud_phone_visibility', opt(['booking', 'confirmed', 'none'], u.phone_visibility || 'booking'))),
    field('ud_whatsapp_visibility', 'WhatsApp visibility', sel('ud_whatsapp_visibility', opt(['booking', 'confirmed', 'none'], u.whatsapp_visibility || 'booking'))),
    '<div class="section-label">Personal & study</div>',
    field('ud_gender', 'Gender', sel('ud_gender', opt(['female', 'male'], u.gender, true))),
    field('ud_date_of_birth', 'Date of birth', inp('ud_date_of_birth', u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : '', 'type="date" dir="ltr"')),
    field('ud_city_id', 'City', sel('ud_city_id', cityOpts)),
    field('ud_university_id', 'University', sel('ud_university_id', uniOpts)),
    field('ud_student_id_number', 'Student ID', inp('ud_student_id_number', u.student_id_number, 'dir="ltr"')),
    field('ud_major', 'Major', inp('ud_major', u.major)),
    field('ud_degree_level', 'Degree', inp('ud_degree_level', u.degree_level)),
    field('ud_study_year', 'Study year', inp('ud_study_year', u.study_year)),
    field('ud_graduation_term', 'Graduation term', inp('ud_graduation_term', u.graduation_term)),
    field('ud_spoken_languages', 'Languages (comma-separated)', inp('ud_spoken_languages', langs, 'dir="ltr"'), true),
    field('ud_bio', 'Bio', '<textarea id="ud_bio">' + esc(u.bio || '') + '</textarea>', true),
    field('ud_home_address', 'Home address', '<textarea id="ud_home_address">' + esc(u.home_address || '') + '</textarea>', true),
    '<div class="section-label">National ID / verify</div>',
    field('ud_national_id_number', 'National ID', inp('ud_national_id_number', u.national_id_number, 'dir="ltr"')),
    field('ud_national_id_expires_at', 'ID expiry', inp('ud_national_id_expires_at', u.national_id_expires_at ? String(u.national_id_expires_at).slice(0, 10) : '', 'type="date" dir="ltr"')),
    field('ud_id_verify_status', 'Verify status', sel('ud_id_verify_status', opt(['none', 'pending', 'approved', 'rejected'], u.id_verify_status || 'none'))),
    field('ud_id_verify_note', 'Verify note', inp('ud_id_verify_note', u.id_verify_note), true),
    field('ud_national_id_url', 'National ID URL', inp('ud_national_id_url', u.national_id_url, 'dir="ltr"'), true),
    field('ud_university_card_url', 'University card URL', inp('ud_university_card_url', u.university_card_url, 'dir="ltr"'), true),
    field('ud_id_docs_consent_at', 'Docs consent (ISO)', inp('ud_id_docs_consent_at', u.id_docs_consent_at, 'dir="ltr"'), true),
    '<div class="section-label">Emergency</div>',
    field('ud_emergency_name', 'Emergency name', inp('ud_emergency_name', u.emergency_name)),
    field('ud_emergency_phone', 'Emergency phone', inp('ud_emergency_phone', u.emergency_phone, 'dir="ltr"')),
    field('ud_share_emergency', 'Share emergency', boolSel('ud_share_emergency', u.share_emergency)),
    '<div class="section-label">Housing prefs</div>',
    field('ud_pref_budget_max', 'Max budget', inp('ud_pref_budget_max', u.pref_budget_max, 'type="number" dir="ltr"')),
    field('ud_pref_lease_months', 'Lease months', inp('ud_pref_lease_months', u.pref_lease_months, 'type="number" dir="ltr"')),
    field('ud_pref_occupants', 'Occupants', inp('ud_pref_occupants', u.pref_occupants, 'type="number" dir="ltr"')),
    field('ud_pref_move_in', 'Move-in date', inp('ud_pref_move_in', u.pref_move_in ? String(u.pref_move_in).slice(0, 10) : '', 'type="date" dir="ltr"')),
    field('ud_pref_gender_policy', 'Gender policy', sel('ud_pref_gender_policy', opt(['any', 'female', 'male'], u.pref_gender_policy, true))),
    field('ud_pref_allows_smoking', 'Allows smoking', boolSel('ud_pref_allows_smoking', u.pref_allows_smoking)),
    field('ud_pref_allows_pets', 'Allows pets', boolSel('ud_pref_allows_pets', u.pref_allows_pets)),
    '<div class="section-label">Notifications & privacy</div>',
    field('ud_notify_booking', 'Notify bookings', boolSel('ud_notify_booking', u.notify_booking !== false)),
    field('ud_notify_chat', 'Notify chat', boolSel('ud_notify_chat', u.notify_chat !== false)),
    field('ud_notify_listing', 'Notify listings', boolSel('ud_notify_listing', u.notify_listing !== false)),
    field('ud_notify_review', 'Notify reviews', boolSel('ud_notify_review', u.notify_review !== false)),
    field('ud_hide_last_seen', 'Hide last seen', boolSel('ud_hide_last_seen', u.hide_last_seen)),
    field('ud_hide_saved_count', 'Hide saved count', boolSel('ud_hide_saved_count', u.hide_saved_count)),
    field('ud_analytics_consent', 'Analytics consent', boolSel('ud_analytics_consent', u.analytics_consent !== false)),
    field('ud_keep_signed_in', 'Keep signed in', boolSel('ud_keep_signed_in', u.keep_signed_in !== false)),
    '<div class="section-label">Technical</div>',
    field('ud_expo_push_token', 'Push token', inp('ud_expo_push_token', u.expo_push_token, 'dir="ltr"'), true),
    field('ud_last_seen_ip', 'Last IP', inp('ud_last_seen_ip', u.last_seen_ip, 'dir="ltr" disabled')),
    field('ud_accepted_terms_at', 'Accepted terms', inp('ud_accepted_terms_at', u.accepted_terms_at, 'dir="ltr"')),
    field('ud_accepted_legal_version', 'Legal version', inp('ud_accepted_legal_version', u.accepted_legal_version, 'type="number" dir="ltr"')),
    field('ud_created_at', 'Created at', inp('ud_created_at', u.created_at, 'dir="ltr" disabled')),
  ].join('');

  // Activity
  const [{ data: bookings }, reportsRes, blocksRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, status, start_date, created_at')
      .or(`student_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('app_reports')
      .select('id', { count: 'exact', head: true })
      .or(`reporter_id.eq.${userId},target_user_id.eq.${userId}`),
    supabase
      .from('user_blocks')
      .select('blocker_id, blocked_id, created_at')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
      .limit(20),
  ]);
  const bookingLines = (bookings || [])
    .map((b) => `${b.status} · ${b.start_date || ''} · ${String(b.id).slice(0, 8)}`)
    .join('<br>') || 'No bookings';
  document.getElementById('udActivity').innerHTML = `
    <p><b>Related reports:</b> ${reportsRes.count ?? 0} · <b>Blocks:</b> ${(blocksRes.data || []).length}</p>
    <p><b>Recent bookings:</b><br>${bookingLines}</p>
    ${u.national_id_url ? `<p><a href="${esc(u.national_id_url)}" target="_blank" rel="noopener">Open national ID</a></p>` : ''}
    ${u.university_card_url ? `<p><a href="${esc(u.university_card_url)}" target="_blank" rel="noopener">Open university card</a></p>` : ''}
  `;

  const danger = [];
  if (u.account_status === 'suspended') {
    danger.push(`<button class="btn" type="button" id="udRestore">Restore account</button>`);
  } else if (u.role !== 'admin') {
    danger.push(`<button class="btn warn" type="button" id="udSuspend">Suspend account</button>`);
  }
  danger.push(`<button class="btn ghost" type="button" id="udExport">Export user CSV</button>`);
  danger.push(`<button class="btn ghost" type="button" id="udClearPush">Clear push token</button>`);
  danger.push(`<button class="btn ghost" type="button" id="udClearMfa">Clear MFA</button>`);
  danger.push(`<button class="btn ghost" type="button" id="udClearDocs">Clear document links</button>`);
  if (u.role !== 'admin' && u.id !== adminProfile?.id) {
    danger.push(`<button class="btn danger" type="button" id="udDelete">Delete user permanently</button>`);
  }
  document.getElementById('udDanger').innerHTML = danger.join('');

  document.getElementById('udSuspend')?.addEventListener('click', async () => {
    if (!confirm('Suspend account?')) return;
    const reason = prompt('Reason') || '';
    try {
      await setSuspended(editingUser, true, reason);
      flash('Suspended');
      await openUserDetail(userId);
      void loadOverview();
    } catch (e) {
      show(document.getElementById('udMsg'), e.message, 'err');
    }
  });
  document.getElementById('udRestore')?.addEventListener('click', async () => {
    try {
      await setSuspended(editingUser, false);
      flash('Restored');
      await openUserDetail(userId);
    } catch (e) {
      show(document.getElementById('udMsg'), e.message, 'err');
    }
  });
  document.getElementById('udExport')?.addEventListener('click', async () => {
    try {
      const bundle = {
        id: editingUser.id,
        email: editingUser.email,
        full_name: editingUser.full_name,
        full_name_en: editingUser.full_name_en,
        role: editingUser.role,
        phone: editingUser.phone,
        account_status: editingUser.account_status,
        owner_status: editingUser.owner_status,
        id_verify_status: editingUser.id_verify_status,
        national_id_number: editingUser.national_id_number,
        created_at: editingUser.created_at,
      };
      downloadCsv('matra7-user-' + editingUser.id.slice(0, 8) + '.csv', rowsToCsv([bundle]));
      await audit('export.user', { targetUserId: editingUser.id });
      flash('Exported');
    } catch (e) {
      show(document.getElementById('udMsg'), e.message || 'Export failed', 'err');
    }
  });
  document.getElementById('udClearPush')?.addEventListener('click', async () => {
    const { error: err } = await supabase.from('profiles').update({ expo_push_token: null }).eq('id', userId);
    if (err) return show(document.getElementById('udMsg'), err.message, 'err');
    flash('Push token cleared');
    await openUserDetail(userId);
  });
  document.getElementById('udClearDocs')?.addEventListener('click', async () => {
    if (!confirm('Clear document URLs from this profile?')) return;
    const { error: err } = await supabase
      .from('profiles')
      .update({ national_id_url: null, university_card_url: null })
      .eq('id', userId);
    if (err) return show(document.getElementById('udMsg'), err.message, 'err');
    await audit('user.update', { targetUserId: userId, note: 'clear id docs' });
    flash('Done');
    await openUserDetail(userId);
  });
  document.getElementById('udClearMfa')?.addEventListener('click', async () => {
    if (!confirm('Clear MFA for this user?')) return;
    const { error: err } = await supabase.rpc('admin_unenroll_mfa', { target: userId });
    if (err) return show(document.getElementById('udMsg'), err.message, 'err');
    await audit('user.mfa_off', { targetUserId: userId });
    flash('MFA cleared');
  });
  document.getElementById('udDelete')?.addEventListener('click', async () => {
    if (!confirm('Permanently delete this user? This cannot be undone.')) return;
    if (!confirm('Final confirmation to delete?')) return;
    let { error: err } = await supabase.rpc('admin_delete_user', { target: userId });
    if (err) {
      const fallback = await supabase.from('profiles').delete().eq('id', userId);
      if (fallback.error) return show(document.getElementById('udMsg'), err.message || fallback.error.message, 'err');
    }
    await audit('user.delete', { targetUserId: userId });
    flash('Deleted');
    await loadUsers();
    void loadOverview();
  });
}

async function saveUserDetail() {
  if (!editingUser) return;
  const msg = document.getElementById('udMsg');
  show(msg, '');
  const role = val('ud_role');
  const owner_status = val('ud_owner_status');
  const account_status = val('ud_account_status');
  const id_verify_status = val('ud_id_verify_status');
  const spokenRaw = emptyToNull(val('ud_spoken_languages'));
  const spoken_languages = spokenRaw
    ? spokenRaw.split(/[,\u060C]/).map((s) => s.trim()).filter(Boolean)
    : null;

  const patch = {
    full_name: emptyToNull(val('ud_full_name')),
    full_name_en: emptyToNull(val('ud_full_name_en')),
    phone: emptyToNull(val('ud_phone')),
    whatsapp: emptyToNull(val('ud_whatsapp')),
    recovery_email: emptyToNull(val('ud_recovery_email')),
    recovery_phone: emptyToNull(val('ud_recovery_phone')),
    phone_visibility: val('ud_phone_visibility') || 'booking',
    whatsapp_visibility: val('ud_whatsapp_visibility') || 'booking',
    role,
    owner_status: role === 'owner' ? owner_status : editingUser.owner_status,
    account_status,
    language: val('ud_language') || 'en',
    avatar_url: emptyToNull(val('ud_avatar_url')),
    gender: emptyToNull(val('ud_gender')),
    date_of_birth: emptyToNull(val('ud_date_of_birth')),
    city_id: emptyToNull(val('ud_city_id')),
    university_id: emptyToNull(val('ud_university_id')),
    student_id_number: emptyToNull(val('ud_student_id_number')),
    major: emptyToNull(val('ud_major')),
    degree_level: emptyToNull(val('ud_degree_level')),
    study_year: emptyToNull(val('ud_study_year')),
    graduation_term: emptyToNull(val('ud_graduation_term')),
    spoken_languages,
    bio: emptyToNull(val('ud_bio')),
    home_address: emptyToNull(val('ud_home_address')),
    national_id_number: emptyToNull(val('ud_national_id_number')),
    national_id_expires_at: emptyToNull(val('ud_national_id_expires_at')),
    id_verify_status,
    id_verify_note: emptyToNull(val('ud_id_verify_note')),
    national_id_url: emptyToNull(val('ud_national_id_url')),
    university_card_url: emptyToNull(val('ud_university_card_url')),
    id_docs_consent_at: emptyToNull(val('ud_id_docs_consent_at')),
    emergency_name: emptyToNull(val('ud_emergency_name')),
    emergency_phone: emptyToNull(val('ud_emergency_phone')),
    share_emergency: val('ud_share_emergency') === 'true',
    pref_budget_max: numOrNull(val('ud_pref_budget_max')),
    pref_lease_months: numOrNull(val('ud_pref_lease_months')),
    pref_occupants: numOrNull(val('ud_pref_occupants')),
    pref_move_in: emptyToNull(val('ud_pref_move_in')),
    pref_gender_policy: emptyToNull(val('ud_pref_gender_policy')),
    pref_allows_smoking: val('ud_pref_allows_smoking') === 'true',
    pref_allows_pets: val('ud_pref_allows_pets') === 'true',
    notify_booking: val('ud_notify_booking') === 'true',
    notify_chat: val('ud_notify_chat') === 'true',
    notify_listing: val('ud_notify_listing') === 'true',
    notify_review: val('ud_notify_review') === 'true',
    hide_last_seen: val('ud_hide_last_seen') === 'true',
    hide_saved_count: val('ud_hide_saved_count') === 'true',
    analytics_consent: val('ud_analytics_consent') === 'true',
    keep_signed_in: val('ud_keep_signed_in') === 'true',
    expo_push_token: emptyToNull(val('ud_expo_push_token')),
    accepted_terms_at: emptyToNull(val('ud_accepted_terms_at')),
    accepted_legal_version: numOrNull(val('ud_accepted_legal_version')),
  };

  if (!patch.full_name) {
    show(msg, 'Name is required', 'err');
    return;
  }

  // ID verify timestamps like mobile
  if (id_verify_status === 'approved') {
    patch.id_verified_at = editingUser.id_verified_at || new Date().toISOString();
    patch.id_verified_by = adminProfile?.id ?? editingUser.id_verified_by;
    patch.id_verify_note = null;
  } else if (id_verify_status === 'rejected') {
    patch.id_verified_at = null;
    patch.id_verified_by = adminProfile?.id ?? null;
  } else if (id_verify_status === 'pending' || id_verify_status === 'none') {
    patch.id_verified_at = null;
    patch.id_verified_by = null;
    if (id_verify_status === 'pending') patch.id_verify_note = patch.id_verify_note;
    else patch.id_verify_note = null;
  }

  // Suspend side-effects if toggled via form
  if (account_status === 'suspended' && editingUser.account_status !== 'suspended') {
    patch.expo_push_token = null;
    if (role === 'owner') patch.owner_status = 'rejected';
  }

  try {
    const { error } = await supabase.from('profiles').update(patch).eq('id', editingUser.id);
    if (error) throw error;

    if (role === 'owner' && patch.owner_status === 'rejected') {
      await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', editingUser.id);
    }
    if (
      account_status === 'suspended' &&
      editingUser.account_status !== 'suspended' &&
      role === 'owner'
    ) {
      await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', editingUser.id);
    }
    if (
      account_status === 'active' &&
      editingUser.account_status === 'suspended' &&
      role === 'owner'
    ) {
      await supabase
        .from('apartments')
        .update({ status: 'pending' })
        .eq('owner_id', editingUser.id)
        .eq('status', 'rejected');
    }

    await audit('user.update', { targetUserId: editingUser.id, detail: { fields: Object.keys(patch) } });
    show(msg, 'All fields saved', 'ok');
    flash('Saved');
    await openUserDetail(editingUser.id);
    void loadOverview();
  } catch (e) {
    show(msg, e.message || 'Save failed', 'err');
  }
}

function openNewOwner() {
  openModal('New owner', `
    <div class="field"><label>Full name</label><input id="m_full_name" /></div>
    <div class="field"><label>Email</label><input id="m_email" type="email" dir="ltr" /></div>
    <div class="field"><label>Password</label><input id="m_password" type="password" dir="ltr" /></div>
    <div class="field"><label>Phone</label><input id="m_phone" dir="ltr" /></div>
  `, async () => {
    const full_name = document.getElementById('m_full_name').value.trim();
    const email = document.getElementById('m_email').value.trim();
    const password = document.getElementById('m_password').value;
    const phone = document.getElementById('m_phone').value.trim() || null;
    if (!full_name || !email || !password) throw new Error('Fill all required fields');
    const detached = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await detached.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role: 'owner', language: 'en' } },
    });
    if (error) throw error;
    if (!data.user?.id) throw new Error('Could not create account');
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ role: 'owner', owner_status: 'approved', full_name, phone, email })
      .eq('id', data.user.id);
    if (upErr) throw upErr;
    await audit('user.update', { targetUserId: data.user.id, note: 'create owner', detail: { email } });
    flash('Owner created');
    await loadUsers();
    await openUserDetail(data.user.id);
  });
}

/* —— Listings —— */
let editingListing = null;

function showListingsList() {
  editingListing = null;
  document.getElementById('listingsListWrap')?.classList.remove('hidden');
  document.getElementById('listingDetailWrap')?.classList.add('hidden');
}

async function loadListings() {
  show(dashErr, '');
  showListingsList();
  await ensureCatalog();
  const { data, error } = await supabase
    .from('apartments')
    .select(
      `id, title_ar, title_en, description_ar, description_en, status, price_month, rooms, bathrooms, area_m2,
       gender_policy, amenities, photos, lat, lng, campus_distance_km, reject_reason, city_id, nearest_university_id,
       owner_id, created_at, profiles!owner_id(full_name, email)`,
    )
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  cache.listings = data || [];
  renderListings();
}

function renderListings() {
  const q = (document.getElementById('listingQ').value || '').trim().toLowerCase();
  const st = document.getElementById('listingStatus').value;
  let rows = cache.listings;
  if (st) rows = rows.filter((a) => a.status === st);
  if (q) rows = rows.filter((a) => titleOf(a).toLowerCase().includes(q));
  document.getElementById('listingRows').innerHTML =
    rows
      .map((a) => {
        const owner = a.profiles;
        const actions = [];
        actions.push(`<button class="btn sm" data-act="list-edit" data-id="${a.id}">${t('admin.edit')}</button>`);
        if (a.status !== 'approved') {
          actions.push(`<button class="btn sm ok" data-act="list-ok" data-id="${a.id}">${t('admin.approve')}</button>`);
        }
        if (a.status !== 'rejected') {
          actions.push(`<button class="btn sm danger" data-act="list-no" data-id="${a.id}">${t('admin.reject')}</button>`);
        }
        if (a.status !== 'hidden') {
          actions.push(`<button class="btn sm warn" data-act="list-hide" data-id="${a.id}">${t('admin.hide')}</button>`);
        }
        actions.push(`<button class="btn sm ghost" data-act="list-del" data-id="${a.id}">${t('admin.delete')}</button>`);
        return `<tr>
          <td><b>${esc(titleOf(a))}</b><div class="muted">${esc((a.description_en || a.description_ar || '').slice(0, 80))}</div></td>
          <td>${chip(a.status)}</td>
          <td>${esc(nameOf(owner))}<div class="muted" dir="ltr">${esc(owner?.email || '')}</div></td>
          <td dir="ltr">${esc(a.price_month ?? '—')}</td>
          <td><div class="row-actions">${actions.join('')}</div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="5" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#listingRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      try {
        if (btn.dataset.act === 'list-edit') {
          await openListingDetail(id);
          return;
        }
        if (btn.dataset.act === 'list-ok') {
          const { error } = await supabase
            .from('apartments')
            .update({ status: 'approved', reject_reason: null })
            .eq('id', id);
          if (error) throw error;
          await audit('listing.approve', { targetId: id });
        }
        if (btn.dataset.act === 'list-no') {
          const reason = prompt('Reject reason (optional)') || null;
          const { error } = await supabase
            .from('apartments')
            .update({ status: 'rejected', reject_reason: reason })
            .eq('id', id);
          if (error) throw error;
          await audit('listing.reject', { targetId: id, note: reason });
        }
        if (btn.dataset.act === 'list-hide') {
          const { error } = await supabase
            .from('apartments')
            .update({ status: 'hidden', reject_reason: null })
            .eq('id', id);
          if (error) throw error;
          await audit('listing.reject', { targetId: id, detail: { status: 'hidden' } });
        }
        if (btn.dataset.act === 'list-del') {
          if (!confirm('Permanently delete this listing?')) return;
          const { error } = await supabase.from('apartments').delete().eq('id', id);
          if (error) throw error;
          await audit('listing.delete', { targetId: id });
        }
        flash('Done');
        await loadListings();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

async function openListingDetail(listingId) {
  show(dashErr, '');
  show(document.getElementById('ldMsg'), '');
  await ensureCatalog();
  const { data, error } = await supabase
    .from('apartments')
    .select('*, profiles!owner_id(full_name, email)')
    .eq('id', listingId)
    .single();
  if (error || !data) {
    show(dashErr, error?.message || 'Listing not found');
    return;
  }
  editingListing = data;
  document.getElementById('listingsListWrap').classList.add('hidden');
  document.getElementById('listingDetailWrap').classList.remove('hidden');
  document.getElementById('ldTitle').textContent = titleOf(data);
  document.getElementById('ldMeta').innerHTML = `
    <span>${chip(data.status)}</span>
    <code>${esc(data.id)}</code>
    <span>${esc(nameOf(data.profiles))}</span>
    <span dir="ltr">${esc(data.profiles?.email || '')}</span>
  `;

  const a = data;
  const cityOpts =
    `<option value="">—</option>` +
    optList(catalog.cities, a.city_id, (c) => c.name_en || c.name_ar);
  const uniOpts =
    `<option value="">—</option>` +
    optList(catalog.universities, a.nearest_university_id, (x) => x.name_en || x.name_ar);
  const amenities = Array.isArray(a.amenities) ? a.amenities.join(', ') : a.amenities || '';
  const photos = Array.isArray(a.photos) ? a.photos.join('\n') : a.photos || '';
  const opt = (values, current) =>
    values
      .map((r) => '<option value="' + r + '"' + (String(current || '') === String(r) ? ' selected' : '') + '>' + r + '</option>')
      .join('');

  document.getElementById('ldForm').innerHTML = [
    '<div class="section-label">Titles & copy</div>',
    field('ld_title_ar', 'Title (AR)', inp('ld_title_ar', a.title_ar), true),
    field('ld_title_en', 'Title (EN)', inp('ld_title_en', a.title_en, 'dir="ltr"'), true),
    field('ld_description_ar', 'Description (AR)', '<textarea id="ld_description_ar">' + esc(a.description_ar || '') + '</textarea>', true),
    field('ld_description_en', 'Description (EN)', '<textarea id="ld_description_en" dir="ltr">' + esc(a.description_en || '') + '</textarea>', true),
    '<div class="section-label">Status & pricing</div>',
    field('ld_status', 'Status', sel('ld_status', opt(['pending', 'approved', 'rejected', 'hidden'], a.status))),
    field('ld_reject_reason', 'Reject reason', inp('ld_reject_reason', a.reject_reason), true),
    field('ld_price_month', 'Price / month', inp('ld_price_month', a.price_month, 'type="number" dir="ltr"')),
    field('ld_rooms', 'Rooms', inp('ld_rooms', a.rooms, 'type="number" dir="ltr"')),
    field('ld_bathrooms', 'Bathrooms', inp('ld_bathrooms', a.bathrooms, 'type="number" dir="ltr"')),
    field('ld_area_m2', 'Area m²', inp('ld_area_m2', a.area_m2, 'type="number" dir="ltr"')),
    field('ld_gender_policy', 'Gender policy', sel('ld_gender_policy', opt(['any', 'female', 'male'], a.gender_policy || 'any'))),
    '<div class="section-label">Location</div>',
    field('ld_city_id', 'City', sel('ld_city_id', cityOpts)),
    field('ld_nearest_university_id', 'Nearest university', sel('ld_nearest_university_id', uniOpts)),
    field('ld_lat', 'Latitude', inp('ld_lat', a.lat, 'type="number" step="any" dir="ltr"')),
    field('ld_lng', 'Longitude', inp('ld_lng', a.lng, 'type="number" step="any" dir="ltr"')),
    field('ld_campus_distance_km', 'Campus distance km', inp('ld_campus_distance_km', a.campus_distance_km, 'type="number" step="any" dir="ltr"')),
    '<div class="section-label">Media & amenities</div>',
    field('ld_amenities', 'Amenities (comma-separated)', inp('ld_amenities', amenities, 'dir="ltr"'), true),
    field('ld_photos', 'Photo URLs (one per line)', '<textarea id="ld_photos" dir="ltr">' + esc(photos) + '</textarea>', true),
    field('ld_owner_id', 'Owner ID', inp('ld_owner_id', a.owner_id, 'dir="ltr" disabled')),
    field('ld_created_at', 'Created at', inp('ld_created_at', a.created_at, 'dir="ltr" disabled')),
  ].join('');
}

/* —— Bookings —— */
async function loadBookings() {
  show(dashErr, '');
  showBookingsList();
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, status, payment_status, payment_method, rent_amount, commission_percent, commission_amount,
       months, occupants, start_date, cancel_reason, created_at,
       apartments(title_ar, title_en),
       student:profiles!student_id(full_name, email),
       owner:profiles!owner_id(full_name, email)`,
    )
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  cache.bookings = data || [];
  renderBookings();
}

function renderBookings() {
  const st = document.getElementById('bookingStatus').value;
  let rows = cache.bookings;
  if (st) rows = rows.filter((b) => b.status === st);
  document.getElementById('bookingRows').innerHTML =
    rows
      .map((b) => {
        const when = b.created_at ? new Date(b.created_at).toLocaleString('en') : '—';
        return `<tr>
          <td>${esc(when)}<div class="muted">${esc(b.start_date || '')}</div></td>
          <td>${esc(titleOf(b.apartments))}</td>
          <td>${esc(nameOf(b.student))}<div class="muted" dir="ltr">${esc(b.student?.email || '')}</div></td>
          <td>${esc(nameOf(b.owner))}</td>
          <td dir="ltr">${esc(b.rent_amount ?? '—')}</td>
          <td dir="ltr">${esc(b.months ?? '—')}</td>
          <td>${chip(b.status)}${b.cancel_reason ? `<div class="muted">${esc(b.cancel_reason)}</div>` : ''}</td>
          <td>${chip(b.payment_status || '—')}<div class="muted">${esc(b.payment_method || '')}</div></td>
          <td><div class="row-actions">
            <button class="btn sm" data-act="bk-edit" data-id="${b.id}">Edit</button>
            <button class="btn sm ok" data-act="bk-confirm" data-id="${b.id}">${t('admin.confirm')}</button>
            <button class="btn sm" data-act="bk-done" data-id="${b.id}">${t('admin.complete')}</button>
            <button class="btn sm danger" data-act="bk-cancel" data-id="${b.id}">${t('admin.cancel')}</button>
            <button class="btn sm ghost" data-act="bk-paid" data-id="${b.id}">${t('admin.markPaid')}</button>
            <button class="btn sm ghost" data-act="bk-del" data-id="${b.id}">${t('admin.delete')}</button>
          </div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="9" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#bookingRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      try {
        if (btn.dataset.act === 'bk-edit') {
          await openBookingDetail(id);
          return;
        } else if (btn.dataset.act === 'bk-confirm') {
          const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-done') {
          const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-cancel') {
          const reason = prompt('Cancel reason') || null;
          const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled', cancel_reason: reason })
            .eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-paid') {
          const { error } = await supabase.from('bookings').update({ payment_status: 'paid' }).eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-del') {
          if (!confirm('Delete this booking?')) return;
          const { error } = await supabase.from('bookings').delete().eq('id', id);
          if (error) throw error;
          await audit('booking.delete', { targetId: id });
          flash('Done');
          await loadBookings();
          return;
        }
        await audit('booking.update', { targetId: id, detail: { act: btn.dataset.act } });
        flash('Done');
        await loadBookings();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

/* —— ID verify —— */
async function loadIds() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, role, id_verify_status, id_verify_note, national_id_url, university_card_url, national_id_number, created_at',
    )
    .eq('id_verify_status', 'pending')
    .or('national_id_url.not.is.null,university_card_url.not.is.null')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  cache.ids = data || [];
  document.getElementById('idRows').innerHTML =
    cache.ids
      .map((u) => {
        const docs = [];
        if (u.national_id_url) {
          docs.push(`<a href="${esc(u.national_id_url)}" target="_blank" rel="noopener">National ID</a>`);
        }
        if (u.university_card_url) {
          docs.push(`<a href="${esc(u.university_card_url)}" target="_blank" rel="noopener">University card</a>`);
        }
        return `<tr>
          <td><b>${esc(nameOf(u))}</b><div class="muted" dir="ltr">${esc(u.email || '')}</div>
            <div class="muted" dir="ltr">${esc(u.national_id_number || '')}</div></td>
          <td>${esc(u.role)}</td>
          <td>${docs.join(' · ') || '—'}</td>
          <td><div class="row-actions">
            <button class="btn sm" data-act="id-user" data-id="${u.id}">Open user</button>
            <button class="btn sm ok" data-act="id-ok" data-id="${u.id}">${t('admin.approve')}</button>
            <button class="btn sm danger" data-act="id-no" data-id="${u.id}">${t('admin.reject')}</button>
          </div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="4" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#idRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      try {
        if (btn.dataset.act === 'id-user') {
          setPanel('users');
          await openUserDetail(id);
          return;
        }
        let patch;
        if (btn.dataset.act === 'id-ok') {
          patch = {
            id_verify_status: 'approved',
            id_verify_note: null,
            id_verified_at: new Date().toISOString(),
            id_verified_by: adminProfile?.id ?? null,
          };
        } else {
          const note = prompt('Reject reason') || null;
          patch = {
            id_verify_status: 'rejected',
            id_verify_note: note,
            id_verified_at: null,
            id_verified_by: adminProfile?.id ?? null,
          };
        }
        const { error } = await supabase.from('profiles').update(patch).eq('id', id);
        if (error) throw error;
        await audit('id.verify', { targetUserId: id, detail: { status: patch.id_verify_status } });
        flash('Done');
        await loadIds();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

/* —— Reports —— */
async function loadReports() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('app_reports')
    .select(
      `id, status, kind, subject, body, admin_note, created_at, reporter_id, target_user_id, target_apartment_id,
       reporter:profiles!reporter_id(full_name, email),
       target:profiles!target_user_id(full_name, email)`,
    )
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    // Fallback without joins
    const fallback = await supabase
      .from('app_reports')
      .select('id, status, kind, subject, body, admin_note, created_at, reporter_id, target_user_id, target_apartment_id')
      .order('created_at', { ascending: false })
      .limit(300);
    if (fallback.error) {
      show(dashErr, error.message || fallback.error.message);
      return;
    }
    cache.reports = fallback.data || [];
  } else {
    cache.reports = data || [];
  }
  renderReports();
}

function renderReports() {
  const st = document.getElementById('reportStatus').value;
  let rows = cache.reports;
  if (st) rows = rows.filter((r) => r.status === st);
  document.getElementById('reportRows').innerHTML =
    rows
      .map((r) => {
        const when = r.created_at ? new Date(r.created_at).toLocaleString('en') : '—';
        const who = nameOf(r.reporter) || String(r.reporter_id || '').slice(0, 8);
        const target = nameOf(r.target) || (r.target_user_id ? String(r.target_user_id).slice(0, 8) : '—');
        return `<tr>
          <td>${esc(when)}<div class="muted">${esc(r.kind || '')}</div></td>
          <td><b>${esc(r.subject || '—')}</b><div class="muted">${esc((r.body || '').slice(0, 120))}</div>
            <div class="muted">From: ${esc(who)} · Target: ${esc(target)}</div>
            <div class="muted">${esc(r.admin_note || '')}</div></td>
          <td>${chip(r.status)}</td>
          <td><div class="row-actions">
            ${r.reporter_id ? `<button class="btn sm ghost" data-act="rep-reporter" data-id="${r.reporter_id}">Reporter</button>` : ''}
            ${r.target_user_id ? `<button class="btn sm ghost" data-act="rep-target" data-id="${r.target_user_id}">Target</button>` : ''}
            <button class="btn sm" data-act="rep-rev" data-id="${r.id}">${t('admin.review')}</button>
            <button class="btn sm ok" data-act="rep-close" data-id="${r.id}">${t('admin.close')}</button>
            <button class="btn sm ghost" data-act="rep-open" data-id="${r.id}">${t('admin.open')}</button>
          </div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="4" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#reportRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        if (btn.dataset.act === 'rep-reporter' || btn.dataset.act === 'rep-target') {
          setPanel('users');
          await openUserDetail(btn.dataset.id);
          return;
        }
        const id = btn.dataset.id;
        const map = { 'rep-rev': 'reviewing', 'rep-close': 'closed', 'rep-open': 'open' };
        const status = map[btn.dataset.act];
        const admin_note = btn.dataset.act === 'rep-close' ? prompt('Close note (optional)') : null;
        const { error } = await supabase
          .from('app_reports')
          .update({ status, admin_note: admin_note?.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await audit('report.update', { targetId: id, detail: { status } });
        flash('Done');
        await loadReports();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

/* —— Settings —— */
async function loadSettings() {
  show(document.getElementById('settingsMsg'), '');
  try {
    const { data, error } = await supabase.rpc('read_platform_settings');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    document.getElementById('commission').value = row?.commission_percent ?? row?.commission ?? '';
    document.getElementById('adminEmail').value = row?.admin_email ?? '';
  } catch (e) {
    // fallback app_settings
    const { data } = await supabase.from('app_settings').select('commission_percent').eq('id', 1).maybeSingle();
    if (data) document.getElementById('commission').value = data.commission_percent ?? '';
    show(document.getElementById('settingsMsg'), e.message || 'Could not load some settings', 'err');
  }
  try {
    const { data } = await supabase.rpc('booking_ops_status');
    const row = Array.isArray(data) ? data[0] : data;
    document.getElementById('opsStatus').textContent = row
      ? `Last run: ${row.last_run_at || row.updated_at || '—'} · ${JSON.stringify(row).slice(0, 120)}`
      : '';
  } catch {
    document.getElementById('opsStatus').textContent = '';
  }

  const host = document.getElementById('hostingInfo');
  if (host) {
    const allow = (cfg.adminEmail || '').trim().toLowerCase() || '(not set in Render env)';
    host.innerHTML = [
      `<div><b>Site</b>: <span dir="ltr">${esc(location.origin)}</span></div>`,
      `<div><b>Supabase URL</b>: <span dir="ltr">${esc(cfg.supabaseUrl || '—')}</span></div>`,
      `<div><b>Allowlist email (EXPO_PUBLIC_ADMIN_EMAIL)</b>: <span dir="ltr">${esc(allow)}</span></div>`,
      `<div><b>Signed-in admin</b>: <span dir="ltr">${esc(adminProfile?.email || '—')}</span></div>`,
      `<div><b>Confirm bridge</b>: <span dir="ltr">${esc(location.origin + '/confirmed.html')}</span></div>`,
      `<div><b>Reset bridge</b>: <span dir="ltr">${esc(location.origin + '/reset.html')}</span></div>`,
      `<div class="fine">MFA is required for admin web login. Enroll TOTP in the Matra7 app first.</div>`,
    ].join('');
  }
}

/* —— Audit —— */
async function loadAudit() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('created_at, action, target_user_id, target_id, note')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  document.getElementById('auditRows').innerHTML =
    (data || [])
      .map((r) => {
        const when = r.created_at ? new Date(r.created_at).toLocaleString('en') : '—';
        const target = (r.target_user_id || r.target_id || '—').toString().slice(0, 8);
        return `<tr><td>${esc(when)}</td><td dir="ltr">${esc(r.action)}</td><td dir="ltr">${esc(target)}</td><td>${esc(r.note || '')}</td></tr>`;
      })
      .join('') || '<tr><td colspan="4" class="empty">Empty</td></tr>';
}

/* —— Modal —— */
let modalOkHandler = null;
function openModal(title, bodyHtml, onOk) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalBack').classList.remove('hidden');
  modalOkHandler = onOk;
}
function closeModal() {
  document.getElementById('modalBack').classList.add('hidden');
  modalOkHandler = null;
}

document.getElementById('modalCancel').onclick = closeModal;
document.getElementById('modalOk').onclick = async () => {
  if (!modalOkHandler) return closeModal();
  try {
    await modalOkHandler();
    closeModal();
  } catch (e) {
    alert(e.message || 'Failed');
  }
};

/* —— Reviews —— */
async function loadReviews() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('apartment_reviews')
    .select('*, apartments(id, title_ar, title_en)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  cache.reviews = data || [];
  renderReviews();
}

function renderReviews() {
  const q = (document.getElementById('reviewQ')?.value || '').trim().toLowerCase();
  let rows = cache.reviews || [];
  if (q) {
    rows = rows.filter((r) =>
      [r.author_name, r.note, titleOf(r.apartments), r.apartment_id, r.student_id]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  document.getElementById('reviewRows').innerHTML =
    rows
      .map((r) => {
        const when = r.created_at ? new Date(r.created_at).toLocaleDateString('en') : '';
        return `<tr>
          <td><b>${esc(r.author_name || '—')}</b><div class="muted">${esc(when)}</div></td>
          <td>${esc(r.stars)}/5</td>
          <td>${esc(r.note || '')}</td>
          <td>${esc(titleOf(r.apartments))}</td>
          <td><div class="row-actions">
            ${r.apartment_id ? `<button class="btn sm" data-act="rev-listing" data-id="${r.apartment_id}">Open listing</button>` : ''}
            ${r.student_id ? `<button class="btn sm ghost" data-act="rev-user" data-id="${r.student_id}">Open user</button>` : ''}
            <button class="btn sm danger" data-act="rev-del" data-id="${r.id}" data-student="${r.student_id || ''}">Delete</button>
          </div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="5" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#reviewRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        if (btn.dataset.act === 'rev-listing') {
          setPanel('listings');
          await openListingDetail(btn.dataset.id);
          return;
        }
        if (btn.dataset.act === 'rev-user') {
          setPanel('users');
          await openUserDetail(btn.dataset.id);
          return;
        }
        if (btn.dataset.act === 'rev-del') {
          if (!confirm('Delete this review?')) return;
          const { error } = await supabase.from('apartment_reviews').delete().eq('id', btn.dataset.id);
          if (error) throw error;
          await audit('review.delete', {
            targetId: btn.dataset.id,
            targetUserId: btn.dataset.student || null,
          });
          flash('Done');
          await loadReviews();
        }
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

/* —— Payouts —— */
async function loadPayouts() {
  show(dashErr, '');
  const [{ data: owners, error: oErr }, { data: bookings, error: bErr }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'owner'),
    supabase
      .from('bookings')
      .select('owner_id, rent_amount, commission_amount, payment_status, status')
      .in('status', ['confirmed', 'completed']),
  ]);
  if (oErr || bErr) {
    show(dashErr, (oErr || bErr).message);
    return;
  }
  const map = new Map();
  for (const owner of owners || []) {
    map.set(owner.id, {
      id: owner.id,
      full_name: owner.full_name,
      email: owner.email,
      phone: owner.phone,
      gross: 0,
      fee: 0,
      net: 0,
      unpaidFee: 0,
      bookings: 0,
    });
  }
  for (const booking of bookings || []) {
    const row = map.get(booking.owner_id);
    if (!row) continue;
    const rent = Number(booking.rent_amount) || 0;
    const fee = Number(booking.commission_amount) || 0;
    row.gross += rent;
    row.fee += fee;
    row.net += Math.max(0, rent - fee);
    row.bookings += 1;
    if (booking.payment_status !== 'paid') row.unpaidFee += fee;
  }
  cache.payouts = Array.from(map.values()).sort(
    (a, b) => b.unpaidFee - a.unpaidFee || b.fee - a.fee,
  );
  renderPayouts();
}

function money(n) {
  return `₪${Math.round(Number(n) || 0).toLocaleString('en')}`;
}

function renderPayouts() {
  const q = (document.getElementById('payoutQ')?.value || '').trim().toLowerCase();
  const filter = document.getElementById('payoutFilter')?.value || 'owed';
  let rows = cache.payouts || [];
  if (filter === 'owed') rows = rows.filter((r) => r.unpaidFee > 0);
  if (filter === 'clear') rows = rows.filter((r) => r.fee > 0 && r.unpaidFee <= 0);
  if (q) {
    rows = rows.filter((r) =>
      [r.full_name, r.email, r.phone].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }
  document.getElementById('payoutRows').innerHTML =
    rows
      .map(
        (r) => `<tr>
          <td><b>${esc(r.full_name || r.email || '—')}</b><div class="muted" dir="ltr">${esc(r.email || '')}</div></td>
          <td>${r.bookings}</td>
          <td dir="ltr">${money(r.gross)}</td>
          <td dir="ltr">${money(r.fee)}</td>
          <td dir="ltr"><b>${money(r.unpaidFee)}</b></td>
          <td dir="ltr">${money(r.net)}</td>
          <td><div class="row-actions">
            <button class="btn sm" data-act="pay-user" data-id="${r.id}">Open user</button>
            ${
              r.unpaidFee > 0
                ? `<button class="btn sm ok" data-act="pay-mark" data-id="${r.id}">Mark paid</button>`
                : ''
            }
          </div></td>
        </tr>`,
      )
      .join('') || `<tr><td colspan="7" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#payoutRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        if (btn.dataset.act === 'pay-user') {
          setPanel('users');
          await openUserDetail(btn.dataset.id);
          return;
        }
        if (btn.dataset.act === 'pay-mark') {
          if (!confirm('Mark all unpaid commission for this owner as paid?')) return;
          const { error } = await supabase
            .from('bookings')
            .update({ payment_status: 'paid' })
            .eq('owner_id', btn.dataset.id)
            .in('status', ['confirmed', 'completed'])
            .neq('payment_status', 'paid');
          if (error) throw error;
          await audit('payout.mark_paid', { targetUserId: btn.dataset.id });
          flash('Done');
          await loadPayouts();
        }
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

/* —— Chats —— */
let activeChatId = '';

function showChatsList() {
  activeChatId = '';
  document.getElementById('chatsListWrap')?.classList.remove('hidden');
  document.getElementById('chatThreadWrap')?.classList.add('hidden');
}

async function loadChats() {
  show(dashErr, '');
  showChatsList();
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `id, last_message, last_message_at, apartment_id, student_id, owner_id,
       apartments(id, title_ar, title_en),
       student:profiles!student_id(id, full_name, email, phone),
       owner:profiles!owner_id(id, full_name, email, phone)`,
    )
    .order('last_message_at', { ascending: false })
    .limit(400);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  cache.chats = data || [];
  renderChats();
}

function renderChats() {
  const q = (document.getElementById('chatQ')?.value || '').trim().toLowerCase();
  let rows = cache.chats || [];
  if (q) {
    rows = rows.filter((c) =>
      [
        titleOf(c.apartments),
        nameOf(c.student),
        nameOf(c.owner),
        c.student?.email,
        c.owner?.email,
        c.last_message,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  document.getElementById('chatRows').innerHTML =
    rows
      .map((c) => {
        const when = c.last_message_at ? new Date(c.last_message_at).toLocaleString('en') : '—';
        return `<tr>
          <td>${esc(titleOf(c.apartments))}</td>
          <td>${esc(nameOf(c.student))}<div class="muted" dir="ltr">${esc(c.student?.email || '')}</div></td>
          <td>${esc(nameOf(c.owner))}</td>
          <td>${esc((c.last_message || '').slice(0, 80))}<div class="muted">${esc(when)}</div></td>
          <td><div class="row-actions">
            <button class="btn sm" data-act="chat-open" data-id="${c.id}">Open</button>
            <button class="btn sm danger" data-act="chat-del" data-id="${c.id}">Delete</button>
          </div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="5" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#chatRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        if (btn.dataset.act === 'chat-open') {
          await openChatThread(btn.dataset.id);
          return;
        }
        if (btn.dataset.act === 'chat-del') {
          if (!confirm('Delete this conversation and its messages?')) return;
          const { error } = await supabase.from('conversations').delete().eq('id', btn.dataset.id);
          if (error) throw error;
          await audit('chat.delete', { targetId: btn.dataset.id });
          flash('Done');
          await loadChats();
        }
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

async function openChatThread(id) {
  activeChatId = id;
  const conv = (cache.chats || []).find((c) => c.id === id);
  document.getElementById('chatsListWrap').classList.add('hidden');
  document.getElementById('chatThreadWrap').classList.remove('hidden');
  document.getElementById('chatTitle').textContent = titleOf(conv?.apartments) || 'Conversation';
  document.getElementById('chatMeta').innerHTML = `
    <span>${esc(nameOf(conv?.student))} (student)</span>
    <span>${esc(nameOf(conv?.owner))} (owner)</span>
    <code>${esc(id)}</code>
  `;

  const { data, error } = await supabase
    .from('messages')
    .select('id, body, sender_id, created_at, image_url, audio_url, profiles:sender_id(full_name, email)')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) {
    // Fallback without optional media columns / join alias
    const fallback = await supabase
      .from('messages')
      .select('id, body, sender_id, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(500);
    if (fallback.error) {
      show(dashErr, error.message || fallback.error.message);
      return;
    }
    document.getElementById('chatThread').innerHTML =
      (fallback.data || [])
        .map((m) => {
          const when = m.created_at ? new Date(m.created_at).toLocaleString('en') : '';
          const who =
            m.sender_id === conv?.student_id
              ? nameOf(conv?.student)
              : m.sender_id === conv?.owner_id
                ? nameOf(conv?.owner)
                : String(m.sender_id || '').slice(0, 8);
          return `<div class="chat-bubble"><div class="chat-who">${esc(who)} · ${esc(when)}</div><div>${esc(m.body || '')}</div></div>`;
        })
        .join('') || '<p class="empty">No messages</p>';
    return;
  }

  document.getElementById('chatThread').innerHTML =
    (data || [])
      .map((m) => {
        const when = m.created_at ? new Date(m.created_at).toLocaleString('en') : '';
        const who = m.profiles?.full_name || m.profiles?.email || String(m.sender_id || '').slice(0, 8);
        let body = esc(m.body || '');
        if (m.image_url) body += `<div><a href="${esc(m.image_url)}" target="_blank" rel="noopener">Photo</a></div>`;
        if (m.audio_url) body += `<div><a href="${esc(m.audio_url)}" target="_blank" rel="noopener">Voice</a></div>`;
        return `<div class="chat-bubble"><div class="chat-who">${esc(who)} · ${esc(when)}</div><div>${body}</div></div>`;
      })
      .join('') || '<p class="empty">No messages</p>';
}

/* —— Catalog —— */
let catalogEdit = { kind: 'cities', id: null };

function slugify(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCoord(raw) {
  const value = Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(value) ? value : null;
}

function parseDomains(raw) {
  return [
    ...new Set(
      String(raw || '')
        .split(/[,;\n]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

async function uniqueSlug(table, base, exceptId) {
  const root = slugify(base) || `item-${Date.now()}`;
  let slug = root;
  for (let n = 2; n < 50; n += 1) {
    let query = supabase.from(table).select('id').eq('slug', slug);
    if (exceptId) query = query.neq('id', exceptId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    slug = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

async function loadCatalog() {
  show(dashErr, '');
  show(document.getElementById('catalogMsg'), '');
  catalog.cities = [];
  await ensureCatalog();
  const [c, u] = await Promise.all([
    supabase.from('cities').select('*').order('name_en'),
    supabase.from('universities').select('*, cities(name_en, name_ar)').order('name_en'),
  ]);
  if (c.error || u.error) {
    show(dashErr, (c.error || u.error).message);
    return;
  }
  catalog.cities = c.data || [];
  catalog.universities = u.data || [];
  resetCatalogForm();
  renderCatalog();
}

function resetCatalogForm() {
  catalogEdit.id = null;
  const pane = document.getElementById('catalogPane')?.value || 'cities';
  catalogEdit.kind = pane;
  document.getElementById('catalogFormTitle').textContent =
    pane === 'cities' ? 'Add city' : 'Add university';
  if (pane === 'cities') {
    document.getElementById('catalogForm').innerHTML = [
      field('cat_name_ar', 'Name (AR)', inp('cat_name_ar', '')),
      field('cat_name_en', 'Name (EN)', inp('cat_name_en', '', 'dir="ltr"')),
      field('cat_lat', 'Latitude', inp('cat_lat', '', 'dir="ltr"')),
      field('cat_lng', 'Longitude', inp('cat_lng', '', 'dir="ltr"')),
    ].join('');
  } else {
    const cityOpts =
      `<option value="">—</option>` +
      optList(catalog.cities, '', (x) => x.name_en || x.name_ar);
    document.getElementById('catalogForm').innerHTML = [
      field('cat_name_ar', 'Name (AR)', inp('cat_name_ar', '')),
      field('cat_name_en', 'Name (EN)', inp('cat_name_en', '', 'dir="ltr"')),
      field('cat_city_id', 'City', sel('cat_city_id', cityOpts)),
      field('cat_lat', 'Latitude', inp('cat_lat', '', 'dir="ltr"')),
      field('cat_lng', 'Longitude', inp('cat_lng', '', 'dir="ltr"')),
      field('cat_domains', 'Email domains (comma-separated)', inp('cat_domains', '', 'dir="ltr"'), true),
    ].join('');
  }
}

function editCatalogCity(city) {
  catalogEdit = { kind: 'cities', id: city.id };
  document.getElementById('catalogPane').value = 'cities';
  document.getElementById('catalogFormTitle').textContent = 'Edit city';
  document.getElementById('catalogForm').innerHTML = [
    field('cat_name_ar', 'Name (AR)', inp('cat_name_ar', city.name_ar)),
    field('cat_name_en', 'Name (EN)', inp('cat_name_en', city.name_en, 'dir="ltr"')),
    field('cat_lat', 'Latitude', inp('cat_lat', city.lat, 'dir="ltr"')),
    field('cat_lng', 'Longitude', inp('cat_lng', city.lng, 'dir="ltr"')),
  ].join('');
}

function editCatalogUni(item) {
  catalogEdit = { kind: 'universities', id: item.id };
  document.getElementById('catalogPane').value = 'universities';
  document.getElementById('catalogFormTitle').textContent = 'Edit university';
  const cityOpts =
    `<option value="">—</option>` +
    optList(catalog.cities, item.city_id, (x) => x.name_en || x.name_ar);
  document.getElementById('catalogForm').innerHTML = [
    field('cat_name_ar', 'Name (AR)', inp('cat_name_ar', item.name_ar)),
    field('cat_name_en', 'Name (EN)', inp('cat_name_en', item.name_en, 'dir="ltr"')),
    field('cat_city_id', 'City', sel('cat_city_id', cityOpts)),
    field('cat_lat', 'Latitude', inp('cat_lat', item.lat, 'dir="ltr"')),
    field('cat_lng', 'Longitude', inp('cat_lng', item.lng, 'dir="ltr"')),
    field(
      'cat_domains',
      'Email domains (comma-separated)',
      inp('cat_domains', (item.email_domains || []).join(', '), 'dir="ltr"'),
      true,
    ),
  ].join('');
}

function renderCatalog() {
  const pane = document.getElementById('catalogPane')?.value || 'cities';
  const q = (document.getElementById('catalogQ')?.value || '').trim().toLowerCase();
  if (pane === 'cities') {
    document.getElementById('catalogHead').innerHTML =
      '<tr><th>Name</th><th>Coords</th><th>Slug</th><th>Actions</th></tr>';
    let rows = catalog.cities || [];
    if (q) {
      rows = rows.filter((c) =>
        [c.name_ar, c.name_en, c.slug].join(' ').toLowerCase().includes(q),
      );
    }
    document.getElementById('catalogRows').innerHTML =
      rows
        .map(
          (c) => `<tr>
            <td><b>${esc(c.name_en || c.name_ar)}</b><div class="muted">${esc(c.name_ar || '')}</div></td>
            <td dir="ltr">${esc(c.lat)}, ${esc(c.lng)}</td>
            <td dir="ltr">${esc(c.slug)}</td>
            <td><div class="row-actions">
              <button class="btn sm" data-act="cat-edit-city" data-id="${c.id}">Edit</button>
              <button class="btn sm danger" data-act="cat-del-city" data-id="${c.id}">Delete</button>
            </div></td>
          </tr>`,
        )
        .join('') || `<tr><td colspan="4" class="empty">${t('admin.noResults')}</td></tr>`;
  } else {
    document.getElementById('catalogHead').innerHTML =
      '<tr><th>Name</th><th>City</th><th>Domains</th><th>Actions</th></tr>';
    let rows = catalog.universities || [];
    if (q) {
      rows = rows.filter((u) =>
        [u.name_ar, u.name_en, u.slug, u.cities?.name_en, ...(u.email_domains || [])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    document.getElementById('catalogRows').innerHTML =
      rows
        .map(
          (u) => `<tr>
            <td><b>${esc(u.name_en || u.name_ar)}</b><div class="muted">${esc(u.name_ar || '')}</div></td>
            <td>${esc(u.cities?.name_en || u.cities?.name_ar || '—')}</td>
            <td dir="ltr">${esc((u.email_domains || []).join(', ') || '—')}</td>
            <td><div class="row-actions">
              <button class="btn sm" data-act="cat-edit-uni" data-id="${u.id}">Edit</button>
              <button class="btn sm danger" data-act="cat-del-uni" data-id="${u.id}">Delete</button>
            </div></td>
          </tr>`,
        )
        .join('') || `<tr><td colspan="4" class="empty">${t('admin.noResults')}</td></tr>`;
  }

  document.querySelectorAll('#catalogRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        if (btn.dataset.act === 'cat-edit-city') {
          const city = catalog.cities.find((c) => c.id === btn.dataset.id);
          if (city) editCatalogCity(city);
          return;
        }
        if (btn.dataset.act === 'cat-edit-uni') {
          const uni = catalog.universities.find((u) => u.id === btn.dataset.id);
          if (uni) editCatalogUni(uni);
          return;
        }
        if (btn.dataset.act === 'cat-del-city') {
          if (!confirm('Delete this city?')) return;
          const id = btn.dataset.id;
          const [unis, homes, people] = await Promise.all([
            supabase.from('universities').select('id', { count: 'exact', head: true }).eq('city_id', id),
            supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('city_id', id),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('city_id', id),
          ]);
          if ((unis.count ?? 0) + (homes.count ?? 0) + (people.count ?? 0) > 0) {
            throw new Error('City is still referenced by universities, listings, or users');
          }
          const { error } = await supabase.from('cities').delete().eq('id', id);
          if (error) throw error;
          await audit('catalog.city_delete', { targetId: id });
          flash('Done');
          catalog.cities = [];
          await loadCatalog();
          return;
        }
        if (btn.dataset.act === 'cat-del-uni') {
          if (!confirm('Delete this university?')) return;
          const id = btn.dataset.id;
          const [homes, people] = await Promise.all([
            supabase
              .from('apartments')
              .select('id', { count: 'exact', head: true })
              .eq('nearest_university_id', id),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('university_id', id),
          ]);
          if ((homes.count ?? 0) + (people.count ?? 0) > 0) {
            throw new Error('University is still referenced by listings or users');
          }
          const { error } = await supabase.from('universities').delete().eq('id', id);
          if (error) throw error;
          await audit('catalog.uni_delete', { targetId: id });
          flash('Done');
          catalog.cities = [];
          await loadCatalog();
        }
      } catch (e) {
        show(dashErr, e.message || 'Failed');
      }
    };
  });
}

async function saveCatalogForm() {
  const msg = document.getElementById('catalogMsg');
  show(msg, '');
  const pane = document.getElementById('catalogPane')?.value || 'cities';
  const name_ar = (val('cat_name_ar') || '').trim();
  const name_en = (val('cat_name_en') || '').trim();
  const lat = parseCoord(val('cat_lat') || '');
  const lng = parseCoord(val('cat_lng') || '');
  try {
    if (!name_ar || !name_en || lat == null || lng == null) {
      throw new Error('Name (AR/EN) and coordinates are required');
    }
    if (pane === 'cities') {
      const slug = await uniqueSlug('cities', name_en, catalogEdit.id || undefined);
      const row = { slug, name_ar, name_en, lat, lng };
      const query = catalogEdit.id
        ? supabase.from('cities').update(row).eq('id', catalogEdit.id)
        : supabase.from('cities').insert(row);
      const { error } = await query;
      if (error) throw error;
      await audit(catalogEdit.id ? 'catalog.city_update' : 'catalog.city_create', {
        targetId: catalogEdit.id || null,
        note: name_en,
      });
    } else {
      const city_id = emptyToNull(val('cat_city_id'));
      if (!city_id) throw new Error('City is required');
      const slug = await uniqueSlug('universities', name_en, catalogEdit.id || undefined);
      const row = {
        slug,
        name_ar,
        name_en,
        city_id,
        lat,
        lng,
        email_domains: parseDomains(val('cat_domains') || ''),
      };
      const query = catalogEdit.id
        ? supabase.from('universities').update(row).eq('id', catalogEdit.id)
        : supabase.from('universities').insert(row);
      const { error } = await query;
      if (error) throw error;
      await audit(catalogEdit.id ? 'catalog.uni_update' : 'catalog.uni_create', {
        targetId: catalogEdit.id || null,
        note: name_en,
      });
    }
    show(msg, 'Saved', 'ok');
    flash('Saved');
    catalog.cities = [];
    await loadCatalog();
  } catch (e) {
    show(msg, e.message || 'Save failed', 'err');
  }
}

/* —— Create listing —— */
async function openNewListing() {
  show(dashErr, '');
  show(document.getElementById('ldMsg'), '');
  await ensureCatalog();
  const { data: owners, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, owner_status')
    .eq('role', 'owner')
    .order('full_name');
  if (error) {
    show(dashErr, error.message);
    return;
  }
  editingListing = { __new: true };
  document.getElementById('listingsListWrap').classList.add('hidden');
  document.getElementById('listingDetailWrap').classList.remove('hidden');
  document.getElementById('ldTitle').textContent = 'New listing';
  document.getElementById('ldMeta').innerHTML = '<span class="chip">draft</span>';

  const ownerOpts =
    `<option value="">— pick owner —</option>` +
    (owners || [])
      .map((o) => {
        const label = `${o.full_name || o.email}${o.owner_status !== 'approved' ? ' (pending)' : ''}`;
        return `<option value="${esc(o.id)}">${esc(label)}</option>`;
      })
      .join('');
  const cityOpts =
    `<option value="">—</option>` +
    optList(catalog.cities, '', (c) => c.name_en || c.name_ar);
  const uniOpts =
    `<option value="">—</option>` +
    optList(catalog.universities, '', (x) => x.name_en || x.name_ar);
  const opt = (values, current) =>
    values
      .map(
        (r) =>
          '<option value="' +
          r +
          '"' +
          (String(current || '') === String(r) ? ' selected' : '') +
          '>' +
          r +
          '</option>',
      )
      .join('');

  document.getElementById('ldForm').innerHTML = [
    '<div class="section-label">Owner</div>',
    field('ld_owner_pick', 'Owner', sel('ld_owner_pick', ownerOpts), true),
    '<div class="section-label">Titles & copy</div>',
    field('ld_title_ar', 'Title (AR)', inp('ld_title_ar', ''), true),
    field('ld_title_en', 'Title (EN)', inp('ld_title_en', '', 'dir="ltr"'), true),
    field('ld_description_ar', 'Description (AR)', '<textarea id="ld_description_ar"></textarea>', true),
    field(
      'ld_description_en',
      'Description (EN)',
      '<textarea id="ld_description_en" dir="ltr"></textarea>',
      true,
    ),
    '<div class="section-label">Status & pricing</div>',
    field('ld_status', 'Status', sel('ld_status', opt(['pending', 'approved', 'rejected', 'hidden'], 'pending'))),
    field('ld_reject_reason', 'Reject reason', inp('ld_reject_reason', ''), true),
    field('ld_price_month', 'Price / month', inp('ld_price_month', '', 'type="number" dir="ltr"')),
    field('ld_rooms', 'Rooms', inp('ld_rooms', '1', 'type="number" dir="ltr"')),
    field('ld_bathrooms', 'Bathrooms', inp('ld_bathrooms', '1', 'type="number" dir="ltr"')),
    field('ld_area_m2', 'Area m²', inp('ld_area_m2', '', 'type="number" dir="ltr"')),
    field('ld_gender_policy', 'Gender policy', sel('ld_gender_policy', opt(['any', 'female', 'male'], 'any'))),
    '<div class="section-label">Location</div>',
    field('ld_city_id', 'City', sel('ld_city_id', cityOpts)),
    field('ld_nearest_university_id', 'Nearest university', sel('ld_nearest_university_id', uniOpts)),
    field('ld_lat', 'Latitude', inp('ld_lat', '', 'type="number" step="any" dir="ltr"')),
    field('ld_lng', 'Longitude', inp('ld_lng', '', 'type="number" step="any" dir="ltr"')),
    field(
      'ld_campus_distance_km',
      'Campus distance km',
      inp('ld_campus_distance_km', '', 'type="number" step="any" dir="ltr"'),
    ),
    '<div class="section-label">Media & amenities</div>',
    field('ld_amenities', 'Amenities (comma-separated)', inp('ld_amenities', '', 'dir="ltr"'), true),
    field('ld_photos', 'Photo URLs (one per line)', '<textarea id="ld_photos" dir="ltr"></textarea>', true),
  ].join('');
}

async function saveListingDetail() {
  const msg = document.getElementById('ldMsg');
  show(msg, '');
  const amenitiesRaw = emptyToNull(val('ld_amenities'));
  const amenities = amenitiesRaw
    ? amenitiesRaw
        .split(/[,\u060C]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const photosRaw = emptyToNull(val('ld_photos'));
  const photos = photosRaw
    ? photosRaw
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const title_ar = emptyToNull(val('ld_title_ar'));
  if (!title_ar) {
    show(msg, 'Title (AR) is required', 'err');
    return;
  }

  if (editingListing?.__new) {
    const owner_id = emptyToNull(val('ld_owner_pick'));
    const city_id = emptyToNull(val('ld_city_id'));
    const price_month = numOrNull(val('ld_price_month'));
    if (!owner_id || !city_id || !price_month) {
      show(msg, 'Owner, city, and price are required', 'err');
      return;
    }
    const city = catalog.cities.find((c) => c.id === city_id);
    const uniId = emptyToNull(val('ld_nearest_university_id'));
    const uni = catalog.universities.find((u) => u.id === uniId);
    const patch = {
      owner_id,
      city_id,
      nearest_university_id: uniId,
      title_ar,
      title_en: emptyToNull(val('ld_title_en')) || title_ar,
      description_ar: emptyToNull(val('ld_description_ar')) || '',
      description_en: emptyToNull(val('ld_description_en')) || '',
      status: val('ld_status') || 'pending',
      reject_reason: emptyToNull(val('ld_reject_reason')),
      price_month,
      rooms: numOrNull(val('ld_rooms')) || 1,
      bathrooms: numOrNull(val('ld_bathrooms')) || 1,
      area_m2: numOrNull(val('ld_area_m2')),
      gender_policy: val('ld_gender_policy') || 'any',
      lat: numOrNull(val('ld_lat')) ?? uni?.lat ?? city?.lat ?? 31.9,
      lng: numOrNull(val('ld_lng')) ?? uni?.lng ?? city?.lng ?? 35.2,
      campus_distance_km: numOrNull(val('ld_campus_distance_km')),
      amenities,
      photos,
    };
    try {
      const { data, error } = await supabase.from('apartments').insert(patch).select('id').single();
      if (error) throw error;
      await audit('listing.create', { targetId: data.id, targetUserId: owner_id });
      show(msg, 'Listing created', 'ok');
      flash('Saved');
      await openListingDetail(data.id);
    } catch (e) {
      show(msg, e.message || 'Save failed', 'err');
    }
    return;
  }

  if (!editingListing) return;
  const patch = {
    title_ar,
    title_en: emptyToNull(val('ld_title_en')) || '',
    description_ar: emptyToNull(val('ld_description_ar')) || '',
    description_en: emptyToNull(val('ld_description_en')) || '',
    status: val('ld_status'),
    reject_reason: emptyToNull(val('ld_reject_reason')),
    price_month: numOrNull(val('ld_price_month')),
    rooms: numOrNull(val('ld_rooms')),
    bathrooms: numOrNull(val('ld_bathrooms')),
    area_m2: numOrNull(val('ld_area_m2')),
    gender_policy: val('ld_gender_policy') || 'any',
    city_id: emptyToNull(val('ld_city_id')),
    nearest_university_id: emptyToNull(val('ld_nearest_university_id')),
    lat: numOrNull(val('ld_lat')),
    lng: numOrNull(val('ld_lng')),
    campus_distance_km: numOrNull(val('ld_campus_distance_km')),
    amenities,
    photos,
  };
  try {
    const { error } = await supabase.from('apartments').update(patch).eq('id', editingListing.id);
    if (error) throw error;
    await audit('listing.update', { targetId: editingListing.id, detail: { status: patch.status } });
    show(msg, 'All fields saved', 'ok');
    flash('Saved');
    await openListingDetail(editingListing.id);
  } catch (e) {
    show(msg, e.message || 'Save failed', 'err');
  }
}


/* —— Platform exports / broadcast —— */
function csvEscape(value) {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function rowsToCsv(rows) {
  if (!rows.length) return 'id\n';
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = keys.map(csvEscape).join(',');
  const body = rows.map((row) => keys.map((key) => csvEscape(row[key])).join(',')).join('\n');
  return `${header}\n${body}`;
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportCsv(kind) {
  const stamp = new Date().toISOString().slice(0, 10);
  const status = document.getElementById('exportStatus');
  if (status) status.textContent = 'Exporting…';
  try {
    let rows = [];
    let name = kind;
    if (kind === 'users') {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, full_name_en, role, phone, city_id, university_id, owner_status, id_verify_status, account_status, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = data || [];
    } else if (kind === 'listings') {
      const { data, error } = await supabase
        .from('apartments')
        .select(
          'id, title_ar, title_en, status, price_month, rooms, bathrooms, city_id, nearest_university_id, owner_id, review_avg, review_count, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = data || [];
    } else if (kind === 'bookings') {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `id, status, payment_method, payment_status, start_date, months, occupants, rent_amount, commission_amount, created_at,
           student:profiles!student_id(full_name, email), owner:profiles!owner_id(full_name, email), apartments(title_ar, title_en)`,
        )
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = (data || []).map((item) => ({
        id: item.id,
        status: item.status,
        payment_method: item.payment_method,
        payment_status: item.payment_status,
        start_date: item.start_date,
        months: item.months,
        occupants: item.occupants,
        rent_amount: item.rent_amount,
        commission_amount: item.commission_amount,
        created_at: item.created_at,
        student_name: item.student?.full_name,
        student_email: item.student?.email,
        owner_name: item.owner?.full_name,
        owner_email: item.owner?.email,
        listing_ar: item.apartments?.title_ar,
        listing_en: item.apartments?.title_en,
      }));
    } else if (kind === 'reports') {
      const { data, error } = await supabase
        .from('app_reports')
        .select(
          'id, kind, subject, body, status, admin_note, reporter_id, target_user_id, target_apartment_id, created_at, updated_at',
        )
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = data || [];
    } else if (kind === 'reviews') {
      const { data, error } = await supabase
        .from('apartment_reviews')
        .select('id, apartment_id, student_id, stars, note, author_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      rows = data || [];
    } else {
      throw new Error('Unknown export');
    }
    downloadCsv(`matra7-${name}-${stamp}.csv`, rowsToCsv(rows));
    await audit('export.platform', { detail: { kind, rows: rows.length } });
    if (status) status.textContent = `Downloaded ${rows.length} ${kind} row(s).`;
    flash('Export ready');
  } catch (e) {
    if (status) status.textContent = e.message || 'Export failed';
    show(document.getElementById('settingsMsg'), e.message || 'Export failed', 'err');
  }
}

async function sendBroadcast() {
  const status = document.getElementById('bcStatus');
  const title = (document.getElementById('bcTitle')?.value || '').trim();
  const body = (document.getElementById('bcBody')?.value || '').trim();
  const roles = [];
  if (document.getElementById('bcStudent')?.checked) roles.push('student');
  if (document.getElementById('bcRenter')?.checked) roles.push('renter');
  if (document.getElementById('bcOwner')?.checked) roles.push('owner');
  if (!title || body.length < 8) {
    if (status) status.textContent = 'Title and body (min 8 chars) required.';
    return;
  }
  if (!roles.length) {
    if (status) status.textContent = 'Pick at least one role.';
    return;
  }
  if (!confirm(`Send push to ${roles.join(', ')}?`)) return;
  if (status) status.textContent = 'Sending…';
  try {
    const { data, error } = await supabase.functions.invoke('push-send', {
      body: { mode: 'broadcast', roles, title, body },
    });
    if (error) throw error;
    const recipients = data?.recipients ?? 0;
    await audit('broadcast', { note: title, detail: { roles, recipients } });
    document.getElementById('bcTitle').value = '';
    document.getElementById('bcBody').value = '';
    if (status) status.textContent = `Sent to ${recipients} recipient(s).`;
    flash('Broadcast sent');
  } catch (e) {
    if (status) status.textContent = e.message || 'Broadcast failed';
  }
}

/* —— Booking detail —— */
let editingBooking = null;

function showBookingsList() {
  editingBooking = null;
  document.getElementById('bookingsListWrap')?.classList.remove('hidden');
  document.getElementById('bookingDetailWrap')?.classList.add('hidden');
}

async function openBookingDetail(id) {
  show(dashErr, '');
  show(document.getElementById('bdMsg'), '');
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `*, apartments(title_ar, title_en),
       student:profiles!student_id(id, full_name, email),
       owner:profiles!owner_id(id, full_name, email)`,
    )
    .eq('id', id)
    .single();
  if (error || !data) {
    show(dashErr, error?.message || 'Booking not found');
    return;
  }
  editingBooking = data;
  document.getElementById('bookingsListWrap')?.classList.add('hidden');
  document.getElementById('bookingDetailWrap')?.classList.remove('hidden');
  document.getElementById('bdTitle').textContent = titleOf(data.apartments) || 'Booking';
  document.getElementById('bdMeta').innerHTML = `
    <span>${chip(data.status)}</span>
    <code>${esc(data.id)}</code>
    <span>${esc(nameOf(data.student))}</span>
    <span>${esc(nameOf(data.owner))}</span>
  `;
  const opt = (values, current) =>
    values
      .map(
        (r) =>
          '<option value="' +
          r +
          '"' +
          (String(current || '') === String(r) ? ' selected' : '') +
          '>' +
          r +
          '</option>',
      )
      .join('');
  document.getElementById('bdForm').innerHTML = [
    field('bd_status', 'Status', sel('bd_status', opt(['pending', 'confirmed', 'completed', 'cancelled'], data.status))),
    field(
      'bd_payment_status',
      'Payment status',
      sel('bd_payment_status', opt(['unpaid', 'paid'], data.payment_status || 'unpaid')),
    ),
    field(
      'bd_payment_method',
      'Payment method',
      sel('bd_payment_method', opt(['pay_now', 'pay_later', 'visa', 'cash'], data.payment_method || 'pay_later')),
    ),
    field('bd_start_date', 'Start date', inp('bd_start_date', data.start_date ? String(data.start_date).slice(0, 10) : '', 'type="date" dir="ltr"')),
    field('bd_months', 'Months', inp('bd_months', data.months, 'type="number" dir="ltr"')),
    field('bd_occupants', 'Occupants', inp('bd_occupants', data.occupants, 'type="number" dir="ltr"')),
    field('bd_rent_amount', 'Rent amount', inp('bd_rent_amount', data.rent_amount, 'type="number" dir="ltr"')),
    field('bd_commission_percent', 'Commission %', inp('bd_commission_percent', data.commission_percent, 'type="number" dir="ltr"')),
    field('bd_commission_amount', 'Commission amount', inp('bd_commission_amount', data.commission_amount, 'type="number" dir="ltr"')),
    field('bd_cancel_reason', 'Cancel reason', inp('bd_cancel_reason', data.cancel_reason || ''), true),
    field('bd_student', 'Student', inp('bd_student', `${nameOf(data.student)} · ${data.student?.email || ''}`, 'disabled'), true),
    field('bd_owner', 'Owner', inp('bd_owner', `${nameOf(data.owner)} · ${data.owner?.email || ''}`, 'disabled'), true),
  ].join('');
}

async function saveBookingDetail() {
  if (!editingBooking) return;
  const msg = document.getElementById('bdMsg');
  show(msg, '');
  const patch = {
    status: val('bd_status'),
    payment_status: val('bd_payment_status'),
    payment_method: val('bd_payment_method'),
    start_date: emptyToNull(val('bd_start_date')),
    months: numOrNull(val('bd_months')),
    occupants: numOrNull(val('bd_occupants')),
    rent_amount: numOrNull(val('bd_rent_amount')),
    commission_percent: numOrNull(val('bd_commission_percent')),
    commission_amount: numOrNull(val('bd_commission_amount')),
    cancel_reason: emptyToNull(val('bd_cancel_reason')),
  };
  try {
    const { error } = await supabase.from('bookings').update(patch).eq('id', editingBooking.id);
    if (error) throw error;
    await audit('booking.update', { targetId: editingBooking.id, detail: patch });
    show(msg, 'Saved', 'ok');
    flash('Saved');
    await openBookingDetail(editingBooking.id);
  } catch (e) {
    show(msg, e.message || 'Save failed', 'err');
  }
}


/* —— Wire UI —— */
async function verifiedTotpFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp || []).find((item) => item.status === 'verified') || null;
}

async function mfaNeedsChallenge() {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === 'aal2') return false;
  if (data?.nextLevel === 'aal2') return true;
  return Boolean(await verifiedTotpFactor());
}

async function verifyTotpCode(factorId, code) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: String(code || '').replace(/\s/g, ''),
  });
  if (error) throw error;
  return data;
}

function showPasswordStep() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('mfaForm').classList.add('hidden');
  document.getElementById('mfaCode').value = '';
}

function showMfaStep() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('mfaForm').classList.remove('hidden');
  document.getElementById('mfaCode').value = '';
  setTimeout(() => document.getElementById('mfaCode').focus(), 50);
}

let pendingMfaFactorId = '';

async function finishAdminGate() {
  const needsMfa = await mfaNeedsChallenge();
  const factor = await verifiedTotpFactor();
  if (needsMfa) {
    if (!factor?.id) {
      await supabase.auth.signOut();
      throw new Error(t('admin.mfaRequired'));
    }
    pendingMfaFactorId = factor.id;
    showMfaStep();
    return null;
  }
  // Admin must have MFA enrolled even if AAL already looks fine without factors.
  if (!factor?.id) {
    await supabase.auth.signOut();
    throw new Error(t('admin.mfaRequired'));
  }
  return requireAdmin();
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  show(loginErr, '');
  const wait = lockRemainingMs();
  if (wait > 0) {
    show(loginErr, t('admin.lockout'));
    return;
  }
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('loginBtn');
  if (!email || !password) {
    show(loginErr, t('admin.denied'));
    return;
  }
  if (!allowedAdminEmail(email)) {
    recordLoginFail();
    show(loginErr, t('admin.denied'));
    return;
  }
  btn.disabled = true;
  try {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || String(cfg.supabaseUrl).includes('REPLACE')) {
      throw new Error(t('admin.cfgHint'));
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Password ok — still must be admin + MFA before dashboard.
    const pre = await requireAdmin();
    if (!pre) {
      recordLoginFail();
      throw new Error(t('admin.denied'));
    }
    document.getElementById('password').value = '';
    const admin = await finishAdminGate();
    if (admin) {
      clearLoginFails();
      showShell(admin);
    }
  } catch (err) {
    recordLoginFail();
    showPasswordStep();
    const msg = /network|fetch|failed to fetch/i.test(err.message || '')
      ? err.message
      : err.message === t('admin.mfaRequired')
        ? t('admin.mfaRequired')
        : t('admin.denied');
    show(loginErr, msg);
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  } finally {
    btn.disabled = false;
  }
}

async function handleMfa(e) {
  if (e) e.preventDefault();
  show(loginErr, '');
  const code = document.getElementById('mfaCode').value.trim();
  const btn = document.getElementById('mfaBtn');
  if (!pendingMfaFactorId || code.replace(/\s/g, '').length < 6) {
    show(loginErr, t('admin.mfaInvalid'));
    return;
  }
  btn.disabled = true;
  try {
    await verifyTotpCode(pendingMfaFactorId, code);
    const admin = await requireAdmin();
    if (!admin) throw new Error(t('admin.denied'));
    // Confirm AAL2 after verify
    const still = await mfaNeedsChallenge();
    if (still) throw new Error(t('admin.mfaInvalid'));
    clearLoginFails();
    pendingMfaFactorId = '';
    showPasswordStep();
    showShell(admin);
  } catch (err) {
    recordLoginFail();
    show(loginErr, t('admin.mfaInvalid'));
  } finally {
    btn.disabled = false;
  }
}

async function cancelMfa() {
  pendingMfaFactorId = '';
  showPasswordStep();
  show(loginErr, '');
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
}

const loginForm = document.getElementById('loginForm');
if (loginForm) loginForm.addEventListener('submit', (e) => void handleLogin(e));
else document.getElementById('loginBtn').addEventListener('click', () => void handleLogin());

const mfaForm = document.getElementById('mfaForm');
if (mfaForm) mfaForm.addEventListener('submit', (e) => void handleMfa(e));
document.getElementById('mfaCancelBtn')?.addEventListener('click', () => void cancelMfa());

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});


document.getElementById('newListingBtn')?.addEventListener('click', () => void openNewListing());
document.getElementById('reviewQ')?.addEventListener('input', renderReviews);
document.getElementById('payoutQ')?.addEventListener('input', renderPayouts);
document.getElementById('payoutFilter')?.addEventListener('change', renderPayouts);
document.getElementById('chatQ')?.addEventListener('input', renderChats);
document.getElementById('chatBackBtn')?.addEventListener('click', () => {
  showChatsList();
  void loadChats();
});
document.getElementById('chatDeleteBtn')?.addEventListener('click', async () => {
  if (!activeChatId) return;
  if (!confirm('Delete this conversation and its messages?')) return;
  try {
    const { error } = await supabase.from('conversations').delete().eq('id', activeChatId);
    if (error) throw error;
    await audit('chat.delete', { targetId: activeChatId });
    flash('Done');
    await loadChats();
  } catch (e) {
    show(dashErr, e.message || 'Failed');
  }
});
document.getElementById('catalogPane')?.addEventListener('change', () => {
  resetCatalogForm();
  renderCatalog();
});
document.getElementById('catalogQ')?.addEventListener('input', renderCatalog);
document.getElementById('catalogSaveBtn')?.addEventListener('click', () => void saveCatalogForm());
document.getElementById('catalogResetBtn')?.addEventListener('click', () => resetCatalogForm());


document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => void exportCsv(btn.dataset.export));
});
document.getElementById('bcSendBtn')?.addEventListener('click', () => void sendBroadcast());
document.getElementById('bookingBackBtn')?.addEventListener('click', () => {
  showBookingsList();
  void loadBookings();
});
document.getElementById('bdSaveBtn')?.addEventListener('click', () => void saveBookingDetail());

document.getElementById('refreshBtn').addEventListener('click', () => {
  const active = document.querySelector('#nav button.active')?.dataset.panel || 'overview';
  setPanel(active);
});

document.querySelectorAll('#nav button').forEach((btn) => {
  btn.addEventListener('click', () => setPanel(btn.dataset.panel));
});

['userQ', 'userRole', 'userFilter'].forEach((id) => {
  document.getElementById(id).addEventListener('input', renderUsers);
  document.getElementById(id).addEventListener('change', renderUsers);
});
document.getElementById('newOwnerBtn').addEventListener('click', openNewOwner);
document.getElementById('userBackBtn').addEventListener('click', () => {
  showUsersList();
  void loadUsers();
});
document.getElementById('udSaveBtn').addEventListener('click', () => void saveUserDetail());
document.getElementById('listingBackBtn')?.addEventListener('click', () => {
  showListingsList();
  void loadListings();
});
document.getElementById('ldSaveBtn')?.addEventListener('click', () => void saveListingDetail());
document.getElementById('listingQ').addEventListener('input', renderListings);
document.getElementById('listingStatus').addEventListener('change', renderListings);
document.getElementById('bookingStatus').addEventListener('change', renderBookings);
document.getElementById('reportStatus').addEventListener('change', renderReports);

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const msg = document.getElementById('settingsMsg');
  try {
    const p_commission = Number(document.getElementById('commission').value);
    const p_admin_email = document.getElementById('adminEmail').value.trim();
    const { error } = await supabase.rpc('save_platform_settings', { p_commission, p_admin_email });
    if (error) throw error;
    await audit('settings.update', { detail: { p_commission, p_admin_email } });
    show(msg, t('admin.saved'), 'ok');
  } catch (e) {
    show(msg, e.message || 'Save failed', 'err');
  }
});

document.getElementById('runOpsBtn').addEventListener('click', async () => {
  const msg = document.getElementById('settingsMsg');
  try {
    const { error } = await supabase.rpc('run_booking_ops');
    if (error) throw error;
    await audit('ops.booking_run', {});
    show(msg, t('admin.done'), 'ok');
    await loadSettings();
  } catch (e) {
    show(msg, e.message || 'Job failed', 'err');
  }
});

if (window.Matra7I18n) {
  Matra7I18n.mountSwitchers();
}

async function bootAdmin() {
  try {
    const boot = await requireAdmin();
    if (boot) showShell(boot);
    else showLogin();
  } catch (e) {
    console.error(e);
    showLogin();
    show(loginErr, e.message || t('admin.loginFail'));
  }
}

void bootAdmin();
})();
