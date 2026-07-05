const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'src/store/database/pcb_tracker.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM pcbs", [], (err, rows) => {
    if (err) {
        console.error("Error reading pcbs:", err);
    } else {
        console.log("Current PCBs in DB:");
        console.log(rows);
    }
    db.close();
});
