var axios = require("axios");
var GRAPH_API = "https://graph.facebook.com/v19.0";

async function getUserProfile(userId) {
  var token = process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) return null;
  try {
    var res = await axios.get(GRAPH_API + "/" + userId, {
      params: { fields: "first_name,last_name,name", access_token: token }
    });
    return res.data.name || res.data.first_name || null;
  } catch (err) {
    console.error("Error obteniendo perfil Facebook:", err.response && err.response.data ? err.response.data.error.message : err.message);
    return null;
  }
}

async function sendMessage(recipientId, text) {
  var token = process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) {
    console.warn("Facebook no configurado. Mensaje simulado:", recipientId, text);
    return { success: true, simulated: true };
  }
  try {
    var res = await axios.post(GRAPH_API + "/me/messages", { recipient: { id: recipientId }, message: { text: text } }, { headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, params: { access_token: token } });
    return { success: true, messageId: res.data.message_id };
  } catch (err) {
    console.error("Error enviando Facebook:", err.response ? err.response.data : err.message);
    return { success: false, error: err.message };
  }
}

function processWebhook(body) {
  try {
    var entry = body.entry && body.entry[0] ? body.entry[0] : null;
    if (!entry) return null;
    var messaging = entry.messaging && entry.messaging[0] ? entry.messaging[0] : null;
    if (!messaging) return null;
    if (!messaging.message) return null;
    if (messaging.message.is_echo) return null;
    var text = messaging.message.text || "";
    var mediaType = null;
    var mediaUrl = null;
    if (messaging.message.attachments && messaging.message.attachments.length > 0) {
      var attachment = messaging.message.attachments[0];
      var type = attachment.type;
      var url = attachment.payload && attachment.payload.url ? attachment.payload.url : null;
      if (type === "image" || type === "video" || type === "audio" || type === "file") {
        mediaType = type;
        mediaUrl = url;
      }
      if (!text && mediaType) {
        if (mediaType === "image") text = "[Imagen]";
        else if (mediaType === "video") text = "[Video]";
        else if (mediaType === "audio") text = "[Audio]";
        else if (mediaType === "file") text = "[Archivo]";
      }
    }
    if (!text && !mediaType) return null;
    return { channel: "facebook", channelId: messaging.sender.id, senderName: messaging.sender.id, text: text, messageId: messaging.message.mid, timestamp: messaging.timestamp, phoneLine: null, mediaType: mediaType, mediaUrl: mediaUrl, storyUrl: null };
  } catch (err) {
    console.error("Error procesando webhook Facebook:", err);
    return null;
  }
}

module.exports = { sendMessage: sendMessage, processWebhook: processWebhook, getUserProfile: getUserProfile };
