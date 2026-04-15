var Database = require("better-sqlite3");
var fs = require("fs");
var path = require("path");
var DB_PATH = fs.existsSync("/data") ? "/data/crm.db" : path.join(__dirname, "..", "data", "crm.db");
function getDb() {
  var dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  var db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
function setup() {
  var db = getDb();
  var schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  var newColumns = [
    ["messages", "media_type", "TEXT"],
    ["messages", "media_url", "TEXT"],
    ["messages", "story_url", "TEXT"],
    ["contacts", "conversation_stage", "TEXT DEFAULT 'consulta'"],
    ["contacts", "quote_sent_at", "TEXT"],
    ["contacts", "followup_count", "INTEGER DEFAULT 0"],
    ["contacts", "last_followup_at", "TEXT"],
    ["contacts", "lost_reason", "TEXT"]
  ];
  for (var i = 0; i < newColumns.length; i++) {
    try {
      db.exec("ALTER TABLE " + newColumns[i][0] + " ADD COLUMN " + newColumns[i][1] + " " + newColumns[i][2]);
    } catch (e) {}
  }
  db.exec("CREATE TABLE IF NOT EXISTS auto_reply_settings (channel TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0)");
  var channels = ["whatsapp", "instagram", "facebook", "email"];
  for (var j = 0; j < channels.length; j++) {
    try {
      db.exec("INSERT OR IGNORE INTO auto_reply_settings (channel, enabled) VALUES ('" + channels[j] + "', 0)");
    } catch (e) {}
  }
  db.exec("CREATE TABLE IF NOT EXISTS quotes (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "contact_id INTEGER NOT NULL, " +
    "description TEXT DEFAULT '', " +
    "amount REAL DEFAULT 0, " +
    "alternatives INTEGER DEFAULT 1, " +
    "status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','enviado','aprobado','rechazado','vencido')), " +
    "created_by TEXT NOT NULL DEFAULT 'Sin asignar', " +
    "channel TEXT DEFAULT '', " +
    "received_at TEXT, " +
    "delivery_date TEXT, " +
    "followup_date TEXT, " +
    "notes TEXT DEFAULT '', " +
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "FOREIGN KEY (contact_id) REFERENCES contacts(id)" +
  ")");
  try { db.exec("ALTER TABLE quotes ADD COLUMN alternatives INTEGER DEFAULT 1"); } catch (e) {}
  db.exec("CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_quotes_followup ON quotes(followup_date)");
  db.exec("CREATE TABLE IF NOT EXISTS reminders (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "contact_id INTEGER NOT NULL, " +
    "reminder_at TEXT NOT NULL, " +
    "note TEXT DEFAULT '', " +
    "is_completed INTEGER DEFAULT 0, " +
    "created_by TEXT NOT NULL, " +
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "FOREIGN KEY (contact_id) REFERENCES contacts(id)" +
  ")");
  db.exec("CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_reminders_contact ON reminders(contact_id)");
  console.log("Base de datos creada correctamente en:", DB_PATH);
  var contacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get();
  var agents = db.prepare("SELECT COUNT(*) as count FROM agents").get();
  var lines = db.prepare("SELECT COUNT(*) as count FROM phone_lines").get();
  var quotes = db.prepare("SELECT COUNT(*) as count FROM quotes").get();
  var reminders = db.prepare("SELECT COUNT(*) as count FROM reminders WHERE is_completed = 0").get();
  console.log("   " + contacts.count + " contactos");
  console.log("   " + agents.count + " agentes");
  console.log("   " + lines.count + " lineas telefonicas");
  console.log("   " + quotes.count + " presupuestos");
  console.log("   " + reminders.count + " recordatorios pendientes");
  db.close();
}
if (require.main === module) {
  setup();
}
module.exports = { getDb: getDb, setup: setup };
