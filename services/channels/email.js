const axios = require("axios");
const nodemailer = require("nodemailer");

/**
 * Enviar email via SendGrid
 */
async function sendMessage(to, subject, text) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM || "noreply@empresa.com";

  if (!apiKey) {
    console.warn("⚠️  Email no configurado. Mensaje simulado:", { to, subject });
    return { success: true, simulated: true };
  }

  try {
    await axios.post("https://api.sendgrid.com/v3/mail/send", {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject: subject,
      content: [{ type: "text/plain", value: text }]
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });

    return { success: true };
  } catch (err) {
    console.error("Error enviando email:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Procesar webhook de email entrante (SendGrid Inbound Parse)
 */
function processWebhook(body) {
  try {
    return {
      channel: "email",
      channelId: body.from || body.sender,
      senderName: body.from?.split("<")[0]?.trim() || body.from,
      senderEmail: body.from?.match(/<(.+)>/)?.[1] || body.from,
      text: body.text || body.html || "",
      subject: body.subject || "(Sin asunto)",
      messageId: body["Message-ID"] || null,
      timestamp: Date.now(),
      phoneLine: null,
    };
  } catch (err) {
    console.error("Error procesando webhook Email:", err);
    return null;
  }
}

module.exports = { sendMessage, processWebhook };
