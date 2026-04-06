const axios = require("axios");

const DEPARTMENTS = {
  ventas: { label: "Ventas", description: "Consultas comerciales, cotizaciones, planes, productos, demos, precios" },
  soporte: { label: "Soporte Técnico", description: "Problemas técnicos, errores, configuración, bugs, rendimiento" },
  admin: { label: "Administración", description: "Facturas, pagos, datos fiscales, CUIT, suscripciones, comprobantes" },
  reclamos: { label: "Reclamos", description: "Quejas, insatisfacción, devoluciones, reembolsos, denuncias" },
};

/**
 * Obtener la hora actual en Argentina (UTC-3)
 */
function getArgentinaTime() {
  const now = new Date();
  const argTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const hour = argTime.getHours();

  let greeting;
  if (hour >= 6 && hour < 13) {
    greeting = "Buenos días";
  } else if (hour >= 13 && hour < 20) {
    greeting = "Buenas tardes";
  } else {
    greeting = "Buenas noches";
  }

  return { hour, greeting };
}

/**
 * Clasifica un mensaje y devuelve el departamento, confianza y razón
 */
async function classifyMessage(messageText, conversationHistory = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  ANTHROPIC_API_KEY no configurada. Usando clasificación por keywords.");
    return classifyByKeywords(messageText);
  }

  const historyText = conversationHistory.length > 0
    ? `\nHistorial previo de la conversación:\n${conversationHistory.map(m => `${m.direction === "incoming" ? "Cliente" : "Agente"}: ${m.content}`).join("\n")}\n`
    : "";

  const prompt = `Sos un sistema de clasificación de consultas para un CRM empresarial. Tu trabajo es analizar el mensaje del cliente y determinar a qué departamento debe ser derivado.

Departamentos disponibles:
- ventas: ${DEPARTMENTS.ventas.description}
- soporte: ${DEPARTMENTS.soporte.description}
- admin: ${DEPARTMENTS.admin.description}
- reclamos: ${DEPARTMENTS.reclamos.description}
${historyText}
Último mensaje del cliente: "${messageText}"

Respondé SOLO con un JSON válido (sin markdown, sin backticks) con este formato exacto:
{"department":"ventas|soporte|admin|reclamos","confidence":"alta|media|baja","reason":"explicación breve"}`;

  try {
    const res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }]
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });

    const text = res.data.content?.[0]?.text || "";
    const parsed = JSON.parse(text);
    return {
      department: parsed.department || "ventas",
      confidence: parsed.confidence || "baja",
      reason: parsed.reason || "No se pudo determinar con certeza"
    };
  } catch (err) {
    console.error("Error clasificando con IA:", err.message);
    return classifyByKeywords(messageText);
  }
}

/**
 * Genera una sugerencia de respuesta para el agente
 */
async function generateSuggestion(contact, messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "IA no configurada. Configurá ANTHROPIC_API_KEY en el archivo .env";

  const dept = DEPARTMENTS[contact.department] || DEPARTMENTS.ventas;
  const history = messages.slice(-10).map(m =>
    `${m.direction === "incoming" ? "Cliente" : "Agente"}: ${m.content}`
  ).join("\n");

  const channelLabels = {
    whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook Messenger",
    email: "Email", telefono: "Teléfono"
  };

  const { greeting } = getArgentinaTime();

  const prompt = `Sos un agente del área de ${dept.label} de "${process.env.COMPANY_NAME || "NexoCRM"}". El cliente ${contact.name} te contactó por ${channelLabels[contact.channel] || contact.channel}.

IMPORTANTE: La hora actual en Argentina es las ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" })}. Si saludás, usá "${greeting}".

Tu tono debe ser profesional, empático y orientado a resolver. Si es un reclamo, mostrá comprensión. Si es una venta, sé entusiasta pero no agresivo.

Historial de la conversación:
${history}

Generá UNA respuesta breve (2-3 oraciones máximo) para el último mensaje del cliente. Solo la respuesta, sin explicaciones ni prefijos.`;

  try {
    const res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }]
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });

    return res.data.content?.[0]?.text || "No se pudo generar una sugerencia.";
  } catch (err) {
    console.error("Error generando sugerencia:", err.message);
    return "Error al
