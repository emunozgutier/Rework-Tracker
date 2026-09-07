.dbconfig defensive off
BEGIN;
PRAGMA writable_schema = on;
PRAGMA foreign_keys = off;
PRAGMA encoding = 'UTF-8';
PRAGMA page_size = '4096';
PRAGMA auto_vacuum = '0';
PRAGMA user_version = '0';
PRAGMA application_id = '0';

CREATE TABLE pcb_tags (
    pcb_id INTEGER,
    tag_id INTEGER,
    PRIMARY KEY (pcb_id, tag_id),
    FOREIGN KEY (pcb_id) REFERENCES pcbs (id),
    FOREIGN KEY (tag_id) REFERENCES tags (id)
);

CREATE TABLE pcb_flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    revisions TEXT,
    boms TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE silicon_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    package_id INTEGER,
    name TEXT NOT NULL,
    silicon_corners TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE TABLE silicon_corners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    silicon_version_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (silicon_version_id) REFERENCES silicon_versions(id) ON DELETE CASCADE
);

CREATE TABLE board_formfactors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER,
    silicon_version_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
    FOREIGN KEY (silicon_version_id) REFERENCES silicon_versions(id) ON DELETE CASCADE
);

CREATE TABLE board_formfactor_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_formfactor_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_formfactor_id) REFERENCES board_formfactors(id) ON DELETE CASCADE
);

CREATE TABLE bom_flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formfactor_revision_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (formfactor_revision_id) REFERENCES board_formfactor_revisions(id) ON DELETE CASCADE
);

CREATE TABLE formfactor_revision_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formfactor_revision_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (formfactor_revision_id) REFERENCES board_formfactor_revisions(id) ON DELETE CASCADE
);

CREATE TABLE uploaded_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    project_id INTEGER,
    pcb_id INTEGER,
    doc_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT,
    path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type TEXT,
    uploaded_by TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE "reworks" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pcb_id INTEGER,
    title TEXT,
    rework_number INTEGER,
    description TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT "Completed",
    owner_id INTEGER,
    image_path TEXT,
    rework_type TEXT DEFAULT "Minor",
    FOREIGN KEY (pcb_id) REFERENCES pcbs (id),
    FOREIGN KEY (owner_id) REFERENCES owners (id)
);

CREATE UNIQUE INDEX idx_reworks_pcb_num ON reworks(pcb_id, rework_number);

PRAGMA writable_schema = off;
COMMIT;
