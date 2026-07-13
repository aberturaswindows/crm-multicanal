var express = require("express");
var router = express.Router();
var getDb = require("../db/setup").getDb;
var generateSuggestion = require("../services/ai-router").generateSuggestion;
var classifyMessage = require("../services/ai-router").classifyMessage;
var generateFicha = require("../services/ai-router").generateFicha;
var STAGE_LABELS = require("../services/ai-router").STAGE_LABELS;
var whatsapp = require("../services/channels/whatsapp");
var instagram = require("../services/channels/instagram");
var facebook = require("../services/channels/facebook");
var emailService = require("../services/channels/email");
var fs = require("fs");
var path = require("path");
var multer = require("multer");
var axios = require("axios");
var MEDIA_DIR = fs.existsSync("/data") ? "/data/media" : path.join(__dirname, "..", "data", "media");

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) { fs.mkdirSync(MEDIA_DIR, { recursive: true }); }

// Multer config for file uploads
var storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, MEDIA_DIR); },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    var safeName = "upload_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, safeName);
  }
});
var upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    var allowed = [".jpg",".jpeg",".png",".gif",".webp",".heic",".mp4",".mov",".avi",".mp3",".ogg",".wav",".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".csv",".zip",".rar",".dwg",".dxf",".skp",".rvt",".3ds",".ifc"];
    var ext = path.extname(file.originalname).toLowerCase();
    if (allowed.indexOf(ext) !== -1) { cb(null, true); } else { cb(new Error("Tipo de archivo no permitido: " + ext)); }
  }
});

// Helper: pausar la IA para un contacto cuando un agente humano intervene
function pauseAiForContact(db, contactId, agentName) {
  try {
    db.prepare("UPDATE contacts SET ai_paused = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contactId);
    console.log("[CLAUDIA] Pausada para contacto " + contactId + " (agente: " + (agentName || "desconocido") + ")");
  } catch (e) {
    console.error("[CLAUDIA] Error pausando:", e.message);
  }
}

// Helper: dado el id INTERNO de un mensaje del CRM, devuelve el wamid (channel_message_id)
// que WhatsApp necesita para citar. El frontend nos manda el id interno del mensaje a
// responder; Meta necesita el wamid. Si el mensaje no tiene wamid (ej: aun 'pending' o
// mensaje de un canal sin id de Meta), devuelve null y el mensaje se envia sin cita.
function resolveReplyWamid(db, internalMsgId) {
  if (!internalMsgId) return null;
  try {
    var row = db.prepare("SELECT channel_message_id FROM messages WHERE id = ?").get(internalMsgId);
    return row && row.channel_message_id ? row.channel_message_id : null;
  } catch (e) {
    return null;
  }
}

// Helper: después de enviar un outgoing a un canal, actualizar su status en DB.
// sendResult viene de whatsapp.sendMessage / sendMedia / sendTemplate / etc.
// Si simulated=true (canal no configurado), se marca como 'sent' sin channel_message_id
// y ese mensaje nunca avanzará por webhooks — lo cual es comportamiento esperado en dev.
function updateMessageStatus(db, msgId, sendResult) {
  try {
    if (sendResult && sendResult.success) {
      if (sendResult.messageId) {
        db.prepare("UPDATE messages SET status='sent', sent_at=CURRENT_TIMESTAMP, channel_message_id=? WHERE id=?")
          .run(sendResult.messageId, msgId);
      } else {
        db.prepare("UPDATE messages SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE id=?").run(msgId);
      }
    } else {
      var reason = sendResult && sendResult.error ? sendResult.error : 'Unknown error';
      db.prepare("UPDATE messages SET status='failed', failed_reason=? WHERE id=?").run(reason, msgId);
    }
  } catch (e) { console.error("[STATUS] updateMessageStatus error:", e.message); }
}

// MIME types para archivos tecnicos que Node no reconoce por default.
// Compartido entre /media/:filename (inline) y /files/:id/download (attachment).
var customMimeTypes = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".heic": "image/heic",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain", ".csv": "text/csv",
  ".zip": "application/zip", ".rar": "application/vnd.rar",
  ".dwg": "application/acad",
  ".dxf": "application/dxf",
  ".skp": "application/vnd.sketchup.skp",
  ".ifc": "application/x-step",
  ".3ds": "application/x-3ds",
  ".rvt": "application/octet-stream"
};
function mimeFor(filename) {
  var ext = (path.extname(filename || "") || "").toLowerCase();
  return customMimeTypes[ext] || "application/octet-stream";
}

router.get("/media/:filename", function(req, res) {
  // Sanitizar nombre: permitir letras, numeros, punto, guion bajo, guion, signo igual, dos puntos.
  // Estos caracteres aparecen en IDs de WhatsApp (base64url-like) y son seguros para filenames.
  // Bloquear solo caracteres que podrian ser un ataque de path traversal: / \ .. espacios raros.
  var raw = req.params.filename;
  var filename = raw.replace(/[^a-zA-Z0-9._\-=:]/g, "");
  // Anti path traversal extra
  if (filename.indexOf("..") !== -1) filename = filename.replace(/\.\./g, "");
  var filepath = path.join(MEDIA_DIR, filename);

  if (fs.existsSync(filepath)) {
    res.setHeader("Content-Type", mimeFor(filename));
    var displayName = req.query.dl ? decodeURIComponent(req.query.dl).replace(/[^a-zA-Z0-9._\- ]/g, "_") : filename;
    res.setHeader("Content-Disposition", "inline; filename=\"" + displayName + "\"");
    res.sendFile(filepath);
  } else {
    // Debug: loggear que archivo se pidio y que hay en disco (limitado a 10 archivos)
    console.error("[MEDIA-404] Pidieron: '" + raw + "' | Sanitizado: '" + filename + "' | Path: " + filepath);
    try {
      var files = fs.readdirSync(MEDIA_DIR).slice(-10);
      console.error("[MEDIA-404] Ultimos 10 archivos en " + MEDIA_DIR + ": " + files.join(", "));
    } catch(e) {}
    res.status(404).json({ error: "Archivo no encontrado" });
  }
});

// Descarga forzada con Content-Disposition: attachment y filename UTF-8 correcto.
// Publico intencionalmente (sin auth) para que Meta/WhatsApp pueda descargar si hace falta.
router.get("/files/:id/download", function(req, res) {
  var db = getDb();
  var msg = db.prepare("SELECT id, media_url, original_filename FROM messages WHERE id = ?").get(req.params.id);
  if (!msg || !msg.media_url) return res.status(404).json({ error: "Archivo no encontrado" });

  var storageFilename = msg.media_url.split("/").pop().split("?")[0];
  var safeStorage = storageFilename.replace(/[^a-zA-Z0-9._\-=:]/g, "");
  if (safeStorage.indexOf("..") !== -1) return res.status(400).json({ error: "Nombre invalido" });
  var absolutePath = path.join(MEDIA_DIR, safeStorage);
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: "Archivo no encontrado en disco" });

  var originalFilename = msg.original_filename || safeStorage;
  var mimeType = mimeFor(originalFilename);
  var encoded = encodeURIComponent(originalFilename);
  var asciiFallback = originalFilename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encoded
  );
  res.sendFile(absolutePath);
});

