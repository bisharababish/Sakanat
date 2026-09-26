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
  const s = String(status || 'â€”');
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
  if (!apt) return 'â€”';
  return apt.title_ar || apt.title_en || apt.id?.slice(0, 8) || 'â€”';
}

function nameOf(p) {
  if (!p) return 'â€”';
  return p.full_name || p.full_name_en || p.email || p.id?.slice(0, 8) || 'â€”';
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
    settings: loadSettings,
    audit: loadAudit,
  };
  void loaders[name]?.();
}

function showLogin() {
  adminProfile = null;
  if (idleTimer) clearTimeout(idleTimer);
  shell.classList.add('hidden');
  loginCard.classList.remove('hidden');
  body.classList.add('centered');
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

/* â€”â€” Overview â€”â€” */
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
    [t('admin.stat.listings'), apartments.count ?? 'â€”'],
    [t('admin.stat.bookings'), (bookings.data || []).length],
    [t('admin.stat.users'), profiles.count ?? 'â€”'],
    [t('admin.stat.chats'), conversations.count ?? 'â€”'],
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

/* â€”â€” Users â€”â€” */
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
    `<option value="true" ${on ? 'selected' : ''}>Ù†Ø¹Ù…</option><option value="false" ${!on ? 'selected' : ''}>Ù„Ø§</option>`,
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
        if (u.role === 'owner') statusBits.push(chip(u.owner_status || 'â€”'));
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
          <td dir="ltr">${esc(u.phone || 'â€”')}</td>
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
          if (!confirm('Ø¥ÙŠÙ‚Ø§Ù Ù‡Ø°Ø§ Ø§Ù„Ø­Ø³Ø§Ø¨ØŸ')) return;
          const reason = prompt('Ø³Ø¨Ø¨ Ø§Ù„Ø¥ÙŠÙ‚Ø§Ù (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)') || '';
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
        show(dashErr, e.message || 'ÙØ´Ù„');
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
    show(dashErr, error?.message || 'Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
    return;
  }
  editingUser = data;
  document.getElementById('usersListWrap').classList.add('hidden');
  document.getElementById('userDetailWrap').classList.remove('hidden');
  document.getElementById('udTitle').textContent = nameOf(data);
  document.getElementById('udMeta').innerHTML = `
    <span>${chip(data.role)}</span>
    <span>${chip(data.account_status || 'active')}</span>
    <span>${chip(data.owner_status || 'â€”')}</span>
    <span>${chip(data.id_verify_status || 'none')}</span>
    <code>${esc(data.id)}</code>
    <span dir="ltr">${esc(data.email || '')}</span>
  `;

  const u = data;
  const cityOpts =
    `<option value="">â€”</option>` +
    optList(catalog.cities, u.city_id, (c) => c.name_ar || c.name_en);
  const uniOpts =
    `<option value="">â€”</option>` +
    optList(catalog.universities, u.university_id, (x) => x.name_ar || x.name_en);
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
    .map((b) => `${b.status} Â· ${b.start_date || ''} Â· ${String(b.id).slice(0, 8)}`)
    .join('<br>') || 'Ù„Ø§ Ø­Ø¬ÙˆØ²Ø§Øª';
  document.getElementById('udActivity').innerHTML = `
    <p><b>Ø¨Ù„Ø§ØºØ§Øª Ù…Ø±ØªØ¨Ø·Ø©:</b> ${reportsRes.count ?? 0} Â· <b>Ø­Ø¸Ø±:</b> ${(blocksRes.data || []).length}</p>
    <p><b>Ø­Ø¬ÙˆØ²Ø§Øª Ø­Ø¯ÙŠØ«Ø©:</b><br>${bookingLines}</p>
    ${u.national_id_url ? `<p><a href="${esc(u.national_id_url)}" target="_blank" rel="noopener">ÙØªØ­ ÙˆØ«ÙŠÙ‚Ø© Ø§Ù„Ù‡ÙˆÙŠØ©</a></p>` : ''}
    ${u.university_card_url ? `<p><a href="${esc(u.university_card_url)}" target="_blank" rel="noopener">ÙØªØ­ Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ø¬Ø§Ù…Ø¹Ø©</a></p>` : ''}
  `;

  const danger = [];
  if (u.account_status === 'suspended') {
    danger.push(`<button class="btn" type="button" id="udRestore">Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø­Ø³Ø§Ø¨</button>`);
  } else if (u.role !== 'admin') {
    danger.push(`<button class="btn warn" type="button" id="udSuspend">Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„Ø­Ø³Ø§Ø¨</button>`);
  }
  danger.push(`<button class="btn ghost" type="button" id="udClearPush">Ù…Ø³Ø­ Push token</button>`);
  danger.push(`<button class="btn ghost" type="button" id="udClearMfa">Ø¥Ù„ØºØ§Ø¡ MFA</button>`);
  danger.push(`<button class="btn ghost" type="button" id="udClearDocs">Ù…Ø³Ø­ Ø±ÙˆØ§Ø¨Ø· Ø§Ù„ÙˆØ«Ø§Ø¦Ù‚</button>`);
  if (u.role !== 'admin' && u.id !== adminProfile?.id) {
    danger.push(`<button class="btn danger" type="button" id="udDelete">Ø­Ø°Ù Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹</button>`);
  }
  document.getElementById('udDanger').innerHTML = danger.join('');

  document.getElementById('udSuspend')?.addEventListener('click', async () => {
    if (!confirm('Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„Ø­Ø³Ø§Ø¨ØŸ')) return;
    const reason = prompt('Ø§Ù„Ø³Ø¨Ø¨') || '';
    try {
      await setSuspended(editingUser, true, reason);
      flash('ØªÙ… Ø§Ù„Ø¥ÙŠÙ‚Ø§Ù');
      await openUserDetail(userId);
      void loadOverview();
    } catch (e) {
      show(document.getElementById('udMsg'), e.message, 'err');
    }
  });
  document.getElementById('udRestore')?.addEventListener('click', async () => {
    try {
      await setSuspended(editingUser, false);
      flash('ØªÙ…Øª Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø©');
      await openUserDetail(userId);
    } catch (e) {
      show(document.getElementById('udMsg'), e.message, 'err');
    }
  });
  document.getElementById('udClearPush')?.addEventListener('click', async () => {
    const { error: err } = await supabase.from('profiles').update({ expo_push_token: null }).eq('id', userId);
    if (err) return show(document.getElementById('udMsg'), err.message, 'err');
    flash('ØªÙ… Ù…Ø³Ø­ Ø§Ù„ØªÙˆÙƒÙ†');
    await openUserDetail(userId);
  });
  document.getElementById('udClearDocs')?.addEventListener('click', async () => {
    if (!confirm('Ù…Ø³Ø­ Ø±ÙˆØ§Ø¨Ø· Ø§Ù„ÙˆØ«Ø§Ø¦Ù‚ Ù…Ù† Ø§Ù„Ù…Ù„ÙØŸ')) return;
    const { error: err } = await supabase
      .from('profiles')
      .update({ national_id_url: null, university_card_url: null })
      .eq('id', userId);
    if (err) return show(document.getElementById('udMsg'), err.message, 'err');
    await audit('user.update', { targetUserId: userId, note: 'clear id docs' });
    flash('ØªÙ…');
    await openUserDetail(userId);
  });
  document.getElementById('udClearMfa')?.addEventListener('click', async () => {
    if (!confirm('Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ù…ØµØ§Ø¯Ù‚Ø© Ø§Ù„Ø«Ù†Ø§Ø¦ÙŠØ© Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ØŸ')) return;
    const { error: err } = await supabase.rpc('admin_unenroll_mfa', { target: userId });
    if (err) return show(document.getElementById('udMsg'), err.message, 'err');
    await audit('user.mfa_off', { targetUserId: userId });
    flash('ØªÙ… Ø¥Ù„ØºØ§Ø¡ MFA');
  });
  document.getElementById('udDelete')?.addEventListener('click', async () => {
    if (!confirm('Ø­Ø°Ù Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹ØŸ Ù„Ø§ Ø±Ø¬Ø¹Ø©.')) return;
    if (!confirm('ØªØ£ÙƒÙŠØ¯ Ù†Ù‡Ø§Ø¦ÙŠ Ù„Ù„Ø­Ø°ÙØŸ')) return;
    let { error: err } = await supabase.rpc('admin_delete_user', { target: userId });
    if (err) {
      const fallback = await supabase.from('profiles').delete().eq('id', userId);
      if (fallback.error) return show(document.getElementById('udMsg'), err.message || fallback.error.message, 'err');
    }
    await audit('user.delete', { targetUserId: userId });
    flash('ØªÙ… Ø§Ù„Ø­Ø°Ù');
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
    ? spokenRaw.split(/[,ØŒ]/).map((s) => s.trim()).filter(Boolean)
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
    language: val('ud_language') || 'ar',
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
    show(msg, 'Ø§Ù„Ø§Ø³Ù… Ù…Ø·Ù„ÙˆØ¨', 'err');
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
    show(msg, 'ØªÙ… Ø­ÙØ¸ ÙƒÙ„ Ø§Ù„Ø­Ù‚ÙˆÙ„', 'ok');
    flash('ØªÙ… Ø§Ù„Ø­ÙØ¸');
    await openUserDetail(editingUser.id);
    void loadOverview();
  } catch (e) {
    show(msg, e.message || 'ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸', 'err');
  }
}

function openNewOwner() {
  openModal('Ù…Ø§Ù„Ùƒ Ø¬Ø¯ÙŠØ¯', `
    <div class="field"><label>Ø§Ù„Ø§Ø³Ù…</label><input id="m_full_name" /></div>
    <div class="field"><label>Ø§Ù„Ø¨Ø±ÙŠØ¯</label><input id="m_email" type="email" dir="ltr" /></div>
    <div class="field"><label>ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</label><input id="m_password" type="password" dir="ltr" /></div>
    <div class="field"><label>Ù‡Ø§ØªÙ</label><input id="m_phone" dir="ltr" /></div>
  `, async () => {
    const full_name = document.getElementById('m_full_name').value.trim();
    const email = document.getElementById('m_email').value.trim();
    const password = document.getElementById('m_password').value;
    const phone = document.getElementById('m_phone').value.trim() || null;
    if (!full_name || !email || !password) throw new Error('Ø£ÙƒÙ…Ù„ Ø§Ù„Ø­Ù‚ÙˆÙ„');
    const detached = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await detached.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role: 'owner', language: 'ar' } },
    });
    if (error) throw error;
    if (!data.user?.id) throw new Error('Ù…Ø§ Ù‚Ø¯Ø±Ù†Ø§ Ù†Ù†Ø´Ø¦ Ø§Ù„Ø­Ø³Ø§Ø¨');
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ role: 'owner', owner_status: 'approved', full_name, phone, email })
      .eq('id', data.user.id);
    if (upErr) throw upErr;
    await audit('user.update', { targetUserId: data.user.id, note: 'create owner', detail: { email } });
    flash('ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù…Ø§Ù„Ùƒ');
    await loadUsers();
    await openUserDetail(data.user.id);
  });
}

