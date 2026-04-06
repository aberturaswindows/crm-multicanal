var axios = require("axios");

var DEPARTMENTS = {
  ventas: { label: "Ventas", description: "Consultas comerciales, cotizaciones, planes, productos, demos, precios" },
  soporte: { label: "Soporte Tecnico", description: "Problemas tecnicos, errores, configuracion, bugs, rendimiento" },
  admin: { label: "Administracion", description: "Facturas, pagos, datos fiscales, CUIT, suscripciones, comprobantes" },
  reclamos: { label: "Reclamos", description: "Quejas, insatisfaccion, devoluciones, reembolsos, denuncias" }
};

function getArgentinaTime() {
  var now = new Date();
  var argTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  var hour = argTime.getHours();
  var greeting;
  if (hour >= 6 && hour < 13) {
    greeting = "Buenos dias";
  } else if (hour >= 13 && hour < 20) {
    greeting = "Buenas tardes";
  } else {
    greeting = "Buenas noches";
  }
  return { hour: hour, greeting: greeting };
}

async function classifyMessage(messageText, conversationHistory) {
  if (!conversationHistory) conversationHistory = [];
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY no configurada. Usando clasificacion por keywords.");
    return classifyByKeywords(messageText);
  }

  var historyText = "";
  if (conversationHistory.length > 0) {
    var lines = conversationHistory.map(function(m) {
      var role = m.direction === "incoming" ? "Cliente" : "Agente";
      return role + ": " + m.content;
    });
    historyText = "\nHistorial previo de la conversacion:\n" + lines.join("\n") + "\n";
  }

  var prompt = "Sos un sistema de clasificacion de consultas para un CRM empresarial. Tu trabajo es analizar el mensaje del cliente y determinar a que departamento debe ser derivado.\n\n";
  prompt += "Departamentos disponibles:\n";
  prompt += "- ventas: " + DEPARTMENTS.ventas.description + "\n";
  prompt += "- soporte: " + DEPARTMENTS.soporte.description + "\n";
  prompt += "- admin: " + DEPARTMENTS.admin.description + "\n";
  prompt += "- reclamos: " + DEPARTMENTS.reclamos.description + "\n";
  prompt += historyText + "\n";
  prompt += 'Ultimo mensaje del cliente: "' + messageText + '"\n\n';
  prompt += 'Responde SOLO con un JSON valido (sin markdown, sin backticks) con este formato exacto:\n';
  prompt += '{"department":"ventas|soporte|admin|reclamos","confidence":"alta|media|baja","reason":"explicacion breve"}';

  try {
    var res = await axios.post("https://api.anthropic.com/v1/messages", {
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

    var text = res.data.content && res.data.content[0] ? res.data.content[0].text : "";
    var parsed = JSON.parse(text);
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

async function generateSuggestion(contact, messages) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "IA no configurada. Configura ANTHROPIC_API_KEY en el archivo .env";

  var dept = DEPARTMENTS[contact.department] || DEPARTMENTS.ventas;
  var lastMessages = messages.slice(-10);
  var history = lastMessages.map(function(m) {
    var role = m.direction === "incoming" ? "Cliente" : "Agente";
    return role + ": " + m.content;
  }).join("\n");

  var channelLabels = {
    whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook Messenger",
    email: "Email", telefono: "Telefono"
  };

  var timeInfo = getArgentinaTime();
  var now = new Date();
  var argHour = now.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });

  var prompt = "Sos un agente del area de " + dept.label + ' de "' + (process.env.COMPANY_NAME || "NexoCRM") + '". ';
  prompt += "El cliente " + contact.name + " te contacto por " + (channelLabels[contact.channel] || contact.channel) + ".\n\n";
  prompt += "IMPORTANTE: La hora actual en Argentina es las " + argHour + '. Si saludas, usa "' + timeInfo.greeting + '".\n\n';
  prompt += "Tu tono debe ser profesional, empatico y orientado a resolver. Si es un reclamo, mostra comprension. Si es una venta, se entusiasta pero no agresivo.\n\n";
  prompt += "Historial de la conversacion:\n" + history + "\n\n";
  prompt += "Genera UNA respuesta breve (2-3 oraciones maximo) para el ultimo mensaje del cliente. Solo la respuesta, sin explicaciones ni prefijos.";

  try {
    var res = await axios.post("https://api.anthropic.com/v1/messages", {
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

    return res.data.content && res.data.content[0] ? res.data.content[0].text : "No se pudo generar una sugerencia.";
  } catch (err) {
    console.error("Error generando sugerencia:", err.message);
    return "Error al conectar con la IA. Intenta de nuevo.";
  }
}

function classifyByKeywords(text) {
  var lower = text.toLowerCase();
  var rules = {
    ventas: ["precio", "cotizacion", "presupuesto", "comprar", "plan", "costo", "descuento", "oferta", "contratar", "producto", "catalogo", "promocion", "cuanto sale", "interesado"],
    soporte: ["no funciona", "error", "problema", "tecnico", "bug", "falla", "ayuda", "configurar", "instalar", "lento", "caido", "no puedo", "soporte", "no anda", "no carga"],
    admin: ["factura", "pago", "cobro", "recibo", "cuit", "datos fiscales", "transferencia", "suscripcion", "vencimiento", "comprobante"],
    reclamos: ["reclamo", "queja", "insatisfecho", "mal servicio", "devolver", "reembolso", "devolucion", "pesimo", "inaceptable", "denuncia", "enojado"]
  };

  var best = "ventas";
  var bestCount = 0;
  var depts = Object.keys(rules);
  for (var i = 0; i < depts.length; i++) {
    var dept = depts[i];
    var keywords = rules[dept];
    var count = 0;
    for (var j = 0; j < keywords.length; j++) {
      if (lower.indexOf(keywords[j]) !== -1) count++;
    }
    if (count > bestCount) { bestCount = count; best = dept; }
  }

  var confidence = bestCount >= 3 ? "alta" : bestCount >= 1 ? "media" : "baja";
  var reason = bestCount > 0 ? "Clasificado por keywords (IA no disponible)" : "Sin keywords detectadas, asignado a ventas por defecto";

  return { department: best, confidence: confidence, reason: reason };
}

module.exports = { classifyMessage: classifyMessage, generateSuggestion: generateSuggestion, DEPARTMENTS: DEPARTMENTS };