// ============================================
// FILE UPLOAD
// ============================================

router.post("/contacts/:id/upload", upload.single("file"), async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  if (!req.file) return res.status(400).json({ error: "No se recibio ningun archivo" });

  var ext = path.extname(req.file.filename).toLowerCase();
  var imageExts = [".jpg",".jpeg",".png",".gif",".webp"];
  var videoExts = [".mp4",".mov",".avi"];
  var audioExts = [".mp3",".ogg",".wav"];
  var mediaType = "file";
  var contentLabel = "[Archivo]";
  if (imageExts.indexOf(ext) !== -1) { mediaType = "image"; contentLabel = "[Imagen]"; }
  else if (videoExts.indexOf(ext) !== -1) { mediaType = "video"; contentLabel = "[Video]"; }
  else if (audioExts.indexOf(ext) !== -1) { mediaType = "audio"; contentLabel = "[Audio]"; }

  var mediaUrl = "/api/media/" + req.file.filename;
  var agentName = req.body.agent_name || "Agente";
  var caption = req.body.caption || "";
  var originalFilename = req.file.originalname || null;
  if (mediaType === "file" && originalFilename && !caption) contentLabel = "[Archivo: " + originalFilename + "]";
  var msgContent = caption ? caption : contentLabel;

  // Cita (reply): el frontend manda el id INTERNO del mensaje citado. Lo guardamos como
  // wamid (channel_message_id) para que se muestre la cita en el CRM y, si aplica, se
  // envie por Meta con context.
  var replyToInternalId = req.body.reply_to_message_id || null;
  var replyToWamid = resolveReplyWamid(db, replyToInternalId);

  var result = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name, media_type, media_url, status, reply_to_message_id) VALUES (?, 'outgoing', ?, ?, ?, ?, ?, 'pending', ?)").run(contact.id, msgContent, contact.channel, agentName, mediaType, mediaUrl, replyToWamid);
  // Guardar nombre original en columna separada (migración idempotente en setup.js garantiza que existe)
  try { db.prepare("UPDATE messages SET original_filename = ? WHERE id = ?").run(originalFilename, result.lastInsertRowid); } catch(e) {}

  // Pausar Claudia porque un humano esta interviniendo
  pauseAiForContact(db, contact.id, agentName);

  // Send via channel
  var sendResult = { success: true, simulated: true };
  var publicUrl = (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : (req.protocol + "://" + req.get("host"))) + mediaUrl;

  try {
    if (contact.channel === "facebook" && process.env.FACEBOOK_PAGE_TOKEN) {
      var fbType = mediaType === "file" ? "file" : mediaType;
      var fbUrl = publicUrl + (originalFilename ? "?dl=" + encodeURIComponent(originalFilename) : "");
      var fbRes = await axios.post("https://graph.facebook.com/v18.0/me/messages", {
        recipient: { id: contact.channel_id },
        message: { attachment: { type: fbType, payload: { url: fbUrl, is_reusable: false } } }
      }, { params: { access_token: process.env.FACEBOOK_PAGE_TOKEN } });
      sendResult = { success: true, message_id: fbRes.data.message_id };
      console.log("[UPLOAD] Facebook attachment sent to " + contact.name + ": " + (originalFilename || req.file.filename));
    } else if (contact.channel === "instagram" && process.env.INSTAGRAM_TOKEN) {
      var igToken = process.env.INSTAGRAM_TOKEN || process.env.FACEBOOK_PAGE_TOKEN;
      if (mediaType === "image") {
        var igRes = await axios.post("https://graph.facebook.com/v18.0/me/messages", {
          recipient: { id: contact.channel_id },
          message: { attachment: { type: "image", payload: { url: publicUrl } } }
        }, { params: { access_token: igToken } });
        sendResult = { success: true, message_id: igRes.data.message_id };
      } else {
        sendResult = { success: true, simulated: true, note: "Instagram solo soporta imagenes como adjuntos" };
      }
      console.log("[UPLOAD] Instagram attachment to " + contact.name + ": " + (originalFilename || req.file.filename));
    } else if (contact.channel === "whatsapp" && process.env.WHATSAPP_TOKEN) {
      var waResult = await whatsapp.sendMedia(contact.channel_id, mediaType, publicUrl, caption, contact.phone_line || 1, originalFilename, replyToWamid);
      sendResult = waResult;
      if (!waResult.success) {
        updateMessageStatus(db, result.lastInsertRowid, waResult);
        console.error("[UPLOAD] Meta rechazó el archivo para " + contact.name + " (" + contact.channel_id + "):", waResult.error, "| code:", waResult.errorCode, "| 24h:", waResult.isOutsideWindow);
        return res.status(422).json({
          error: waResult.isOutsideWindow
            ? "No podés enviar archivos a este contacto porque no te escribió en las últimas 24 horas. Usá una plantilla."
            : ("Meta rechazó el envío: " + waResult.error),
          sendResult: waResult
        });
      }
      console.log("[UPLOAD] WhatsApp archivo enviado a " + contact.name + ": " + (originalFilename || req.file.filename));
    } else {
      console.log("[UPLOAD] " + contact.channel + " attachment saved for " + contact.name + ": " + (originalFilename || req.file.filename) + " (envio pendiente)");
    }
  } catch (err) {
    console.error("[UPLOAD] Error enviando por " + contact.channel + ":", err.response ? err.response.data : err.message);
    sendResult = { success: false, error: err.message };
  }

  updateMessageStatus(db, result.lastInsertRowid, sendResult);
  var message = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
  res.json({ message: message, sendResult: sendResult, file: { filename: req.file.filename, originalName: originalFilename, size: req.file.size, mediaType: mediaType, url: mediaUrl } });
});

// ============================================
// SHARE CONTACT
// ============================================

router.post("/contacts/:id/share-contact", async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  var sharedId = req.body.shared_contact_id;
  var agentName = req.body.agent_name || "Agente";
  var shared = db.prepare("SELECT * FROM contacts WHERE id = ?").get(sharedId);
  if (!shared) return res.status(404).json({ error: "Contacto a compartir no encontrado" });

  var parts = [];
  parts.push("Contacto: " + shared.name);
  if (shared.phone) parts.push("Tel: " + shared.phone);
  if (shared.email) parts.push("Email: " + shared.email);
  var content = parts.join("\n");

  var result = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name, status) VALUES (?, 'outgoing', ?, ?, ?, 'pending')").run(contact.id, content, contact.channel, agentName);

  // Pausar Claudia porque un humano esta interviniendo
  pauseAiForContact(db, contact.id, agentName);

  var sendResult = { success: true, simulated: true };
  try {
    if (contact.channel === "facebook") {
      sendResult = await facebook.sendMessage(contact.channel_id, content);
    } else if (contact.channel === "instagram") {
      sendResult = await instagram.sendMessage(contact.channel_id, content);
    } else if (contact.channel === "whatsapp") {
      sendResult = await whatsapp.sendMessage(contact.channel_id, content, contact.phone_line || 1);
    }
  } catch (err) {
    sendResult = { success: false, error: err.message };
  }

  updateMessageStatus(db, result.lastInsertRowid, sendResult);
  var message = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
  console.log("[CONTACTO] " + agentName + " compartio " + shared.name + " con " + contact.name);
  res.json({ message: message, sendResult: sendResult });
});

