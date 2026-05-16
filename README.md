# Museum Collection Manager

A cross-platform desktop application for managing museum collections. Runs fully offline — no internet connection, cloud account, or web server required.

Built with Electron, React, TypeScript, and SQLite.

---

## Features

- **Item management** — full CRUD with accession numbers, images, provenance, condition ratings and valuations
- **Full-text search** — SQLite FTS5 with LIKE-based fuzzy fallback
- **Categories & Locations** — hierarchical categories, multi-type locations (gallery, storage, loan, conservation)
- **Reports & charts** — collection overview, location breakdown, acquisition timeline, condition summary
- **CSV export** — filtered exports via native save dialog
- **Local authentication** — bcrypt-hashed passwords, account lockout, TOTP MFA (optional per user)
- **Role-based access** — viewer / editor / admin roles
- **Audit log** — every write to items, categories, locations and users is logged with full before/after data
- **Configurable backup** — manual backup/restore, automatic daily backups to a custom folder (NAS, SharePoint, etc.)
- **Demo data** — one-click import of 27 sample collection items across 8 categories to explore the app
- **Auto-updater** — checks GitHub Releases on startup; downloads in the background and prompts to restart

---

## Download

Pre-built installers are published automatically to [GitHub Releases](https://github.com/TomAustin94/MuseumCollectionManagerDesktop/releases) on every push to `main`.

| Platform | Format |
|---|---|
| Windows | `.exe` (NSIS installer) or `.exe` (portable) |
| macOS | `.dmg` |
| Linux | `.AppImage` or `.deb` |

> **Linux `.deb` note:** Run `sudo dpkg -i museum-collection-manager_*.deb` then launch from your application menu or run `museum-collection-manager`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 30+ |
| UI | React 18 + Vite + TypeScript |
| Components | shadcn/ui + Tailwind CSS |
| Database | SQLite via better-sqlite3 |
| Auth | bcryptjs (cost 12) + Electron safeStorage |
| MFA | speakeasy TOTP + qrcode |
| Charts | Recharts |
| Tables | @tanstack/react-table |
| Export | csv-stringify |
| Packaging | electron-builder |

---

## Getting Started (Development)

### Prerequisites

- Node.js 20+
- npm 10+

### Install & Run

```bash
npm install
npm run dev
```

On first launch a setup wizard will create the initial admin account and optionally enrol TOTP MFA.

### Build for Distribution

```bash
npm run build
npx electron-builder --linux        # AppImage + deb
npx electron-builder --win          # NSIS + portable
npx electron-builder --mac          # dmg + zip
```

---

## Data Storage

All data is stored locally. Nothing ever leaves the machine.

| OS | Path |
|---|---|
| Windows | `%APPDATA%\museum-collection-manager\` |
| macOS | `~/Library/Application Support/museum-collection-manager/` |
| Linux | `~/.config/museum-collection-manager/` |

Key files:

| File | Purpose |
|---|---|
| `collection.db` | SQLite database (all collection data) |
| `backups/` | Automatic daily backups (last 7 kept) |
| `settings.json` | Application preferences (backup location, etc.) |
| `app.log` | Diagnostic log file |

The automatic backup folder can be changed in **Settings** to any path — including a NAS mount or a SharePoint-synced folder.

---

## Security

- `nodeIntegration: false` and `contextIsolation: true` enforced on all BrowserWindows
- Renderer has zero direct Node.js access — all data flows through the contextBridge preload API
- Every IPC handler validates input with Zod before touching the database
- Prepared statements only — no SQL string interpolation anywhere
- TOTP secrets encrypted at rest via Electron `safeStorage` (OS-backed AES)
- Session tokens stored in an encrypted file via `safeStorage` (no plaintext on disk)
- Account lockout after 5 failed login attempts (15-minute cooldown)
- Full audit log of all writes with before/after snapshots

---

## Project Structure

```
├── electron/                   # Main process (Node.js)
│   ├── main.ts                 # App entry, BrowserWindow, menu
│   ├── preload.ts              # contextBridge API surface
│   ├── logger.ts               # File-based diagnostic logger
│   ├── settings.ts             # Persistent JSON settings store
│   ├── ipc/                    # IPC handler modules
│   │   ├── auth.ts             # Login, MFA, session, setup
│   │   ├── items.ts            # Collection item CRUD + search
│   │   ├── categories.ts
│   │   ├── locations.ts
│   │   ├── reports.ts
│   │   ├── export.ts           # CSV export
│   │   ├── admin.ts            # User management, audit log, DB backup, demo data
│   │   └── settings.ts         # App preferences
│   ├── db/
│   │   ├── client.ts           # better-sqlite3 singleton
│   │   ├── schema.ts           # Table definitions + FTS5 + triggers
│   │   ├── migrate.ts
│   │   └── seed.ts             # Demo data
│   └── auth/                   # Password hashing, session, TOTP
├── src/                        # Renderer process (React)
│   ├── pages/                  # Route-level page components
│   ├── components/             # Shared UI (shadcn/ui wrappers, Sidebar, Layout)
│   └── types/                  # window.api TypeScript declarations
├── electron-builder.config.cjs
└── electron.vite.config.ts
```

---

## CI / Release Pipeline

Every push to `main` triggers a three-stage GitHub Actions workflow:

1. **version** — bumps the patch version (`npm version patch`) and pushes a `[skip ci]` tag commit
2. **build** — parallel matrix builds for Linux (AppImage + deb), Windows (NSIS + portable) and macOS (dmg + zip)
3. **publish** — marks the GitHub Release as public once all builds succeed

Releases stay as drafts if any platform build fails.
