const axios = require("axios");

const GRAPH_API = "https://graph.facebook.com/v19.0";

/**
 * Enviar mensaje de Facebook Messenger
 */
async function sendMessage(recipientId, text) {
  const token = process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) {
    console.warn("⚠️  Facebook no configurado. Mensaje simulado:", { recipientId, text });
    return { success: true, simulated: true };
  }

  try {
    const res = await axios.post(`${GRAPH_API}/me/messages`, {
      recipient: { id: recipientId },
      message: { text }
    }, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      params: { access_token: token }
    });

    return { success: true, messageId: res.data.message_id };
  } catch (err) {
    console.error("Error enviando Facebook:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Procesar webhook de Facebook Messenger
 */
function processWebhook(body) {
  try {
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging?.message?.text) return null;

    return {
      channel: "facebook",
      channelId: messaging.sender.id,
      senderName: messaging.sender.id,
      text: messaging.message.text,
      messageId: messaging.message.mid,
      timestamp: messaging.timestamp,
      phoneLine: null,
    };
  } catch (err) {
    console.error("Error procesando webhook Facebook:", err);
    return null;
  }
}

module.exports = { sendMessage, processWebhook };