/* â€”â€” Listings â€”â€” */
async function loadListings() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('apartments')
    .select('id, title_ar, title_en, status, price_month, owner_id, reject_reason, created_at, profiles!owner_id(full_name, email)')
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
          <td><b>${esc(titleOf(a))}</b></td>
          <td>${chip(a.status)}</td>
          <td>${esc(nameOf(owner))}</td>
          <td dir="ltr">${esc(a.price_month ?? 'â€”')}</td>
          <td><div class="row-actions">${actions.join('')}</div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="5" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#listingRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      try {
        if (btn.dataset.act === 'list-ok') {
          const { error } = await supabase
            .from('apartments')
            .update({ status: 'approved', reject_reason: null })
            .eq('id', id);
          if (error) throw error;
          await audit('listing.approve', { targetId: id });
        }
        if (btn.dataset.act === 'list-no') {
          const reason = prompt('Ø³Ø¨Ø¨ Ø§Ù„Ø±ÙØ¶ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)') || null;
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
          if (!confirm('Ø­Ø°Ù Ø§Ù„Ø¥Ø¹Ù„Ø§Ù† Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹ØŸ')) return;
          const { error } = await supabase.from('apartments').delete().eq('id', id);
          if (error) throw error;
          await audit('listing.delete', { targetId: id });
        }
        flash('ØªÙ…');
        await loadListings();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'ÙØ´Ù„');
      }
    };
  });
}

