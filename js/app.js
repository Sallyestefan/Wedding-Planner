/* ================================================================
   OUR WEDDING BOOK: APP LOGIC
   You rarely need to change this file. Your lists and form fields
   are in js/config.js.
   ================================================================ */

/* ================================================================
   SAVING YOUR DATA
   Once js/firebase-config.js is filled in, everything is saved in
   your Firebase database, so your phone and computer stay in sync.
   Until then, it saves in this browser only (handy for testing).

   Firebase also keeps a copy on each device, so the planner still
   works with bad signal. Changes upload when you're back online.
   ================================================================ */
const COLLECTIONS = ['settings', 'vendors', 'calls', 'tasks', 'expenses', 'guests'];
const LOCAL_PREFIX = 'wedding-book:';

const Store = {
  fs: null,          // the Firebase database, once connected
  mode: 'starting',  // 'online' (Firebase) or 'device' (this browser only)
  local: {},
  unsubscribers: [],

  start() {
    const configured = window.firebase && typeof FIREBASE_CONFIG === 'object' &&
      FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('PASTE');
    if (!configured) { this.mode = 'device'; return; }
    firebase.initializeApp(FIREBASE_CONFIG);
    this.fs = firebase.firestore();
    this.fs.enablePersistence({ synchronizeTabs: true }).catch(() => {}); // offline copy
    this.mode = 'online';
  },

  // Calls onChange(listOfItems, isFresh) now and whenever the data changes.
  watch(name, onChange, onError) {
    if (this.fs) {
      const stop = this.fs.collection(name).onSnapshot(
        { includeMetadataChanges: true },
        snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })), !snap.metadata.fromCache),
        err => onError && onError(err)
      );
      this.unsubscribers.push(stop);
      return;
    }
    this.local[name] = onChange;
    onChange(this.readLocal(name), true);
  },

  stopWatching() {
    this.unsubscribers.forEach(stop => stop());
    this.unsubscribers = [];
  },

  // Firebase shows the change on screen right away and uploads it in the
  // background, so we don't wait for the upload (it may be offline).
  async save(name, id, data) {
    if (this.fs) { this.fs.collection(name).doc(id).set(data).catch(saveError); return; }
    const all = Object.fromEntries(this.readLocal(name).map(({ id, ...rest }) => [id, rest]));
    all[id] = data;
    this.writeLocal(name, all);
  },

  async remove(name, id) {
    if (this.fs) { this.fs.collection(name).doc(id).delete().catch(saveError); return; }
    const all = Object.fromEntries(this.readLocal(name).map(({ id, ...rest }) => [id, rest]));
    delete all[id];
    this.writeLocal(name, all);
  },

  readLocal(name) {
    try {
      const all = JSON.parse(localStorage.getItem(LOCAL_PREFIX + name)) || {};
      return Object.entries(all).map(([id, v]) => ({ id, ...v }));
    } catch (e) { return []; }
  },
  writeLocal(name, all) {
    try { localStorage.setItem(LOCAL_PREFIX + name, JSON.stringify(all)); } catch (e) {}
    if (this.local[name]) this.local[name](this.readLocal(name), true);
  },
};

/* ================================================================
   APP STATE
   ================================================================ */
const state = {
  tab: 'overview',
  loaded: false,
  data: { settings: [], vendors: [], calls: [], tasks: [], expenses: [], guests: [] },
  vendorFilter: 'All',
  hideDone: false,
  guestFilter: 'All',
  user: null,          // who is signed in (Firebase)
  authChecked: false,  // true once Firebase has told us
};
const settings = () => state.data.settings.find(s => s.id === 'main') || {};

/* ================================================================
   HELPERS
   ================================================================ */