// ============================================
// REMINDERS
// ============================================

router.get("/reminders", function(req, res) {
  var db = getDb();
  try {
    var reminders = db.prepare("SELECT r.*, c.name as contact_name, c.channel as contact_channel FROM reminders r JOIN contacts c ON r.contact_id = c.id WHERE r.is_completed = 0 ORDER BY r.reminder_at ASC").all();
    res.json(reminders);
  } catch (e) {
    res.json([]);
  }
});

router.post("/reminders", function(req, res) {
  var db = getDb();
  var contact_id = req.body.contact_id;
  var reminder_at = req.body.reminder_at;
  var note = req.body.note || "";
  var created_by = req.body.created_by || "Agente";
  if (!contact_id || !reminder_at) return res.status(400).json({ error: "contact_id y reminder_at son requeridos" });
  var contact = db.prepare("SELECT id, name FROM contacts WHERE id = ?").get(contact_id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  var result = db.prepare("INSERT INTO reminders (contact_id, reminder_at, note, created_by) VALUES (?, ?, ?, ?)").run(contact_id, reminder_at, note, created_by);
  var reminder = db.prepare("SELECT r.*, c.name as contact_name FROM reminders r JOIN contacts c ON r.contact_id = c.id WHERE r.id = ?").get(result.lastInsertRowid);
  console.log("[RECORDATORIO] " + created_by + " -> " + contact.name + " para " + reminder_at + (note ? ": " + note : ""));
  res.json(reminder);
});

router.put("/reminders/:id", function(req, res) {
  var db = getDb();
  if (req.body.is_completed !== undefined) {
    db.prepare("UPDATE reminders SET is_completed = ? WHERE id = ?").run(req.body.is_completed ? 1 : 0, req.params.id);
  }
  if (req.body.reminder_at !== undefined) {
    db.prepare("UPDATE reminders SET reminder_at = ? WHERE id = ?").run(req.body.reminder_at, req.params.id);
  }
  if (req.body.note !== undefined) {
    db.prepare("UPDATE reminders SET note = ? WHERE id = ?").run(req.body.note, req.params.id);
  }
  var updated = db.prepare("SELECT r.*, c.name as contact_name FROM reminders r JOIN contacts c ON r.contact_id = c.id WHERE r.id = ?").get(req.params.id);
  res.json(updated);
});

router.delete("/reminders/:id", function(req, res) {
  var db = getDb();
  db.prepare("DELETE FROM reminders WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ============================================
// AUTH & USERS
// ============================================

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

// ============================================
// AUTO-REPLY
// ============================================

router.get("/auto-reply", function(req, res) {
  var db = getDb();
  try {
    db.exec("CREATE TABLE IF NOT EXISTS auto_reply_settings (channel TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0)");
    var channels = ["whatsapp", "instagram", "facebook", "email"];
    for (var i = 0; i < channels.length; i++) {
      try { db.exec("INSERT OR IGNORE INTO auto_reply_settings (channel, enabled) VALUES ('" + channels[i] + "', 0)"); } catch (e) {}
    }
    var settings = db.prepare("SELECT channel, enabled FROM auto_reply_settings ORDER BY channel").all();
    res.json(settings);
  } catch (e) {
    res.json([]);
  }
});

router.put("/auto-reply/:channel", function(req, res) {
  var db = getDb();
  var channel = req.params.channel;
  var enabled = req.body.enabled ? 1 : 0;
  try {
    db.exec("CREATE TABLE IF NOT EXISTS auto_reply_settings (channel TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0)");
    var existing = db.prepare("SELECT channel FROM auto_reply_settings WHERE channel = ?").get(channel);
    if (existing) {
      db.prepare("UPDATE auto_reply_settings SET enabled = ? WHERE channel = ?").run(enabled, channel);
    } else {
      db.prepare("INSERT INTO auto_reply_settings (channel, enabled) VALUES (?, ?)").run(channel, enabled);
    }
    var updated = db.prepare("SELECT channel, enabled FROM auto_reply_settings WHERE channel = ?").get(channel);
    console.log("[AUTO-REPLY] " + channel + " -> " + (enabled ? "ACTIVADO" : "DESACTIVADO"));
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// STAGES
// ============================================

router.put("/contacts/:id/stage", function(req, res) {
  var db = getDb();
  var stage = req.body.stage;
  var validStages = ["consulta", "recopilando_datos", "datos_completos", "presupuesto_enviado", "seguimiento", "cerrado_ganado", "cerrado_perdido", "sin_respuesta"];
  if (validStages.indexOf(stage) === -1) return res.status(400).json({ error: "Etapa invalida" });

  var updates = ["conversation_stage = ?", "updated_at = CURRENT_TIMESTAMP"];
  var values = [stage];

  if (stage === "presupuesto_enviado") {
    updates.push("quote_sent_at = CURRENT_TIMESTAMP");
    updates.push("followup_count = 0");
    updates.push("last_followup_at = NULL");
  }
  if (stage === "cerrado_perdido" && req.body.lost_reason) {
    updates.push("lost_reason = ?");
    values.push(req.body.lost_reason);
  }
  if (stage === "cerrado_ganado") {
    updates.push("status = 'cliente'");
  }
  if (stage === "consulta") {
    updates.push("quote_sent_at = NULL");
    updates.push("followup_count = 0");
    updates.push("last_followup_at = NULL");
    updates.push("lost_reason = NULL");
  }

  values.push(req.params.id);
  db.prepare("UPDATE contacts SET " + updates.join(", ") + " WHERE id = ?").run(values);
  var updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  console.log("[STAGE] " + updated.name + " -> " + stage + (req.body.lost_reason ? " (motivo: " + req.body.lost_reason + ")" : ""));
  res.json(updated);
});

router.get("/stage-labels", function(req, res) {
  res.json(STAGE_LABELS || {});
});

router.get("/lost-stats", function(req, res) {
  var db = getDb();
  try {
    var stats = db.prepare("SELECT lost_reason, COUNT(*) as count FROM contacts WHERE conversation_stage = 'cerrado_perdido' AND lost_reason IS NOT NULL GROUP BY lost_reason ORDER BY count DESC").all();
    var total = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE conversation_stage = 'cerrado_perdido'").get().count;
    res.json({ stats: stats, total: total });
  } catch (e) {
    res.json({ stats: [], total: 0 });
  }
});

// ============================================
// CLAUDIA - Control manual de pausa/resume
// ============================================

// Despausar a Claudia: el agente decide devolverle el control de la conversacion a la IA
router.post("/contacts/:id/resume-ai", function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  db.prepare("UPDATE contacts SET ai_paused = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contact.id);
  var updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contact.id);
  console.log("[CLAUDIA] Reactivada para " + updated.name + " (control devuelto a la IA)");
  res.json(updated);
});

// Pausar manualmente a Claudia (por si un agente quiere pausarla sin escribir aun)
router.post("/contacts/:id/pause-ai", function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  db.prepare("UPDATE contacts SET ai_paused = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contact.id);
  var updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contact.id);
  console.log("[CLAUDIA] Pausada manualmente para " + updated.name);
  res.json(updated);
});

// Regenerar ficha de cotizacion (extrae datos del cliente del historial completo)
router.post("/contacts/:id/regenerate-ficha", async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });

  try {
    var messages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? AND direction != 'system' ORDER BY created_at ASC").all(contact.id);
    if (messages.length === 0) {
      return res.status(400).json({ error: "No hay mensajes en esta conversacion" });
    }

    var resumen = await generateFicha(contact, messages);
    if (!resumen) {
      return res.status(500).json({ error: "No se pudo generar la ficha" });
    }

    var fichaTexto = "\u{1F4CB} FICHA PARA COTIZAR\n";
    fichaTexto += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
    fichaTexto += "\u{1F464} Nombre: " + (resumen.nombre || "No indicado") + "\n";
    fichaTexto += "\u{1F4DE} Tel\u00e9fono: " + (resumen.telefono || "No indicado") + "\n";
    fichaTexto += "\u{1F4CD} Direcci\u00f3n: " + (resumen.direccion || "No indicada") + "\n";
    fichaTexto += "\u{1FA9F} Producto: " + (resumen.producto || "No indicado") + "\n";
    fichaTexto += "\u{1F4D0} Plano: " + (resumen.plano || "No indicado") + "\n";
    fichaTexto += "\u{1F3A8} Color: " + (resumen.color || "No indicado") + "\n";
    fichaTexto += "\u{1F532} Vidrio: " + (resumen.vidrio || "No indicado") + "\n";
    fichaTexto += "\u{1F4CF} Medidas: " + (resumen.medidas || "No indicadas") + "\n";
    fichaTexto += "\u{1F527} Instalaci\u00f3n: " + (resumen.instalacion || "No indicado") + "\n";
    fichaTexto += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501";

    var result = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name) VALUES (?, 'system', ?, ?, 'Sistema')").run(contact.id, fichaTexto, contact.channel);
    var message = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
    console.log("[FICHA] Regenerada para " + contact.name);
    res.json({ success: true, message: message, resumen: resumen });
  } catch (err) {
    console.error("[FICHA] Error regenerando:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PLANTILLAS WHATSAPP
// ============================================

// Listar plantillas aprobadas desde Meta
router.get("/templates", async function(req, res) {
  try {
    var result = await whatsapp.listTemplates();
    if (!result.success) {
      return res.status(500).json({ error: result.error, templates: [] });
    }
    res.json({ templates: result.templates });
  } catch (err) {
    console.error("[TEMPLATES] Error:", err.message);
    res.status(500).json({ error: err.message, templates: [] });
  }
});

// Subir PDF temporal (para usarlo como adjunto en una plantilla)
router.post("/templates/upload-attachment", upload.single("file"), function(req, res) {
  if (!req.file) return res.status(400).json({ error: "No se recibio ningun archivo" });
  var mediaUrl = "/api/media/" + req.file.filename;
  var publicUrl = (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : (req.protocol + "://" + req.get("host"))) + mediaUrl;
  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    url: mediaUrl,
    publicUrl: publicUrl
  });
});

// Enviar plantilla a un contacto YA EXISTENTE en el CRM
router.post("/contacts/:id/send-template", async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  if (contact.channel !== "whatsapp") return res.status(400).json({ error: "Las plantillas solo funcionan para WhatsApp" });

  var templateName = req.body.template_name;
  var languageCode = req.body.language_code || "es_AR";
  var bodyParams = req.body.body_params || [];
  var attachmentUrl = req.body.attachment_url || null;
  var attachmentType = req.body.attachment_type || null; // "document", "image", "video"
  var attachmentFilename = req.body.attachment_filename || null;
  var agentName = req.body.agent_name || "Agente";

  if (!templateName) return res.status(400).json({ error: "template_name es requerido" });

  var headerMedia = null;
  var publicAttachmentUrl = null;
  if (attachmentUrl && attachmentType) {
    // Convertir URL relativa a absoluta (Meta necesita URL publica)
    if (attachmentUrl.indexOf("http") === 0) {
      publicAttachmentUrl = attachmentUrl;
    } else {
      publicAttachmentUrl = (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : (req.protocol + "://" + req.get("host"))) + attachmentUrl;
    }
    headerMedia = { type: attachmentType, url: publicAttachmentUrl, filename: attachmentFilename };
  }

  var sendResult = await whatsapp.sendTemplate(contact.channel_id, templateName, languageCode, bodyParams, headerMedia, contact.phone_line || 1);

  // Guardar el mensaje en el CRM
  var contentToSave = "[Plantilla: " + templateName + "]";
  if (bodyParams.length > 0) {
    contentToSave += " " + bodyParams.join(", ");
  }
  if (attachmentFilename) {
    contentToSave += " [Adjunto: " + attachmentFilename + "]";
  }

  var mediaType = null;
  var localMediaUrl = null;
  if (attachmentUrl && attachmentType === "document") {
    mediaType = "file";
    localMediaUrl = attachmentUrl;
  } else if (attachmentUrl && attachmentType === "image") {
    mediaType = "image";
    localMediaUrl = attachmentUrl;
  }

  var result = db.prepare(
    "INSERT INTO messages (contact_id, direction, content, channel, agent_name, media_type, media_url, status) VALUES (?, 'outgoing', ?, ?, ?, ?, ?, 'pending')"
  ).run(contact.id, contentToSave, contact.channel, agentName, mediaType, localMediaUrl);

  // Pausar Claudia porque un humano intervino
  pauseAiForContact(db, contact.id, agentName);

  updateMessageStatus(db, result.lastInsertRowid, sendResult);
  var message = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
  console.log("[TEMPLATE] " + agentName + " envio '" + templateName + "' a " + contact.name + " | Exito: " + sendResult.success);
  res.json({ message: message, sendResult: sendResult, contact: db.prepare("SELECT * FROM contacts WHERE id = ?").get(contact.id) });
});

// Enviar plantilla a un numero NUEVO (crea el contacto en el CRM)
router.post("/templates/new-contact", async function(req, res) {
  var db = getDb();

  var phone = req.body.phone;
  var name = req.body.name;
  var templateName = req.body.template_name;
  var languageCode = req.body.language_code || "es_AR";
  var bodyParams = req.body.body_params || [];
  var attachmentUrl = req.body.attachment_url || null;
  var attachmentType = req.body.attachment_type || null;
  var attachmentFilename = req.body.attachment_filename || null;
  var department = req.body.department || "ventas";
  var agentName = req.body.agent_name || "Agente";

  if (!phone) return res.status(400).json({ error: "phone es requerido" });
  if (!name) return res.status(400).json({ error: "name es requerido" });
  if (!templateName) return res.status(400).json({ error: "template_name es requerido" });

  // Normalizar el telefono: sacar espacios, guiones, parentesis, signo +
  var cleanPhone = String(phone).replace(/[\s\-\(\)\+]/g, "");

  // Detectar si necesita prefijo de pais. Si es un numero argentino sin prefijo,
  // le agregamos 549 (codigo argentina + 9 para celulares)
  if (cleanPhone.length === 10 && cleanPhone.indexOf("54") !== 0) {
    // ej: "2613539384" -> "5492613539384"
    cleanPhone = "549" + cleanPhone;
  } else if (cleanPhone.length === 11 && cleanPhone.indexOf("15") === 3) {
    // ej: "26115393843" (formato viejo con 15) -> sacar el 15 y agregar 549
    cleanPhone = "549" + cleanPhone.substring(0, 3) + cleanPhone.substring(5);
  } else if (cleanPhone.length === 12 && cleanPhone.indexOf("54") === 0 && cleanPhone.charAt(2) !== "9") {
    // ej: "542613539384" -> "5492613539384" (agregar el 9)
    cleanPhone = "549" + cleanPhone.substring(2);
  }

  // Verificar si ya existe un contacto con ese numero en WhatsApp
  var existing = db.prepare("SELECT * FROM contacts WHERE channel = 'whatsapp' AND channel_id = ?").get(cleanPhone);
  var contactId;
  var isNew = false;

  if (existing) {
    contactId = existing.id;
    // Actualizar nombre si el usuario lo cambio
    if (name && name !== existing.name) {
      db.prepare("UPDATE contacts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, contactId);
    }
  } else {
    var result = db.prepare(
      "INSERT INTO contacts (name, phone, channel, channel_id, phone_line, department, status, origin, conversation_stage) VALUES (?, ?, 'whatsapp', ?, 1, ?, 'lead', 'outbound', 'consulta')"
    ).run(name, cleanPhone, cleanPhone, department);
    contactId = result.lastInsertRowid;
    isNew = true;
  }

  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId);

  // Preparar el header media si corresponde
  var headerMedia = null;
  if (attachmentUrl && attachmentType) {
    var publicAttachmentUrl;
    if (attachmentUrl.indexOf("http") === 0) {
      publicAttachmentUrl = attachmentUrl;
    } else {
      publicAttachmentUrl = (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : (req.protocol + "://" + req.get("host"))) + attachmentUrl;
    }
    headerMedia = { type: attachmentType, url: publicAttachmentUrl, filename: attachmentFilename };
  }

  // Enviar la plantilla
  var sendResult = await whatsapp.sendTemplate(cleanPhone, templateName, languageCode, bodyParams, headerMedia, contact.phone_line || 1);

  // Guardar el mensaje en el historial
  var contentToSave = "[Plantilla: " + templateName + "]";
  if (bodyParams.length > 0) contentToSave += " " + bodyParams.join(", ");
  if (attachmentFilename) contentToSave += " [Adjunto: " + attachmentFilename + "]";

  var mediaType = null;
  var localMediaUrl = null;
  if (attachmentUrl && attachmentType === "document") {
    mediaType = "file";
    localMediaUrl = attachmentUrl;
  } else if (attachmentUrl && attachmentType === "image") {
    mediaType = "image";
    localMediaUrl = attachmentUrl;
  }

  var insertTplNew = db.prepare(
    "INSERT INTO messages (contact_id, direction, content, channel, agent_name, media_type, media_url, status) VALUES (?, 'outgoing', ?, 'whatsapp', ?, ?, ?, 'pending')"
  ).run(contactId, contentToSave, agentName, mediaType, localMediaUrl);
  updateMessageStatus(db, insertTplNew.lastInsertRowid, sendResult);

  // Pausar Claudia porque fue una interaccion humana
  pauseAiForContact(db, contactId, agentName);

  console.log("[TEMPLATE-NEW] " + agentName + " creo contacto '" + name + "' (" + cleanPhone + ") y envio plantilla '" + templateName + "' | Exito: " + sendResult.success);
  res.json({
    success: sendResult.success,
    isNew: isNew,
    contact: db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId),
    sendResult: sendResult,
    phoneUsed: cleanPhone
  });
});

// ============================================
// CONTACTS
// ============================================

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

router.patch("/conversations/:id/read-status", function(req, res) {
  var db = getDb();
  var isUnread = req.body.isUnread ? 1 : 0;
  var result = db.prepare("UPDATE contacts SET is_unread = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(isUnread, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Contacto no encontrado" });
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  res.json(contact);
});

