const axios = require("axios");

const DEPARTMENTS = {
  ventas: { label: "Ventas", description: "Consultas comerciales, cotizaciones, planes, productos, demos, precios" },
  soporte: { label: "Soporte Técnico", description: "Problemas técnicos, errores, configuración, bugs, rendimiento" },
  admin: { label: "Administración", description: "Facturas, pagos, datos fiscales, CUIT, suscripciones, comprobantes" },
  reclamos: { label: "Reclamos", description: "Quejas, insatisfacción, devoluciones, reembolsos, denuncias" },
};

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

  const prompt = `Sos un agente del área de ${dept.label} de NexoCRM "${process.env.COMPANY_NAME || "NexoCRM"}". El cliente ${contact.name} te contactó por ${channelLabels[contact.channel] || contact.channel}.

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
    return "Error al conectar con la IA. Intentá de nuevo.";
  }
}

/**
 * Fallback: clasificación por keywords cuando no hay API key
 */
function classifyByKeywords(text) {
  const lower = text.toLowerCase();
  const rules = {
    ventas: ["precio", "cotización", "presupuesto", "comprar", "plan", "costo", "descuento", "oferta", "contratar", "producto", "catálogo", "promoción", "cuánto sale", "cuanto sale", "interesado"],
    soporte: ["no funciona", "error", "problema", "técnico", "bug", "falla", "ayuda", "configurar", "instalar", "lento", "caído", "no puedo", "soporte", "no anda", "no carga"],
    admin: ["factura", "pago", "cobro", "recibo", "cuit", "datos fiscales", "transferencia", "suscripción", "vencimiento", "comprobante"],
    reclamos: ["reclamo", "queja", "insatisfecho", "mal servicio", "devolver", "reembolso", "devolución", "pésimo", "inaceptable", "denuncia", "enojado"],
  };

  let best = "ventas";
  let bestCount = 0;
  for (const [dept, keywords] of Object.entries(rules)) {
    const count = keywords.filter(k => lower.includes(k)).length;
    if (count > bestCount) { bestCount = count; best = dept; }
  }

  return {
    department: best,
    confidence: bestCount >= 3 ? "alta" : bestCount >= 1 ? "media" : "baja",
    reason: bestCount > 0 ? "Clasificado por keywords (IA no disponible)" : "Sin keywords detectadas, asignado a ventas por defecto"
  };
}

module.exports = { classifyMessage, generateSuggestion, DEPARTMENTS };