const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
const money = v => new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 }).format(num(v));

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysFromToday(iso) {
  const d = parseDate(iso); if (!d) return null;
  const t = parseDate(todayISO());
  return Math.round((d - t) / 86400000);
}
function shortDate(iso) {
  const d = parseDate(iso); if (!d) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
function whenLabel(iso) {
  const n = daysFromToday(iso);
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return shortDate(iso) + ' (' + Math.abs(n) + ' days ago)';
  if (n < 14) return 'In ' + n + ' days';
  return shortDate(iso);
}

// Writes the wedding date the way a formal invitation does:
// "Saturday, the twelfth of June, two thousand twenty-seven"
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
function words(n) { if (n < 20) return ONES[n]; const o = ONES[n % 10]; return TENS[Math.floor(n / 10)] + (o ? '-' + o : ''); }
function ordinalWords(n) {
  const parts = words(n).split('-'); let last = parts.pop();
  last = ORD[last] || (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th');
  return [...parts, last].join('-');
}
function invitationDate(iso) {
  const d = parseDate(iso); if (!d) return '';
  const y = d.getFullYear();
  const yearText = y >= 2000 && y < 2100 ? 'two thousand' + (y > 2000 ? ' ' + words(y - 2000) : '') : String(y);
  return d.toLocaleDateString('en-US', { weekday: 'long' }) + ', the ' + ordinalWords(d.getDate()) +
         ' of ' + d.toLocaleDateString('en-US', { month: 'long' }) + ', ' + yearText;
}

function vendorOptions() {
  return [...state.data.vendors].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map(v => ({ value: v.id, label: v.name + (v.category ? ' · ' + v.category : '') }));
}
function sideOptions() {
  const s = settings();
  return GUEST_SIDES.map(side =>
    side === 'Partner 1' && s.partner1 ? { value: side, label: s.partner1 + "'s side" } :
    side === 'Partner 2' && s.partner2 ? { value: side, label: s.partner2 + "'s side" } :
    { value: side, label: side });
}
function sideLabel(side) { const o = sideOptions().find(x => x.value === side); return o ? o.label : side; }
function vendorName(id) { const v = state.data.vendors.find(x => x.id === id); return v ? v.name : 'Removed vendor'; }

function statusPill(status) {
  const cls = { 'Paid in full': 'good', 'Booked': 'good', 'Meeting set': 'warn', 'Contacted': '', 'Researching': 'plain' }[status] ?? 'plain';
  return '<span class="pill ' + cls + '">' + esc(status || 'Researching') + '</span>';
}
function rsvpPill(rsvp) {
  const cls = { 'Attending': 'good', 'Declined': 'bad', 'Invited': 'warn', 'Save-the-date sent': '', 'Not sent yet': 'plain' }[rsvp] ?? 'plain';
  return '<span class="pill ' + cls + '">' + esc(rsvp || 'Not sent yet') + '</span>';
}
function duePill(iso) {
  const n = daysFromToday(iso);
  if (n === null) return '';
  const cls = n < 0 ? 'bad' : n <= 14 ? 'warn' : 'plain';
  return '<span class="pill ' + cls + '">' + esc(n < 0 ? 'Overdue' : whenLabel(iso)) + '</span>';
}

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
function saveError(err) {
  const code = err && err.code;
  if (code === 'permission-denied') toast('This account can’t change the plan. Check that its email is in your Firestore rules.');
  else if (code === 'resource-exhausted') toast('Firebase’s free daily limit is used up. Try again tomorrow.');
  else toast('Couldn’t save. Check your connection and try again.');
}
function authMessage(err) {
  const code = err && err.code;
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/invalid-login-credentials'].includes(code))
    return 'That email and password don’t match. Check them and try again.';
  if (code === 'auth/too-many-requests') return 'Too many tries. Wait a few minutes, or reset your password.';
  if (code === 'auth/network-request-failed') return 'No connection. Check your signal and try again.';
  return 'Couldn’t sign in (' + (code || 'unknown error') + ').';
}

/* ================================================================
   BUDGET MATH
   ================================================================ */
function budgetTotals() {
  const booked = state.data.vendors.filter(v => BOOKED_STATUSES.includes(v.status));
  const committed = booked.reduce((s, v) => s + num(v.price), 0) + state.data.expenses.reduce((s, e) => s + num(e.cost), 0);
  const paid = state.data.vendors.reduce((s, v) => s + num(v.paid), 0) + state.data.expenses.reduce((s, e) => s + num(e.paid), 0);
  const total = num(settings().budget);
  return { total, committed, paid, left: total - committed, booked };
}
function guestTotals() {
  const sum = list => list.reduce((s, g) => s + (num(g.party) || 1), 0);
  const g = state.data.guests;
  return {
    all: sum(g),
    attending: sum(g.filter(x => x.rsvp === 'Attending')),
    declined: sum(g.filter(x => x.rsvp === 'Declined')),
    waiting: sum(g.filter(x => x.rsvp === 'Invited')),
  };
}

/* ================================================================
   VIEWS: one function per tab
   ================================================================ */
function loadingHTML(what) {
  return '<div class="list"><div class="empty">Loading your ' + what + '…</div></div>';
}

function renderOverview() {
  const s = settings();
  const names = (s.partner1 || s.partner2)
    ? esc(s.partner1 || '…') + '<span class="amp">&amp;</span>' + esc(s.partner2 || '…')
    : 'Your names here';
  const days = daysFromToday(s.date);
  const b = budgetTotals();
  const tasks = state.data.tasks;
  const done = tasks.filter(t => t.done).length;
  const g = guestTotals();
  const pct = (a, z) => z > 0 ? Math.min(100, Math.round((a / z) * 100)) : 0;

  let countdown = '';
  if (days !== null) {
    countdown = days > 0 ? '<div class="countdown"><b class="num">' + days + '</b><span class="muted">' + (days === 1 ? 'day to go' : 'days to go') + '</span></div>'
      : days === 0 ? '<div class="countdown"><b>Today</b><span class="muted">is the day</span></div>'
      : '<div class="countdown"><span class="muted">Married ' + Math.abs(days) + ' days</span></div>';
  }

  // "Coming up": open tasks, payments, meetings and follow-ups with dates
  const upcoming = [];
  tasks.filter(t => !t.done && t.due).forEach(t => upcoming.push({ date: t.due, label: t.title, kind: 'Task', action: 'edit', col: 'tasks', id: t.id }));
  state.data.vendors.forEach(v => {
    if (v.dueDate && num(v.price) - num(v.paid) > 0) upcoming.push({ date: v.dueDate, label: 'Pay ' + v.name + ' · ' + money(num(v.price) - num(v.paid)) + ' left', kind: 'Payment', action: 'vendor', id: v.id });
    if (v.meetDate && daysFromToday(v.meetDate) >= 0) upcoming.push({ date: v.meetDate, label: 'Meet ' + v.name, kind: 'Meeting', action: 'vendor', id: v.id });
  });
  state.data.calls.forEach(c => {
    if (c.followUp && daysFromToday(c.followUp) >= -7) upcoming.push({ date: c.followUp, label: 'Follow up with ' + vendorName(c.vendorId), kind: 'Follow-up', action: 'vendor', id: c.vendorId });
  });
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const upcomingHTML = upcoming.length
    ? upcoming.slice(0, 6).map(u => '<button class="row" type="button" data-action="' + u.action + '" data-col="' + (u.col || '') + '" data-id="' + esc(u.id) + '">' +
        '<span class="row-title">' + esc(u.label) + '</span><span class="row-right">' + duePill(u.date) + '</span>' +
        '<span class="row-meta"><span>' + u.kind + '</span><span>' + esc(shortDate(u.date)) + '</span></span></button>').join('')
    : '<div class="empty">Nothing dated yet. Add due dates to tasks, or payment and meeting dates to vendors, and they will show up here.</div>';

  const recent = [...state.data.calls].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);
  const recentHTML = recent.length
    ? recent.map(c => '<button class="row" type="button" data-action="vendor" data-id="' + esc(c.vendorId) + '">' +
        '<span class="row-title">' + esc(vendorName(c.vendorId)) + '</span><span class="row-right muted">' + esc(shortDate(c.date)) + '</span>' +
        '<span class="row-meta"><span>' + esc(c.method || '') + '</span><span>' + esc((c.summary || '').slice(0, 90)) + ((c.summary || '').length > 90 ? '…' : '') + '</span></span></button>').join('')
    : '<div class="empty">Log calls, texts and meetings with vendors so you always know what was agreed.</div>';

  return '<section class="view">' +
    '<div class="hero">' +
      '<h1 class="hero-names">' + names + '</h1>' +
      (s.date ? '<p class="hero-date">' + esc(invitationDate(s.date)) + '</p>' : '<p class="hero-date">Add your date in Wedding details</p>') +
      ((s.venue || s.city) ? '<p class="hero-venue">' + esc([s.venue, s.city].filter(Boolean).join(' · ')) + '</p>' : '') +
      countdown +
    '</div>' +
    '<div class="stats">' +
      '<button class="stat" type="button" data-goto="budget"><h3>Budget</h3><span class="stat-value num">' + money(b.committed) + '</span>' +
        '<span class="stat-sub num">' + (b.total ? 'committed of ' + money(b.total) : 'committed · set a total budget') + '</span>' +
        '<div class="meter' + (b.total && b.committed > b.total ? ' over' : '') + '"><span style="width:' + pct(b.committed, b.total) + '%"></span></div></button>' +
      '<button class="stat" type="button" data-goto="checklist"><h3>Checklist</h3><span class="stat-value num">' + done + ' of ' + tasks.length + '</span>' +
        '<span class="stat-sub">tasks done</span><div class="meter"><span style="width:' + pct(done, tasks.length) + '%"></span></div></button>' +
      '<button class="stat" type="button" data-goto="guests"><h3>Guests</h3><span class="stat-value num">' + g.attending + ' attending</span>' +
        '<span class="stat-sub num">' + g.waiting + ' awaiting reply · ' + g.all + ' on list</span><div class="meter"><span style="width:' + pct(g.attending + g.declined, g.all) + '%"></span></div></button>' +
    '</div>' +
    '<div class="section"><div class="view-head"><h2>Coming up</h2></div><div class="list">' + upcomingHTML + '</div></div>' +
    '<div class="section"><div class="view-head"><h2>Recent conversations</h2>' +
      '<button class="btn btn-primary" type="button" data-action="new" data-col="calls">Log a conversation</button></div>' +
      '<div class="list">' + recentHTML + '</div></div>' +
  '</section>';
}

function renderVendors() {
  const filters = ['All', ...VENDOR_STATUSES];
  let list = state.data.vendors;
  if (state.vendorFilter !== 'All') list = list.filter(v => (v.status || 'Researching') === state.vendorFilter);
  list = [...list].sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));

  const rows = list.map(v => {
    const owed = num(v.price) - num(v.paid);
    return '<button class="row" type="button" data-action="vendor" data-id="' + esc(v.id) + '">' +
      '<span class="row-title">' + esc(v.name) + '</span><span class="row-right">' + statusPill(v.status) + '</span>' +
      '<span class="row-meta"><span>' + esc(v.category || 'No category') + '</span>' +
        (v.price ? '<span class="num">' + money(v.price) + (owed > 0 && num(v.paid) > 0 ? ' · ' + money(owed) + ' left' : '') + '</span>' : '') +
        (v.phone ? '<span class="num">' + esc(v.phone) + '</span>' : '') + '</span></button>';
  }).join('');

  const empty = state.data.vendors.length
    ? '<div class="empty">No vendors at this stage.</div>'
    : '<div class="empty">Keep every venue, photographer and florist you are considering here, with their quote, contact details and every conversation you have had.<button class="btn btn-primary" type="button" data-action="new" data-col="vendors">Add your first vendor</button></div>';

  return '<section class="view">' +
    '<div class="view-head"><h2>Vendors</h2><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost" type="button" data-action="new" data-col="calls">Log a conversation</button>' +
      '<button class="btn btn-primary" type="button" data-action="new" data-col="vendors">Add vendor</button></div></div>' +
    '<div class="chips">' + filters.map(f => {
      const n = f === 'All' ? state.data.vendors.length : state.data.vendors.filter(v => (v.status || 'Researching') === f).length;
      return '<button class="chip" type="button" data-vfilter="' + esc(f) + '" aria-pressed="' + (state.vendorFilter === f) + '">' + esc(f) + ' <span class="num">' + n + '</span></button>';
    }).join('') + '</div>' +
    '<div class="list">' + (state.loaded ? (rows || empty) : loadingHTML('vendors')) + '</div>' +
  '</section>';
}