router.get("/conversations/:id/attachments", function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  var msgs = db.prepare("SELECT id, direction, content, channel, agent_name, media_type, media_url, original_filename, created_at FROM messages WHERE contact_id = ? AND media_type IS NOT NULL AND media_url IS NOT NULL ORDER BY created_at DESC").all(req.params.id);
  var attachments = msgs.map(function(m) {
    var ext = m.original_filename ? ("." + m.original_filename.split(".").pop()).toLowerCase() : (m.media_url ? ("." + m.media_url.split(".").pop().split("?")[0]).toLowerCase() : "");
    var sizeBytes = null;
    if (m.media_url) {
      var fs2 = require("fs"); var path2 = require("path");
      var fname = m.media_url.replace("/api/media/", "");
      var fpath = path2.join(MEDIA_DIR, fname.split("?")[0]);
      try { sizeBytes = fs2.statSync(fpath).size; } catch(e) {}
    }
    return { id: m.id, direction: m.direction, media_type: m.media_type, media_url: m.media_url, original_filename: m.original_filename, ext: ext, size_bytes: sizeBytes, created_at: m.created_at, agent_name: m.agent_name };
  });
  res.json(attachments);
});

router.get("/contacts/:id/messages", function(req, res) {
  var db = getDb();
  // Self-JOIN para resolver la cita (reply): messages.reply_to_message_id guarda el wamid
  // (channel_message_id) del mensaje citado. Traemos un preview de ese mensaje para pintarlo
  // en el CRM sin que el frontend tenga que buscarlo aparte.
  var messages = db.prepare(
    "SELECT m.*, " +
    "  q.content AS reply_content, " +
    "  q.direction AS reply_direction, " +
    "  q.agent_name AS reply_agent_name, " +
    "  q.media_type AS reply_media_type, " +
    "  q.original_filename AS reply_original_filename " +
    "FROM messages m " +
    "LEFT JOIN messages q ON q.channel_message_id = m.reply_to_message_id AND q.contact_id = m.contact_id " +
    "WHERE m.contact_id = ? ORDER BY m.created_at ASC"
  ).all(req.params.id);
  res.json(messages);
});

