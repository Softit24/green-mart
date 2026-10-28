const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const { openDatabase } = require("./database");
const fs = require("fs");
const crypto = require("crypto");
const sessions = new Map();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

let db;

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer ([a-f0-9]{64})$/);

  if (!match) {
    return res.status(401).json({ error: "Please log in first." });
  }

  const session = sessions.get(match[1]);

  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(match[1]);
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }

  req.memberId = session.memberId;
  next();
}



const adminSessions = new Map();

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer ([a-f0-9]{64})$/);
  if (!match) {
    return res.status(401).json({ error: "Admin login required." });
  }
  const session = adminSessions.get(match[1]);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) adminSessions.delete(match[1]);
    return res.status(401).json({ error: "Admin session expired. Please log in again." });
  }
  next();
}


const permissionFile = path.join(__dirname, "admin-permissions.json");
const permissionNames = ["binaryTeam", "rechargeCodes", "wallet", "commissions", "withdrawals", "reports", "members"];

function readPermissions() {
  const permissions = Object.fromEntries(permissionNames.map(name => [name, true]));
  if (!fs.existsSync(permissionFile)) return permissions;
  try {
    const saved = JSON.parse(fs.readFileSync(permissionFile, "utf8"));
    for (const name of permissionNames) {
      if (typeof saved[name] === "boolean") permissions[name] = saved[name];
    }
  } catch (error) {
    console.error("Could not read admin permissions:", error.message);
  }
  return permissions;
}

function requirePermission(name) {
  return (req, res, next) => {
    requireAdmin(req, res, () => {
      if (!readPermissions()[name]) {
        return res.status(403).json({ error: "Permission denied for this section." });
      }
      next();
    });
  };
}

app.get("/api/admin/permissions", requireAdmin, (req, res) => {
  res.json({ permissions: readPermissions() });
});

app.post("/api/admin/permissions", requireAdmin, (req, res) => {
  const submitted = req.body && req.body.permissions;
  if (!submitted || typeof submitted !== "object" || Array.isArray(submitted) ||
      permissionNames.some(name => typeof submitted[name] !== "boolean")) {
    return res.status(400).json({ error: "Provide true or false for every permission." });
  }
  try {
    const permissions = Object.fromEntries(permissionNames.map(name => [name, submitted[name]]));
    fs.writeFileSync(permissionFile, JSON.stringify(permissions, null, 2), { mode: 0o600 });
    res.json({ message: "Permissions saved.", permissions });
  } catch (error) {
    console.error("Could not save permissions:", error.message);
    res.status(500).json({ error: "Could not save permissions." });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body || {};
    if (typeof password !== "string" || !password || password.length > 72) {
      return res.status(400).json({ error: "Enter your admin password." });
    }
    const passwordFile = path.join(__dirname, "admin-password.json");
    if (!fs.existsSync(passwordFile)) {
      return res.status(500).json({ error: "Admin login is not configured." });
    }
    const adminConfig = JSON.parse(fs.readFileSync(passwordFile, "utf8"));
    if (typeof adminConfig.hash !== "string" ||
        !(await bcrypt.compare(password, adminConfig.hash))) {
      return res.status(401).json({ error: "Invalid admin password." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    adminSessions.set(token, { expiresAt: Date.now() + 60 * 60 * 1000 });
    return res.json({ message: "Admin login successful.", token, expires_in: 3600 });
  } catch (error) {
    console.error("Admin login error:", error.message);
    return res.status(500).json({ error: "Admin login failed." });
  }
});

function saveDatabase() {
  fs.writeFileSync(
    path.join(__dirname, "bluemart.db"),
    Buffer.from(db.export())
  );
}

app.get("/api/status", (req, res) => {
  try {
    const result = db.exec("SELECT COUNT(*) FROM members");
    const members = result.length ? result[0].values[0][0] : 0;

    res.json({
      name: "BlueMart MLM",
      status: "running",
      members,
      wallet: 0,
      transactions: 0
    });
  } catch (error) {
    res.status(500).json({ error: "Could not load dashboard status" });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, phone, password, sponsor_id, placement } = req.body;

    if (
      typeof name !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !/^[0-9+ -]{7,20}$/.test(phone.trim()) ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        error: "Enter a name, valid phone number, and password of 8–72 characters."
      });
    }

    if (!["left", "right"].includes(placement)) {
      return res.status(400).json({
        error: "Placement must be left or right."
      });
    }

    const sponsor = typeof sponsor_id === "string" ? sponsor_id.trim() : "";

    if (sponsor) {
      const found = db.exec(
        "SELECT member_id FROM members WHERE member_id = ?",
        [sponsor]
      );

      if (!found.length || !found[0].values.length) {
        return res.status(400).json({ error: "Sponsor ID was not found." });
      }

      const occupied = db.exec(
        "SELECT id FROM members WHERE sponsor_id = ? AND placement = ?",
        [sponsor, placement]
      );

      if (occupied.length && occupied[0].values.length) {
        return res.status(409).json({
          error: "That sponsor's selected position is already occupied."
        });
      }
    }

    const existing = db.exec(
      "SELECT id FROM members WHERE phone = ?",
      [phone.trim()]
    );

    if (existing.length && existing[0].values.length) {
      return res.status(409).json({
        error: "This phone number is already registered."
      });
    }

    const memberId = "BM" + Date.now().toString(36).toUpperCase();
    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO members
       (member_id, name, phone, password_hash, sponsor_id, placement)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        name.trim(),
        phone.trim(),
        passwordHash,
        sponsor || null,
        placement
      ]
    );

    saveDatabase();

    const savedMember = db.exec(
      "SELECT created_at FROM members WHERE member_id = ?",
      [memberId]
    );
    const createdAt = savedMember[0]?.values[0]?.[0] ?? null;

    res.status(201).json({
      message: "Member registered successfully.",
      member: {
        member_id: memberId,
        name: name.trim(),
        sponsor_id: sponsor || null,
        placement,
        created_at: createdAt
      }
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({ error: "Registration failed." });
  }
});