function renderChecklist() {
  const tasks = state.data.tasks;
  const done = tasks.filter(t => t.done).length;
  const groups = TIMEFRAMES.map(tf => ({ tf, items: tasks.filter(t => (t.timeframe || TIMEFRAMES[0]) === tf) }));
  const known = new Set(TIMEFRAMES);
  const other = tasks.filter(t => t.timeframe && !known.has(t.timeframe));
  if (other.length) groups.push({ tf: 'Other', items: other });

  const body = groups.map(({ tf, items }) => {
    let shown = state.hideDone ? items.filter(t => !t.done) : items;
    if (!shown.length) return '';
    shown = [...shown].sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
    const left = items.filter(t => !t.done).length;
    return '<div class="section"><div class="view-head"><h3>' + esc(tf) + '</h3><span class="small muted num">' + (left ? left + ' to do' : 'All done') + '</span></div><div class="list">' +
      shown.map(t => '<div class="task' + (t.done ? ' done' : '') + '">' +
        '<input type="checkbox" id="task-' + esc(t.id) + '" data-toggle="' + esc(t.id) + '"' + (t.done ? ' checked' : '') + ' aria-label="Mark done">' +
        '<label for="task-' + esc(t.id) + '"><span class="task-title">' + esc(t.title) + '</span>' +
          (t.due && !t.done ? ' ' + duePill(t.due) : '') +
          (t.notes ? '<br><span class="small muted">' + esc(t.notes) + '</span>' : '') + '</label>' +
        '<button class="task-edit" type="button" data-action="edit" data-col="tasks" data-id="' + esc(t.id) + '">Edit</button></div>').join('') +
      '</div></div>';
  }).join('');

  return '<section class="view">' +
    '<div class="view-head"><div><h2>Checklist</h2><p class="small muted num">' + done + ' of ' + tasks.length + ' done</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip" type="button" data-action="hide-done" aria-pressed="' + state.hideDone + '">Hide done</button>' +
      '<button class="btn btn-primary" type="button" data-action="new" data-col="tasks">Add task</button></div></div>' +
    (!state.loaded ? loadingHTML('checklist')
      : body || '<div class="list"><div class="empty">' + (tasks.length ? 'Everything is done. Congratulations!'
        : 'No tasks yet. Start with a standard wedding checklist of ' + STARTER_TASKS.length + ' tasks, then edit or delete any you don’t need.' +
          '<button class="btn btn-primary" type="button" data-action="starter-tasks">Add the starter checklist</button>') + '</div></div>') +
  '</section>';
}