/* â€”â€” Bookings â€”â€” */
async function loadBookings() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, status, payment_status, payment_method, commission_amount, cancel_reason, created_at,
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
        const when = b.created_at ? new Date(b.created_at).toLocaleString('ar') : 'â€”';
        return `<tr>
          <td>${esc(when)}</td>
          <td>${esc(titleOf(b.apartments))}</td>
          <td>${esc(nameOf(b.student))}</td>
          <td>${chip(b.status)}</td>
          <td>${chip(b.payment_status || 'â€”')}</td>
          <td><div class="row-actions">
            <button class="btn sm ok" data-act="bk-confirm" data-id="${b.id}">${t('admin.confirm')}</button>
            <button class="btn sm" data-act="bk-done" data-id="${b.id}">${t('admin.complete')}</button>
            <button class="btn sm danger" data-act="bk-cancel" data-id="${b.id}">${t('admin.cancel')}</button>
            <button class="btn sm ghost" data-act="bk-paid" data-id="${b.id}">${t('admin.markPaid')}</button>
            <button class="btn sm ghost" data-act="bk-del" data-id="${b.id}">${t('admin.delete')}</button>
          </div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="6" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#bookingRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      try {
        if (btn.dataset.act === 'bk-confirm') {
          const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-done') {
          const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-cancel') {
          const reason = prompt('Ø³Ø¨Ø¨ Ø§Ù„Ø¥Ù„ØºØ§Ø¡') || null;
          const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled', cancel_reason: reason })
            .eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-paid') {
          const { error } = await supabase.from('bookings').update({ payment_status: 'paid' }).eq('id', id);
          if (error) throw error;
        } else if (btn.dataset.act === 'bk-del') {
          if (!confirm('Ø­Ø°Ù Ø§Ù„Ø­Ø¬Ø²ØŸ')) return;
          const { error } = await supabase.from('bookings').delete().eq('id', id);
          if (error) throw error;
          await audit('booking.delete', { targetId: id });
          flash('ØªÙ…');
          await loadBookings();
          return;
        }
        await audit('booking.update', { targetId: id, detail: { act: btn.dataset.act } });
        flash('ØªÙ…');
        await loadBookings();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'ÙØ´Ù„');
      }
    };
  });
}

/* â€”â€” ID verify â€”â€” */
async function loadIds() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, role, id_verify_status, id_verify_note, national_id_url, university_card_url',
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
        if (u.national_id_url) docs.push('Ù‡ÙˆÙŠØ©');
        if (u.university_card_url) docs.push('Ø¬Ø§Ù…Ø¹Ø©');
        return `<tr>
          <td><b>${esc(nameOf(u))}</b><div class="muted" dir="ltr">${esc(u.email || '')}</div></td>
          <td>${esc(u.role)}</td>
          <td>${esc(docs.join(' Â· ') || 'â€”')}</td>
          <td><div class="row-actions">
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
        let patch;
        if (btn.dataset.act === 'id-ok') {
          patch = {
            id_verify_status: 'approved',
            id_verify_note: null,
            id_verified_at: new Date().toISOString(),
            id_verified_by: adminProfile?.id ?? null,
          };
        } else {
          const note = prompt('Ø³Ø¨Ø¨ Ø§Ù„Ø±ÙØ¶') || null;
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
        flash('ØªÙ…');
        await loadIds();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'ÙØ´Ù„');
      }
    };
  });
}