app.post("/api/login", async (req, res) => {
  try {
    const { member_id, password } = req.body || {};

    if (
      typeof member_id !== "string" ||
      typeof password !== "string" ||
      !member_id.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Enter your member ID and password."
      });
    }

    const result = db.exec(
      "SELECT member_id, name, password_hash FROM members WHERE member_id = ?",
      [member_id.trim()]
    );

    if (!result.length || !result[0].values.length) {
      return res.status(401).json({
        error: "Invalid member ID or password."
      });
    }

    const [id, name, passwordHash] = result[0].values[0];
    const valid = await bcrypt.compare(password, passwordHash);

    if (!valid) {
      return res.status(401).json({
        error: "Invalid member ID or password."
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, {
      memberId: id,
      expiresAt: Date.now() + 60 * 60 * 1000
    });

    res.json({
      message: "Login successful.",
      token,
      expires_in: 3600,
      member: { member_id: id, name }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/recharge-codes", requirePermission("rechargeCodes"), (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const quantity = Number(req.body.quantity ?? 1);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({
        error: "Enter a positive amount and a quantity from 1 to 100."
      });
    }

    const generated = [];
    for (let i = 0; i < quantity; i++) {
      let code;
      let exists;
      do {
        code = "EF" + require("crypto").randomBytes(8).toString("hex").toUpperCase();
        exists = db.exec("SELECT id FROM recharge_codes WHERE code = ?", [code]);
      } while (exists.length && exists[0].values.length);

      db.run(
        "INSERT INTO recharge_codes (code, amount) VALUES (?, ?)",
        [code, amount]
      );
      generated.push({ code, amount, status: "unused" });
    }

    saveDatabase();
    res.status(201).json({ message: "Recharge codes created.", codes: generated });
  } catch (error) {
    console.error("Recharge code creation error:", error.message);
    res.status(500).json({ error: "Could not create recharge codes." });
  }
});

app.get("/api/recharge-codes", requirePermission("rechargeCodes"), (req, res) => {
  try {
    const result = db.exec(
      "SELECT code, amount, status, created_at, redeemed_by, redeemed_at FROM recharge_codes ORDER BY id DESC"
    );
    const codes = result.length
      ? result[0].values.map(row => ({
          code: row[0],
          amount: row[1],
          status: row[2],
          created_at: row[3],
          redeemed_by: row[4],
          redeemed_at: row[5]
        }))
      : [];
    res.json({ codes });
  } catch (error) {
    console.error("Recharge code list error:", error.message);
    res.status(500).json({ error: "Could not load recharge codes." });
  }
});

