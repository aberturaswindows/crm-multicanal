var express = require("express");
var router = express.Router();
var getDb = require("../db/setup").getDb;
var classifyMessage = require("../services/ai-router").classifyMessage;
var generateAutoReply = require("../services/ai-router").generateAutoReply;
var detectLostReason = require("../services/ai-router").detectLostReason;
var whatsapp = require("../services/channels/whatsapp");
var instagram = require("../services/channels/instagram");
var facebook = require("../services/channels/facebook");
var email = require("../services/channels/email");
var fs = require("fs");
var path = require("path");
var axios = require("axios");
var FormData = require("form-data");

var MEDIA_DIR = fs.existsSync("/data") ? "/data/media" : path.join(__dirname, "..", "data", "media");
if (!fs.existsSync(MEDIA_DIR)) { try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch(e) {} }

// Cola simple en memoria para procesar auto-replies secuencialmente.
// Esto evita que 50 mensajes simultaneos disparen 50 llamadas a la IA a la vez
// y provoquen rate limits (429) en la API de Anthropic.
var autoReplyQueue = [];
var autoReplyProcessing = false;
var MIN_DELAY_BETWEEN_REPLIES_MS = 1500; // 1.5s entre cada respuesta
var debounceTimers = {}; // contactId -> setTimeout handle; espera 10s de silencio antes de disparar auto-reply

async function processAutoReplyQueue() {
  if (autoReplyProcessing) return;
  autoReplyProcessing = true;
  while (autoReplyQueue.length > 0) {
    var job = autoReplyQueue.shift();
    try {
      // Re-leer el contacto desde DB por si su estado cambio mientras estaba en cola
      var db = getDb();
      var freshContact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(job.contact.id);
      if (freshContact && !freshContact.ai_paused) {
        await handleAutoReply(freshContact, job.channel);
      } else if (freshContact && freshContact.ai_paused) {
        console.log("[QUEUE] Saltado auto-reply para " + freshContact.name + " (Claudia fue pausada mientras estaba en cola)");
      }
    } catch (err) {
      console.error("[QUEUE] Error procesando auto-reply:", err.message);
    }
    // Pequena espera entre respuestas para no saturar la API
    if (autoReplyQueue.length > 0) {
      await new Promise(function(resolve) { setTimeout(resolve, MIN_DELAY_BETWEEN_REPLIES_MS); });
    }
  }
  autoReplyProcessing = false;
}

function enqueueAutoReply(contact, channel) {
  autoReplyQueue.push({ contact: contact, channel: channel });
  console.log("[QUEUE] Encolado auto-reply para " + contact.name + " (posicion " + autoReplyQueue.length + " en cola)");
  // Arrancar procesamiento con un pequeno delay inicial
  setTimeout(function() { processAutoReplyQueue(); }, 1500);
}

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

async function sendChannelMessage(channel, channelId, phoneLine, contactEmail, text) {
  var sendResult = { success: true, simulated: true };
  if (channel === "whatsapp") {
    sendResult = await whatsapp.sendMessage(channelId, text, phoneLine || 1);
  } else if (channel === "instagram") {
    sendResult = await instagram.sendMessage(channelId, text);
  } else if (channel === "facebook") {
    sendResult = await facebook.sendMessage(channelId, text);
  } else if (channel === "email") {
    sendResult = await email.sendMessage(contactEmail, "Re: Consulta - Aberturas Windows", text);
  }
  return sendResult;
}

async function downloadMediaIfNeeded(normalized) {
  if (!normalized._needsDownload || !normalized.mediaUrl) return;
  try {
    var downloadFn = null;
    if (normalized.channel === "instagram") {
      downloadFn = instagram.downloadMedia;
    } else if (normalized.channel === "facebook") {
      downloadFn = facebook.downloadMedia;
    } else if (normalized.channel === "whatsapp") {
      downloadFn = whatsapp.downloadMedia;
    }
    if (downloadFn) {
      var localUrl = await downloadFn(normalized.mediaUrl, normalized.mediaType, normalized.messageId);
      normalized.mediaUrl = localUrl;
      console.log("[MEDIA] Descargada y guardada: " + localUrl);
    }
  } catch (err) {
    console.error("[MEDIA] Error descargando:", err.message);
  }
}

