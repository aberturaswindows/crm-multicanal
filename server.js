require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { setup, getDb } = require("./db/setup");
const { generateFollowup, detectLostReason } = require("./services/ai-router");

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar base de datos
setup();

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "public")));

// Rutas
app.use("/webhooks", require("./routes/webhooks"));
app.use("/api", require("./routes/api"));

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    company: process.env.COMPANY_NAME || "NexoCRM",
    channels: {
      whatsapp: !!process.env.WHATSAPP_TOKEN,
      instagram: !!process.env.INSTAGRAM_TOKEN,
      facebook: !!process.env.FACEBOOK_PAGE_TOKEN,
      email: !!process.env.SENDGRID_API_KEY,
      ai: !!process.env.ANTHROPIC_API_KEY,
    }
  });
});

// ============================================
// CRON: Seguimiento automatico de presupuestos
// Se ejecuta cada hora
// ============================================

async function sendFollowupMessage(contact) {
  try {
    var db = getDb();

    // Si Claudia esta pausada, no enviar seguimiento automatico
    if (contact.ai_paused) {
      console.log("[FOLLOWUP] Saltado para " + contact.name + " (Claudia pausada)");
      return;
    }

    var messages = db.prepare("SELECT direction, content FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(contact.id);
    var followupText = await generateFollowup(contact, messages);
    if (!followupText) {
      console.log("[FOLLOWUP] No se pudo generar seguimiento para " + contact.name);
      return;
    }

    db.prepare("INSERT INTO messages (contact_id, direction, content, channel, agent_name) VALUES (?, 'outgoing', ?, ?, 'Claudia')").run(contact.id, followupText, contact.channel);

    var sendResult = { success: true, simulated: true };
    var whatsapp = require("./services/channels/whatsapp");
    var instagram = require("./services/channels/instagram");
    var facebook = require("./services/channels/facebook");
    var emailService = require("./services/channels/email");

    if (contact.channel === "whatsapp") {
      sendResult = await whatsapp.sendMessage(contact.channel_id, followupText, contact.phone_line || 1);
    } else if (contact.channel === "instagram") {
      sendResult = await instagram.sendMessage(contact.channel_id, followupText);
    } else if (contact.channel === "facebook") {
      sendResult = await facebook.sendMessage(contact.channel_id, followupText);
    } else if (contact.channel === "email") {
      sendResult = await emailService.sendMessage(contact.email, "Seguimiento - Aberturas Windows", followupText);
    }

    var newCount = (contact.followup_count || 0) + 1;
    var newStage = newCount >= 5 ? "sin_respuesta" : "seguimiento";
    db.prepare("UPDATE contacts SET followup_count = ?, last_followup_at = CURRENT_TIMESTAMP, conversation_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newCount, newStage, contact.id);

    console.log("[FOLLOWUP] #" + newCount + "/5 -> " + contact.name + " (" + contact.channel + "): " + followupText.substring(0, 60) + "... | Enviado: " + sendResult.success);

    if (newCount >= 5) {
      console.log("[FOLLOWUP] " + contact.name + " -> Sin respuesta despues de 5 seguimientos. Detenido.");
    }
  } catch (err) {
    console.error("[FOLLOWUP] Error con " + contact.name + ":", err.message);
  }
}

async function runFollowupCron() {
  try {
    var db = getDb();

    var contacts = db.prepare(`
      SELECT * FROM contacts 
      WHERE conversation_stage IN ('presupuesto_enviado', 'seguimiento')
      AND followup_count < 5
    `).all();

    if (contacts.length === 0) return;

    var now = new Date();

    for (var i = 0; i < contacts.length; i++) {
      var contact = contacts[i];
      var followupCount = contact.followup_count || 0;
      var shouldSend = false;

      if (followupCount === 0 && contact.quote_sent_at) {
        var quoteSent = new Date(contact.quote_sent_at.replace(" ", "T") + "Z");
        var daysSinceQuote = (now - quoteSent) / (1000 * 60 * 60 * 24);
        if (daysSinceQuote >= 3) shouldSend = true;
      } else if (followupCount > 0 && contact.last_followup_at) {
        var lastFollowup = new Date(contact.last_followup_at.replace(" ", "T") + "Z");
        var daysSinceLastFollowup = (now - lastFollowup) / (1000 * 60 * 60 * 24);
        if (daysSinceLastFollowup >= 5) shouldSend = true;
      }

      if (shouldSend) {
        var argHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hour12: false }));
        if (argHour >= 9 && argHour < 18) {
          await sendFollowupMessage(contact);
          await new Promise(function(resolve) { setTimeout(resolve, 3000); });
        } else {
          console.log("[FOLLOWUP] Fuera de horario (" + argHour + "hs ARG). Se reintentara en la proxima hora.");
        }
      }
    }
  } catch (err) {
    console.error("[FOLLOWUP-CRON] Error:", err.message);
  }
}

// Ejecutar cada hora
setInterval(runFollowupCron, 60 * 60 * 1000);

// Ejecutar una vez al iniciar (despues de 30 segundos para dar tiempo al deploy)
setTimeout(runFollowupCron, 30000);

// Fallback al frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║            N E X O C R M                ║
║       ${process.env.COMPANY_NAME || "Mi Empresa"}
╠══════════════════════════════════════════╣
║  Servidor: http://localhost:${PORT}          ║
║  Webhooks: /webhooks/meta               ║
║  API:      /api                         ║
╠══════════════════════════════════════════╣
║  Canales configurados:                  ║
║  ${process.env.WHATSAPP_TOKEN ? "SI" : "NO"} WhatsApp                           ║
║  ${process.env.INSTAGRAM_TOKEN ? "SI" : "NO"} Instagram                          ║
║  ${process.env.FACEBOOK_PAGE_TOKEN ? "SI" : "NO"} Facebook                           ║
║  ${process.env.SENDGRID_API_KEY ? "SI" : "NO"} Email                              ║
║  ${process.env.ANTHROPIC_API_KEY ? "SI" : "NO"} IA Claudia (Claude)                ║
║  SI Seguimiento automatico (cada 1 hora)║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