app.get("/api/binary-team", requirePermission("binaryTeam"), (req, res) => {
  try {
    const result = db.exec(`
      SELECT member_id, name, sponsor_id, placement, created_at
      FROM members
      ORDER BY id ASC
    `);
    const members = result.length
      ? result[0].values.map(row => ({
          member_id: row[0],
          name: row[1],
          sponsor_id: row[2],
          placement: row[3],
          created_at: row[4]
        }))
      : [];
    res.json({ members });
  } catch (error) {
    console.error("Binary Team error:", error.message);
    res.status(500).json({ error: "Could not load Binary Team." });
  }
});


app.get("/api/admin/members", requirePermission("members"), (req, res) => {
  try {
    const result = db.exec(`
      SELECT member_id, name, phone, sponsor_id, placement, created_at
      FROM members
      ORDER BY id ASC
    `);
    const members = result.length
      ? result[0].values.map(row => ({
          member_id: row[0],
          name: row[1],
          phone: row[2],
          sponsor_id: row[3],
          placement: row[4],
          created_at: row[5]
        }))
      : [];
    res.json({ members });
  } catch (error) {
    console.error("Admin member list error:", error.message);
    res.status(500).json({ error: "Could not load members." });
  }
});


app.patch("/api/admin/members/:memberId", requirePermission("members"), (req, res) => {
  try {
    const memberId = req.params.memberId;
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!name || name.length > 100 || !phone || phone.length > 30) {
      return res.status(400).json({ error: "Enter a valid name and phone number." });
    }

    const existing = db.exec(
      "SELECT member_id FROM members WHERE member_id = ?",
      [memberId]
    );
    if (!existing.length || existing[0].values.length === 0) {
      return res.status(404).json({ error: "Member not found." });
    }

    const duplicate = db.exec(
      "SELECT member_id FROM members WHERE phone = ? AND member_id <> ?",
      [phone, memberId]
    );
    if (duplicate.length && duplicate[0].values.length) {
      return res.status(409).json({ error: "That phone number belongs to another member." });
    }

    db.run(
      "UPDATE members SET name = ?, phone = ? WHERE member_id = ?",
      [name, phone, memberId]
    );
    saveDatabase();

    res.json({ message: "Member updated successfully." });
  } catch (error) {
    console.error("Admin member edit error:", error.message);
    res.status(500).json({ error: "Could not update member." });
  }
});


app.delete("/api/admin/members/:memberId", requirePermission("members"), (req, res) => {
  try {
    const memberId = req.params.memberId;
    const found = db.exec(
      "SELECT member_id FROM members WHERE member_id = ?",
      [memberId]
    );

    if (!found.length || found[0].values.length === 0) {
      return res.status(404).json({ error: "Member not found." });
    }

    const checks = [
      ["SELECT COUNT(*) FROM members WHERE sponsor_id = ?", [memberId], "This member sponsors other members."],
      ["SELECT COUNT(*) FROM wallet_accounts WHERE member_id = ?", [memberId], "This member has a wallet account."],
      ["SELECT COUNT(*) FROM wallet_transactions WHERE from_member_id = ? OR to_member_id = ?", [memberId, memberId], "This member has transaction history."],
      ["SELECT COUNT(*) FROM member_pins WHERE member_id = ?", [memberId], "This member has a PIN record."]
    ];

    for (const [sql, params, reason] of checks) {
      const result = db.exec(sql, params);
      if (result.length && Number(result[0].values[0][0]) > 0) {
        return res.status(409).json({
          error: "Deletion blocked. " + reason
        });
      }
    }

    db.run("DELETE FROM members WHERE member_id = ?", [memberId]);
    saveDatabase();
    return res.json({ message: "Member deleted successfully." });
  } catch (error) {
    console.error("Admin member delete error:", error.message);
    return res.status(500).json({ error: "Could not delete member." });
  }
});

async function startServer() {
  db = await openDatabase();
  db.run(`CREATE TABLE IF NOT EXISTS member_pins (
    member_id TEXT PRIMARY KEY,
    pin_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(member_id)
  )`);
  saveDatabase();

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`BlueMart MLM running at http://127.0.0.1:${PORT}`);
    console.log("Database connected successfully");
    console.log("Member registration API ready");
  });
}

startServer().catch(error => {
  console.error("Could not start server:", error.message);
});
