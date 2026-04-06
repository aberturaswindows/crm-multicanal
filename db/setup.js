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
    ["messages", "story_url", "TEXT"]
  ];

  for (var i = 0; i < newColumns.length; i++) {
    try {
      db.exec("ALTER TABLE " + newColumns[i][0] + " ADD COLUMN " + newColumns[i][1] + " " + newColumns[i][2]);
    } catch (e) {
      // Column already exists
    }
  }

  console.log("Base de datos creada correctamente en:", DB_PATH);

  var contacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get();
  var agents = db.prepare("SELECT COUNT(*) as count FROM agents").get();
  var lines = db.prepare("SELECT COUNT(*) as count FROM phone_lines").get();

  console.log("   " + contacts.count + " contactos");
  console.log("   " + agents.count + " agentes");
  console.log("   " + lines.count + " lineas telefonicas");

  db.close();
}

if (require.main === module) {
  setup();
}

module.exports = { getDb: getDb, setup: setup };
