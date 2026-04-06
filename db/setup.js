const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_PATH = fs.existsSync("/data") ? "/data/crm.db" : path.join(__dirname, "..", "data", "crm.db");

function getDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function setup() {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  console.log("✅ Base de datos creada correctamente en:", DB_PATH);
  
  const contacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get();
  const agents = db.prepare("SELECT COUNT(*) as count FROM agents").get();
  const lines = db.prepare("SELECT COUNT(*) as count FROM phone_lines").get();
  
  console.log(`   📋 ${contacts.count} contactos`);
  console.log(`   👥 ${agents.count} agentes`);
  console.log(`   📞 ${lines.count} líneas telefónicas`);
  
  db.close();
}

if (require.main === module) {
  setup();
}

module.exports = { getDb, setup };
