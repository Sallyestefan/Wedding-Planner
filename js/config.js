// Money is shown in this currency.
const CURRENCY = 'CAD';

// Vendor categories in the "Category" drop-down.
const VENDOR_CATEGORIES = [
  'Venue', 'Photographer', 'Videographer', 'Florist', 'DJ', 'Band',
  'Church', 'Hair', 'Makeup', 'Cake', 'Attire', 'Rentals',
  'Stationery', 'Transportation', 'Planner / Coordinator', 'Other'
];

// Vendor stages, in order. The last two count toward your budget.
const VENDOR_STATUSES = ['Researching', 'Contacted', 'Meeting set', 'Booked', 'Paid in full'];
const BOOKED_STATUSES = ['Booked', 'Paid in full'];

// Ways you talked with a vendor.
const CONTACT_METHODS = ['Phone call', 'Text', 'Email', 'In person', 'Video call'];

// Checklist groups, in the order they appear.
const TIMEFRAMES = [
  '12+ months out', '9 to 12 months', '6 to 9 months', '3 to 6 months',
  '1 to 3 months', 'Final month', 'Final week', 'Wedding day', 'After the wedding'
];

// Guest list choices.
const RSVP_OPTIONS = ['Save-the-date sent', 'Invited', 'Attending', 'Declined', 'Not sent yet'];
const GUEST_SIDES = ['Partner 1', 'Partner 2', 'Both'];

/* ----------------------------------------------------------------
   FORM FIELDS
   Each form is a list of fields. To add a field, copy a line and
   change the key (a short id with no spaces) and the label.
   Field types: text, tel, email, url, date, money, number,
                select (needs options), textarea, checkbox
   half: true puts two fields side by side on wider screens.
   ---------------------------------------------------------------- */