function renderBudget() {
  const b = budgetTotals();
  const pct = b.total ? Math.min(100, Math.round((b.committed / b.total) * 100)) : 0;

  const vendorRows = b.booked.sort((x, y) => num(y.price) - num(x.price)).map(v =>
    '<button class="row" type="button" data-action="vendor" data-id="' + esc(v.id) + '">' +
      '<span class="row-title">' + esc(v.name) + '</span><span class="row-right num">' + money(v.price) + '</span>' +
      '<span class="row-meta"><span>' + esc(v.category || '') + '</span><span class="num">' + money(v.paid) + ' paid</span>' +
      (num(v.price) - num(v.paid) > 0 && v.dueDate ? '<span>Next payment ' + esc(shortDate(v.dueDate)) + '</span>' : '') + '</span></button>').join('');

  const expenseRows = state.data.expenses.map(e =>
    '<button class="row" type="button" data-action="edit" data-col="expenses" data-id="' + esc(e.id) + '">' +
      '<span class="row-title">' + esc(e.item) + '</span><span class="row-right num">' + money(e.cost) + '</span>' +
      '<span class="row-meta"><span class="num">' + money(e.paid) + ' paid</span>' + (e.notes ? '<span>' + esc(e.notes) + '</span>' : '') + '</span></button>').join('');

  return '<section class="view">' +
    '<div class="view-head"><h2>Budget</h2><button class="btn btn-ghost" type="button" data-action="edit-settings">Set total budget</button></div>' +
    '<div class="ledger">' +
      '<div><span>Total budget</span><b class="num">' + (b.total ? money(b.total) : 'Not set') + '</b></div>' +
      '<div><span>Committed</span><b class="num">' + money(b.committed) + '</b></div>' +
      '<div><span>Paid so far</span><b class="num">' + money(b.paid) + '</b></div>' +
      '<div><span>' + (b.left < 0 ? 'Over budget' : 'Not yet spent') + '</span><b class="num" style="color:' + (b.left < 0 ? 'var(--bad)' : 'var(--good)') + '">' + (b.total ? money(Math.abs(b.left)) : '–') + '</b></div>' +
      '<div class="meter' + (b.left < 0 ? ' over' : '') + '"><span style="width:' + pct + '%"></span></div>' +
    '</div>' +
    '<div class="section"><div class="view-head"><h3>Booked vendors</h3></div><div class="list">' +
      (vendorRows || '<div class="empty">Vendors you mark as Booked or Paid in full are added here automatically, using their contract price.</div>') + '</div></div>' +
    '<div class="section"><div class="view-head"><h3>Other expenses</h3><button class="btn btn-primary" type="button" data-action="new" data-col="expenses">Add expense</button></div><div class="list">' +
      (expenseRows || '<div class="empty">Rings, the marriage license, favors, gifts for the wedding party: anything that isn’t a vendor goes here.</div>') + '</div></div>' +
  '</section>';
}

