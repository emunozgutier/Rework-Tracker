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

## 🛠️ Getting Started

First, install the necessary dependencies if you haven't already:
```bash
npm install
```

### Running the App (Development)

We've configured the project with the `concurrently` package, making it incredibly simple to run both your frontend UI and your backend database server together!

```bash
npm run dev
```
*This command opens two streams in one terminal:*
1. Starts the **Express backend server** on `http://localhost:5002`
2. Starts the **Vite frontend server** on `http://localhost:5173` (Open this in your browser)

## 🧪 Integration Testing

The application features a fully automated integration test suite that proves the database constraints (duplication prevention, foreign-key blocks, cascading teardowns) work flawlessly.

To run the tests:
```bash
npm run test
```
*This smart command uses `start-server-and-test` to automatically spin up a temporary ghost backend, wait for it to be ready, run all Vitest integration suites against the temporary database connections, and safely shut down the instance afterward!*

## 📦 Project Structure
- `src/` (Frontend React logic, Styles, and UI Pages)
- `src/store/` (Zustand state files linking React to the Backend)
- `server.js` (Express backend serving the REST API endpoints)
- `db.js` (Database schema configuration and migration logic)
- `tests/` (Vitest integration files)
