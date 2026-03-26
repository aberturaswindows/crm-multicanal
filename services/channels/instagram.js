const axios = require("axios");

const GRAPH_API = "https://graph.facebook.com/v19.0";

/**
 * Enviar mensaje de Instagram
 */
async function sendMessage(recipientId, text) {
  const token = process.env.INSTAGRAM_TOKEN;
  if (!token) {
    console.warn("⚠️  Instagram no configurado. Mensaje simulado:", { recipientId, text });
    return { success: true, simulated: true };
  }

  try {
    const res = await axios.post(`${GRAPH_API}/me/messages`, {
      recipient: { id: recipientId },
      message: { text }
    }, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    });

    return { success: true, messageId: res.data.message_id };
  } catch (err) {
    console.error("Error enviando Instagram:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Procesar webhook de Instagram
 */
function processWebhook(body) {
  try {
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging?.message?.text) return null;

    return {
      channel: "instagram",
      channelId: messaging.sender.id,
      senderName: messaging.sender.id, // Se resuelve después con la API
      text: messaging.message.text,
      messageId: messaging.message.mid,
      timestamp: messaging.timestamp,
      phoneLine: null,
    };
  } catch (err) {
    console.error("Error procesando webhook Instagram:", err);
    return null;
  }
}

module.exports = { sendMessage, processWebhook };