router.post("/contacts/:id/messages", async function(req, res) {
  try {
    var db = getDb();
    var content = req.body.content;
    var agent_name = req.body.agent_name;
    var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
    if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
    if (!content || !content.trim()) return res.status(400).json({ error: "Mensaje vacio" });

    // Cita (reply): el frontend manda el id INTERNO del mensaje citado. Resolvemos su wamid
    // para guardarlo y (en WhatsApp) enviarlo por Meta con context.
    var replyToInternalId = req.body.reply_to_message_id || null;
    var replyToWamid = resolveReplyWamid(db, replyToInternalId);

    var result = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name, status, reply_to_message_id) VALUES (?, 'outgoing', ?, ?, ?, 'pending', ?)").run(contact.id, content.trim(), contact.channel, agent_name || "Agente", replyToWamid);
    db.prepare("UPDATE contacts SET is_unread = 0 WHERE id = ?").run(contact.id);

    // Pausar Claudia: un agente humano tomo el control de la conversacion
    pauseAiForContact(db, contact.id, agent_name);

    var sendResult = { success: true, simulated: true };
    if (contact.channel === "whatsapp") {
      sendResult = await whatsapp.sendMessage(contact.channel_id, content.trim(), contact.phone_line || 1, replyToWamid);
    } else if (contact.channel === "instagram") {
      sendResult = await instagram.sendMessage(contact.channel_id, content.trim());
    } else if (contact.channel === "facebook") {
      sendResult = await facebook.sendMessage(contact.channel_id, content.trim());
    } else if (contact.channel === "email") {
      sendResult = await emailService.sendMessage(contact.email, "Re: Consulta", content.trim());
    }
    updateMessageStatus(db, result.lastInsertRowid, sendResult);
    var message = db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid);
    var updatedContact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contact.id);
    res.json({ message: message, sendResult: sendResult, contact: updatedContact });
  } catch (err) {
    console.error("[POST /contacts/:id/messages] contactId=" + req.params.id
      + " channel=" + (typeof contact !== "undefined" && contact ? contact.channel : "n/a")
      + " channel_id=" + (typeof contact !== "undefined" && contact ? contact.channel_id : "n/a")
      + " errCode=" + err.code
      + " errMessage=" + err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message || "Error enviando mensaje", code: err.code });
  }
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

