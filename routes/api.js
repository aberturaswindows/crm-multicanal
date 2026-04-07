var express = require("express");
var router = express.Router();
var getDb = require("../db/setup").getDb;
var generateSuggestion = require("../services/ai-router").generateSuggestion;
var classifyMessage = require("../services/ai-router").classifyMessage;
var whatsapp = require("../services/channels/whatsapp");
var instagram = require("../services/channels/instagram");
var facebook = require("../services/channels/facebook");
var emailService = require("../services/channels/email");

router.post("/login", function(req, res) {
  var db = getDb();
  var username = req.body.username;
  var password = req.body.password;
  if (!username || !password) return res.status(400).json({ error: "Usuario y contrasena requeridos" });
  var user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ? AND is_active = 1").get(username, password);
  if (!user) return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, department: user.department });
});

router.get("/users", function(req, res) {
  var db = getDb();
  var users = db.prepare("SELECT id, username, name, role, department, is_active, created_at FROM users ORDER BY role, name").all();
  res.json(users);
});

router.post("/users", function(req, res) {
  var db = getDb();
  var username = req.body.username;
  var password = req.body.password;
  var name = req.body.name;
  var role = req.body.role || "agent";
  var department = req.body.department || "ventas";
  if (!username || !password || !name) return res.status(400).json({ error: "Username, contrasena y nombre son requeridos" });
  var existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return res.status(409).json({ error: "Ese nombre de usuario ya existe" });
  var result = db.prepare("INSERT INTO users (username, password, name, role, department, is_active) VALUES (?, ?, ?, ?, ?, 1)").run(username, password, name, role, department);
  var user = db.prepare("SELECT id, username, name, role, department, is_active, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.json(user);
});

router.put("/users/:id", function(req, res) {
  var db = getDb();
  var updates = [];
  var values = [];
  if (req.body.password) { updates.push("password = ?"); values.push(req.body.password); }
  if (req.body.name) { updates.push("name = ?"); values.push(req.body.name); }
  if (req.body.role) { updates.push("role = ?"); values.push(req.body.role); }
  if (req.body.department !== undefined) { updates.push("department = ?"); values.push(req.body.department); }
  if (req.body.is_active !== undefined) { updates.push("is_active = ?"); values.push(req.body.is_active); }
  if (updates.length === 0) return res.status(400).json({ error: "Nada que actualizar" });
  values.push(req.params.id);
  db.prepare("UPDATE users SET " + updates.join(", ") + " WHERE id = ?").run(values);
  var updated = db.prepare("SELECT id, username, name, role, department, is_active FROM users WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.get("/contacts", function(req, res) {
  var db = getDb();
  var channel = req.query.channel;
  var department = req.query.department;
  var status = req.query.status;
  var query = "SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.contact_id = c.id AND m.direction = 'incoming' AND m.created_at > COALESCE((SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.contact_id = c.id AND m2.direction = 'outgoing'), '1970-01-01')) as unread, (SELECT content FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message, (SELECT created_at FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at FROM contacts c WHERE 1=1";
  var params = [];
  if (channel && channel !== "all") { query += " AND c.channel = ?"; params.push(channel); }
  if (department && department !== "all") { query += " AND c.department = ?"; params.push(department); }
  if (status && status !== "all") { query += " AND c.status = ?"; params.push(status); }
  query += " ORDER BY last_message_at DESC NULLS LAST";
  var stmt = db.prepare(query);
  var contacts = params.length > 0 ? stmt.all.apply(stmt, params) : stmt.all();
  res.json(contacts);
});

router.get("/contacts/:id", function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  res.json(contact);
});

router.put("/contacts/:id", function(req, res) {
  var db = getDb();
  var updates = [];
  var values = [];
  if (req.body.name !== undefined) { updates.push("name = ?"); values.push(req.body.name); }
  if (req.body.email !== undefined) { updates.push("email = ?"); values.push(req.body.email); }
  if (req.body.phone !== undefined) { updates.push("phone = ?"); values.push(req.body.phone); }
  if (req.body.department !== undefined) { updates.push("department = ?"); values.push(req.body.department); }
  if (req.body.status !== undefined) { updates.push("status = ?"); values.push(req.body.status); }
  if (req.body.notes !== undefined) { updates.push("notes = ?"); values.push(req.body.notes); }
  if (req.body.assigned_agent !== undefined) { updates.push("assigned_agent = ?"); values.push(req.body.assigned_agent); }
  if (updates.length === 0) return res.status(400).json({ error: "Nada que actualizar" });
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(req.params.id);
  db.prepare("UPDATE contacts SET " + updates.join(", ") + " WHERE id = ?").run(values);
  if (req.body.department !== undefined) {
    db.prepare("INSERT INTO routing_log (contact_id, from_department, to_department, reason, routed_by) VALUES (?, ?, ?, ?, 'manual')").run(req.params.id, req.body._old_department || "unknown", req.body.department, "Reasignacion manual");
  }
  var updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.get("/contacts/:id/messages", function(req, res) {
  var db = getDb();
  var messages = db.prepare("SELECT * FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(req.params.id);
  res.json(messages);
});

router.post("/contacts/:id/messages", async function(req, res) {
  var db = getDb();
  var content = req.body.content;
  var agent_name = req.body.agent_name;
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  if (!content || !content.trim()) return res.status(400).json({ error: "Mensaje vacio" });
  var result = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name) VALUES (?, 'outgoing', ?, ?, ?)").run(contact.id, content.trim(), contact.channel, agent_name || "Agente");
  var sendResult = { success: true, simulated: true };
  if (contact.channel === "whatsapp") {
    sendResult = await whatsapp.sendMessage(contact.channel_id, content.trim(), contact.phone_line || 1);
  } else if (contact.channel === "instagram") {
    sendResult = await instagram.sendMessage(contact.channel_id, content.trim());
  } else if (contact.channel === "facebook") {
    sendResult = await facebook.sendMessage(contact.channel_id, content.trim());
  } else if (contact.channel === "email") {
    sendResult = await emailService.sendMessage(contact.email, "Re: Consulta", content.trim());
  }
  var message = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
  res.json({ message: message, sendResult: sendResult });
});

router.get("/contacts/:id/suggestion", async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  var messages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(req.params.id);
  var suggestion = await generateSuggestion(contact, messages);
  res.json({ suggestion: suggestion });
});

router.post("/contacts/:id/reclassify", async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  var messages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(req.params.id);
  var allText = messages.filter(function(m) { return m.direction === "incoming"; }).map(function(m) { return m.content; }).join(" ");
  var classification = await classifyMessage(allText, messages);
  db.prepare("UPDATE contacts SET department = ?, ai_confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(classification.department, classification.confidence, contact.id);
  db.prepare("INSERT INTO routing_log (contact_id, from_department, to_department, reason, confidence) VALUES (?, ?, ?, ?, ?)").run(contact.id, contact.department, classification.department, classification.reason, classification.confidence);
  res.json({ classification: classification, contact: db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id) });
});

router.get("/agents", function(req, res) {
  var db = getDb();
  var agents = db.prepare("SELECT * FROM agents WHERE is_active = 1 ORDER BY department, name").all();
  res.json(agents);
});

router.get("/phone-lines", function(req, res) {
  var db = getDb();
  var lines = db.prepare("SELECT * FROM phone_lines").all();
  res.json(lines);
});

router.get("/routing-log", function(req, res) {
  var db = getDb();
  var logs = db.prepare("SELECT r.*, c.name as contact_name FROM routing_log r JOIN contacts c ON r.contact_id = c.id ORDER BY r.created_at DESC LIMIT 50").all();
  res.json(logs);
});

router.get("/metrics", function(req, res) {
  var db = getDb();
  var totalMessages = db.prepare("SELECT COUNT(*) as count FROM messages").get().count;
  var totalContacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get().count;
  var totalConversations = db.prepare("SELECT COUNT(DISTINCT contact_id) as count FROM messages").get().count;
  var byChannel = db.prepare("SELECT channel, COUNT(*) as count FROM messages GROUP BY channel ORDER BY count DESC").all();
  var byDepartment = db.prepare("SELECT department, COUNT(*) as count FROM contacts GROUP BY department ORDER BY count DESC").all();
  var byStatus = db.prepare("SELECT status, COUNT(*) as count FROM contacts GROUP BY status ORDER BY count DESC").all();
  res.json({ totalMessages: totalMessages, totalContacts: totalContacts, totalConversations: totalConversations, byChannel: byChannel, byDepartment: byDepartment, byStatus: byStatus });
});

module.exports = router;
