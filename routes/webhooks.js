var express = require("express");
var router = express.Router();
var getDb = require("../db/setup").getDb;
var classifyMessage = require("../services/ai-router").classifyMessage;
var generateSuggestion = require("../services/ai-router").generateSuggestion;
var whatsapp = require("../services/channels/whatsapp");
var instagram = require("../services/channels/instagram");
var facebook = require("../services/channels/facebook");
var email = require("../services/channels/email");

function isAutoReplyEnabled(channel) {
  try {
    var db = getDb();
    db.exec("CREATE TABLE IF NOT EXISTS auto_reply_settings (channel TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0)");
    var setting = db.prepare("SELECT enabled FROM auto_reply_settings WHERE channel = ?").get(channel);
    return setting && setting.enabled === 1;
  } catch (e) {
    return false;
  }
}

async function sendAutoReply(contact, channel) {
  try {
    var db = getDb();
    var messages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(contact.id);
    var suggestion = await generateSuggestion(contact, messages);
    if (!suggestion || suggestion.indexOf("Error") === 0) {
      console.log("[AUTO-REPLY] No se pudo generar respuesta para " + contact.name);
      return;
    }
    db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name) VALUES (?, 'outgoing', ?, ?, 'IA NexoCRM')").run(contact.id, suggestion, channel);
    var sendResult = { success: true, simulated: true };
    if (channel === "whatsapp") {
      sendResult = await whatsapp.sendMessage(contact.channel_id, suggestion, contact.phone_line || 1);
    } else if (channel === "instagram") {
      sendResult = await instagram.sendMessage(contact.channel_id, suggestion);
    } else if (channel === "facebook") {
      sendResult = await facebook.sendMessage(contact.channel_id, suggestion);
    } else if (channel === "email") {
      sendResult = await email.sendMessage(contact.email, "Re: Consulta - Aberturas Windows", suggestion);
    }
    console.log("[AUTO-REPLY] " + channel.toUpperCase() + " -> " + contact.name + ": " + suggestion.substring(0, 60) + "... | Enviado: " + sendResult.success);
  } catch (err) {
    console.error("[AUTO-REPLY] Error:", err.message);
  }
}

async function handleIncomingMessage(normalized) {
  var db = getDb();
  try {
    var contact = db.prepare("SELECT * FROM contacts WHERE channel = ? AND channel_id = ?").get(normalized.channel, normalized.channelId);
    if (!contact) {
      var result = db.prepare("INSERT INTO contacts (name, phone, email, channel, channel_id, phone_line, department, status, origin) VALUES (?, ?, ?, ?, ?, ?, 'ventas', 'lead', ?)").run(normalized.senderName || "Contacto nuevo", normalized.senderPhone || null, normalized.senderEmail || null, normalized.channel, normalized.channelId, normalized.phoneLine || null, normalized.channel);
      contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(result.lastInsertRowid);
    }
    if (contact && normalized.senderName && normalized.senderName !== contact.name && contact.name.match(/^\d{10,}$/)) {
      db.prepare("UPDATE contacts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(normalized.senderName, contact.id);
      contact.name = normalized.senderName;
    }
    db.prepare("INSERT INTO messages (contact_id, direction, content, channel, channel_message_id, media_type, media_url, story_url) VALUES (?, 'incoming', ?, ?, ?, ?, ?, ?)").run(contact.id, normalized.text, normalized.channel, normalized.messageId, normalized.mediaType || null, normalized.mediaUrl || null, normalized.storyUrl || null);
    var textForAi = normalized.text || "";
    if (normalized.storyUrl) { textForAi = "[Respuesta a historia de Instagram] " + textForAi; }
    var recentMessages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10").all(contact.id).reverse();
    var classification = await classifyMessage(textForAi, recentMessages);
    if (classification.department !== contact.department) {
      db.prepare("UPDATE contacts SET department = ?, ai_confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(classification.department, classification.confidence, contact.id);
      db.prepare("INSERT INTO routing_log (contact_id, from_department, to_department, reason, confidence) VALUES (?, ?, ?, ?, ?)").run(contact.id, contact.department, classification.department, classification.reason, classification.confidence);
    }
    console.log("[" + normalized.channel.toUpperCase() + "] " + normalized.senderName + ": " + (normalized.text || "").substring(0, 50) + " -> " + classification.department + " (" + classification.confidence + ")");

    if (isAutoReplyEnabled(normalized.channel)) {
      var updatedContact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contact.id);
      setTimeout(function() {
        sendAutoReply(updatedContact, normalized.channel);
      }, 2000);
    }

    return { contact: contact, classification: classification };
  } catch (err) {
    console.error("Error procesando mensaje entrante:", err);
    throw err;
  }
}

router.get("/meta", function(req, res) {
  var mode = req.query["hub.mode"];
  var token = req.query["hub.verify_token"];
  var challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("Webhook de Meta verificado");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post("/meta", async function(req, res) {
  res.sendStatus(200);
  try {
    var body = req.body;
    var object = body.object;
    var normalized = null;
    if (object === "whatsapp_business_account") {
      normalized = whatsapp.processWebhook(body);
    } else if (object === "instagram") {
      normalized = instagram.processWebhook(body);
      if (normalized) {
        var igName = await instagram.getUserProfile(normalized.channelId);
        if (igName) { normalized.senderName = igName; }
      }
    } else if (object === "page") {
      normalized = facebook.processWebhook(body);
      if (normalized) {
        var fbName = await facebook.getUserProfile(normalized.channelId);
        if (fbName) { normalized.senderName = fbName; }
      }
    }
    if (normalized) { await handleIncomingMessage(normalized); }
  } catch (err) {
    console.error("Error en webhook Meta:", err);
  }
});

router.post("/email", async function(req, res) {
  res.sendStatus(200);
  try {
    var normalized = email.processWebhook(req.body);
    if (normalized) { await handleIncomingMessage(normalized); }
  } catch (err) {
    console.error("Error en webhook Email:", err);
  }
});

router.post("/phone", async function(req, res) {
  try {
    var normalized = {
      channel: "telefono",
      channelId: req.body.callerPhone || "phone-" + Date.now(),
      senderName: req.body.callerName || "Llamada entrante",
      senderPhone: req.body.callerPhone,
      text: req.body.summary || "[Llamada registrada]",
      messageId: null,
      timestamp: Date.now(),
      phoneLine: req.body.phoneLine || 3,
      mediaType: null,
      mediaUrl: null,
      storyUrl: null
    };
    var result = await handleIncomingMessage(normalized);
    res.json({ success: true, contact: result.contact, classification: result.classification });
  } catch (err) {
    console.error("Error registrando llamada:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