// ============================================
// AGENTS & ROUTING
// ============================================

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

// ============================================
// METRICS
// ============================================

router.get("/metrics", function(req, res) {
  var db = getDb();
  var totalMessages = db.prepare("SELECT COUNT(*) as count FROM messages").get().count;
  var totalContacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get().count;
  var totalConversations = db.prepare("SELECT COUNT(DISTINCT contact_id) as count FROM messages").get().count;
  var byChannel = db.prepare("SELECT channel, COUNT(*) as count FROM messages GROUP BY channel ORDER BY count DESC").all();
  var byDepartment = db.prepare("SELECT department, COUNT(*) as count FROM contacts GROUP BY department ORDER BY count DESC").all();
  var byStatus = db.prepare("SELECT status, COUNT(*) as count FROM contacts GROUP BY status ORDER BY count DESC").all();
  var byStage = db.prepare("SELECT conversation_stage, COUNT(*) as count FROM contacts WHERE conversation_stage IS NOT NULL GROUP BY conversation_stage ORDER BY count DESC").all();
  var lostStats = db.prepare("SELECT lost_reason, COUNT(*) as count FROM contacts WHERE conversation_stage = 'cerrado_perdido' AND lost_reason IS NOT NULL GROUP BY lost_reason ORDER BY count DESC").all();
  res.json({ totalMessages: totalMessages, totalContacts: totalContacts, totalConversations: totalConversations, byChannel: byChannel, byDepartment: byDepartment, byStatus: byStatus, byStage: byStage, lostStats: lostStats });
});

// ============================================
// VENTANA 24HS WHATSAPP
// ============================================

// Devuelve si la ventana de 24hs esta abierta para enviar mensajes free-form
// a un contacto de WhatsApp. La ventana se abre cuando el contacto nos escribe
// y se cierra 24hs despues del ultimo mensaje entrante.
function checkWhatsappWindow(db, contactId) {
  var row = db.prepare(
    "SELECT MAX(created_at) as last FROM messages WHERE contact_id = ? AND direction = 'incoming'"
  ).get(contactId);
  if (!row || !row.last) return { open: false, lastIncomingAt: null, hoursSince: null };
  var ts = new Date(String(row.last).replace(" ", "T") + "Z");
  var hoursSince = (Date.now() - ts.getTime()) / (1000 * 60 * 60);
  return { open: hoursSince < 24, lastIncomingAt: row.last, hoursSince: hoursSince };
}

router.get("/contacts/:id/whatsapp-window", function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  res.json(checkWhatsappWindow(db, contact.id));
});

// Helper: convierte una URL relativa (/api/media/xxx) o absoluta a URL publica
function toPublicUrl(req, mediaUrl) {
  if (!mediaUrl) return null;
  if (mediaUrl.indexOf("http") === 0) return mediaUrl;
  var base = process.env.RAILWAY_PUBLIC_DOMAIN
    ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN
    : (req.protocol + "://" + req.get("host"));
  return base + mediaUrl;
}

