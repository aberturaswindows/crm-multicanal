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
    var res = await axios.post(GRAPH_API + "/me/messages