/* â€”â€” Reports â€”â€” */
async function loadReports() {
  show(dashErr, '');
  const { data, error } = await supabase
    .from('app_reports')
    .select('id, status, reason, admin_note, created_at, reporter_id, target_user_id')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    show(dashErr, error.message);
    return;
  }
  cache.reports = data || [];
  renderReports();
}

function renderReports() {
  const st = document.getElementById('reportStatus').value;
  let rows = cache.reports;
  if (st) rows = rows.filter((r) => r.status === st);
  document.getElementById('reportRows').innerHTML =
    rows
      .map((r) => {
        const when = r.created_at ? new Date(r.created_at).toLocaleString('ar') : 'â€”';
        return `<tr>
          <td>${esc(when)}</td>
          <td>${esc(r.reason || 'â€”')}<div class="muted">${esc(r.admin_note || '')}</div></td>
          <td>${chip(r.status)}</td>
          <td><div class="row-actions">
            <button class="btn sm" data-act="rep-rev" data-id="${r.id}">${t('admin.review')}</button>
            <button class="btn sm ok" data-act="rep-close" data-id="${r.id}">${t('admin.close')}</button>
            <button class="btn sm ghost" data-act="rep-open" data-id="${r.id}">${t('admin.open')}</button>
          </div></td>
        </tr>`;
      })
      .join('') || `<tr><td colspan="4" class="empty">${t('admin.noResults')}</td></tr>`;

  document.querySelectorAll('#reportRows [data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const map = { 'rep-rev': 'reviewing', 'rep-close': 'closed', 'rep-open': 'open' };
      const status = map[btn.dataset.act];
      const admin_note = btn.dataset.act === 'rep-close' ? prompt('Ù…Ù„Ø§Ø­Ø¸Ø© Ø¥ØºÙ„Ø§Ù‚ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)') : null;
      try {
        const { error } = await supabase
          .from('app_reports')
          .update({ status, admin_note: admin_note?.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await audit('report.update', { targetId: id, detail: { status } });
        flash('ØªÙ…');
        await loadReports();
        void loadOverview();
      } catch (e) {
        show(dashErr, e.message || 'ÙØ´Ù„');
      }
    };
  });
}