// Helper: dado un mediaUrl tipo "/api/media/<filename>", devuelve el path absoluto en disco
function mediaUrlToDiskPath(mediaUrl) {
  if (!mediaUrl) return null;
  var fname = mediaUrl.replace(/^\/api\/media\//, "").split("?")[0];
  var safe = fname.replace(/[^a-zA-Z0-9._\-=:]/g, "");
  if (safe.indexOf("..") !== -1) return null;
  return path.join(MEDIA_DIR, safe);
}

// Helper: fusiona varios PDFs (rutas en disco) en uno solo. Devuelve { filename, mediaUrl }
async function mergePdfFiles(diskPaths, outputBasename) {
  var PDFDocument = require("pdf-lib").PDFDocument;
  var merged = await PDFDocument.create();
  for (var i = 0; i < diskPaths.length; i++) {
    var bytes = fs.readFileSync(diskPaths[i]);
    var doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    var pages = await merged.copyPages(doc, doc.getPageIndices());
    for (var j = 0; j < pages.length; j++) merged.addPage(pages[j]);
  }
  var outBytes = await merged.save();
  var outName = "merged_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8) + ".pdf";
  var outPath = path.join(MEDIA_DIR, outName);
  fs.writeFileSync(outPath, outBytes);
  return { filename: outName, mediaUrl: "/api/media/" + outName, originalName: outputBasename || "Documentacion.pdf" };
}

// ============================================
// ENVIAR DOCUMENTACION (varios PDF unidos)
// Plantilla: envio_documentacion, header: document, {{1}} = nombre cliente
// ============================================

router.post("/contacts/:id/send-documentation", async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  if (contact.channel !== "whatsapp") return res.status(400).json({ error: "Solo funciona para WhatsApp" });

  var attachments = req.body.attachments || []; // [{url, filename}]
  var agentName = req.body.agent_name || "Agente";
  var templateName = req.body.template_name || "envio_documentacion";
  var languageCode = req.body.language_code || "es";

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return res.status(400).json({ error: "Tenes que adjuntar al menos un PDF" });
  }

  // Resolver rutas en disco
  var diskPaths = [];
  for (var i = 0; i < attachments.length; i++) {
    var p = mediaUrlToDiskPath(attachments[i].url);
    if (!p || !fs.existsSync(p)) {
      return res.status(400).json({ error: "Archivo no encontrado en el servidor: " + (attachments[i].filename || attachments[i].url) });
    }
    diskPaths.push(p);
  }

  // Fusionar PDFs (si es uno solo, igual lo re-escribimos para mantener un solo flujo)
  var mergedInfo;
  try {
    var baseName = (attachments.length === 1 && attachments[0].filename)
      ? attachments[0].filename
      : "Documentacion_" + (contact.name || "cliente").replace(/[^a-zA-Z0-9_\- ]/g, "_") + ".pdf";
    mergedInfo = await mergePdfFiles(diskPaths, baseName);
  } catch (err) {
    console.error("[DOCUMENTACION] Error fusionando PDFs:", err.message);
    return res.status(500).json({ error: "No se pudieron fusionar los PDFs: " + err.message });
  }

  var publicUrl = toPublicUrl(req, mergedInfo.mediaUrl);
  var nombreCliente = (contact.name || "").trim() || "Estimado/a";

  var headerMedia = { type: "document", url: publicUrl, filename: mergedInfo.originalName };
  var sendResult = await whatsapp.sendTemplate(
    contact.channel_id,
    templateName,
    languageCode,
    [nombreCliente],
    headerMedia,
    contact.phone_line || 1
  );

  var contentToSave = "[Plantilla: " + templateName + "] " + nombreCliente + " [Adjunto: " + mergedInfo.originalName + " (" + attachments.length + " archivo" + (attachments.length > 1 ? "s unidos" : "") + ")]";
  var insertRes = db.prepare(
    "INSERT INTO messages (contact_id, direction, content, channel, agent_name, media_type, media_url, original_filename, status) VALUES (?, 'outgoing', ?, ?, ?, 'file', ?, ?, 'pending')"
  ).run(contact.id, contentToSave, contact.channel, agentName, mergedInfo.mediaUrl, mergedInfo.originalName);

  pauseAiForContact(db, contact.id, agentName);
  updateMessageStatus(db, insertRes.lastInsertRowid, sendResult);

  var message = db.prepare("SELECT * FROM messages WHERE id = ?").get(insertRes.lastInsertRowid);
  console.log("[DOCUMENTACION] " + agentName + " envio " + attachments.length + " archivos unidos a " + contact.name + " | Exito: " + sendResult.success);
  res.json({ message: message, sendResult: sendResult, merged: mergedInfo });
});

// ============================================
// PEDIR COTIZACION A PROVEEDOR
// Texto descriptivo OBLIGATORIO + adjuntos opcionales (0..n, PDF o imagenes).
// Si la ventana de 24hs esta cerrada, primero se envia la plantilla
// `solicitud_cotizacion` (solo texto, {{1}} = nombre del proveedor) y despues
// el texto + adjuntos por la API normal.
// ============================================

router.post("/contacts/:id/send-supplier-request", async function(req, res) {
  var db = getDb();
  var contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  if (contact.channel !== "whatsapp") return res.status(400).json({ error: "Solo funciona para WhatsApp" });

  var text = (req.body.text || "").trim();
  var attachments = req.body.attachments || []; // [{url, filename, mediaType}]
  var agentName = req.body.agent_name || "Agente";
  var templateName = req.body.template_name || "solicitud_cotizacion";
  var languageCode = req.body.language_code || "es";

  if (!text) return res.status(400).json({ error: "El texto descriptivo es obligatorio" });

  var windowStatus = checkWhatsappWindow(db, contact.id);
  var phoneLine = contact.phone_line || 1;
  var steps = [];
  var allOk = true;
  var templateResult = null;

  pauseAiForContact(db, contact.id, agentName);

  // 1) Si la ventana esta cerrada, primero la plantilla
  if (!windowStatus.open) {
    var nombreProveedor = (contact.name || "").trim() || "Proveedor";
    templateResult = await whatsapp.sendTemplate(
      contact.channel_id,
      templateName,
      languageCode,
      [nombreProveedor],
      null, // sin header
      phoneLine
    );
    var tplContent = "[Plantilla: " + templateName + "] " + nombreProveedor;
    var tplIns = db.prepare(
      "INSERT INTO messages (contact_id, direction, content, channel, agent_name, status) VALUES (?, 'outgoing', ?, ?, ?, 'pending')"
    ).run(contact.id, tplContent, contact.channel, agentName);
    updateMessageStatus(db, tplIns.lastInsertRowid, templateResult);
    steps.push({ type: "template", result: templateResult });
    if (!templateResult.success) allOk = false;
  }

  // 2) Texto descriptivo via API normal
  var textResult = await whatsapp.sendMessage(contact.channel_id, text, phoneLine);
  var textIns = db.prepare(
    "INSERT INTO messages (contact_id, direction, content, channel, agent_name, status) VALUES (?, 'outgoing', ?, ?, ?, 'pending')"
  ).run(contact.id, text, contact.channel, agentName);
  updateMessageStatus(db, textIns.lastInsertRowid, textResult);
  steps.push({ type: "text", result: textResult });
  if (!textResult.success) allOk = false;

  // 3) Adjuntos (uno por uno)
  var attachmentResults = [];
  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];
    var attUrl = toPublicUrl(req, att.url);
    var mt = att.mediaType || "file"; // "image" | "file"
    var captionForFirst = null; // ya enviamos el texto antes, no repetir
    var attRes = await whatsapp.sendMedia(contact.channel_id, mt, attUrl, captionForFirst, phoneLine, att.filename);

    var localMediaType = mt === "image" ? "image" : "file";
    var attContent = att.filename ? "[" + (localMediaType === "image" ? "Imagen" : "Archivo") + ": " + att.filename + "]" : (localMediaType === "image" ? "[Imagen]" : "[Archivo]");
    var attIns = db.prepare(
      "INSERT INTO messages (contact_id, direction, content, channel, agent_name, media_type, media_url, original_filename, status) VALUES (?, 'outgoing', ?, ?, ?, ?, ?, ?, 'pending')"
    ).run(contact.id, attContent, contact.channel, agentName, localMediaType, att.url, att.filename || null);
    updateMessageStatus(db, attIns.lastInsertRowid, attRes);
    attachmentResults.push({ filename: att.filename, result: attRes });
    if (!attRes.success) allOk = false;
  }

  console.log("[COTIZACION-PROV] " + agentName + " -> " + contact.name + " | ventana: " + (windowStatus.open ? "abierta" : "cerrada") + " | adjuntos: " + attachments.length + " | exito: " + allOk);

  res.json({
    success: allOk,
    windowWasOpen: windowStatus.open,
    hoursSinceLastIncoming: windowStatus.hoursSince,
    templateResult: templateResult,
    textResult: textResult,
    attachmentResults: attachmentResults,
    steps: steps
  });
});