function renderGuests() {
  const g = guestTotals();
  const filters = ['All', ...RSVP_OPTIONS];
  let list = state.data.guests;
  if (state.guestFilter !== 'All') list = list.filter(x => (x.rsvp || 'Not sent yet') === state.guestFilter);
  list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const rows = list.map(x => '<button class="row" type="button" data-action="edit" data-col="guests" data-id="' + esc(x.id) + '">' +
    '<span class="row-title">' + esc(x.name) + (num(x.party) > 1 ? ' <span class="muted num">+' + (num(x.party) - 1) + '</span>' : '') + '</span>' +
    '<span class="row-right">' + rsvpPill(x.rsvp) + '</span>' +
    '<span class="row-meta">' + (x.side ? '<span>' + esc(sideLabel(x.side)) + '</span>' : '') + (x.meal ? '<span>' + esc(x.meal) + '</span>' : '') + (x.notes ? '<span>' + esc(x.notes) + '</span>' : '') + '</span></button>').join('');

  return '<section class="view">' +
    '<div class="view-head"><div><h2>Guests</h2><p class="small muted num">' + g.attending + ' attending · ' + g.waiting + ' awaiting reply · ' + g.declined + ' declined · ' + g.all + ' people on the list</p></div>' +
      '<button class="btn btn-primary" type="button" data-action="new" data-col="guests">Add guest</button></div>' +
    '<div class="chips">' + filters.map(f => '<button class="chip" type="button" data-gfilter="' + esc(f) + '" aria-pressed="' + (state.guestFilter === f) + '">' + esc(f) + '</button>').join('') + '</div>' +
    '<div class="list">' + (!state.loaded ? loadingHTML('guest list') : rows || '<div class="empty">' + (state.data.guests.length ? 'No guests with this RSVP.' : 'Add guests one household at a time. Set the number of people so your headcount stays right.') + '</div>') + '</div>' +
  '</section>';
}

const VIEWS = { overview: renderOverview, vendors: renderVendors, checklist: renderChecklist, budget: renderBudget, guests: renderGuests };

function renderSignIn() {
  return '<section class="view">' +
    '<div class="hero"><h1 class="hero-names">Our Wedding Book</h1><p class="hero-date">Sign in to see your plans.</p></div>' +
    '<form class="fields" id="signin-form" style="max-width:420px">' +
      '<div class="field"><label for="signin-email">Email</label><input type="email" id="signin-email" autocomplete="username" required></div>' +
      '<div class="field"><label for="signin-password">Password</label><input type="password" id="signin-password" autocomplete="current-password" required></div>' +
      '<p class="field small" id="signin-message" style="color:var(--bad)" aria-live="polite"></p>' +
      '<div class="form-actions"><button class="btn btn-ghost" type="button" data-action="reset-password">Forgot password?</button>' +
      '<button class="btn btn-primary" type="submit">Sign in</button></div>' +
    '</form></section>';
}