/* â€”â€” Settings â€”â€” */
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
    show(document.getElementById('settingsMsg'), e.message || 'ØªØ¹Ø°Ø± Ù‚Ø±Ø§Ø¡Ø© Ø¨Ø¹Ø¶ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª', 'err');
  }
  try {
    const { data } = await supabase.rpc('booking_ops_status');
    const row = Array.isArray(data) ? data[0] : data;
    document.getElementById('opsStatus').textContent = row
      ? `Ø¢Ø®Ø± ØªØ´ØºÙŠÙ„: ${row.last_run_at || row.updated_at || 'â€”'} Â· ${JSON.stringify(row).slice(0, 120)}`
      : '';
  } catch {
    document.getElementById('opsStatus').textContent = '';
  }
}

/* â€”â€” Audit â€”â€” */
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
        const when = r.created_at ? new Date(r.created_at).toLocaleString('ar') : 'â€”';
        const target = (r.target_user_id || r.target_id || 'â€”').toString().slice(0, 8);
        return `<tr><td>${esc(when)}</td><td dir="ltr">${esc(r.action)}</td><td dir="ltr">${esc(target)}</td><td>${esc(r.note || '')}</td></tr>`;
      })
      .join('') || '<tr><td colspan="4" class="empty">ÙØ§Ø±Øº</td></tr>';
}

/* â€”â€” Modal â€”â€” */
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
    alert(e.message || 'ÙØ´Ù„');
  }
};

/* —— Wire UI —— */
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
    const admin = await requireAdmin();
    if (!admin) {
      recordLoginFail();
      throw new Error(t('admin.denied'));
    }
    clearLoginFails();
    document.getElementById('password').value = '';
    showShell(admin);
  } catch (err) {
    recordLoginFail();
    const msg = /network|fetch|failed to fetch/i.test(err.message || '')
      ? err.message
      : t('admin.denied');
    show(loginErr, msg);
  } finally {
    btn.disabled = false;
  }
}

const loginForm = document.getElementById('loginForm');
if (loginForm) loginForm.addEventListener('submit', (e) => void handleLogin(e));
else document.getElementById('loginBtn').addEventListener('click', () => void handleLogin());

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

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
    show(msg, e.message || 'ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸', 'err');
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
    show(msg, e.message || 'ÙØ´Ù„ Ø§Ù„ØªØ´ØºÙŠÙ„', 'err');
  }
});

if (window.Matra7I18n) {
  Matra7I18n.mountSwitchers();
  window.addEventListener('matra7:lang', () => {
    Matra7I18n.apply(document);
    const active = document.querySelector('#nav button.active')?.dataset.panel;
    if (active && !shell.classList.contains('hidden')) setPanel(active);
  });
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