async function transcribeAudio(mediaUrl) {
  var apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[TRANSCRIPCION] OPENAI_API_KEY no configurada, no se puede transcribir");
    return null;
  }

  try {
    var audioPath = null;

    if (mediaUrl.startsWith("/media/") || mediaUrl.startsWith("/api/media/")) {
      audioPath = path.join(MEDIA_DIR, path.basename(mediaUrl));
    } else if (mediaUrl.startsWith("http")) {
      var tmpPath = path.join(MEDIA_DIR, "tmp_audio_" + Date.now() + ".ogg");
      var response = await axios.get(mediaUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(tmpPath, response.data);
      audioPath = tmpPath;
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      console.log("[TRANSCRIPCION] Archivo de audio no encontrado: " + mediaUrl);
      return null;
    }

    var form = new FormData();
    form.append("file", fs.createReadStream(audioPath), { filename: "audio.ogg", contentType: "audio/ogg" });
    form.append("model", "whisper-1");
    form.append("language", "es");

    var res = await axios.post("https://api.openai.com/v1/audio/transcriptions", form, {
      headers: Object.assign({ "Authorization": "Bearer " + apiKey }, form.getHeaders()),
      maxContentLength: 25 * 1024 * 1024,
      timeout: 30000
    });

    var transcription = res.data && res.data.text ? res.data.text.trim() : null;

    if (audioPath.indexOf("tmp_audio_") !== -1) {
      try { fs.unlinkSync(audioPath); } catch(e) {}
    }

    if (transcription) {
      console.log("[TRANSCRIPCION] OK: " + transcription.substring(0, 80) + "...");
    }
    return transcription;
  } catch (err) {
    console.error("[TRANSCRIPCION] Error:", err.response ? err.response.data : err.message);
    return null;
  }
}

function handleStatusUpdate(statusEvent) {
  // Procesa eventos de status de WhatsApp Cloud API (sent/delivered/read/failed).
  // Los webhooks pueden llegar fuera de orden (read antes que delivered); los guards
  // WHERE status NOT IN (...) evitan retrocesos de estado.
  var db = getDb();
  try {
    var msg = db.prepare("SELECT id, status FROM messages WHERE channel_message_id = ?").get(statusEvent.channelMessageId);
    if (!msg) {
      console.log("[STATUS] Mensaje no encontrado: channel_message_id=" + statusEvent.channelMessageId + " (" + statusEvent.status + ")");
      return;
    }
    var ts = new Date(parseInt(statusEvent.timestamp, 10) * 1000).toISOString();
    if (statusEvent.status === "read") {
      db.prepare("UPDATE messages SET status='read', read_at=? WHERE id=?").run(ts, msg.id);
    } else if (statusEvent.status === "delivered" && msg.status !== 'read') {
      db.prepare("UPDATE messages SET status='delivered', delivered_at=? WHERE id=?").run(ts, msg.id);
    } else if (statusEvent.status === "sent" && msg.status !== 'read' && msg.status !== 'delivered') {
      db.prepare("UPDATE messages SET status='sent', sent_at=? WHERE id=?").run(ts, msg.id);
    } else if (statusEvent.status === "failed") {
      db.prepare("UPDATE messages SET status='failed', failed_reason=? WHERE id=?").run(statusEvent.error || 'Unknown error', msg.id);
    }
    console.log("[STATUS] " + statusEvent.channelMessageId + " -> " + statusEvent.status + " (msg.id=" + msg.id + ")");
  } catch (err) {
    console.error("[STATUS] Error:", err.message);
  }
}

