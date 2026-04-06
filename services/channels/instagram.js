var axios = require("axios");

var GRAPH_API = "https://graph.instagram.com/v21.0";

async function getUserProfile(userId) {
  var token = process.env.INSTAGRAM_TOKEN;
  if (!token) return null;

  try {
    var res = await axios.get(GRAPH_API + "/" + userId, {
      params: { fields: "name,username", access_token: token }
    });
    return res.data.name || res.data.username || null;
  } catch (err) {
    console.error("Error obteniendo perfil Instagram:", err.response && err.response.data ? err.response.data.error.message : err.message);
    try {
      var res2 = await axios.get(GRAPH_API + "/" + userId, {
        params: { fields: "username", access_token: token }
      });
      return res2.data.username || null;
    } catch (err2) {
      return null;
    }
  }
}

async function sendMessage(recipientId, text) {
  var token = process.env.INSTAGRAM_TOKEN;
  if (!token) {
    console.warn("Instagram no configurado. Mensaje simulado:", recipientId, text);
    return { success: true, simulated: true };
  }

  try {
    var res = await axios.post(GRAPH_API + "/me/messages", {
      recipient: { id: recipientId },
      message: { text: text }
    }, {
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
    });

    return { success: true, messageId: res.data.message_id };
  } catch (err) {
    console.error("Error enviando Instagram:", err.response ? err.response.data : err.message);
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

    var senderId = messaging.sender.id;
    var text = messaging.message.text || "";
    var mediaType = null;
    var mediaUrl = null;
    var storyUrl = null;

    // Verificar si es respuesta a una historia
    if (messaging.message.reply_to && messaging.message.reply_to.story) {
      storyUrl = messaging.message.reply_to.story.url || null;
    }

    // Verificar si tiene archivos adjuntos (imagen, video, audio)
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

    // Si no hay texto ni media, ignorar
    if (!text && !mediaType) return null;

    return {
      channel: "instagram",
      channelId: senderId,
      senderName: senderId,
      text: text,
      messageId: messaging.message.mid,
      timestamp: messaging.timestamp,
      phoneLine: null,
      mediaType: mediaType,
      mediaUrl: mediaUrl,
      storyUrl: storyUrl
    };
  } catch (err) {
    console.error("Error procesando webhook Instagram:", err);
    return null;
  }
}

module.exports = { sendMessage: sendMessage, processWebhook: processWebhook, getUserProfile: getUserProfile };
