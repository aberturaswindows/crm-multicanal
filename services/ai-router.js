var axios = require("axios");

var DEPARTMENTS = {
  ventas: { label: "Ventas", description: "Consultas comerciales, cotizaciones, planes, productos, demos, precios" },
  soporte: { label: "Soporte Tecnico", description: "Problemas tecnicos, errores, configuracion, bugs, rendimiento" },
  admin: { label: "Administracion", description: "Facturas, pagos, datos fiscales, CUIT, suscripciones, comprobantes" },
  reclamos: { label: "Reclamos", description: "Quejas, insatisfaccion, devoluciones, reembolsos, denuncias" }
};

var COMPANY_KNOWLEDGE = [
  "SOBRE LA EMPRESA:",
  "Aberturas Windows (De Pissis S.A.) es una empresa especializada en aberturas a medida en Mendoza, Argentina.",
  "Direccion: Alberdi 1315 esquina Uruguay, San Jose, Guaymallen, Mendoza.",
  "Horario: Lunes a Viernes de 9 a 17 hs.",
  "Telefono ventas: 261-353-9384.",
  "Realizamos obras en todo el pais. Fuera del Gran Mendoza tiene recargo de medicion, flete e instalacion que se calcula para cada obra.",
  "",
  "PRODUCTOS PRINCIPALES:",
  "- Aberturas de ALUMINIO: desde media prestacion hasta RPT (maxima prestacion). Extrusoras: FLAMIA y ALUWIND (linea Enkel de alta prestacion, minimalista).",
  "- Aberturas de PVC: perfiles REHAU, la mejor empresa de perfiles de PVC en Argentina.",
  "- Cortinas de interior y toldos de exterior: FLEXCOLOR (empresa mendocina).",
  "- Mamparas de bano: GLASSIC.",
  "- Persianas de aluminio inyectado y mosquiteros enrollables: LUXE PERFIL.",
  "- Puertas ventanas de aluminio: ALUTECNIC.",
  "- Portones seccionales: HORMANN.",
  "- Puertas placas interior (solo provision, NO instalacion): INDOORS.",
  "- Barandas de balcon, frentes de placard, espejos.",
  "- Puertas automaticas: AUDOOR.",
  "- Toldos: IPROA.",
  "",
  "COLORES EN ALUMINIO:",
  "- Pintados (los mas comunes): blanco, bronce colonial, negro. Hay otros colores disponibles.",
  "- Microtexturados: gris, marron claro, negro, gris metalizado, etc.",
  "- Anodizados: natural, gris, champagne, peltre, bronce claro, bronce medio, bronce oscuro, negro. Pueden ser lijados o pulidos brillantes.",
  "",
  "COLORES EN PVC:",
  "- Color base: blanco.",
  "- Foliados: toda la gama de foliados de REHAU.",
  "",
  "PLAZOS DE ENTREGA (desde medicion final):",
  "- Aluminio pintado (blanco, bronce colonial, negro): 45 a 60 dias habiles.",
  "- Aluminio microtexturado y anodizado: 70 a 90 dias habiles.",
  "- PVC blanco: 45 a 60 dias habiles.",
  "- PVC foliado: 70 a 90 dias habiles.",
  "- Los plazos dependen de la cantidad de aberturas y si incluye o no instalacion.",
  "",
  "PROCESO DE VENTA:",
  "1. El cliente consulta y le pedimos los siguientes datos para cotizar:",
  "   - Nombre para el presupuesto",
  "   - Si incluye o no instalacion",
  "   - Direccion de la obra (si requiere instalacion)",
  "   - Color de la perfileria",
  "   - Tipo de vidrio: DVH (doble vidrio hermetico) o vidrio simple",
  "   - Tipo de abertura (corrediza, de abrir, etc.)",
  "   - Medidas aproximadas",
  "   - Plano de carpinterias y plantas si tiene",
  "2. Se arma el presupuesto en hasta 72 hs habiles.",
  "3. Se envia el presupuesto por WhatsApp o mail segun prefiera el cliente.",
  "4. Lo ideal es que el cliente visite el showroom para ver las lineas en exhibicion.",
  "5. Una vez que contrata, un tecnico visita la obra cuando esta en condiciones y toma las medidas finales.",
  "",
  "CONDICIONES PARA MEDICION FINAL:",
  "- El 100% de los vanos deben estar recuadrados con terminacion final para pintar o texturar.",
  "- Los vanos deben estar a nivel, plomo y escuadra.",
  "- Para puertas de abrir o corredizas: debe haber contrapiso terminado y tipo de piso definido.",
  "- Para vanos con aberturas en esquina a 90 grados o bow windows: debe estar realizada la terminacion de yeso o enlucido fino en muros interiores.",
  "- Estos requisitos son obligatorios. Si no se cumplen, la medicion se suspende hasta que la obra este en condiciones.",
  "- Una vez realizada la medicion definitiva, NO se pueden modificar los vanos. Si hay cambios, se cobra un costo adicional.",
  "",
  "CONDICIONES PARA COLOCACION:",
  "- Revestimientos ceramicos en muros de banos, cocina y lavadero deben estar colocados.",
  "- Yeso o enlucido fino en todos los muros interiores terminados.",
  "- Revestimiento de piso colocado donde se deban colocar puertas de abrir.",
  "- Para puertas ventanas corredizas con riel inferior embutido: dejar sin colocar la ultima hilera de ceramico frente a la abertura.",
  "- Consultas tecnicas y de fabricacion: 261-526-3244 o medicionesyservicios@aberturaswindows.com.ar",
  "",
  "IMPORTANTE:",
  "- Trabajamos sobre pedido, NO tenemos productos estandar ni entregas inmediatas.",
  "- Cada cotizacion se realiza de manera detallada y personalizada.",
  "- No dar precios por mensaje, siempre ofrecer armar un presupuesto formal.",
  "- Los descuentos, promociones bancarias y condiciones de pago van especificados en cada presupuesto."
].join("\n");

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

  var prompt = "Sos un sistema de clasificacion de consultas para Aberturas Windows, empresa de aberturas de aluminio y PVC en Mendoza, Argentina.\n\n";
  prompt += "Departamentos disponibles:\n";
  prompt += "- ventas: Consultas comerciales, cotizaciones, productos, precios, medidas, colores, tipos de aberturas, presupuestos\n";
  prompt += "- soporte: Consultas tecnicas sobre medicion, colocacion, estado de fabricacion, problemas con aberturas instaladas\n";
  prompt += "- admin: Facturas, pagos, datos fiscales, CUIT, transferencias, comprobantes\n";
  prompt += "- reclamos: Quejas, insatisfaccion, devoluciones, problemas graves con el servicio\n";
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

  var prompt = "Sos un agente de atencion al cliente de Aberturas Windows, empresa especializada en aberturas a medida de aluminio y PVC en Mendoza, Argentina.\n\n";
  prompt += "CONOCIMIENTO DE LA EMPRESA:\n" + COMPANY_KNOWLEDGE + "\n\n";
  prompt += "REGLAS DE RESPUESTA:\n";
  prompt += "- Tono: formal pero relajado, profesional y amable. Tutear al cliente.\n";
  prompt += "- NUNCA dar precios por mensaje. Siempre ofrecer armar un presupuesto formal.\n";
  prompt += "- Si el cliente pregunta por un producto, explicar brevemente y pedir los datos para cotizar.\n";
  prompt += "- Si el cliente ya dio los datos para cotizar, confirmar que se va a preparar el presupuesto en hasta 72 hs habiles.\n";
  prompt += "- Si preguntan por plazos, dar los rangos generales segun el material y color.\n";
  prompt += "- Invitar al cliente a visitar el showroom cuando sea apropiado.\n";
  prompt += "- Si es una respuesta a una historia de Instagram, ser breve y conectar con lo que muestra la historia.\n";
  prompt += "- Respuestas breves: 2-3 oraciones maximo.\n\n";
  prompt += "La hora actual en Argentina es las " + argHour + '. Si saludas, usa "' + timeInfo.greeting + '".\n';
  prompt += "El cliente " + contact.name + " te contacto por " + (channelLabels[contact.channel] || contact.channel) + ".\n";
  prompt += "Area actual: " + dept.label + ".\n\n";
  prompt += "Historial de la conversacion:\n" + history + "\n\n";
  prompt += "Genera UNA respuesta breve para el ultimo mensaje del cliente. Solo la respuesta, sin explicaciones ni prefijos.";

  try {
    var res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
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
    ventas: ["precio", "cotizacion", "presupuesto", "comprar", "costo", "descuento", "oferta", "contratar", "producto", "catalogo", "promocion", "cuanto sale", "interesado", "abertura", "ventana", "puerta", "aluminio", "pvc", "dvh", "vidrio", "corrediza", "mampara", "persiana", "mosquitero", "porton", "baranda", "toldo", "cortina"],
    soporte: ["no funciona", "error", "problema", "tecnico", "falla", "ayuda", "configurar", "instalar", "medicion", "colocacion", "fabricacion", "cuando esta", "estado", "pedido", "entrega"],
    admin: ["factura", "pago", "cobro", "recibo", "cuit", "datos fiscales", "transferencia", "suscripcion", "vencimiento", "comprobante"],
    reclamos: ["reclamo", "queja", "insatisfecho", "mal servicio", "devolver", "reembolso", "devolucion", "pesimo", "inaceptable", "denuncia", "enojado"]
  };

  var best = "ventas";
  var bestCount = 0;
  var depts = Object.keys(rules);
  for (var i = 0; i < depts.length; i++) {
    var deptKey = depts[i];
    var keywords = rules[deptKey];
    var count = 0;
    for (var j = 0; j < keywords.length; j++) {
      if (lower.indexOf(keywords[j]) !== -1) count++;
    }
    if (count > bestCount) { bestCount = count; best = deptKey; }
  }

  var confidence = bestCount >= 3 ? "alta" : bestCount >= 1 ? "media" : "baja";
  var reason = bestCount > 0 ? "Clasificado por keywords (IA no disponible)" : "Sin keywords detectadas, asignado a ventas por defecto";

  return { department: best, confidence: confidence, reason: reason };
}

module.exports = { classifyMessage: classifyMessage, generateSuggestion: generateSuggestion, DEPARTMENTS: DEPARTMENTS };
