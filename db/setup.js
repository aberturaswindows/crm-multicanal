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
    ["contacts", "lost_reason", "TEXT"],
    ["contacts", "ai_paused", "INTEGER DEFAULT 0"],
    ["contacts", "is_unread", "INTEGER DEFAULT 0"],
    ["messages", "original_filename", "TEXT"],
    ["messages", "status", "TEXT DEFAULT 'pending'"],
    ["messages", "sent_at", "TIMESTAMP"],
    ["messages", "delivered_at", "TIMESTAMP"],
    ["messages", "read_at", "TIMESTAMP"],
    ["messages", "failed_reason", "TEXT"],
    ["contacts", "profile_picture_url", "TEXT"],
    ["contacts", "profile_picture_updated_at", "TIMESTAMP"]
  ];
  for (var i = 0; i < newColumns.length; i++) {
    try {
      db.exec("ALTER TABLE " + newColumns[i][0] + " ADD COLUMN " + newColumns[i][1] + " " + newColumns[i][2]);
    } catch (e) {}
  }

  // Backfill de status para mensajes existentes (idempotente)
  try {
    db.exec("UPDATE messages SET status='read' WHERE direction='incoming' AND status IS NULL");
    db.exec("UPDATE messages SET status='sent', sent_at=created_at WHERE direction='outgoing' AND status IS NULL");
    db.exec("UPDATE messages SET status='read' WHERE direction='system' AND status IS NULL");
    db.exec("UPDATE messages SET status='sent' WHERE status IS NULL");
    db.exec("CREATE INDEX IF NOT EXISTS idx_messages_channel_msg_id ON messages(channel_message_id)");
  } catch (e) {}

  // Migracion: permitir direction='system' en la tabla messages
  // SQLite no permite modificar CHECK constraints con ALTER TABLE, asi que hay que recrear la tabla.
  // Esta migracion solo se ejecuta si la tabla vieja NO permite 'system'.
  try {
    var canInsertSystem = false;
    try {
      var tableDdl = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
      canInsertSystem = !!(tableDdl && tableDdl.sql && tableDdl.sql.indexOf("'system'") !== -1);
    } catch (e) {
      canInsertSystem = false;
    }

    if (!canInsertSystem) {
      console.log("[MIGRACION] Recreando tabla messages para permitir direction='system'...");
      db.exec("BEGIN");
      // 1. Leer columnas actuales dinamicamente — preserva cualquier columna futura
      var cols = db.prepare("PRAGMA table_info(messages)").all();
      var colNames = cols.map(function(c){ return c.name; });
      var hasAutoincrement = !!(tableDdl && tableDdl.sql && /\bAUTOINCREMENT\b/i.test(tableDdl.sql));

      // 2. Construir definiciones de columnas, parchando solo el CHECK de direction
      var colDefs = cols.map(function(c){
        var parts = [c.name, c.type || "TEXT"];
        if (c.pk) {
          parts.push(hasAutoincrement ? "PRIMARY KEY AUTOINCREMENT" : "PRIMARY KEY");
        } else {
          if (c.notnull) parts.push("NOT NULL");
          if (c.dflt_value !== null) parts.push("DEFAULT " + c.dflt_value);
        }
        if (c.name === "direction") {
          parts.push("CHECK(direction IN ('incoming','outgoing','system'))");
        }
        return parts.join(" ");
      });

      // 3. Recrear tabla con CHECK ampliado y todas las columnas existentes
      var createNew = "CREATE TABLE messages_new (" + colDefs.join(", ") + ", FOREIGN KEY (contact_id) REFERENCES contacts(id))";
      db.exec(createNew);

      // 4. Copiar todos los datos con todas las columnas actuales
      db.exec("INSERT INTO messages_new (" + colNames.join(", ") + ") SELECT " + colNames.join(", ") + " FROM messages");

      // 5. Reemplazar tabla
      db.exec("DROP TABLE messages");
      db.exec("ALTER TABLE messages_new RENAME TO messages");

      // 6. Recrear indices
      db.exec("CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)");

      db.exec("COMMIT");
      console.log("[MIGRACION] Tabla messages recreada con soporte para direction='system'");
    }
  } catch (migErr) {
    try { db.exec("ROLLBACK"); } catch(e) {}
    console.error("[MIGRACION] Error migrando messages table:", migErr.message);
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
  db.exec("CREATE TABLE IF NOT EXISTS cotizaciones_datos (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "contact_id INTEGER NOT NULL, " +
    "nombre TEXT, " +
    "telefono TEXT, " +
    "instalacion INTEGER DEFAULT 0, " +
    "direccion TEXT, " +
    "tiene_plano INTEGER DEFAULT 0, " +
    "color TEXT, " +
    "vidrio TEXT, " +
    "notas TEXT, " +
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "FOREIGN KEY (contact_id) REFERENCES contacts(id)" +
  ")");
  db.exec("CREATE TABLE IF NOT EXISTS cotizaciones_aberturas (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "cotizacion_datos_id INTEGER NOT NULL, " +
    "contact_id INTEGER NOT NULL, " +
    "tipo TEXT, " +
    "ancho_cm INTEGER, " +
    "alto_cm INTEGER, " +
    "cantidad INTEGER DEFAULT 1, " +
    "descripcion TEXT, " +
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "FOREIGN KEY (cotizacion_datos_id) REFERENCES cotizaciones_datos(id), " +
    "FOREIGN KEY (contact_id) REFERENCES contacts(id)" +
  ")");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cotizaciones_datos_contact ON cotizaciones_datos(contact_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cotizaciones_aberturas_datos ON cotizaciones_aberturas(cotizacion_datos_id)");
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