// ============================================
// PRESUPUESTOS
// ============================================

router.get("/quotes", function(req, res) {
  var db = getDb();
  var status = req.query.status;
  var created_by = req.query.created_by;
  var query = "SELECT q.*, c.name as contact_name, c.channel as contact_channel, c.phone as contact_phone, c.email as contact_email FROM quotes q JOIN contacts c ON q.contact_id = c.id WHERE 1=1";
  var params = [];
  if (status && status !== "all") { query += " AND q.status = ?"; params.push(status); }
  if (created_by && created_by !== "all") { query += " AND q.created_by = ?"; params.push(created_by); }
  query += " ORDER BY q.created_at DESC";
  var stmt = db.prepare(query);
  var quotes = params.length > 0 ? stmt.all.apply(stmt, params) : stmt.all();
  res.json(quotes);
});

router.get("/quotes/stats", function(req, res) {
  var db = getDb();
  try {
    var total = db.prepare("SELECT COUNT(*) as count FROM quotes").get().count;
    var totalAmount = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM quotes").get().total;
    var totalAlternatives = db.prepare("SELECT COALESCE(SUM(alternatives), 0) as total FROM quotes").get().total;
    var byStatus = db.prepare("SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM quotes GROUP BY status ORDER BY count DESC").all();
    var byUser = db.prepare("SELECT created_by, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount, COALESCE(SUM(alternatives), 0) as total_alternatives FROM quotes GROUP BY created_by ORDER BY count DESC").all();
    var approvedStats = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END) AS approved FROM quotes").get();
    var approvedRate = approvedStats.total > 0 ? Math.round((approvedStats.approved / approvedStats.total) * 1000) / 10 : 0;
    var upcomingFollowups = db.prepare("SELECT q.*, c.name as contact_name FROM quotes q JOIN contacts c ON q.contact_id = c.id WHERE q.followup_date IS NOT NULL AND q.followup_date <= date('now', '+3 days') AND q.status IN ('pendiente', 'enviado') ORDER BY q.followup_date ASC LIMIT 20").all();
    res.json({ total: total, totalAmount: totalAmount, totalAlternatives: totalAlternatives, byStatus: byStatus, byUser: byUser, approvedRate: approvedRate, upcomingFollowups: upcomingFollowups });
  } catch (e) {
    res.json({ total: 0, totalAmount: 0, totalAlternatives: 0, byStatus: [], byUser: [], approvedRate: 0, upcomingFollowups: [] });
  }
});

router.get("/quotes/:id", function(req, res) {
  var db = getDb();
  var quote = db.prepare("SELECT q.*, c.name as contact_name, c.channel as contact_channel, c.phone as contact_phone, c.email as contact_email FROM quotes q JOIN contacts c ON q.contact_id = c.id WHERE q.id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Presupuesto no encontrado" });
  res.json(quote);
});

router.post("/quotes", function(req, res) {
  var db = getDb();
  var contact_id = req.body.contact_id;
  var description = req.body.description || "";
  var amount = req.body.amount || 0;
  var alternatives = req.body.alternatives || 1;
  var status = req.body.status || "pendiente";
  var created_by = req.body.created_by || "Sin asignar";
  var channel = req.body.channel || "";
  var received_at = req.body.received_at || null;
  var delivery_date = req.body.delivery_date || null;
  var followup_date = req.body.followup_date || null;
  var notes = req.body.notes || "";
  if (!contact_id) return res.status(400).json({ error: "contact_id es requerido" });
  var contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(contact_id);
  if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });
  var result = db.prepare("INSERT INTO quotes (contact_id, description, amount, alternatives, status, created_by, channel, received_at, delivery_date, followup_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(contact_id, description, amount, alternatives, status, created_by, channel, received_at, delivery_date, followup_date, notes);
  var quote = db.prepare("SELECT q.*, c.name as contact_name FROM quotes q JOIN contacts c ON q.contact_id = c.id WHERE q.id = ?").get(result.lastInsertRowid);
  console.log("[PRESUPUESTO] Nuevo #" + quote.id + " - " + quote.contact_name + " - $" + amount + " (" + alternatives + " alt.) por " + created_by);
  res.json(quote);
});

router.put("/quotes/:id", function(req, res) {
  var db = getDb();
  var updates = [];
  var values = [];
  if (req.body.description !== undefined) { updates.push("description = ?"); values.push(req.body.description); }
  if (req.body.amount !== undefined) { updates.push("amount = ?"); values.push(req.body.amount); }
  if (req.body.alternatives !== undefined) { updates.push("alternatives = ?"); values.push(req.body.alternatives); }
  if (req.body.status !== undefined) { updates.push("status = ?"); values.push(req.body.status); }
  if (req.body.created_by !== undefined) { updates.push("created_by = ?"); values.push(req.body.created_by); }
  if (req.body.channel !== undefined) { updates.push("channel = ?"); values.push(req.body.channel); }
  if (req.body.received_at !== undefined) { updates.push("received_at = ?"); values.push(req.body.received_at); }
  if (req.body.delivery_date !== undefined) { updates.push("delivery_date = ?"); values.push(req.body.delivery_date); }
  if (req.body.followup_date !== undefined) { updates.push("followup_date = ?"); values.push(req.body.followup_date); }
  if (req.body.notes !== undefined) { updates.push("notes = ?"); values.push(req.body.notes); }
  if (updates.length === 0) return res.status(400).json({ error: "Nada que actualizar" });
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(req.params.id);
  db.prepare("UPDATE quotes SET " + updates.join(", ") + " WHERE id = ?").run(values);
  var updated = db.prepare("SELECT q.*, c.name as contact_name FROM quotes q JOIN contacts c ON q.contact_id = c.id WHERE q.id = ?").get(req.params.id);
  if (req.body.status) {
    console.log("[PRESUPUESTO] #" + req.params.id + " -> " + req.body.status);
  }
  res.json(updated);
});

router.delete("/quotes/:id", function(req, res) {
  var db = getDb();
  var quote = db.prepare("SELECT id FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Presupuesto no encontrado" });
  db.prepare("DELETE FROM quotes WHERE id = ?").run(req.params.id);
  console.log("[PRESUPUESTO] Eliminado #" + req.params.id);
  res.json({ success: true });
});

module.exports = router;
