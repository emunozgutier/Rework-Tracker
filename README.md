# PCB Rework Tracker

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Click%20Here-success?style=for-the-badge)](https://emunozgutier.github.io/Rework-Tracker/)

A full-stack tracking application designed to simplify the management of projects, Printed Circuit Boards (PCBs), and hardware rework histories.

Built with a **React + TypeScript + Vite** frontend against an **Express.js + SQLite** backend, designed entirely around a sleek, modern, dark-purple interface.

## 🚀 Features

- **Project Management:** Create projects with auto-generated 3-letter project keys (`e.g. MOD`).
- **PCB Tracking:** Add and assign individual PCBs specifically to projects.
- **Rework History:** Log detailed rework steps inside PCBs, complete with statuses, tags, dates, and ownership assignment.
- **Strict Database Integrity:** Built-in safeguards at the SQLite database level prevent users from deleting projects if they still contain active PCBs attached to them.
- **Dynamic Duplication Prevention:** The database physically prevents duplicate project keys, lowercase/uppercase clashes, or duplicate board numbers inside the exact same project!

## ⚙️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Zustand (for centralized Store management), Lucide React (for icons)
- **Backend:** Node.js, Express, `cors`
- **Database:** SQLite (`pcb_tracker.db`) running with enforced `PRAGMA foreign_keys = ON` and `COLLATE NOCASE` index scoping.
- **Testing:** Vitest & JSDOM (`start-server-and-test`)

---

## 🛠️ Getting Started

**1. Clone the repository**
```bash
git clone https://github.com/emunozgutier/Rework-Tracker.git
cd Rework-Tracker
```

**2. Install dependencies**
```bash
npm install
```

**3. Start the app**
```bash
npm run dev
```

*This starts two servers concurrently:*
1. **Express backend** → `http://localhost:5002`
2. **Vite frontend** → `http://localhost:5001` *(open this in your browser)*

---

## 🧪 Testing & Sandbox Environment

### 1. Isolated Sandbox Dev Server
Run a dedicated sandbox that uses an isolated database (`pcb_tracker_sandbox.db`) and sandbox upload folder (`sandbox_uploads/`) pre-seeded with demo data. Any testing or experimentation here will not affect your main data:
```bash
npm run dev:sandbox
```

### 2. Reset or Clean Test Data
- **Reset Sandbox:** Wipes the sandbox database and upload folder:
  ```bash
  npm run db:reset-sandbox
  ```
- **Purge Test Records:** Removes any test entities (`[TEST]`, `vitest`, `Test Project`) and test upload files from the active database:
  ```bash
  npm run db:clean-test
  ```
- **Re-Seed Demo Data:** Restores the database with standard demo data from `demoData.json`:
  ```bash
  npm run db:seed
  ```

### 3. Automated Vitest Suites
The application features a fully automated integration test suite that proves database constraints work flawlessly against an isolated test database:
```bash
npm run test:run        # Run test suite directly
npm run test            # Spins up backend on port 5002 and runs vitest
```

---

## 📦 Project Structure

```
src/                          # Frontend React logic, styles, and UI pages
src/store/                    # Zustand state files linking React to the backend
src/store/serverDataBase/
  ├── server.ts               # Express backend serving the REST API endpoints
  ├── db.ts                   # Database schema configuration and migration logic
  └── data/                   # SQLite database file
tests/                        # Vitest integration test files
```

---

## 📝 Attribution

The PCB parser in this application was adapted from the GitHub repository **board ripper** (which appears to have sourced its parsing logic from **KiCad**).
