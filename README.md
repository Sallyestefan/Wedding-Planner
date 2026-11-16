# Our Wedding Book

A private, mobile-friendly wedding planner for two. It's a static site hosted on GitHub Pages, and Firebase handles sign-in and keeps data in sync across devices.

## Features

- **Overview**: a dashboard with a banner showing your names, the date written in invitation style and a countdown (add your own cover photo in Wedding details), then cards for guest RSVPs, budget by category, your top-priority tasks, upcoming payments and meetings, and recent vendor conversations
- **Vendors**: contact details, quotes, payments, booking stage (Researching → Paid in full), and a log of every call, text and meeting
- **Checklist**: tasks grouped by how far out from the wedding they happen, plus a one-tap starter checklist of 35 tasks
- **Budget**: total budget against committed and paid amounts. Booked vendors are added automatically.
- **Guests**: guest list with RSVPs, headcount, meal choices and addresses
- **Works offline**: changes are saved on the device and sync when you're back online
- **Installable**: add it to your phone's home screen to use it like an app
- **Dark mode**: follows your device setting

## Tech stack

- Plain HTML, CSS and JavaScript, with no build step or dependencies to install
- [Firebase Authentication](https://firebase.google.com/docs/auth) (email and password)
- [Cloud Firestore](https://firebase.google.com/docs/firestore) with offline persistence
- [GitHub Pages](https://pages.github.com) for hosting

## Project structure

```
├── index.html              Page structure: sidebar (bottom tab bar on phones), pop-up sheet
├── css/style.css           Colors, fonts and layout
├── js/
│   ├── firebase-config.js  Firebase project settings
│   ├── config.js           Lists, form fields and the starter checklist
│   └── app.js              App logic: data sync, sign-in, rendering, budget math
└── firestore.rules         Firestore security rules (template)
```

## Security

Only the email addresses you list in Firestore's security rules can read or change the data. Anyone else is turned away, even if they're signed in.

**`firebase-config.js` is meant to be public.** A Firebase web config only identifies which project the site connects to. Every visitor's browser downloads it anyway, so it isn't a secret and doesn't grant access on its own ([Firebase docs](https://firebase.google.com/docs/projects/api-keys)). Access is controlled by:

1. **Firestore rules** that only allow two specific email addresses
2. **No public sign-up.** Accounts are created by hand in the Firebase console, and sign-up is turned off in Authentication settings.

The `firestore.rules` file in this repository contains placeholder emails. The real ones live only in the Firebase console.

## Setup

You'll need a Google account (for Firebase) and a GitHub account. Setup takes about 30 minutes.

### 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com) and click **Create a project**. You can turn off Google Analytics.
2. Click the **web icon `</>`** to add a web app. You don't need Firebase Hosting.
3. Copy the values from the `firebaseConfig` that Firebase shows you into `js/firebase-config.js`.

### 2. Set up sign-in

1. Go to **Build → Authentication → Get started**, then turn on **Email/Password** under **Sign-in method**.
2. On the **Users** tab, click **Add user** for each of you.
3. Under **Settings → User actions**, untick **Enable create (sign-up)** so nobody else can create an account.

### 3. Create the database

1. Go to **Build → Firestore Database → Create database** and start in **production mode**.
2. On the **Rules** tab, paste in the contents of `firestore.rules`, replace the placeholder emails with your real ones, and click **Publish**.

> Type your real emails only in the Firebase console. Don't put them in `firestore.rules`, because that file is public on GitHub.

### 4. Deploy to GitHub Pages

1. Create a **public** repository (for example `wedding-planner`).
2. Upload the project files so that `index.html` sits at the **top level** of the repository. Upload the files themselves, not the folder that contains them.
3. Go to **Settings → Pages**, set **Branch** to `main` and the folder to `/ (root)`, and click **Save**.
4. After a minute or two, your site is live at `https://<username>.github.io/<repo-name>/`. If the address doesn't show, refresh the page and check the **Actions** tab to see whether the build has finished.

### 5. Authorize your domain

In Firebase, go to **Authentication → Settings → Authorized domains** and add `<username>.github.io`.

### 6. Install it on your phone

Open the site and sign in. Then:

- **iPhone (Safari):** tap Share, then **Add to Home Screen**
- **Android (Chrome):** tap ⋮, then **Add to Home screen**

## Customizing

Most changes only need edits to `js/config.js`:

| To change… | Edit this |
|---|---|
| Currency | `CURRENCY` (for example `'USD'`, `'GBP'` or `'EUR'`) |
| Vendor categories | `VENDOR_CATEGORIES` |
| Vendor stages | `VENDOR_STATUSES` |
| Checklist groups | `TIMEFRAMES` |
| RSVP choices | `RSVP_OPTIONS` |
| Starter checklist | `STARTER_TASKS` |

**Cover photo:** open **Wedding details** and paste a link to any photo that starts with `https://`. It fills the banner at the top of the Overview.

**Adding a form field:** under `FORM FIELDS`, add a line like this:

```js
{ key: 'table', label: 'Table number', type: 'number', half: true },
```

| Property | What it does |
|---|---|
| `key` | A unique name for the field within its form, with no spaces |
| `label` | The text shown on screen |
| `type` | One of `text`, `tel`, `email`, `date`, `money`, `number`, `select`, `textarea` or `checkbox` |
| `half: true` | Optional. Puts two fields side by side on larger screens. |

**Colors and fonts:** in `css/style.css`, `--plum` is the accent color, `--ink` colors the primary buttons and progress bars, `--banner` is the Overview banner's background when there's no cover photo, and `--font-display` is the heading font (Cormorant Garamond; the body font is DM Sans). The dark mode colors are in a second block further down. If you change the font, also update the Google Fonts `<link>` in `index.html`.

## Local development

There's nothing to install or build. Open `index.html` with a local server, such as VS Code's **Live Server** extension, and the page reloads every time you save.

- Once Firebase is set up, the local preview reads and writes your **real** data.
- Without a Firebase config, the app saves in the browser only and shows a note at the bottom saying so.

To publish a change, upload the changed files to the same paths in the repository (for example, `js/config.js` goes in the `js` folder). The site updates in about a minute.

## Troubleshooting

| Problem | Fix |
|---|---|
| The page is blank or stuck on "Loading…" | Usually a missing comma or quote mark. Open the browser console (right-click → **Inspect** → **Console**) to see which file and line has the error. |
| Pages shows no site address | Make sure the repository is public and `index.html` is at the top level, not inside a folder. |
| "That email and password don't match" | Check that the user exists under Firebase → Authentication → Users. |
| "This account doesn't have access to the plan" | The email isn't in your published Firestore rules. |
| Sign-in fails only on the live site | Add your `github.io` domain to Authorized domains (step 5). |