function render() {
  const signedOut = Store.mode === 'online' && !state.user;
  $('.tabs').hidden = signedOut;
  $('#details-btn').hidden = signedOut;
  if (signedOut) {
    // Don't redraw the sign-in form while someone is typing in it.
    if (!$('#signin-form')) $('#view').innerHTML = state.authChecked ? renderSignIn() : loadingHTML('planner');
    $('#footer-note').textContent = '';
    return;
  }
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
  $('#view').innerHTML = VIEWS[state.tab]();
  const s = settings();
  $('#monogram').textContent = (s.partner1 && s.partner2) ? s.partner1 + ' & ' + s.partner2 : 'Our Wedding Book';
  $('#footer-note').textContent = Store.mode === 'device'
    ? 'Firebase isn’t connected yet, so this saves in this browser only. See README.md to set it up.'
    : 'Saved online · syncs across your devices · signed in as ' + state.user.email;
  if (sheetRefresh) sheetRefresh();
}

/* ================================================================
   POP-UP SHEET: forms and vendor details
   ================================================================ */
const sheet = $('#sheet');
let sheetRefresh = null; // re-draws an open vendor detail when data changes

function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { sheetRefresh = null; if (sheet.open) sheet.close(); }
sheet.addEventListener('close', () => { sheetRefresh = null; });
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });

function optionList(opts) {
  const list = typeof opts === 'function' ? opts() : opts;
  return list.map(o => typeof o === 'string' ? { value: o, label: o } : o);
}

