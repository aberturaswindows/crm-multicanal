// ============================================================
// CATALOGOS - envio automatico de catalogos por Claudia
// Hoy: catalogo de mamparas Glassic. Claudia lo pide con el campo
// "enviar_catalogo_mamparas" del JSON de respuesta y este modulo lo manda
// por el canal del cliente. Se envia UNA sola vez por contacto.
//
// El PDF vive en el repo (assets/catalogos/) y al arrancar se copia a la
// carpeta de media del CRM, asi se ve y se descarga en el chat igual que
// cualquier otro archivo, y Meta lo descarga desde /api/media/.
// Para actualizar el catalogo: reemplazar el PDF en assets/catalogos/ con
// el MISMO nombre y redeployar.
// ============================================================

var fs = require("fs");
var path = require("path");
var axios = require("axios");
var whatsapp = require("./channels/whatsapp");
var instagram = require("./channels/instagram");
var email = require("./channels/email");

var MEDIA_DIR = fs.existsSync("/data") ? "/data/media" : path.join(__dirname, "..", "data", "media");
var ASSETS_DIR = path.join(__dirname, "..", "assets", "catalogos");
var DEFAULT_PUBLIC_DOMAIN = "crm-multicanal-production.up.railway.app";

var CATALOGO_MAMPARAS = {
  archivo: "catalogo-mamparas-glassic.pdf",       // nombre en assets y en /api/media
  nombreVisible: "Catalogo Mamparas Glassic.pdf",  // nombre que ve el cliente
  caption: "Le comparto el catalogo de mamparas para que vea los modelos disponibles. Cuando elija el que mas le guste, me indica el modelo y las medidas del espacio y seguimos."
};

function mediaUrl(cat) { return "/api/media/" + cat.archivo; }

function publicBaseUrl() {
  var domain = process.env.RAILWAY_PUBLIC_DOMAIN || DEFAULT_PUBLIC_DOMAIN;
  return "https://" + domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function publicUrl(cat) { return publicBaseUrl() + mediaUrl(cat); }

// Copia el PDF del repo a la carpeta de media si falta o si cambio de tamano.
function prepararCatalogo(cat) {
  try {
    var origen = path.join(ASSETS_DIR, cat.archivo);
    if (!fs.existsSync(origen)) {
      console.error("[CATALOGO] No existe el archivo " + origen);
      return false;
    }
    if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
    var destino = path.join(MEDIA_DIR, cat.archivo);
    var copiar = !fs.existsSync(destino) || fs.statSync(destino).size !== fs.statSync(origen).size;
    if (copiar) {
      fs.copyFileSync(origen, destino);
      console.log("[CATALOGO] Copiado a media: " + cat.archivo);
    }
    return true;
  } catch (e) {
    console.error("[CATALOGO] Error preparando " + cat.archivo + ":", e.message);
    return false;
  }
}

// Al cargar el modulo dejamos el catalogo listo.
prepararCatalogo(CATALOGO_MAMPARAS);

// true si al contacto ya se le envio el catalogo (por Claudia o por un vendedor).
function catalogoMamparasYaEnviado(db, contactId) {
  try {
    var row = db.prepare("SELECT id FROM messages WHERE contact_id = ? AND direction = 'outgoing' AND media_url = ? AND status != 'failed' LIMIT 1")
      .get(contactId, mediaUrl(CATALOGO_MAMPARAS));
    return !!row;
  } catch (e) {
    return false;
  }
}

// Mismo chequeo sobre el historial que recibe Claudia (para avisarle en el prompt).
function catalogoMamparasEnHistorial(messages) {
  var url = mediaUrl(CATALOGO_MAMPARAS);
  for (var i = 0; i < (messages || []).length; i++) {
    if (messages[i].direction === "outgoing" && messages[i].media_url === url) return true;
  }
  return false;
}

async function enviarPorCanal(contact, channel, cat) {
  var url = publicUrl(cat);
  if (channel === "whatsapp") {
    return await whatsapp.sendMedia(contact.channel_id, "document", url, cat.caption, contact.phone_line || 1, cat.nombreVisible);
  }
  if (channel === "facebook") {
    var fbToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!fbToken) return { success: true, simulated: true };
    try {
      var fbRes = await axios.post("https://graph.facebook.com/v18.0/me/messages", {
        recipient: { id: contact.channel_id },
        message: { attachment: { type: "file", payload: { url: url + "?dl=" + encodeURIComponent(cat.nombreVisible), is_reusable: false } } }
      }, { params: { access_token: fbToken } });
      return { success: true, messageId: fbRes.data.message_id };
    } catch (err) {
      console.error("[CATALOGO] Error Facebook:", err.response ? JSON.stringify(err.response.data) : err.message);
      return { success: false, error: err.message };
    }
  }
  if (channel === "instagram") {
    // Instagram no permite enviar PDF: mandamos el link.
    return await instagram.sendMessage(contact.channel_id, cat.caption + "\n" + url);
  }
  if (channel === "email") {
    return await email.sendMessage(contact.email, "Catalogo de mamparas - Aberturas Windows", cat.caption + "\n\n" + url);
  }
  return { success: true, simulated: true };
}

// Envia el catalogo de mamparas si todavia no se envio a ese contacto.
// Devuelve true si lo envio.
async function enviarCatalogoMamparas(db, contact, channel) {
  var cat = CATALOGO_MAMPARAS;
  if (catalogoMamparasYaEnviado(db, contact.id)) {
    console.log("[CATALOGO] Ya se habia enviado el catalogo de mamparas a " + contact.name + ". No se reenvia.");
    return false;
  }
  if (!prepararCatalogo(cat)) return false;

  var ins = db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name, media_type, media_url, status) VALUES (?, 'outgoing', ?, ?, 'Claudia', 'file', ?, 'pending')")
    .run(contact.id, cat.caption, channel, mediaUrl(cat));
  var msgId = ins.lastInsertRowid;
  try { db.prepare("UPDATE messages SET original_filename = ? WHERE id = ?").run(cat.nombreVisible, msgId); } catch (e) {}

  var sendResult;
  try {
    sendResult = await enviarPorCanal(contact, channel, cat);
  } catch (err) {
    sendResult = { success: false, error: err.message };
  }
  if (sendResult && sendResult.success) {
    db.prepare("UPDATE messages SET status='sent', sent_at=CURRENT_TIMESTAMP, channel_message_id=? WHERE id=?").run(sendResult.messageId || null, msgId);
  } else {
    db.prepare("UPDATE messages SET status='failed', failed_reason=? WHERE id=?").run((sendResult && sendResult.error) || "Unknown error", msgId);
  }
  console.log("[CATALOGO] Catalogo de mamparas -> " + contact.name + " (" + channel + ") | Enviado: " + !!(sendResult && sendResult.success));
  return !!(sendResult && sendResult.success);
}

module.exports = {
  enviarCatalogoMamparas: enviarCatalogoMamparas,
  catalogoMamparasYaEnviado: catalogoMamparasYaEnviado,
  catalogoMamparasEnHistorial: catalogoMamparasEnHistorial,
  CATALOGO_MAMPARAS: CATALOGO_MAMPARAS
};
