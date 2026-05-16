# Museum Collection Manager — User Guide

## Contents

1. [First Launch & Setup](#1-first-launch--setup)
2. [Logging In](#2-logging-in)
3. [Dashboard](#3-dashboard)
4. [Managing Items](#4-managing-items)
5. [Categories](#5-categories)
6. [Locations](#6-locations)
7. [Reports](#7-reports)
8. [Exporting to CSV](#8-exporting-to-csv)
9. [Settings](#9-settings)
10. [Admin Panel](#10-admin-panel)
11. [Roles & Permissions](#11-roles--permissions)
12. [Two-Factor Authentication (MFA)](#12-two-factor-authentication-mfa)
13. [Backup & Restore](#13-backup--restore)
14. [Demo Data](#14-demo-data)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. First Launch & Setup

When you open the app for the first time you will see the **Setup Wizard**.

### Step 1 — Welcome
A brief overview of the application. Click **Get Started** to continue.

### Step 2 — Create Admin Account
Fill in the fields to create your administrator account:

| Field | Required | Notes |
|---|---|---|
| Username | Yes | 3–50 characters, used to log in |
| Full Name | No | Displayed in the sidebar |
| Email | Yes | Used for identification only |
| Password | Yes | Minimum 12 characters. The strength meter will guide you — aim for green. |
| Confirm Password | Yes | Must match |

Click **Create Admin Account** when ready.

### Step 3 — Two-Factor Authentication
You will be shown a QR code. Scan it with an authenticator app (Google Authenticator, Authy, 1Password, Microsoft Authenticator, etc.) and enter the 6-digit code to confirm.

- If you cannot scan the QR code, click **Can't scan? Enter key manually** to reveal the secret key.
- Click **Skip — I'll set this up later** to bypass this step. MFA can be enabled later from the Admin panel.
- If you enable MFA, **save your recovery codes**. Each code can be used once to bypass MFA if you lose access to your authenticator app.

### Step 4 — Done
Click **Open My Collection** to enter the app.

---

## 2. Logging In

Enter your **username** and **password** on the login screen. If MFA is enabled for your account you will be asked for a 6-digit code from your authenticator app after your password is accepted.

**Forgotten password?** Ask an admin to reset it for you via the Admin panel.

**Account locked?** After 5 consecutive failed login attempts your account is locked for 15 minutes. Wait and try again, or ask an admin to reset your password.

---

## 3. Dashboard

The Dashboard gives you an at-a-glance summary of the entire collection.

| Section | What it shows |
|---|---|
| Total Items | Count of all items in the database |
| Total Value | Sum of estimated values across all items |
| Items on Display | Count of items with status *display* |
| Items in Storage | Count of items with status *storage* |
| Status chart | Bar chart breaking down item counts by status |
| Condition chart | Pie chart breaking down items by condition rating |
| Recent Acquisitions | The 5 most recently added items |
| Recent Activity | The 5 most recent changes from the audit log |

Click **New Item** (top-right toolbar) or use **Ctrl/Cmd + N** to add an item directly from the Dashboard.

---

## 4. Managing Items

### Browsing the Collection

The **Items** page shows the full collection in a paginated table. You can:

- **Search** — type in the search box to run a full-text search across titles, descriptions, accession numbers, tags and provenance notes
- **Filter** — use the filter bar to narrow by Status, Category, Location or Condition
- **Sort** — click any column header to sort ascending or descending

### Adding an Item

Click **New Item** in the top-right toolbar (or **Ctrl/Cmd + N** from anywhere in the app).

Fill in the form:

| Field | Notes |
|---|---|
| Accession Number | Must be unique. Recommended format: `YYYY.NNN.NNN` |
| Title | Short descriptive name |
| Description | Free-text description of the object |
| Category | Select from the category list (managed in the Categories page) |
| Location | Where the item currently is |
| Status | `storage`, `display`, `loan`, `conservation` or `deaccessioned` |
| Acquisition Date | Date the item entered the collection |
| Acquisition Method | `purchase`, `donation`, `bequest`, `transfer` or `field collection` |
| Donor / Vendor | Name of the source if applicable |
| Estimated Value | Numeric value in your local currency |
| Condition | `excellent`, `good`, `fair`, `poor` or `critical` |
| Provenance | Ownership history and source documentation |
| Notes | Internal working notes |
| Tags | Comma-separated keywords for searching |

Click **Upload Images** to attach photographs of the item (multiple files supported).

### Editing an Item

From the Items list, click the **eye icon** to open the item detail view, then click **Edit** (pencil icon). You can also click the pencil icon directly from the list.

### Moving an Item

On the item detail page, click **Move** to change the item's location and/or status in a single step. This is logged in the audit trail.

### Deleting an Item

Open the item detail page and click the **red trash icon**. You will be asked to confirm. Deletion is permanent and cannot be undone (take a backup first if needed).

> **Tip:** Consider setting status to `deaccessioned` instead of deleting — this preserves the record in the audit log.

---

## 5. Categories

Categories are used to classify items (e.g. *Paintings*, *Ceramics*, *Archaeology*).

### Hierarchy
Categories support one level of parent-child nesting. For example:
- Fine Art (parent)
  - Paintings (child)
  - Sculptures (child)

### Adding a Category
Go to **Categories** in the sidebar, click **New Category**, enter a name, optional description, and optionally select a parent category.

### Editing / Deleting
Click the **pencil** or **trash** icon on any row. A category cannot be deleted if items are assigned to it — reassign those items first.

---

## 6. Locations

Locations track where items are physically held.

### Location Types

| Type | Use for |
|---|---|
| Gallery | Public display spaces |
| Storage | Non-public storage areas |
| Conservation | Conservation or restoration labs |
| Loan | Off-site loans to other institutions |
| Other | Any other location |

### Adding a Location
Go to **Locations** in the sidebar, click **New Location**, enter a name, select a type, and add an optional description.

### Editing / Deleting
Click the pencil or trash icon on any row. A location cannot be deleted if items are currently assigned to it.

---

## 7. Reports

The **Reports** page has four tabs:

### Overview
High-level collection statistics with status and condition charts. Mirrors the Dashboard but with more detail.

### By Location
Table and chart showing how many items are in each location, including total estimated values. Items with no location assigned are counted separately as *Unlocated*.

### Acquisition Timeline
Charts showing how the collection has grown over time:
- Items acquired per year
- Items acquired per month (last 24 months)
- Breakdown by acquisition method (purchase, donation, bequest, etc.)

### Condition Summary
- Breakdown of items by condition rating
- Condition by category cross-tabulation
- List of items flagged as **needing attention** (condition rated *poor* or *critical*)

---

## 8. Exporting to CSV

Click **Export CSV** in the top-right toolbar. A native save dialog will open — choose a filename and location.

The exported file contains all items currently visible with their full metadata (accession number, title, category, location, status, condition, value, dates, provenance, tags, etc.).

> To export a filtered subset, apply filters on the Items page before exporting.

---

## 9. Settings

Click **Settings** in the left sidebar (gear icon).

### Automatic Backup Location

By default, automatic daily backups are saved to the app's data folder. You can change this to any folder — for example:

- A NAS drive mounted at `/mnt/nas/museum-backups`
- A SharePoint or OneDrive sync folder at `~/OneDrive/Museum Backups`
- Any other network or local path

Click **Choose folder…** to open a folder picker. The path is saved immediately and takes effect at the next scheduled backup.

Click **Reset to default** to go back to the built-in backups folder.

---

## 10. Admin Panel

The Admin panel is only visible to users with the **admin** role. Click **Admin** (shield icon) in the sidebar.

### Users Tab

Manage all user accounts:

- **Create User** — add a new user with a username, email, password and role
- **Edit** (pencil icon) — update email, full name or role
- **Reset Password** (key icon) — set a new password for the user (useful if they forget it)
- **Delete** (trash icon) — remove the user. You cannot delete your own account or the last remaining admin.

### Audit Log Tab

A full chronological log of every change made to items, categories, locations and users. Each entry shows:

- The table and record that was changed
- The action (INSERT, UPDATE, DELETE)
- The before and after data (JSON)
- Who made the change and when

Use the filters to narrow by table or action type.

### Database Tab

#### Manual Backup
Click **Save Backup** to export the database to a `.db` file of your choice. Useful before major changes.

#### Restore
Click **Restore from Backup** to replace the current database with a previously saved backup file. **This is irreversible** — take a fresh backup first.

#### Demo Data
See [Section 14 — Demo Data](#14-demo-data).

---

## 11. Roles & Permissions

| Action | Viewer | Editor | Admin |
|---|---|---|---|
| Browse items, categories, locations | ✓ | ✓ | ✓ |
| Search and filter | ✓ | ✓ | ✓ |
| View reports | ✓ | ✓ | ✓ |
| Export CSV | ✓ | ✓ | ✓ |
| Add / edit / delete items | — | ✓ | ✓ |
| Add / edit / delete categories | — | ✓ | ✓ |
| Add / edit / delete locations | — | ✓ | ✓ |
| Manage users | — | — | ✓ |
| View audit log | — | — | ✓ |
| Backup / restore database | — | — | ✓ |
| Import / clear demo data | — | — | ✓ |

---

## 12. Two-Factor Authentication (MFA)

MFA adds a second verification step at login using a time-based one-time code (TOTP).

### Enabling MFA
Go to **Admin → Users**, click the **shield icon** on your own account (or any account if you are an admin) and follow the QR code setup flow.

### Disabling MFA
Click the shield icon on the user row — if MFA is already enabled the button will offer to disable it. You must enter a valid 6-digit code to confirm.

### Recovery Codes
During setup you are given 8 single-use recovery codes. Store these securely offline. If you lose access to your authenticator app, enter a recovery code in place of the 6-digit TOTP code at login.

---

## 13. Backup & Restore

### Automatic Daily Backups
The app automatically backs up the database once every 24 hours. Up to 7 backups are retained; older ones are deleted automatically. The backup folder can be configured in **Settings**.

### Manual Backup
**Admin → Database → Save Backup** — exports the current database to a `.db` file you choose. Recommended before:
- Restoring from another backup
- Clearing demo data
- Any bulk import or deletion

### Restoring
**Admin → Database → Restore from Backup** — opens a file picker. Select a `.db` backup file. The current database is replaced immediately. The app should be restarted after a restore.

> Backups are plain SQLite files. You can open them with any SQLite tool (e.g. DB Browser for SQLite) for inspection or data recovery.

---

## 14. Demo Data

Demo data lets you explore the app with a realistic collection before entering your own data.

**Admin → Database → Demo Data**

### Import Demo Data
Inserts 27 sample items across 8 categories and 8 locations, including:

- Fine Art: paintings, sculptures, drawings & prints
- Decorative Arts: ceramics, textiles, furniture
- Archaeology: classical antiquities, pre-Columbian objects
- Natural History: fossils, minerals, botanical specimens
- Photography & Media: daguerreotypes, photograph albums

Items have realistic accession numbers, provenance notes, acquisition dates, condition ratings and estimated values. The import is safe to run multiple times — existing demo items are not duplicated.

### Remove Demo Data
Deletes all demo items (identified by their accession number pattern) and removes any categories and locations that are now empty. Your own data is not affected.

---

## 15. Troubleshooting

### The app shows a blank white screen
The diagnostic log is at:
- **Linux:** `~/.config/museum-collection-manager/app.log`
- **Windows:** `%APPDATA%\museum-collection-manager\app.log`
- **macOS:** `~/Library/Application Support/museum-collection-manager/app.log`

Share the contents of that file when reporting an issue.

### I forgot my admin password
Ask another admin to reset it via **Admin → Users → Reset Password**.

If you are the only admin and cannot log in, restore the database from a backup that pre-dates the password change.

### An item won't delete
Check that the item is not referenced by other records. If the issue persists, note the accession number, check the audit log for recent changes, and restore from a backup if needed.

### Export CSV produces an empty file
Make sure there is at least one item in the collection. If filters are active on the Items page, clear them before exporting.

### Automatic backups are not appearing in my chosen folder
- Confirm the folder path is accessible and the app has write permission to it.
- The backup runs once per 24 hours. Check the folder the following day, or trigger a manual backup from Admin → Database to test the path.
- The app log will show any backup errors.

### How do I report a bug?
Open an issue at [github.com/TomAustin94/MuseumCollectionManagerDesktop/issues](https://github.com/TomAustin94/MuseumCollectionManagerDesktop/issues) and include:
- Your operating system and version
- The app version (visible in the window title or Help menu)
- The contents of `app.log`
- Steps to reproduce the problem
