require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { setup } = require("./db/setup");

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
║  🌐 Servidor: http://localhost:${PORT}      ║
║  📡 Webhooks: /webhooks/meta            ║
║  📡 Email:    /webhooks/email           ║
║  🔌 API:      /api                      ║
╠══════════════════════════════════════════╣
║  Canales configurados:                  ║
║  ${process.env.WHATSAPP_TOKEN ? "✅" : "❌"} WhatsApp                          ║
║  ${process.env.INSTAGRAM_TOKEN ? "✅" : "❌"} Instagram                         ║
║  ${process.env.FACEBOOK_PAGE_TOKEN ? "✅" : "❌"} Facebook                          ║
║  ${process.env.SENDGRID_API_KEY ? "✅" : "❌"} Email                             ║
║  ${process.env.ANTHROPIC_API_KEY ? "✅" : "❌"} IA (Claude)                       ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
