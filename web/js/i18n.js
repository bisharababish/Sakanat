/*! Matra7 web — English only */
(function (global) {
  const dict = {
    'meta.homeTitle': 'Matra7',
    'nav.admin': 'Admin sign in',
    'nav.reset': 'Forgot password',
    'nav.home': 'Home',
    'hero.lede':
      'Trusted student housing near Palestinian universities — search, book, and chat in one place.',
    'cta.admin': 'Admin sign in',
    'cta.app': 'Open Matra7 app (mobile)',
    'cta.appHint': 'Install Matra7 on your phone, then tap Open app. On desktop, use the Admin sign in button.',
    'strip.studentsTitle': 'Students & renters',
    'strip.studentsBody':
      'Find housing near your campus, book in clear steps, and message the owner directly.',
    'strip.ownersTitle': 'Owners',
    'strip.ownersBody': 'List units, track bookings, and manage chats in the Matra7 app.',
    'strip.adminTitle': 'Admins',
    'strip.adminBody':
      'Review users, listings, bookings, and reports in the browser — same database as the app.',
    'foot.emailLinks': 'Email links:',
    'foot.confirm': 'Confirm account',
    'foot.reset': 'Reset password',
    'foot.copy': '© Matra7',

    'confirm.title': 'Email confirmed — Matra7',
    'confirm.h1': 'Email confirmed',
    'confirm.body': 'Your account is ready. Open Matra7 and sign in with the same email and password.',
    'confirm.open': 'Open the app',
    'confirm.failTitle': 'Could not confirm email',
    'confirm.failBody': 'Try signing in, or request a new code from the app.',

    'reset.title': 'Reset password — Matra7',
    'reset.h1': 'Back to the app',
    'reset.body': 'Open Matra7 to choose a new password.',
    'reset.open': 'Open the app',
    'reset.failTitle': 'Could not open link',
    'reset.failBody': 'Request a new link from the app.',

    'admin.metaTitle': 'Admin — Matra7',
    'admin.loginTitle': 'Admin sign in',
    'admin.loginHint': 'Use your admin email and password (same as the app).',
    'admin.email': 'Email',
    'admin.password': 'Password',
    'admin.signIn': 'Sign in',
    'admin.mfaTitle': 'Authenticator code',
    'admin.mfaHint': 'Open Google Authenticator (or similar) and enter the 6-digit code.',
    'admin.mfaCode': 'Authenticator code',
    'admin.mfaContinue': 'Continue',
    'admin.mfaCancel': 'Back to sign in',
    'admin.mfaRequired': 'Admin accounts require authenticator MFA. Enable it in the Matra7 app first.',
    'admin.mfaInvalid': 'Invalid authenticator code.',
    'admin.cfgHint': 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in hosting env.',
    'admin.brand': 'Matra7 · Admin',
    'admin.nav.overview': 'Overview',
    'admin.nav.users': 'Users',
    'admin.nav.listings': 'Listings',
    'admin.nav.bookings': 'Bookings',
    'admin.nav.ids': 'ID verify',
    'admin.nav.reports': 'Reports',
    'admin.nav.settings': 'Settings',
    'admin.nav.audit': 'Audit log',
    'admin.refresh': 'Refresh',
    'admin.logout': 'Sign out',
    'admin.overview': 'Overview',
    'admin.events7': 'Events (last 7 days)',
    'admin.queues': 'Queues needing action',
    'admin.users': 'Users',
    'admin.userSearch': 'Search name / email / phone / ID',
    'admin.allRoles': 'All roles',
    'admin.role.student': 'Student',
    'admin.role.renter': 'Renter',
    'admin.role.owner': 'Owner',
    'admin.role.admin': 'Admin',
    'admin.filter.all': 'All',
    'admin.filter.ownerPending': 'Owners pending',
    'admin.filter.suspended': 'Suspended',
    'admin.filter.idPending': 'ID pending',
    'admin.newOwner': '+ New owner',
    'admin.col.name': 'Name',
    'admin.col.role': 'Role',
    'admin.col.status': 'Status',
    'admin.col.contact': 'Contact',
    'admin.col.actions': 'Actions',
    'admin.fullControl': 'Full control',
    'admin.approve': 'Approve',
    'admin.reject': 'Reject',
    'admin.suspend': 'Suspend',
    'admin.restore': 'Restore',
    'admin.listings': 'Listings',
    'admin.listingSearch': 'Search title',
    'admin.status.pending': 'Pending',
    'admin.status.approved': 'Approved',
    'admin.status.rejected': 'Rejected',
    'admin.status.hidden': 'Hidden',
    'admin.status.all': 'All',
    'admin.col.title': 'Title',
    'admin.col.owner': 'Owner',
    'admin.col.price': 'Price',
    'admin.hide': 'Hide',
    'admin.delete': 'Delete',
    'admin.edit': 'Edit',
    'admin.bookings': 'Bookings',
    'admin.allStatuses': 'All statuses',
    'admin.status.confirmed': 'Confirmed',
    'admin.status.completed': 'Completed',
    'admin.status.cancelled': 'Cancelled',
    'admin.col.date': 'Date',
    'admin.col.listing': 'Listing',
    'admin.col.student': 'Student',
    'admin.col.payment': 'Payment',
    'admin.confirm': 'Confirm',
    'admin.complete': 'Complete',
    'admin.cancel': 'Cancel',
    'admin.markPaid': 'Mark paid',
    'admin.ids': 'ID verification',
    'admin.idsHint': 'Pending requests with uploaded documents.',
    'admin.col.note': 'Note',
    'admin.reports': 'Reports',
    'admin.report.open': 'Open',
    'admin.report.reviewing': 'Reviewing',
    'admin.report.closed': 'Closed',
    'admin.col.reason': 'Reason',
    'admin.review': 'Review',
    'admin.close': 'Close',
    'admin.open': 'Reopen',
    'admin.settings': 'Platform settings',
    'admin.commission': 'Platform commission %',
    'admin.adminEmail': 'Admin email (platform)',
    'admin.save': 'Save',
    'admin.runOps': 'Run booking jobs',
    'admin.audit': 'Audit log',
    'admin.col.time': 'Time',
    'admin.col.action': 'Action',
    'admin.col.target': 'Target',
    'admin.editUser': 'Edit user',
    'admin.editListing': 'Edit listing',
    'admin.saveAll': 'Save all changes',
    'admin.activity': 'Related activity',
    'admin.danger': 'Danger zone',
    'admin.back': '← Back to list',
    'admin.done': 'Done',
    'admin.saved': 'Saved',
    'admin.notAdmin': 'Sign-in failed. Check your credentials.',
    'admin.loginFail': 'Sign-in failed. Check your credentials.',
    'admin.lockout': 'Too many failed attempts. Try again in a minute.',
    'admin.denied': 'Sign-in failed. Check your credentials.',
    'admin.idle': 'Signed out due to inactivity.',
    'admin.event': 'Event',
    'admin.count': 'Count',
    'admin.type': 'Type',
    'admin.details': 'Details',
    'admin.stat.listings': 'Listings',
    'admin.stat.bookings': 'Bookings',
    'admin.stat.users': 'Users',
    'admin.stat.chats': 'Chats',
    'admin.stat.commission': 'Confirmed commission',
    'admin.stat.pendingOwners': 'Owners pending',
    'admin.stat.pendingListings': 'Listings pending',
    'admin.stat.openReports': 'Open reports',
    'admin.queue.owners': 'Owners pending',
    'admin.queue.listings': 'Listings pending',
    'admin.queue.bookings': 'Bookings pending',
    'admin.queue.ids': 'ID verify',
    'admin.queue.reports': 'Reports',
    'admin.openQueue': 'Open',
    'admin.noEvents': 'No events',
    'admin.noResults': 'No results',
    'admin.modalCancel': 'Cancel',
    'admin.modalOk': 'Confirm',
  };

  function t(key, fallback) {
    return dict[key] || fallback || key;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.textContent = t(key);
    });
  }

  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';

  global.Matra7I18n = {
    t,
    lang: 'en',
    setLang() {},
    apply,
    mountSwitchers() {
      apply(document);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply(document));
  } else {
    apply(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
