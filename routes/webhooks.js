const express = require("express");
const router = express.Router();
const { getDb } = require("../db/setup");
const { classifyMessage } = require("../services/ai-router");
const whatsapp = require("../services/channels/whatsapp");
const instagram = require("../services/channels/instagram");
const facebook = require("../services/channels/facebook");
const email = require("../services/channels/email");

/**
 * Procesa un mensaje normalizado de cualquier canal:
 * 1. Busca o crea el contacto
 * 2. Guarda el mensaje
 * 3. Clasifica con IA
 * 4. Asigna al departamento
 */
async function handleIncomingMessage(normalized) {
  const db = getDb();

  try {
    // 1. Buscar contacto existente por channel + channelId
    let contact = db.prepare(
      "SELECT * FROM contacts WHERE channel = ? AND channel_id = ?"
    ).get(normalized.channel, normalized.channelId);

    // 2. Si no existe, crear contacto nuevo
    if (!contact) {
      const result = db.prepare(`
        INSERT INTO contacts (name, phone, email, channel, channel_id, phone_line, department, status, origin)
        VALUES (?, ?, ?, ?, ?, ?, 'ventas', 'lead', ?)
      `).run(
        normalized.senderName || "Contacto nuevo",
        normalized.senderPhone || null,
        normalized.senderEmail || null,
        normalized.channel,
        normalized.channelId,
        normalized.phoneLine || null,
        normalized.channel
      );
      contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(result.lastInsertRowid);
    }

    // 3. Guardar mensaje
    db.prepare(`
      INSERT INTO messages (contact_id, direction, content, channel, channel_message_id)
      VALUES (?, 'incoming', ?, ?, ?)
    `).run(contact.id, normalized.text, normalized.channel, normalized.messageId);

    // 4. Clasificar con IA
    const recentMessages = db.prepare(
      "SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10"
    ).all(contact.id).reverse();

    const classification = await classifyMessage(normalized.text, recentMessages);

    // 5. Actualizar departamento si cambió
    if (classification.department !== contact.department) {
      db.prepare("UPDATE contacts SET department = ?, ai_confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(classification.department, classification.confidence, contact.id);

      // Log de routing
      db.prepare(`
        INSERT INTO routing_log (contact_id, from_department, to_department, reason, confidence)
        VALUES (?, ?, ?, ?, ?)
      `).run(contact.id, contact.department, classification.department, classification.reason, classification.confidence);
    }

    console.log(`📨 [${normalized.channel.toUpperCase()}] ${normalized.senderName}: "${normalized.text.substring(0, 50)}..." → ${classification.department} (${classification.confidence})`);

    return { contact, classification };

  } catch (err) {
    console.error("Error procesando mensaje entrante:", err);
    throw err;
  }
}

// ============================================
// WEBHOOK: Meta (WhatsApp + Instagram + Facebook)
// ============================================

// Verificación del webhook (Meta envía un GET para validar)
router.get("/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("✅ Webhook de Meta verificado");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Recepción de mensajes de Meta
router.post("/meta", async (req, res) => {
  // Responder 200 inmediatamente (Meta requiere respuesta rápida)
  res.sendStatus(200);

  try {
    const body = req.body;
    const object = body.object;

    let normalized = null;

    if (object === "whatsapp_business_account") {
      normalized = whatsapp.processWebhook(body);
    } else if (object === "instagram") {
      normalized = instagram.processWebhook(body);
    } else if (object === "page") {
      normalized = facebook.processWebhook(body);
    }

    if (normalized) {
      await handleIncomingMessage(normalized);
    }
  } catch (err) {
    console.error("Error en webhook Meta:", err);
  }
});

// ============================================
// WEBHOOK: Email (SendGrid Inbound Parse)
// ============================================

router.post("/email", async (req, res) => {
  res.sendStatus(200);

  try {
    const normalized = email.processWebhook(req.body);
    if (normalized) {
      await handleIncomingMessage(normalized);
    }
  } catch (err) {
    console.error("Error en webhook Email:", err);
  }
});

// ============================================
// WEBHOOK: Teléfono (registro manual desde el CRM)
// ============================================

router.post("/phone", async (req, res) => {
  try {
    const { callerName, callerPhone, phoneLine, summary } = req.body;
    const normalized = {
      channel: "telefono",
      channelId: callerPhone || `phone-${Date.now()}`,
      senderName: callerName || "Llamada entrante",
      senderPhone: callerPhone,
      text: summary || "[Llamada registrada]",
      messageId: null,
      timestamp: Date.now(),
      phoneLine: phoneLine || 3,
    };

    const result = await handleIncomingMessage(normalized);
    res.json({ success: true, contact: result.contact, classification: result.classification });
  } catch (err) {
    console.error("Error registrando llamada:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
