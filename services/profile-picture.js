var axios = require("axios");
var getDb = require("../db/setup").getDb;

var GRAPH_API = "https://graph.facebook.com/v19.0";
var STALE_DAYS = 7;
var REQUEST_TIMEOUT_MS = 8000;

function isStale(updatedAt) {
  if (!updatedAt) return true;
  var last = new Date(updatedAt);
  if (isNaN(last.getTime())) return true;
  var ageMs = Date.now() - last.getTime();
  return ageMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchForWhatsapp(waId) {
  var token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;
  try {
    var res = await axios.get(GRAPH_API + "/" + encodeURIComponent(waId) + "/profile", {
      params: { fields: "profile_picture", access_token: token },
      timeout: REQUEST_TIMEOUT_MS
    });
    if (res && res.data && res.data.profile_picture) return res.data.profile_picture;
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchForFacebook(psid) {
  var token = process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) return null;
  try {
    var res = await axios.get(GRAPH_API + "/" + encodeURIComponent(psid), {
      params: { fields: "profile_pic,name", access_token: token },
      timeout: REQUEST_TIMEOUT_MS
    });
    if (res && res.data && res.data.profile_pic) return res.data.profile_pic;
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchForInstagram(igUserId) {
  var token = process.env.INSTAGRAM_TOKEN;
  if (!token) return null;
  try {
    var res = await axios.get(GRAPH_API + "/" + encodeURIComponent(igUserId), {
      params: { fields: "profile_pic,name", access_token: token },
      timeout: REQUEST_TIMEOUT_MS
    });
    if (res && res.data && res.data.profile_pic) return res.data.profile_pic;
    return null;
  } catch (e) {
    return null;
  }
}

// Nunca throwea. Loggea warn en fallo y deja profile_picture_url=null.
async function fetchAndSaveProfilePicture(contactId, channel, channelUserId) {
  if (!contactId || !channel || !channelUserId) return;
  try {
    var url = null;
    if (channel === "whatsapp") url = await fetchForWhatsapp(channelUserId);
    else if (channel === "facebook") url = await fetchForFacebook(channelUserId);
    else if (channel === "instagram") url = await fetchForInstagram(channelUserId);
    else return;

    var db = getDb();
    if (url) {
      db.prepare("UPDATE contacts SET profile_picture_url = ?, profile_picture_updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(url, contactId);
    } else {
      // Marcar intento para respetar la ventana de 7 dias y no spamear a Meta
      db.prepare("UPDATE contacts SET profile_picture_updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(contactId);
      console.warn("[PROFILE-PIC] Sin foto para contacto " + contactId + " (" + channel + "/" + channelUserId + ")");
    }
  } catch (e) {
    console.warn("[PROFILE-PIC] Error contacto " + contactId + ": " + e.message);
  }
}

module.exports = {
  fetchAndSaveProfilePicture: fetchAndSaveProfilePicture,
  isStale: isStale
};