async function handleAutoReply(contact, channel) {
  try {
    var db = getDb();
    var messages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(contact.id);
    var result = await generateAutoReply(contact, messages);

    if (!result.reply) {
      console.log("[AUTO-REPLY] Sin respuesta para " + contact.name + " (etapa: " + (contact.conversation_stage || "consulta") + (contact.ai_paused ? ", IA pausada" : "") + ")");
      return;
    }

    if (result.stageChange) {
      var updates = { conversation_stage: result.stageChange };
      if (result.stageChange === "cerrado_perdido") {
        var lastMsg = db.prepare("SELECT content FROM messages WHERE contact_id = ? AND direction = 'incoming' ORDER BY created_at DESC LIMIT 1").get(contact.id);
        if (lastMsg) {
          var reason = await detectLostReason(lastMsg.content);
          updates.lost_reason = reason;
        }
      }
      var setClauses = [];
      var setValues = [];
      var keys = Object.keys(updates);
      for (var i = 0; i < keys.length; i++) {
        setClauses.push(keys[i] + " = ?");
        setValues.push(updates[keys[i]]);
      }
      setClauses.push("updated_at = CURRENT_TIMESTAMP");
      setValues.push(contact.id);
      db.prepare("UPDATE contacts SET " + setClauses.join(", ") + " WHERE id = ?").run(setValues);
      console.log("[AUTO-REPLY] Etapa cambiada: " + (contact.conversation_stage || "consulta") + " -> " + result.stageChange + " | " + contact.name);

      if (result.stageChange === "datos_completos") {
        console.log("[AUTO-REPLY] *** ATENCION: " + contact.name + " tiene todos los datos para cotizar. Armar presupuesto. ***");

        if (result.resumen) {
          try {
            var r = result.resumen;
            var cotizResult = db.prepare("INSERT INTO cotizaciones_datos (contact_id, nombre, telefono, instalacion, direccion, tiene_plano, color, vidrio, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
              contact.id,
              r.nombre || null,
              r.telefono || null,
              r.instalacion === "Si" ? 1 : 0,
              r.direccion || null,
              r.tiene_plano === "Si" ? 1 : 0,
              r.color || null,
              r.vidrio || null,
              r.notas || null
            );
            var cotizId = cotizResult.lastInsertRowid;
            if (Array.isArray(r.aberturas)) {
              for (var ai = 0; ai < r.aberturas.length; ai++) {
                var ab = r.aberturas[ai];
                db.prepare("INSERT INTO cotizaciones_aberturas (cotizacion_datos_id, contact_id, tipo, ancho_cm, alto_cm, cantidad) VALUES (?, ?, ?, ?, ?, ?)").run(
                  cotizId, contact.id, ab.tipo || null, ab.ancho_cm || null, ab.alto_cm || null, ab.cantidad || 1
                );
              }
            }
            var fichaTexto = "📋 FICHA PARA COTIZAR\n";
            fichaTexto += "━━━━━━━━━━━━━━━━━━━━━\n";
            fichaTexto += "👤 Nombre: " + (r.nombre || "No indicado") + "\n";
            fichaTexto += "📞 Teléfono: " + (r.telefono || "No indicado") + "\n";
            fichaTexto += "🔧 Instalación: " + (r.instalacion || "No indicado") + "\n";
            fichaTexto += "📍 Dirección: " + (r.direccion || "No indicada") + "\n";
            fichaTexto += "📐 Plano: " + (r.tiene_plano || "No indicado") + "\n";
            fichaTexto += "🎨 Color: " + (r.color || "No indicado") + "\n";
            fichaTexto += "🔲 Vidrio: " + (r.vidrio || "No indicado") + "\n";
            if (Array.isArray(r.aberturas) && r.aberturas.length > 0) {
              fichaTexto += "🪟 Aberturas:\n";
              for (var fi = 0; fi < r.aberturas.length; fi++) {
                var fab = r.aberturas[fi];
                fichaTexto += "   • " + (fab.tipo || "Abertura") + ": " + (fab.ancho_cm || "?") + " x " + (fab.alto_cm || "?") + " cm";
                if (fab.cantidad > 1) fichaTexto += " (x" + fab.cantidad + ")";
                fichaTexto += "\n";
              }
            } else {
              fichaTexto += "🪟 Aberturas: No indicadas\n";
            }
            if (r.notas) fichaTexto += "📝 Notas: " + r.notas + "\n";
            fichaTexto += "━━━━━━━━━━━━━━━━━━━━━";
            db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name) VALUES (?, 'system', ?, ?, 'Sistema')").run(contact.id, fichaTexto, channel);
            console.log("[FICHA] Guardada para " + contact.name + " (cotizacion #" + cotizId + ", " + (Array.isArray(r.aberturas) ? r.aberturas.length : 0) + " aberturas)");
          } catch (fichaErr) {
            console.error("[FICHA] Error guardando ficha:", fichaErr.message);
          }
        }
      }
    }

    var insertResult = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name, status) VALUES (?, 'outgoing', ?, ?, 'Claudia', 'pending')").run(contact.id, result.reply, channel);
    var msgId = insertResult.lastInsertRowid;

    var sendResult = await sendChannelMessage(channel, contact.channel_id, contact.phone_line, contact.email, result.reply);
    if (sendResult.success) {
      db.prepare("UPDATE messages SET status='sent', sent_at=CURRENT_TIMESTAMP, channel_message_id=? WHERE id=?").run(sendResult.messageId || null, msgId);
    } else {
      db.prepare("UPDATE messages SET status='failed', failed_reason=? WHERE id=?").run(sendResult.error || 'Unknown error', msgId);
    }
    console.log("[CLAUDIA] " + channel.toUpperCase() + " -> " + contact.name + ": " + result.reply.substring(0, 60) + "... | Enviado: " + sendResult.success);
  } catch (err) {
    console.error("[AUTO-REPLY] Error:", err.message);
  }
}

