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

var QUOTE_DATA_FIELDS = [
  "nombre para el presupuesto",
  "si incluye o no instalacion",
  "direccion de la obra (si incluye instalacion)",
  "color de la perfileria",
  "tipo de vidrio (DVH o simple)",
  "tipo de abertura (corrediza, de abrir, etc.)",
  "medidas aproximadas"
];

var STAGE_LABELS = {
  consulta: "Consulta inicial",
  recopilando_datos: "Recopilando datos para cotizar",
  datos_completos: "Datos completos - Armar presupuesto",
  presupuesto_enviado: "Presupuesto enviado - Esperando respuesta",
  seguimiento: "En seguimiento",
  cerrado_ganado: "Cerrado - Ganado",
  cerrado_perdido: "Cerrado - Perdido",
  sin_respuesta: "Sin respuesta"
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

function formatMessageForHistory(m) {
  var role = m.direction === "incoming" ? "Cliente" : "Agente";
  var texto = m.content;
  if (texto === "[Audio]") texto = "(envio un mensaje de voz que no se puede transcribir, responde normalmente y pregunta en que podes ayudarlo)";
  else if (texto === "[Imagen]") texto = "(envio una imagen)";
  else if (texto === "[Video]") texto = "(envio un video)";
  else if (texto === "[Archivo]") texto = "(envio un archivo)";
  return role + ": " + texto;
}

async function classifyMessage(messageText, conversationHistory) {
  if (!conversationHistory) conversationHistory = [];
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return classifyByKeywords(messageText);
  }

  var historyText = "";
  if (conversationHistory.length > 0) {
    var lines = conversationHistory.map(function(m) {
      return formatMessageForHistory(m);
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
    return formatMessageForHistory(m);
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
  prompt += "- Si el cliente envio un mensaje de voz, responde normalmente y pregunta en que podes ayudarlo.\n";
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

async function generateAutoReply(contact, messages) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: null, stageChange: null };

  var stage = contact.conversation_stage || "consulta";

  if (stage === "datos_completos" || stage === "cerrado_ganado" || stage === "cerrado_perdido" || stage === "sin_respuesta") {
    return { reply: null, stageChange: null };
  }

  var dept = DEPARTMENTS[contact.department] || DEPARTMENTS.ventas;
  var lastMessages = messages.slice(-15);
  var history = lastMessages.map(function(m) {
    return formatMessageForHistory(m);
  }).join("\n");

  var channelLabels = {
    whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook Messenger",
    email: "Email", telefono: "Telefono"
  };

  var timeInfo = getArgentinaTime();
  var now = new Date();
  var argHour = now.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });

  var stageInstructions = "";

  if (stage === "consulta" || stage === "recopilando_datos") {
    stageInstructions = "ETAPA ACTUAL: Recopilando datos para cotizacion.\n";
    stageInstructions += "DATOS QUE NECESITAS PARA COTIZAR:\n";
    for (var i = 0; i < QUOTE_DATA_FIELDS.length; i++) {
      stageInstructions += "- " + QUOTE_DATA_FIELDS[i] + "\n";
    }
    stageInstructions += "\nINSTRUCCIONES DE ETAPA:\n";
    stageInstructions += "- Responde la consulta del cliente de forma natural.\n";
    stageInstructions += "- Si el cliente esta interesado, pedi los datos que faltan para cotizar (de a 2-3 datos por mensaje, no todos juntos).\n";
    stageInstructions += "- Si el cliente ya proporciono TODOS los datos necesarios, confirma que vas a preparar el presupuesto en hasta 72 hs habiles.\n";
    stageInstructions += "- NO pidas datos que el cliente ya dio en mensajes anteriores.\n";
  } else if (stage === "presupuesto_enviado" || stage === "seguimiento") {
    stageInstructions = "ETAPA ACTUAL: Seguimiento de presupuesto.\n";
    stageInstructions += "Seguimiento numero: " + ((contact.followup_count || 0) + 1) + " de 5.\n";
    stageInstructions += "INSTRUCCIONES DE ETAPA:\n";
    stageInstructions += "- El cliente ya recibio un presupuesto de nuestra empresa.\n";
    stageInstructions += "- Hace un seguimiento amable y profesional.\n";
    stageInstructions += "- Pregunta si pudo revisar el presupuesto y si tiene alguna consulta.\n";
    stageInstructions += "- Si el cliente dice que NO va a hacer el trabajo con nosotros, agradece y preguntale el motivo ofreciendo estas opciones:\n";
    stageInstructions += '  1) "El presupuesto excedia mi presupuesto" (Precio)\n';
    stageInstructions += '  2) "Elegi otra empresa" (Competencia)\n';
    stageInstructions += '  3) "Los tiempos de entrega no me servian" (Plazos)\n';
    stageInstructions += '  4) "La obra se postergo o cancelo" (Obra pausada)\n';
    stageInstructions += '  5) "Otro motivo"\n';
    stageInstructions += "- Si el cliente confirma que SI va a hacer el trabajo, felicitalo y decile que un asesor se va a comunicar para coordinar los proximos pasos.\n";
    stageInstructions += "- Respuesta breve: 2-3 oraciones.\n";
  }

  var prompt = "Sos un agente de atencion al cliente de Aberturas Windows.\n\n";
  prompt += "CONOCIMIENTO DE LA EMPRESA:\n" + COMPANY_KNOWLEDGE + "\n\n";
  prompt += stageInstructions + "\n";
  prompt += "REGLAS GENERALES:\n";
  prompt += "- Tono: formal pero relajado, profesional y amable. Tutear al cliente.\n";
  prompt += "- NUNCA dar precios por mensaje.\n";
  prompt += "- Respuestas breves: 2-3 oraciones maximo.\n";
  prompt += "- Si es una respuesta a una historia de Instagram, ser breve y conectar con lo que muestra la historia.\n";
  prompt += "- Si el cliente envio un mensaje de voz, responde normalmente y pregunta en que podes ayudarlo.\n\n";
  prompt += "La hora actual en Argentina es las " + argHour + '. Si saludas, usa "' + timeInfo.greeting + '".\n';
  prompt += "El cliente " + contact.name + " te contacto por " + (channelLabels[contact.channel] || contact.channel) + ".\n\n";
  prompt += "Historial de la conversacion:\n" + history + "\n\n";
  prompt += 'Responde SOLO con un JSON valido (sin markdown, sin backticks) con este formato:\n';
  prompt += '{"reply":"tu respuesta al cliente","stage_assessment":"consulta|recopilando_datos|datos_completos|cliente_acepta|cliente_rechaza|continuar"}';
  prompt += '\n\nDonde stage_assessment es:\n';
  prompt += '- "consulta": el cliente recien consulta, no pidio cotizacion aun\n';
  prompt += '- "recopilando_datos": el cliente esta interesado y estamos pidiendo/recibiendo datos\n';
  prompt += '- "datos_completos": el cliente ya dio TODOS los datos necesarios para cotizar\n';
  prompt += '- "cliente_acepta": el cliente confirma que va a hacer el trabajo con nosotros\n';
  prompt += '- "cliente_rechaza": el cliente dice que NO va a hacer el trabajo\n';
  prompt += '- "continuar": seguir en la etapa actual sin cambios\n';

  try {
    var res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }]
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });

    var text = res.data.content && res.data.content[0] ? res.data.content[0].text : "";
    try {
      var parsed = JSON.parse(text);
      var reply = parsed.reply || null;
      var assessment = parsed.stage_assessment || "continuar";

      var stageChange = null;
      if (assessment === "datos_completos" && stage !== "datos_completos") {
        stageChange = "datos_completos";
      } else if (assessment === "recopilando_datos" && stage === "consulta") {
        stageChange = "recopilando_datos";
      } else if (assessment === "cliente_acepta") {
        stageChange = "cerrado_ganado";
      } else if (assessment === "cliente_rechaza") {
        stageChange = "cerrado_perdido";
      }

      return { reply: reply, stageChange: stageChange };
    } catch (parseErr) {
      return { reply: text, stageChange: null };
    }
  } catch (err) {
    console.error("Error generando auto-reply:", err.message);
    return { reply: null, stageChange: null };
  }
}

