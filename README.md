# Museum Collection Manager

A cross-platform desktop application for managing museum collections. Runs fully offline — no internet connection, cloud account, or web server required.

Built with Electron, React, TypeScript, and SQLite.

## Features

- **Item management** — full CRUD with accession numbers, images, provenance, condition ratings, and valuations
- **Full-text search** — SQLite FTS5 with LIKE-based fuzzy fallback
- **Categories & Locations** — hierarchical categories, multi-type locations (display, storage, loan, conservation)
- **Reports & Charts** — collection overview, location breakdown, acquisition timeline, condition summary
- **CSV export** — filtered exports via native save dialog
- **Local authentication** — bcrypt-hashed passwords, account lockout, TOTP MFA (optional per user)
- **Role-based access** — viewer / editor / admin roles
- **Audit log** — every write to items, categories, locations, and users is logged
- **Database backup/restore** — single-file SQLite backup via File menu, automatic daily backups
- **Auto-updater** — checks GitHub Releases on startup; background download, prompt to restart

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 30+ |
| UI | React 18 + Vite + TypeScript |
| Components | shadcn/ui + Tailwind CSS |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Auth | bcryptjs (cost 12) + keytar (OS keychain) |
| MFA | speakeasy TOTP + qrcode |
| Charts | Recharts |
| Tables | @tanstack/react-table |
| Export | csv-stringify |
| Packaging | electron-builder |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install & Run

```bash
npm install
npm run dev
```

On first launch a setup wizard will appear to create the initial admin account and optionally enrol TOTP MFA.

### Build for Distribution

```bash
# Current platform
npm run package

# Outputs to dist-electron/
# Windows  → MuseumApp-Setup-x.y.z.exe
# macOS    → MuseumApp-x.y.z.dmg
# Linux    → MuseumApp-x.y.z.AppImage / .deb / .rpm
```

## Data Storage

All data is stored locally. No data ever leaves the machine.

| OS | Location |
|---|---|
| Windows | `%APPDATA%\MuseumApp\collection.db` |
| macOS | `~/Library/Application Support/MuseumApp/collection.db` |
| Linux | `~/.config/MuseumApp/collection.db` |

Images are stored in `userData/images/`. Automatic daily backups are kept in `userData/backups/` (last 7 retained).

## Security

- `nodeIntegration: false` and `contextIsolation: true` in all BrowserWindows
- Renderer has zero direct Node.js access — all data flows through the preload `contextBridge`
- Every IPC handler validates input with Zod before touching the database
- Prepared statements only — no SQL string interpolation
- TOTP secrets encrypted at rest via Electron `safeStorage` (OS keychain-backed AES)
- Session tokens stored in the OS keychain via keytar
- Account lockout after 5 failed login attempts (15 minutes)
- Full audit log of all writes

## Project Structure

```
├── electron/           # Main process (Node.js)
│   ├── main.ts         # App entry, BrowserWindow, native menu
│   ├── preload.ts      # contextBridge API surface
│   ├── ipc/            # IPC handler modules
│   ├── db/             # SQLite client, schema, migrations
│   └── auth/           # Password, session, TOTP logic
├── src/                # Renderer process (React)
│   ├── pages/          # Route-level page components
│   ├── components/     # Shared UI components (shadcn/ui)
│   ├── hooks/          # Data-fetching hooks (window.api wrappers)
│   └── types/          # TypeScript declarations for window.api
└── electron-builder.config.cjs
```

## Admin Recovery

If the admin password is lost, run:

```bash
npx electron . --reset-admin
```

This prompts for a new admin password directly in the terminal.