async function handleIncomingMessage(normalized) {
  var db = getDb();
  try {
    if (normalized._needsDownload) {
      await downloadMediaIfNeeded(normalized);
    }

    if (normalized.mediaType === "audio" && normalized.mediaUrl) {
      var transcription = await transcribeAudio(normalized.mediaUrl);
      if (transcription) {
        normalized.text = transcription;
        normalized._transcribed = true;
        console.log("[AUDIO] Transcripcion exitosa para mensaje de " + (normalized.senderName || "desconocido"));
      }
    }

    var contact = db.prepare("SELECT * FROM contacts WHERE channel = ? AND channel_id = ?").get(normalized.channel, normalized.channelId);
    if (!contact) {
      var result = db.prepare("INSERT INTO contacts (name, phone, email, channel, channel_id, phone_line, department, status, origin, conversation_stage) VALUES (?, ?, ?, ?, ?, ?, 'ventas', 'lead', ?, 'consulta')").run(normalized.senderName || "Contacto nuevo", normalized.senderPhone || null, normalized.senderEmail || null, normalized.channel, normalized.channelId, normalized.phoneLine || null, normalized.channel);
      contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(result.lastInsertRowid);
    }
    if (contact && normalized.senderName && normalized.senderName !== contact.name && contact.name.match(/^\d{10,}$/)) {
      db.prepare("UPDATE contacts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(normalized.senderName, contact.id);
      contact.name = normalized.senderName;
    }

    var stage = contact.conversation_stage || "consulta";
    if (stage === "presupuesto_enviado" || stage === "seguimiento" || stage === "sin_respuesta") {
      db.prepare("UPDATE contacts SET conversation_stage = 'seguimiento', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contact.id);
      contact.conversation_stage = "seguimiento";
    }
    if (stage === "cerrado_perdido" || stage === "cerrado_ganado") {
      contact.conversation_stage = stage;
    }

    var contentToSave = normalized.text;
    if (normalized._transcribed && normalized.mediaType === "audio") {
      contentToSave = normalized.text;
    }

    var insertedMsg = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, channel_message_id, media_type, media_url, story_url) VALUES (?, 'incoming', ?, ?, ?, ?, ?, ?)").run(contact.id, contentToSave, normalized.channel, normalized.messageId, normalized.mediaType || null, normalized.mediaUrl || null, normalized.storyUrl || null);
    if (normalized.originalFilename) {
      try { db.prepare("UPDATE messages SET original_filename = ? WHERE id = ?").run(normalized.originalFilename, insertedMsg.lastInsertRowid); } catch(e) {}
    }
    db.prepare("UPDATE contacts SET is_unread = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contact.id);

    var textForAi = normalized.text || "";
    if (normalized.storyUrl) { textForAi = "[Respuesta a historia de Instagram] " + textForAi; }
    if (normalized.mediaType === "audio" && !normalized._transcribed) { textForAi = textForAi || "[El cliente envio un mensaje de audio]"; }
    var recentMessages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10").all(contact.id).reverse();
    var classification = await classifyMessage(textForAi, recentMessages);
    if (classification.department !== contact.department) {
      db.prepare("UPDATE contacts SET department = ?, ai_confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(classification.department, classification.confidence, contact.id);
      db.prepare("INSERT INTO routing_log (contact_id, from_department, to_department, reason, confidence) VALUES (?, ?, ?, ?, ?)").run(contact.id, contact.department, classification.department, classification.reason, classification.confidence);
    }

    console.log("[" + normalized.channel.toUpperCase() + "] " + normalized.senderName + ": " + (normalized.text || "").substring(0, 50) + (normalized.mediaType ? " [" + normalized.mediaType + (normalized._transcribed ? " transcripto" : "") + "]" : "") + " -> " + classification.department + " (" + classification.confidence + ") | Etapa: " + (contact.conversation_stage || "consulta") + (contact.ai_paused ? " | IA PAUSADA" : ""));

    if (isAutoReplyEnabled(normalized.channel)) {
      var cId = contact.id;
      var cChannel = normalized.channel;
      if (debounceTimers[cId]) {
        clearTimeout(debounceTimers[cId]);
        console.log("[DEBOUNCE] Timer reiniciado para contacto " + cId);
      }
      debounceTimers[cId] = setTimeout(function() {
        delete debounceTimers[cId];
        var freshDb = getDb();
        var freshContact = freshDb.prepare("SELECT * FROM contacts WHERE id = ?").get(cId);
        if (freshContact && !freshContact.ai_paused) {
          enqueueAutoReply(freshContact, cChannel);
        }
      }, 10000);
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
      if (normalized && !normalized._isStatusEvent) {
        var igName = await instagram.getUserProfile(normalized.channelId);
        if (igName) { normalized.senderName = igName; }
      }
    } else if (object === "page") {
      normalized = facebook.processWebhook(body);
      if (normalized && !normalized._isStatusEvent) {
        var fbName = await facebook.getUserProfile(normalized.channelId);
        if (fbName) { normalized.senderName = fbName; }
      }
    }
    if (normalized && normalized._isStatusEvent) {
      handleStatusUpdate(normalized);
      return;
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