async function generateFollowup(contact, messages) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  var followupNum = (contact.followup_count || 0) + 1;
  var lastMessages = messages.slice(-10);
  var history = lastMessages.map(function(m) {
    return formatMessageForHistory(m);
  }).join("\n");

  var timeInfo = getArgentinaTime();

  var prompt = "Sos un agente de atencion al cliente de Aberturas Windows.\n\n";
  prompt += "El cliente " + contact.name + " recibio un presupuesto pero no respondio.\n";
  prompt += "Este es el seguimiento numero " + followupNum + " de 5.\n\n";
  prompt += "Historial reciente:\n" + history + "\n\n";
  prompt += "REGLAS:\n";
  prompt += "- Tono: formal pero relajado, profesional, amable. Tutear.\n";
  prompt += "- Mensaje breve de seguimiento (2-3 oraciones).\n";
  prompt += "- NO seas insistente ni presiones.\n";
  prompt += '- Si saludas, usa "' + timeInfo.greeting + '".\n';

  if (followupNum === 1) {
    prompt += "- Primer seguimiento: pregunta amablemente si pudo revisar el presupuesto.\n";
  } else if (followupNum === 2) {
    prompt += "- Segundo seguimiento: recorda que estamos a disposicion para cualquier consulta sobre el presupuesto.\n";
  } else if (followupNum === 3) {
    prompt += "- Tercer seguimiento: ofrece agendar una visita al showroom o una llamada para resolver dudas.\n";
  } else if (followupNum === 4) {
    prompt += "- Cuarto seguimiento: menciona que los precios del presupuesto tienen vigencia limitada.\n";
  } else if (followupNum === 5) {
    prompt += "- Ultimo seguimiento: agradece el interes, deja la puerta abierta y menciona que puede contactarnos cuando quiera.\n";
  }

  prompt += "\nGenera SOLO el mensaje de seguimiento, sin explicaciones ni prefijos.";

  try {
    var res = await axios.post("https://api.anthropic.com/v1/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });

    return res.data.content && res.data.content[0] ? res.data.content[0].text : null;
  } catch (err) {
    console.error("Error generando followup:", err.message);
    return null;
  }
}

