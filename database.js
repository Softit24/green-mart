const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const databasePath = path.join(__dirname, "bluemart.db");

async function openDatabase() {
  const SQL = await initSqlJs();

  let db;

  if (fs.existsSync(databasePath)) {
    const file = fs.readFileSync(databasePath);
    db = new SQL.Database(file);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      sponsor_id TEXT,
      placement TEXT CHECK (placement IN ('left', 'right')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sponsor_id) REFERENCES members(member_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recharge_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'redeemed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      redeemed_by TEXT,
      redeemed_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      member_id TEXT PRIMARY KEY,
      current_balance REAL NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
      transaction_balance REAL NOT NULL DEFAULT 0 CHECK (transaction_balance >= 0),
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(member_id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_member_id TEXT NOT NULL,
      to_member_id TEXT,
      transfer_type TEXT NOT NULL CHECK (transfer_type IN ("self", "other")),
      amount REAL NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT "pending",
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_member_id) REFERENCES members(member_id),
      FOREIGN KEY (to_member_id) REFERENCES members(member_id)
    )
  `);
  fs.writeFileSync(databasePath, Buffer.from(db.export()));

  return db;
}

module.exports = { openDatabase };