function fieldHTML(f, value) {
  const id = 'f-' + f.key;
  const req = f.required ? ' required' : '';
  const cls = 'field' + (f.half ? ' half' : '');
  if (value === undefined && f.default) value = f.default();
  if (f.type === 'checkbox') {
    return '<div class="' + cls + '"><label style="display:flex;gap:10px;align-items:center;font-weight:500"><input type="checkbox" id="' + id + '" name="' + f.key + '"' + (value ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:var(--plum)"> ' + esc(f.label) + '</label></div>';
  }
  let input;
  if (f.type === 'select') {
    const opts = optionList(f.options);
    input = '<select id="' + id + '" name="' + f.key + '"' + req + '>' + (f.required ? '' : '<option value="">Choose…</option>') +
      opts.map(o => '<option value="' + esc(o.value) + '"' + (o.value === value ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
  } else if (f.type === 'textarea') {
    input = '<textarea id="' + id + '" name="' + f.key + '"' + req + '>' + esc(value) + '</textarea>';
  } else {
    const type = f.type === 'money' || f.type === 'number' ? 'number' : f.type;
    const extra = f.type === 'money' ? ' inputmode="decimal" step="0.01" min="0"' : f.type === 'number' ? ' inputmode="numeric" min="0" step="1"' : '';
    input = '<input type="' + type + '" id="' + id + '" name="' + f.key + '" value="' + esc(value ?? '') + '"' + extra + req + '>';
  }
  return '<div class="' + cls + '"><label for="' + id + '">' + esc(f.label) + '</label>' + input + '</div>';
}

// Opens the form for a collection. item is undefined when adding something new.
function openForm(col, item, preset) {
  sheetRefresh = null;
  const form = FORMS[col];
  if (col === 'calls' && !state.data.vendors.length) { toast('Add a vendor first, then log conversations with them.'); return; }
  const values = Object.assign({}, preset || {}, item || {});
  const isNew = !item;
  const title = col === 'settings' ? 'Wedding details' : (isNew ? 'Add ' : 'Edit ') + form.name;

  openSheet(
    '<div class="sheet-head"><h2>' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + '</h2><button class="close-btn" type="button" data-action="close" aria-label="Close">×</button></div>' +
    '<form class="fields" id="edit-form" novalidate>' +
      form.fields.map(f => fieldHTML(f, values[f.key])).join('') +
      '<div class="form-actions">' +
        (!isNew && col !== 'settings' ? '<button class="btn btn-danger" type="button" data-action="delete" data-col="' + col + '" data-id="' + esc(item.id) + '">Delete</button>'
          : col === 'settings' && state.user ? '<button class="btn btn-ghost" type="button" data-action="sign-out">Sign out</button>' : '<span></span>') +
        '<button class="btn btn-primary" type="submit">' + (isNew && col !== 'settings' ? 'Add ' + form.name : 'Save') + '</button>' +
      '</div></form>'
  );

  $('#edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const formEl = e.target;
    const data = {};
    for (const f of form.fields) {
      const el = formEl.elements[f.key];
      if (f.type === 'checkbox') data[f.key] = el.checked;
      else if (f.type === 'money' || f.type === 'number') data[f.key] = el.value === '' ? null : Number(el.value);
      else data[f.key] = el.value.trim();
      if (f.required && (data[f.key] === '' || data[f.key] === null)) {
        el.focus(); toast(f.label + ' is required.'); return;
      }
    }
    // Keep any extra fields this form doesn't show (so nothing is lost).
    const merged = Object.assign({}, item || {}, data);
    delete merged.id;
    if (isNew) merged.created = new Date().toISOString();
    const id = col === 'settings' ? 'main' : (item ? item.id : newId());
    try {
      await Store.save(col, id, merged);
      toast(isNew && col !== 'settings' ? 'Added' : 'Saved');
      if (col === 'calls') openVendor(merged.vendorId);
      else if (col === 'vendors') openVendor(id);
      else closeSheet();
    } catch (err) { saveError(err); }
  });
}

function openVendor(id) {
  const draw = () => {
    const v = state.data.vendors.find(x => x.id === id);
    if (!v) { closeSheet(); return; }
    const calls = state.data.calls.filter(c => c.vendorId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const owed = num(v.price) - num(v.paid);
    const contact = (label, value, href) => value
      ? '<dt>' + label + '</dt><dd><span class="contact-line"><span class="num">' + esc(value) + '</span>' +
        (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">Open</a>' : '') +
        '<button class="log-edit" type="button" data-copy="' + esc(value) + '">Copy</button></span></dd>' : '';
    const site = v.website ? (/^https?:\/\//i.test(v.website) ? v.website : (v.website.startsWith('@') ? 'https://instagram.com/' + v.website.slice(1) : 'https://' + v.website)) : '';

    $('#sheet-body').innerHTML =
      '<div class="sheet-head"><div style="display:flex;flex-direction:column;gap:6px"><h2>' + esc(v.name) + '</h2>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + statusPill(v.status) + '<span class="small muted">' + esc(v.category || '') + '</span></div></div>' +
        '<button class="close-btn" type="button" data-action="close" aria-label="Close">×</button></div>' +
      '<dl class="detail-grid">' +
        (v.contact ? '<dt>Contact</dt><dd>' + esc(v.contact) + '</dd>' : '') +
        contact('Phone', v.phone, v.phone ? 'tel:' + v.phone.replace(/[^\d+]/g, '') : '') +
        contact('Email', v.email, v.email ? 'mailto:' + v.email : '') +
        contact('Web', v.website, site) +
        (v.price ? '<dt>Price</dt><dd class="num">' + money(v.price) + ' · ' + money(v.paid) + ' paid' + (owed > 0 ? ' · <b>' + money(owed) + ' left</b>' : '') + '</dd>' : '') +
        (v.dueDate && owed > 0 ? '<dt>Payment due</dt><dd>' + esc(shortDate(v.dueDate)) + ' ' + duePill(v.dueDate) + '</dd>' : '') +
        (v.meetDate ? '<dt>Meeting</dt><dd>' + esc(shortDate(v.meetDate)) + '</dd>' : '') +
        (v.notes ? '<dt>Notes</dt><dd style="white-space:pre-wrap">' + esc(v.notes) + '</dd>' : '') +
      '</dl>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" type="button" data-action="new" data-col="calls" data-vendor="' + esc(v.id) + '">Log a conversation</button>' +
        '<button class="btn btn-ghost" type="button" data-action="edit" data-col="vendors" data-id="' + esc(v.id) + '">Edit vendor</button></div>' +
      '<div class="section"><h3>Conversations</h3>' +
        (calls.length ? '<div class="log">' + calls.map(c =>
          '<div class="log-item"><span class="small"><b>' + esc(shortDate(c.date)) + '</b>' + (c.method ? ' · ' + esc(c.method) : '') + '</span>' +
          '<p>' + esc(c.summary) + '</p>' + (c.followUp ? '<span>' + duePill(c.followUp) + ' <span class="small muted">follow up</span></span>' : '') +
          '<button class="log-edit" type="button" data-action="edit" data-col="calls" data-id="' + esc(c.id) + '">Edit</button></div>').join('') + '</div>'
        : '<p class="small muted">No conversations logged yet. After a call or meeting, jot down prices, dates and anything they promised.</p>') +
      '</div>';
  };
  sheetRefresh = draw;
  if (!sheet.open) sheet.showModal();
  draw();
}

/* ================================================================
   CLICKS AND TAPS
   ================================================================ */
document.addEventListener('click', async e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { state.tab = tab.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const go = e.target.closest('[data-goto]');
  if (go) { state.tab = go.dataset.goto; render(); window.scrollTo(0, 0); return; }
  const vf = e.target.closest('[data-vfilter]');
  if (vf) { state.vendorFilter = vf.dataset.vfilter; render(); return; }
  const gf = e.target.closest('[data-gfilter]');
  if (gf) { state.guestFilter = gf.dataset.gfilter; render(); return; }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.copy); toast('Copied'); }
    catch (err) { toast('Couldn’t copy. Press and hold the text to copy it instead.'); }
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, col, id } = btn.dataset;
  const find = () => state.data[col].find(x => x.id === id);

  if (action === 'close') closeSheet();
  else if (action === 'edit-settings') openForm('settings', settings().id ? settings() : undefined);
  else if (action === 'new') openForm(col, undefined, btn.dataset.vendor ? { vendorId: btn.dataset.vendor } : undefined);
  else if (action === 'edit') { const item = find(); if (item) openForm(col, item); }
  else if (action === 'vendor') { if (state.data.vendors.some(v => v.id === id)) openVendor(id); }
  else if (action === 'hide-done') { state.hideDone = !state.hideDone; render(); }
  else if (action === 'starter-tasks') {
    const created = new Date().toISOString();
    STARTER_TASKS.forEach(([timeframe, title], i) =>
      Store.save('tasks', 'starter-' + String(i + 1).padStart(2, '0'), { title, timeframe, done: false, created }));
    toast('Added ' + STARTER_TASKS.length + ' tasks');
  }
  else if (action === 'sign-out') { closeSheet(); firebase.auth().signOut(); }
  else if (action === 'reset-password') {
    const email = $('#signin-email').value.trim();
    const msg = $('#signin-message');
    if (!email) { msg.textContent = 'Type your email above first.'; return; }
    try { await firebase.auth().sendPasswordResetEmail(email); msg.style.color = 'var(--good)'; msg.textContent = 'Check your email for a link to reset your password.'; }
    catch (err) { msg.style.color = 'var(--bad)'; msg.textContent = authMessage(err); }
  }
  else if (action === 'delete') {
    // Ask twice so nothing is deleted by accident.
    if (!btn.classList.contains('armed')) { btn.classList.add('armed'); btn.textContent = 'Tap again to delete'; return; }
    try {
      const vendorId = col === 'calls' ? (find() || {}).vendorId : null;
      await Store.remove(col, id);
      toast('Deleted');
      if (vendorId) openVendor(vendorId); else closeSheet();
    } catch (err) { saveError(err); }
  }
});

// Ticking a checklist box saves straight away.
document.addEventListener('change', async e => {
  const id = e.target.dataset && e.target.dataset.toggle;
  if (!id) return;
  const task = state.data.tasks.find(t => t.id === id);
  if (!task) return;
  const { id: _, ...rest } = task;
  try { await Store.save('tasks', id, { ...rest, done: e.target.checked }); }
  catch (err) { e.target.checked = !e.target.checked; saveError(err); }
});

/* ================================================================
   START UP
   ================================================================ */
// The sign-in form.
document.addEventListener('submit', async e => {
  if (e.target.id !== 'signin-form') return;
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const msg = $('#signin-message');
  msg.style.color = 'var(--bad)'; msg.textContent = '';
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    await firebase.auth().signInWithEmailAndPassword($('#signin-email').value.trim(), $('#signin-password').value);
  } catch (err) {
    msg.textContent = authMessage(err);
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});

// Start listening to every list, and re-draw whenever something changes.
function watchAll() {
  const fresh = new Set();
  const slowTimer = setTimeout(() => {
    if (fresh.size < COLLECTIONS.length) $('#notice').innerHTML = '<p class="notice">Can’t reach your saved plans right now. You’re seeing the copy saved on this device. Changes will upload when you’re back online.</p>';
  }, 10000);

  COLLECTIONS.forEach(name => {
    Store.watch(name, (items, isFresh) => {
      state.data[name] = items;
      if (isFresh) fresh.add(name);
      if (fresh.size === COLLECTIONS.length) { clearTimeout(slowTimer); $('#notice').innerHTML = ''; }
      state.loaded = true;
      render();
    }, err => {
      clearTimeout(slowTimer);
      state.loaded = true;
      $('#notice').innerHTML = err && err.code === 'permission-denied'
        ? '<p class="notice">This account doesn’t have access to the plan. Check that its email is listed in your Firestore rules.</p>'
        : '<p class="notice">Your saved plans couldn’t be loaded. Reopen the page to try again.</p>';
      render();
    });
  });
}

(function start() {
  try { const t = localStorage.getItem(LOCAL_PREFIX + 'tab'); if (t && VIEWS[t]) state.tab = t; } catch (e) {}
  document.addEventListener('click', () => { try { localStorage.setItem(LOCAL_PREFIX + 'tab', state.tab); } catch (e) {} });

  Store.start();
  if (Store.mode === 'device') { watchAll(); render(); return; }

  render(); // shows "Loading…" until Firebase says who is signed in
  firebase.auth().onAuthStateChanged(user => {
    state.user = user;
    state.authChecked = true;
    Store.stopWatching();
    COLLECTIONS.forEach(name => { state.data[name] = []; });
    state.loaded = false;
    $('#notice').innerHTML = '';
    $('#view').innerHTML = '';
    if (user) watchAll();
    render();
  });
})();
