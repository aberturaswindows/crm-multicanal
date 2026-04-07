-- NexoCRM - Esquema de Base de Datos
-- SQLite3

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp','instagram','facebook','email','telefono')),
  channel_id TEXT,
  phone_line INTEGER CHECK(phone_line IN (1,2,3)),
  department TEXT NOT NULL DEFAULT 'ventas' CHECK(department IN ('ventas','soporte','admin','reclamos')),
  status TEXT NOT NULL DEFAULT 'lead' CHECK(status IN ('lead','cliente','cerrado')),
  ai_confidence TEXT DEFAULT 'pending',
  assigned_agent TEXT,
  notes TEXT DEFAULT '',
  origin TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
  content TEXT NOT NULL,
  channel TEXT NOT NULL,
  channel_message_id TEXT,
  agent_name TEXT,
  is_ai_suggestion INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE IF NOT EXISTS routing_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  from_department TEXT,
  to_department TEXT NOT NULL,
  reason TEXT,
  confidence TEXT,
  routed_by TEXT DEFAULT 'ai',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT NOT NULL CHECK(department IN ('ventas','soporte','admin','reclamos')),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phone_lines (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  number TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Datos iniciales: Líneas telefónicas
INSERT OR IGNORE INTO phone_lines (id, label, number) VALUES 
  (1, 'Línea 1 – Ventas', '+54 11 4567-0001'),
  (2, 'Línea 2 – Soporte', '+54 11 4567-0002'),
  (3, 'Línea 3 – General', '+54 11 4567-0003');

-- Datos iniciales: Agentes
INSERT OR IGNORE INTO agents (name, department) VALUES 
  ('Carlos M.', 'ventas'),
  ('Ana R.', 'ventas'),
  ('Diego L.', 'soporte'),
  ('Sofía P.', 'soporte'),
  ('Laura G.', 'admin'),
  ('Mariana T.', 'reclamos'),
  ('Pablo F.', 'reclamos');

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_department ON contacts(department);
CREATE INDEX IF NOT EXISTS idx_contacts_channel ON contacts(channel);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
-- Tabla de usuarios del CRM
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK(role IN ('admin','agent')),
  department TEXT CHECK(department IN ('ventas','soporte','admin','reclamos')),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios iniciales
INSERT OR IGNORE INTO users (username, password, name, role, department) VALUES
  ('federico', 'windows2026', 'Federico Soriano', 'admin', NULL),
  ('juanmanuel', 'windows2026', 'Juan Manuel Soriano', 'admin', NULL),
  ('manuel', 'windows2026', 'Manuel Soriano', 'admin', NULL),
  ('camila', 'windows2026', 'Camila Soriano', 'admin', NULL),
  ('gonzalo', 'windows2026', 'Gonzalo Bertaina', 'agent', 'soporte'),
  ('anabel', 'windows2026', 'Anabel Rios', 'agent', 'soporte'),
  ('julia', 'windows2026', 'Julia Cejas', 'agent', 'admin'),
  ('soledad', 'windows2026', 'Soledad Galindo', 'agent', 'ventas');