const FORMS = {
  vendors: {
    name: 'vendor',
    fields: [
      { key: 'name',     label: 'Business name', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: VENDOR_CATEGORIES, half: true },
      { key: 'status',   label: 'Stage',    type: 'select', options: VENDOR_STATUSES, half: true },
      { key: 'contact',  label: 'Contact person', type: 'text' },
      { key: 'phone',    label: 'Phone',  type: 'tel',   half: true },
      { key: 'email',    label: 'Email',  type: 'email', half: true },
      { key: 'website',  label: 'Website or Instagram', type: 'text' },
      { key: 'price',    label: 'Quoted or contract price', type: 'money', half: true },
      { key: 'paid',     label: 'Paid so far', type: 'money', half: true },
      { key: 'dueDate',  label: 'Next payment due', type: 'date', half: true },
      { key: 'meetDate', label: 'Next meeting or tasting', type: 'date', half: true },
      { key: 'notes',    label: 'Notes', type: 'textarea' },
    ],
  },
  calls: {
    name: 'conversation',
    fields: [
      { key: 'vendorId', label: 'Vendor', type: 'select', options: () => vendorOptions(), required: true },
      { key: 'date',     label: 'Date', type: 'date', half: true, default: () => todayISO() },
      { key: 'method',   label: 'How', type: 'select', options: CONTACT_METHODS, half: true },
      { key: 'summary',  label: 'What did you talk about?', type: 'textarea', required: true },
      { key: 'followUp', label: 'Follow up by', type: 'date', half: true },
    ],
  },
  tasks: {
    name: 'task',
    fields: [
      { key: 'title',     label: 'Task', type: 'text', required: true },
      { key: 'timeframe', label: 'When', type: 'select', options: TIMEFRAMES, half: true },
      { key: 'due',       label: 'Due date (optional)', type: 'date', half: true },
      { key: 'notes',     label: 'Notes', type: 'textarea' },
      { key: 'done',      label: 'Done', type: 'checkbox' },
    ],
  },
  expenses: {
    name: 'expense',
    fields: [
      { key: 'item',  label: 'What is it?', type: 'text', required: true },
      { key: 'cost',  label: 'Cost', type: 'money', half: true },
      { key: 'paid',  label: 'Paid so far', type: 'money', half: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  guests: {
    name: 'guest',
    fields: [
      { key: 'name',    label: 'Name(s)', type: 'text', required: true },
      { key: 'party',   label: 'Number of people', type: 'number', half: true, default: () => 1 },
      { key: 'side',    label: 'Side', type: 'select', options: () => sideOptions(), half: true },
      { key: 'rsvp',    label: 'RSVP', type: 'select', options: RSVP_OPTIONS, half: true },
      { key: 'meal',    label: 'Meal choice', type: 'text', half: true },
      { key: 'address', label: 'Mailing address', type: 'textarea' },
      { key: 'notes',   label: 'Notes (allergies, plus-one, table)', type: 'text' },
    ],
  },
  settings: {
    name: 'wedding details',
    fields: [
      { key: 'partner1', label: 'Your name', type: 'text', half: true },
      { key: 'partner2', label: "Your partner's name", type: 'text', half: true },
      { key: 'date',     label: 'Wedding date', type: 'date', half: true },
      { key: 'budget',   label: 'Total budget', type: 'money', half: true },
      { key: 'venue',    label: 'Venue', type: 'text' },
      { key: 'city',     label: 'City', type: 'text' },
      { key: 'cover',    label: 'Cover photo link (optional, starts with https://)', type: 'url' },
    ],
  },
};


/* ----------------------------------------------------------------
   STARTER CHECKLIST
   The "Add the starter checklist" button on the Checklist tab adds
   these. Each line is [ 'when', 'task' ]. The "when" must match one
   of the TIMEFRAMES above.
   ---------------------------------------------------------------- */
const STARTER_TASKS = [
  ['12+ months out', 'Set a total budget together'],
  ['12+ months out', 'Draft a rough guest count'],
  ['12+ months out', 'Pick a date or season'],
  ['12+ months out', 'Tour and book the venue'],
  ['12+ months out', 'Book a planner or coordinator (if using one)'],
  ['9 to 12 months', 'Book the photographer'],
  ['9 to 12 months', 'Book the caterer'],
  ['9 to 12 months', 'Book the DJ or band'],
  ['9 to 12 months', 'Choose the wedding party'],
  ['9 to 12 months', 'Start shopping for wedding attire'],
  ['6 to 9 months', 'Book the officiant'],
  ['6 to 9 months', 'Book the florist'],
  ['6 to 9 months', 'Reserve hotel room blocks for guests'],
  ['6 to 9 months', 'Send save-the-dates'],
  ['6 to 9 months', 'Set up a gift registry'],
  ['3 to 6 months', 'Book hair and makeup'],
  ['3 to 6 months', 'Order the cake and do a tasting'],
  ['3 to 6 months', 'Order invitations'],
  ['3 to 6 months', 'Book transportation'],
  ['3 to 6 months', 'Buy wedding rings'],
  ['1 to 3 months', 'Mail invitations (6 to 8 weeks before)'],
  ['1 to 3 months', 'Do the menu tasting and finalize the menu'],
  ['1 to 3 months', 'Schedule attire fittings'],
  ['1 to 3 months', 'Write your vows'],
  ['Final month', 'Get the marriage license'],
  ['Final month', 'Chase missing RSVPs and send the final headcount to the caterer'],
  ['Final month', 'Make the seating chart'],
  ['Final month', 'Share the day-of timeline with vendors and the wedding party'],
  ['Final week', 'Confirm arrival times with every vendor'],
  ['Final week', 'Put final payments and tips in labeled envelopes'],
  ['Final week', 'Pack an emergency kit and the rings'],
  ['Wedding day', 'Eat breakfast and enjoy it'],
  ['After the wedding', 'Send thank-you cards'],
  ['After the wedding', 'File the signed marriage license'],
  ['After the wedding', 'Leave reviews for your favorite vendors'],
];
