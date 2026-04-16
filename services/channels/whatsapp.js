var axios = require("axios");
var fs = require("fs");
var path = require("path");

var GRAPH_API = "https://graph.facebook.com/v21.0";

var MEDIA_DIR = fs.existsSync("/data") ? "/data/media" : path.join(__dirname, "..", "..", "data", "media");
if (!fs.existsSync(MEDIA_DIR)) { try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch(e) {} }

// Solo se migra UNA linea (261-353-9384), pero se mantiene soporte multi-linea por si en el futuro se agregan
function getPhoneId(line) {
  var map = {
    1: process.env.WHATSAPP_PHONE_ID_1 || process.env.WHATSAPP_PHONE_ID,
    2: process.env.WHATSAPP_PHONE_ID_2,
    3: process.env.WHATSAPP_PHONE_ID_3
  };
  return map[line] || map[1];
}

/**
 * Enviar mensaje de texto por WhatsApp
 */
async function sendMessage(to, text, phoneLine) {
  var phoneId = getPhoneId(phoneLine || 1);
  var token = process.env.WHATSAPP_TOKEN;

  if (!phoneId || !token) {
    console.warn("[WHATSAPP] No configurado. Mensaje simulado:", to, text.substring(0, 50));
    return { success: true, simulated: true };
  }

  try {
    var res = await axios.post(GRAPH_API + "/" + phoneId + "/messages", {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text }
    }, {
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" }
    });

    var msgId = res.data.messages && res.data.messages[0] ? res.data.messages[0].id : null;
    return { success: true, messageId: msgId };
  } catch (err) {
    console.error("[WHATSAPP] Error enviando texto:", err.response ? err.response.data : err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Enviar archivo multimedia por WhatsApp
 * mediaType: "image" | "video" | "audio" | "document"
 * url: URL publica del archivo
 */
async function sendMedia(to, mediaType, url, caption, phoneLine) {
  var phoneId = getPhoneId(phoneLine || 1);
  var token = process.env.WHATSAPP_TOKEN;

  if (!phoneId || !token) {
    console.warn("[WHATSAPP] No configurado. Media simulado:", to);
    return { success: true, simulated: true };
  }

  var waType = mediaType;
  if (waType === "file") waType = "document";

  var body = {
    messaging_product: "whatsapp",
    to: to,
    type: waType
  };

  var mediaObj = { link: url };
  if (caption && (waType === "image" || waType === "video" || waType === "document")) {
    mediaObj.caption = caption;
  }
  body[waType] = mediaObj;

  try {
    var res = await axios.post(GRAPH_API + "/" + phoneId + "/messages", body, {
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" }
    });
    var msgId = res.data.messages && res.data.messages[0] ? res.data.messages[0].id : null;
    console.log("[WHATSAPP] Media enviado (" + waType + ") a " + to);
    return { success: true, messageId: msgId };
  } catch (err) {
    console.error("[WHATSAPP] Error enviando media:", err.response ? err.response.data : err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Descargar media de WhatsApp Cloud API
 * Paso 1: GET /media_id -> obtener URL temporal
 * Paso 2: GET url -> descargar archivo binario
 */
async function downloadMedia(mediaId, mediaType, messageId) {
  var token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;

  try {
    // Paso 1: obtener URL temporal del media
    var metaRes = await axios.get(GRAPH_API + "/" + mediaId, {
      headers: { "Authorization": "Bearer " + token }
    });

    var mediaUrl = metaRes.data.url;
    if (!mediaUrl) {
      console.error("[WHATSAPP] No se obtuvo URL para media " + mediaId);
      return null;
    }

    // Determinar extension segun tipo
    var ext = "bin";
    var mime = metaRes.data.mime_type || "";
    if (mediaType === "image") {
      ext = mime.indexOf("png") !== -1 ? "png" : mime.indexOf("webp") !== -1 ? "webp" : "jpg";
    } else if (mediaType === "video") {
      ext = "mp4";
    } else if (mediaType === "audio") {
      ext = "ogg";
    } else if (mediaType === "document" || mediaType === "file") {
      if (mime.indexOf("pdf") !== -1) ext = "pdf";
      else if (mime.indexOf("word") !== -1 || mime.indexOf("docx") !== -1) ext = "docx";
      else if (mime.indexOf("sheet") !== -1 || mime.indexOf("xlsx") !== -1) ext = "xlsx";
      else ext = "bin";
    } else if (mediaType === "sticker") {
      ext = "webp";
    }

    var filename = "wa_" + (messageId || Date.now()) + "." + ext;
    var filepath = path.join(MEDIA_DIR, filename);

    // Paso 2: descargar el archivo
    var response = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: { "Authorization": "Bearer " + token },
      timeout: 30000
    });

    fs.writeFileSync(filepath, response.data);
    console.log("[WHATSAPP] Media descargada: " + filename + " (" + Math.round(response.data.length / 1024) + " KB)");
    return "/api/media/" + filename;
  } catch (err) {
    console.error("[WHATSAPP] Error descargando media:", err.response ? err.response.data : err.message);
    return null;
  }
}

/**
 * Procesar webhook de WhatsApp Cloud API
 * Maneja: text, image, video, audio, document, sticker, location, contacts, reaction
 */
function processWebhook(body) {
  try {
    var entry = body.entry && body.entry[0] ? body.entry[0] : null;
    if (!entry) return null;
    var changes = entry.changes && entry.changes[0] ? entry.changes[0] : null;
    if (!changes) return null;
    var value = changes.value;
    if (!value) return null;

    // Ignorar eventos de status (entregado, leido, etc.)
    if (value.statuses) return null;

    // Verificar que hay mensajes
    if (!value.messages || !value.messages[0]) return null;

    var msg = value.messages[0];
    var contact = value.contacts && value.contacts[0] ? value.contacts[0] : null;
    var phoneNumberId = value.metadata ? value.metadata.phone_number_id : null;

    // Determinar que linea recibio el mensaje
    var phoneLine = 1;
    if (phoneNumberId === process.env.WHATSAPP_PHONE_ID_2) phoneLine = 2;
    if (phoneNumberId === process.env.WHATSAPP_PHONE_ID_3) phoneLine = 3;

    var text = "";
    var mediaType = null;
    var mediaUrl = null; // Para WA Cloud API, esto es el media ID que luego se descarga
    var needsDownload = false;

    var msgType = msg.type;

    if (msgType === "text") {
      text = msg.text && msg.text.body ? msg.text.body : "";
    } else if (msgType === "image") {
      mediaType = "image";
      mediaUrl = msg.image.id; // media ID, no URL
      text = msg.image.caption || "[Imagen]";
      needsDownload = true;
    } else if (msgType === "video") {
      mediaType = "video";
      mediaUrl = msg.video.id;
      text = msg.video.caption || "[Video]";
      needsDownload = true;
    } else if (msgType === "audio") {
      mediaType = "audio";
      mediaUrl = msg.audio.id;
      text = "[Audio]";
      needsDownload = true;
    } else if (msgType === "document") {
      mediaType = "file";
      mediaUrl = msg.document.id;
      text = msg.document.caption || "[Archivo]";
      if (msg.document.filename) {
        text = msg.document.caption || "[Archivo: " + msg.document.filename + "]";
      }
      needsDownload = true;
    } else if (msgType === "sticker") {
      mediaType = "image";
      mediaUrl = msg.sticker.id;
      text = "[Sticker]";
      needsDownload = true;
    } else if (msgType === "location") {
      var loc = msg.location;
      text = "[Ubicacion: " + (loc.name || "") + " " + (loc.address || "") + " (" + loc.latitude + ", " + loc.longitude + ")]";
    } else if (msgType === "contacts") {
      var shared = msg.contacts && msg.contacts[0] ? msg.contacts[0] : null;
      if (shared) {
        var phone = shared.phones && shared.phones[0] ? shared.phones[0].phone : "";
        text = "[Contacto: " + (shared.name && shared.name.formatted_name ? shared.name.formatted_name : "Sin nombre") + (phone ? " - " + phone : "") + "]";
      } else {
        text = "[Contacto compartido]";
      }
    } else if (msgType === "reaction") {
      // Ignorar reacciones por ahora
      return null;
    } else {
      text = "[Mensaje tipo: " + msgType + "]";
    }

    if (!text && !mediaType) return null;

    var senderName = contact && contact.profile ? contact.profile.name : msg.from;

    return {
      channel: "whatsapp",
      channelId: msg.from,
      senderName: senderName,
      senderPhone: msg.from,
      text: text,
      messageId: msg.id,
      timestamp: msg.timestamp,
      phoneLine: phoneLine,
      mediaType: mediaType,
      mediaUrl: mediaUrl,
      storyUrl: null,
      _needsDownload: needsDownload,
      _waMediaId: needsDownload ? mediaUrl : null // Guardamos el media ID original
    };
  } catch (err) {
    console.error("[WHATSAPP] Error procesando webhook:", err);
    return null;
  }
}

module.exports = { sendMessage: sendMessage, sendMedia: sendMedia, processWebhook: processWebhook, downloadMedia: downloadMedia };
