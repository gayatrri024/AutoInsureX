const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');

const dbFile = './autoinsurex.db';
const db = new sqlite3.Database(dbFile);

function initDb() {
  db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Vehicles Table
    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      registration_number TEXT NOT NULL,
      type TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 3. Policies Catalog Table (Now with vehicle_type)
    db.run(`CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      vehicle_type TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      annual_premium INTEGER NOT NULL,
      coverage_amount INTEGER NOT NULL,
   
   
      duration_months INTEGER NOT NULL,
      rating REAL NOT NULL,
      highlights TEXT NOT NULL
    )`);

    // 4. Purchases / Policy Details Table
    db.run(`CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      policy_id TEXT NOT NULL,
      vehicle_id INTEGER NOT NULL,
      amount_paid INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING_VERIFICATION',
      purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      video_path TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(policy_id) REFERENCES policies(id),
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
    )`);

    // Insert Default Admin
    db.get("SELECT * FROM users WHERE role = 'admin'", async (err, row) => {
      if (!row) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run("INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
          ["Admin Manager", "admin@autoinsurex.com", "0000000000", hashedPassword, "admin"]
        );
        console.log("Default admin created.");
      }
    });

    // Insert Dummy Policies if not exist
    db.get("SELECT count(*) as count FROM policies", (err, row) => {
      if (row.count === 0) {
        const stmt = db.prepare("INSERT INTO policies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // 3 Policies for Two Wheeler
        // 3 Policies for Four Wheeler
        const defaultPolicies = [
          ['PL_2W_1', 'Two Wheeler', 'HDFC ERGO', 'Bike Comprehensive Shield', 'Comprehensive', 1450, 45000, 12, 4.8, 'Zero Depreciation,24x7 Roadside Assistance,Cashless at Garages'],
          ['PL_2W_2', 'Two Wheeler', 'ICICI Lombard', 'Third Party Plus Bike', 'Third Party', 750, 100000, 12, 4.2, 'Legal Liability Cover,Personal Accident Cover (15L),Quick Claim Settlement'],
          ['PL_2W_3', 'Two Wheeler', 'Digit Insurance', 'Super Saver Scooter', 'Comprehensive', 1100, 35000, 12, 4.4, 'Smartphone Self-Inspection,Zero Deductible,Quick Online Claims'],
          
          ['PL_4W_1', 'Four Wheeler', 'Bajaj Allianz', 'Car Drive Smart', 'Comprehensive', 12500, 500000, 12, 4.5, 'Engine Protector,Consumables Cover,Quick Doorstep Survey'],
          ['PL_4W_2', 'Four Wheeler', 'Acko General', 'Basic Protect Auto', 'Third Party', 3200, 750000, 12, 4.0, 'Zero Paperwork,Instant Policy,Affordable Premium'],
          ['PL_4W_3', 'Four Wheeler', 'TATA AIG', 'Car Auto Secure', 'Comprehensive', 15200, 600000, 12, 4.7, 'Return to Invoice,Key Replacement,Loss of Personal Belongings']
        ];
        
        defaultPolicies.forEach(p => {
          stmt.run(p);
        });
        stmt.finalize();
        console.log("Dummy policies inserted with dynamic vehicle types.");
      }
    });
  });
}

module.exports = { db, initDb };
