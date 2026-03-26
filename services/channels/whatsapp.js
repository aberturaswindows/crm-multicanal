const axios = require("axios");

const GRAPH_API = "https://graph.facebook.com/v19.0";

// Mapeo de líneas a Phone IDs
function getPhoneId(line) {
  const map = {
    1: process.env.WHATSAPP_PHONE_ID_1,
    2: process.env.WHATSAPP_PHONE_ID_2,
    3: process.env.WHATSAPP_PHONE_ID_3,
  };
  return map[line] || map[1];
}

/**
 * Enviar mensaje de WhatsApp
 */
async function sendMessage(to, text, phoneLine = 1) {
  const phoneId = getPhoneId(phoneLine);
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneId || !token) {
    console.warn("⚠️  WhatsApp no configurado. Mensaje simulado:", { to, text });
    return { success: true, simulated: true };
  }

  try {
    const res = await axios.post(`${GRAPH_API}/${phoneId}/messages`, {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text }
    }, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    });

    return { success: true, messageId: res.data.messages?.[0]?.id };
  } catch (err) {
    console.error("Error enviando WhatsApp:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Procesar webhook de WhatsApp
 * Retorna un objeto normalizado o null si no es un mensaje de texto
 */
function processWebhook(body) {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) return null;

    const msg = value.messages[0];
    const contact = value.contacts?.[0];
    const phoneNumberId = value.metadata?.phone_number_id;

    // Determinar qué línea recibió el mensaje
    let phoneLine = 1;
    if (phoneNumberId === process.env.WHATSAPP_PHONE_ID_2) phoneLine = 2;
    if (phoneNumberId === process.env.WHATSAPP_PHONE_ID_3) phoneLine = 3;

    return {
      channel: "whatsapp",
      channelId: msg.from,
      senderName: contact?.profile?.name || msg.from,
      senderPhone: msg.from,
      text: msg.text?.body || msg.caption || "[Archivo multimedia]",
      messageId: msg.id,
      timestamp: msg.timestamp,
      phoneLine: phoneLine,
    };
  } catch (err) {
    console.error("Error procesando webhook WhatsApp:", err);
    return null;
  }
}

module.exports = { sendMessage, processWebhook };
