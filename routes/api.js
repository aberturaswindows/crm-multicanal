const express = require("express");
const router = express.Router();
const { getDb } = require("../db/setup");
const { generateSuggestion, classifyMessage } = require("../services/ai-router");
const whatsapp = require("../services/channels/whatsapp");
const instagram = require("../services/channels/instagram");
const facebook = require("../services/channels/facebook");
const emailService = require("../services/channels/email");

// ============================================
// CONTACTOS
// ============================================

// Listar contactos con filtros
router.get("/contacts", (req, res) => {
  const db = getDb();
  const { channel, department, status } = req.query;

  let query = `
    SELECT c.*, 
      (SELECT COUNT(*) FROM messages m WHERE m.contact_id = c.id AND m.direction = 'incoming' 
       AND m.created_at > COALESCE((SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.contact_id = c.id AND m2.direction = 'outgoing'), '1970-01-01')
      ) as unread,
      (SELECT content FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages m WHERE m.contact_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
    FROM contacts c WHERE 1=1
  `;
  const params = [];

  if (channel && channel !== "all") { query += " AND c.channel = ?"; params.push(channel); }
  if (department && department !== "all") { query += " AND c.department = ?"; params.push(department); }
  if (status && status !== "all") { query += " AND c.status = ?"; params.push(status); }

  query += " ORDER BY last_message_at DESC NULLS LAST";

  const contacts = db.prepare(query).all(...params);
  res.json(contacts);
});

// Obtener un contacto
router.get("/contacts/:id", (req, res) => {
  const db = getDb();
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  res.json(contact);
});

// Actualizar contacto
router.put("/contacts/:id", (req, res) => {
  const db = getDb();
  const { name, email, phone, department, status, notes, assigned_agent } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (email !== undefined) { fields.push("email = ?"); values.push(email); }
  if (phone !== undefined) { fields.push("phone = ?"); values.push(phone); }
  if (department !== undefined) { fields.push("department = ?"); values.push(department); }
  if (status !== undefined) { fields.push("status = ?"); values.push(status); }
  if (notes !== undefined) { fields.push("notes = ?"); values.push(notes); }
  if (assigned_agent !== undefined) { fields.push("assigned_agent = ?"); values.push(assigned_agent); }

  if (fields.length === 0) return res.status(400).json({ error: "Nada que actualizar" });

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(req.params.id);

  db.prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  // Si cambió el departamento, registrar en routing_log
  if (department !== undefined) {
    const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
    db.prepare("INSERT INTO routing_log (contact_id, from_department, to_department, reason, routed_by) VALUES (?, ?, ?, ?, 'manual')")
      .run(req.params.id, req.body._old_department || "unknown", department, "Reasignación manual");
  }

  const updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// ============================================
// MENSAJES
// ============================================

// Obtener mensajes de un contacto
router.get("/contacts/:id/messages", (req, res) => {
  const db = getDb();
  const messages = db.prepare(
    "SELECT * FROM messages WHERE contact_id = ? ORDER BY created_at ASC"
  ).all(req.params.id);
  res.json(messages);
});

// Enviar mensaje (agente → cliente)
router.post("/contacts/:id/messages", async (req, res) => {
  const db = getDb();
  const { content, agent_name } = req.body;
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);

  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  if (!content?.trim()) return res.status(400).json({ error: "Mensaje vacío" });

  // Guardar en DB
  const result = db.prepare(`
    INSERT INTO messages (contact_id, direction, content, channel, agent_name)
    VALUES (?, 'outgoing', ?, ?, ?)
  `).run(contact.id, content.trim(), contact.channel, agent_name || "Agente");

  // Enviar por el canal correspondiente
  let sendResult = { success: true, simulated: true };
  switch (contact.channel) {
    case "whatsapp":
      sendResult = await whatsapp.sendMessage(contact.channel_id, content.trim(), contact.phone_line || 1);
      break;
    case "instagram":
      sendResult = await instagram.sendMessage(contact.channel_id, content.trim());
      break;
    case "facebook":
      sendResult = await facebook.sendMessage(contact.channel_id, content.trim());
      break;
    case "email":
      sendResult = await emailService.sendMessage(contact.email, `Re: Consulta`, content.trim());
      break;
    case "telefono":
      // Las llamadas no se "envían", solo se registran
      break;
  }

  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
  res.json({ message, sendResult });
});

// ============================================
// IA
// ============================================

// Obtener sugerencia de respuesta
router.get("/contacts/:id/suggestion", async (req, res) => {
  const db = getDb();
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });

  const messages = db.prepare(
    "SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at ASC"
  ).all(req.params.id);

  const suggestion = await generateSuggestion(contact, messages);
  res.json({ suggestion });
});

// Reclasificar un contacto con IA
router.post("/contacts/:id/reclassify", async (req, res) => {
  const db = getDb();
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });

  const messages = db.prepare(
    "SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at ASC"
  ).all(req.params.id);

  const allText = messages.filter(m => m.direction === "incoming").map(m => m.content).join(" ");
  const classification = await classifyMessage(allText, messages);

  db.prepare("UPDATE contacts SET department = ?, ai_confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(classification.department, classification.confidence, contact.id);

  db.prepare("INSERT INTO routing_log (contact_id, from_department, to_department, reason, confidence) VALUES (?, ?, ?, ?, ?)")
    .run(contact.id, contact.department, classification.department, classification.reason, classification.confidence);

  res.json({ classification, contact: db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id) });
});

// ============================================
// AGENTES Y LÍNEAS
// ============================================

router.get("/agents", (req, res) => {
  const db = getDb();
  const agents = db.prepare("SELECT * FROM agents WHERE is_active = 1 ORDER BY department, name").all();
  res.json(agents);
});

router.get("/phone-lines", (req, res) => {
  const db = getDb();
  const lines = db.prepare("SELECT * FROM phone_lines").all();
  res.json(lines);
});

// ============================================
// ROUTING LOG
// ============================================

router.get("/routing-log", (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT r.*, c.name as contact_name 
    FROM routing_log r 
    JOIN contacts c ON r.contact_id = c.id 
    ORDER BY r.created_at DESC 
    LIMIT 50
  `).all();
  res.json(logs);
});

// ============================================
// MÉTRICAS
// ============================================

router.get("/metrics", (req, res) => {
  const db = getDb();

  const totalMessages = db.prepare("SELECT COUNT(*) as count FROM messages").get().count;
  const totalContacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get().count;
  const totalConversations = db.prepare("SELECT COUNT(DISTINCT contact_id) as count FROM messages").get().count;

  const byChannel = db.prepare(`
    SELECT channel, COUNT(*) as count FROM messages GROUP BY channel ORDER BY count DESC
  `).all();

  const byDepartment = db.prepare(`
    SELECT department, COUNT(*) as count FROM contacts GROUP BY department ORDER BY count DESC
  `).all();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM contacts GROUP BY status ORDER BY count DESC
  `).all();

  res.json({ totalMessages, totalContacts, totalConversations, byChannel, byDepartment, byStatus });
});

module.exports = router;