async function detectLostReason(messageText) {
  var lower = messageText.toLowerCase();
  if (lower.indexOf("precio") !== -1 || lower.indexOf("caro") !== -1 || lower.indexOf("presupuesto") !== -1 || lower.indexOf("costoso") !== -1 || lower.indexOf("plata") !== -1) return "precio";
  if (lower.indexOf("otra empresa") !== -1 || lower.indexOf("otro proveedor") !== -1 || lower.indexOf("competencia") !== -1 || lower.indexOf("otro lado") !== -1) return "competencia";
  if (lower.indexOf("plazo") !== -1 || lower.indexOf("tiempo") !== -1 || lower.indexOf("demora") !== -1 || lower.indexOf("tarda") !== -1 || lower.indexOf("rapido") !== -1) return "plazos";
  if (lower.indexOf("obra") !== -1 || lower.indexOf("postergo") !== -1 || lower.indexOf("cancelo") !== -1 || lower.indexOf("pauso") !== -1 || lower.indexOf("freno") !== -1) return "obra_pausada";
  return "otro";
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

module.exports = {
  classifyMessage: classifyMessage,
  generateSuggestion: generateSuggestion,
  generateAutoReply: generateAutoReply,
  generateFollowup: generateFollowup,
  detectLostReason: detectLostReason,
  DEPARTMENTS: DEPARTMENTS,
  STAGE_LABELS: STAGE_LABELS
};
