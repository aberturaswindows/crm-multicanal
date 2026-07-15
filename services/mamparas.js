// ============================================================
// MAMPARAS GLASSIC - Lista de precios L106 (Edicion 8/7/2026)
// Precios de lista SIN IVA. Se venden a precio de lista tal cual.
// Instalacion (medicion + flete + colocacion) Gran Mendoza: $299.700 + IVA.
// Fuera del Gran Mendoza: la calcula el vendedor manualmente.
// IMPORTANTE: la cotizacion la calcula SIEMPRE este modulo (deterministico),
// nunca la IA. Claudia solo recopila los datos.
// ============================================================

var LISTA_EDICION = "L106 (8/7/2026)";
var INSTALACION_GRAN_MENDOZA = 299700; // + IVA
var IVA = 0.21;

// tipo de medida: "estandar" (medidas fijas) o "rango" (se fabrica a medida dentro del rango)
// cristales: incoloro | color (Gris y Bronce) | textura (Dreamline y Pacific) | saten
var SERIES = [
  // ---------- LINEA 1000 - PANEL (estandar) ----------
  { serie: "1000", nombre: "Panel", apertura: "panel fijo", medida: "estandar", items: [
    { ancho: 80, alto: 160, precios: { incoloro: 342940, color: 403362, textura: 394382, saten: 563238 } },
    { ancho: 80, alto: 200, precios: { incoloro: 416999, color: 488750, textura: 479549, saten: 679439 } }
  ]},
  { serie: "1010", nombre: "Panel Punta Curva", apertura: "panel fijo", medida: "estandar", items: [
    { ancho: 80, alto: 160, precios: { incoloro: 348819, color: 410277, textura: 401142, saten: 572131 } },
    { ancho: 80, alto: 200, precios: { incoloro: 424148, color: 497128, textura: 487770, saten: 690167 } }
  ]},
  { serie: "1200", nombre: "Panel Angulo", apertura: "panel fijo en angulo", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 160, precios: { incoloro: 704160, color: 841663, textura: 809784, saten: 1185409 } },
    { anchoMin: 70, anchoMax: 90, alto: 200, precios: { incoloro: 834985, color: 998270, textura: 960233, saten: 1406380 } }
  ]},

  // ---------- LINEA 2000 - REBATIBLE PIVOT (estandar) ----------
  { serie: "2000", nombre: "Rebatible Pivot", apertura: "hoja rebatible", medida: "estandar", items: [
    { ancho: 85, alto: 150, precios: { incoloro: 360766, color: 393480, textura: 414880, saten: 531595 } },
    { ancho: 85, alto: 190, precios: { incoloro: 627385, color: 703479, textura: 721492, saten: 918781 } }
  ]},
  { serie: "2010", nombre: "Rebatible Pivot Punta Curva", apertura: "hoja rebatible", medida: "estandar", items: [
    { ancho: 85, alto: 150, precios: { incoloro: 367325, color: 400635, textura: 422424, saten: 540455 } },
    { ancho: 85, alto: 190, precios: { incoloro: 656558, color: 715074, textura: 755042, saten: 932772 } }
  ]},
  { serie: "2100", nombre: "Rebatible Pivot Par", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 467954, color: 518199, textura: 538146, saten: 696515 } },
    { ancho: 100, alto: 190, precios: { incoloro: 694488, color: 783838, textura: 798662, saten: 1033167 } }
  ]},
  { serie: "2110", nombre: "Rebatible Pivot Par Punta Curva", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 475668, color: 526741, textura: 547017, saten: 707122 } },
    { ancho: 100, alto: 190, precios: { incoloro: 705936, color: 796758, textura: 811827, saten: 1048900 } }
  ]},
  { serie: "2200", nombre: "Rebatible Pivot Forma", apertura: "hoja rebatible", medida: "estandar", items: [
    { ancho: 95, alto: 141, precios: { incoloro: 437235, color: 481358, textura: 502821, saten: 656910 } }
  ]},

  // ---------- LINEA 3000 - REBATIBLE BOLT (estandar) ----------
  { serie: "3100", nombre: "Rebatible Bolt", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 897672, color: 964265, textura: 1032323, saten: 1146620 } },
    { ancho: 100, alto: 190, precios: { incoloro: 989654, color: 1075610, textura: 1138102, saten: 1302448 } }
  ]},
  { serie: "3110", nombre: "Rebatible Bolt Punta Curva", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 943038, color: 1012996, textura: 1084494, saten: 1201194 } },
    { ancho: 100, alto: 190, precios: { incoloro: 1039669, color: 1129969, textura: 1195619, saten: 1364437 } }
  ]},
  { serie: "3200", nombre: "Rebatible Bolt Forma", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 143, precios: { incoloro: 998505, color: 1082853, textura: 1148282, saten: 1302528 } }
  ]},

  // ---------- LINEA 4000 - BOX (a medida) ----------
  { serie: "4000", nombre: "Box Frontal", apertura: "corrediza", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 943831, color: 1068452, saten: 1381139 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 1105964, color: 1260795, saten: 1645476 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 1306890, color: 1499485, saten: 1974058 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 1047016, color: 1195240, saten: 1562831 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 1229594, color: 1413693, saten: 1866207 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 1440315, color: 1664538, saten: 2212404 } }
  ]},
  { serie: "4050", nombre: "Box Transfer", apertura: "corrediza", medida: "estandar", items: [
    { ancho: 120, alto: 160, precios: { incoloro: 991022, color: 1121874, saten: 1450197 } },
    { ancho: 120, alto: 200, precios: { incoloro: 1099367, color: 1255002, saten: 1640972 } }
  ]},
  { serie: "4100", nombre: "Box Esquinero", apertura: "corrediza esquinera", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 200, precios: { incoloro: 1185180, color: 1355590, saten: 1777142 } },
    { anchoMin: 91, anchoMax: 120, alto: 200, precios: { incoloro: 1438300, color: 1662523, saten: 2210274 } }
  ]},
  { serie: "4200", nombre: "Box Angular", apertura: "corrediza angular (retorno 70)", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 1299920, color: 1481186, saten: 1931838 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 1462053, color: 1673530, saten: 2196175 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 1662979, color: 1912220, saten: 2524757 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 1443140, color: 1658393, saten: 2187799 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 1625718, color: 1876847, saten: 2491175 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 1854636, color: 2150610, saten: 2871132 } }
  ]},

  // ---------- LINEA 5000 - OPEN PIVOT (a medida) ----------
  { serie: "5000", nombre: "Open Pivot", apertura: "puerta batiente + fijo", medida: "rango", items: [
    { anchoMin: 50, anchoMax: 75, alto: 190, precios: { incoloro: 707106, color: 774109, saten: 952206 } },
    { anchoMin: 76, anchoMax: 100, alto: 190, precios: { incoloro: 806731, color: 896555, saten: 1127463 } },
    { anchoMin: 101, anchoMax: 160, alto: 190, precios: { incoloro: 1040070, color: 1183788, saten: 1539314 } }
  ]},
  { serie: "5100", nombre: "Open Pivot 2 Puertas", apertura: "2 puertas batientes", medida: "rango", items: [
    { anchoMin: 75, anchoMax: 100, alto: 190, precios: { incoloro: 1003913, color: 1093737, saten: 1335601 } },
    { anchoMin: 101, anchoMax: 160, alto: 190, precios: { incoloro: 1263682, color: 1407401, saten: 1775349 } }
  ]},
  { serie: "5200", nombre: "Open Pivot Esquinero", apertura: "batiente esquinera", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 1152469, color: 1314152, saten: 1713141 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 1372040, color: 1587617, saten: 2110458 } }
  ]},
  { serie: "5300", nombre: "Open Pivot Corner", apertura: "batiente corner", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 1363378, color: 1525061, saten: 1935766 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 1582534, color: 1798111, saten: 2332646 } }
  ]},
  { serie: "5500", nombre: "Open Pivot Plegadiza", apertura: "2 hojas plegadizas", medida: "estandar", items: [
    { ancho: 100, alto: 190, precios: { incoloro: 834720, color: 881121, saten: 997124 } }
  ]},

  // ---------- LINEA 6000 - OPEN BOLT (a medida) ----------
  { serie: "6000", nombre: "Open Bolt", apertura: "puerta batiente + fijo", medida: "rango", items: [
    { anchoMin: 75, anchoMax: 100, alto: 190, precios: { incoloro: 1080644, color: 1168017, saten: 1401650 } },
    { anchoMin: 101, anchoMax: 160, alto: 190, precios: { incoloro: 1345063, color: 1484861, saten: 1839475 } }
  ]},
  { serie: "6100", nombre: "Open Bolt 2 Puertas", apertura: "2 puertas batientes", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 190, precios: { incoloro: 1823296, color: 1963093, saten: 2341620 } }
  ]},
  { serie: "6200", nombre: "Open Bolt Esquinero", apertura: "batiente esquinera", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 1422456, color: 1579728, saten: 1974132 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 1636036, color: 1845732, saten: 2358576 } }
  ]},
  { serie: "6300", nombre: "Open Bolt Corner", apertura: "batiente corner", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 1910302, color: 2067574, saten: 2486370 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 2123479, color: 2333175, saten: 2870391 } }
  ]},

  // ---------- LINEA 7000 - STEEL ONE (a medida, herrajes acero inox.) ----------
  { serie: "7000-1P", nombre: "Steel One Frontal 1 Puerta", apertura: "corrediza herraje a la vista", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 200, alto: 160, precios: { incoloro: 1278094, color: 1335413, saten: 1474586 } },
    { anchoMin: 100, anchoMax: 200, alto: 200, precios: { incoloro: 1343605, color: 1414549, saten: 1589225 } }
  ]},
  { serie: "7000-2P", nombre: "Steel One Frontal 2 Puertas", apertura: "corrediza herraje a la vista", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 200, alto: 160, precios: { incoloro: 1844890, color: 1902189, saten: 2041383 } },
    { anchoMin: 100, anchoMax: 200, alto: 200, precios: { incoloro: 1910381, color: 1981346, saten: 2156001 } }
  ]},
  { serie: "7100", nombre: "Steel One Esquinero", apertura: "corrediza esquinera", medida: "estandar", items: [
    { ancho: 100, alto: 200, precios: { incoloro: 1973702, color: 2044647, saten: 2219323 } }
  ]},
  { serie: "7200", nombre: "Steel One Angular", apertura: "corrediza angular (retorno 70)", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 200, alto: 160, precios: { incoloro: 1384205, color: 1465257, saten: 1661749 } },
    { anchoMin: 100, anchoMax: 200, alto: 200, precios: { incoloro: 1475365, color: 1578528, saten: 1821411 } }
  ]},

  // ---------- LINEA 8000 - ESPACIO (zona de ducha) ----------
  { serie: "8100-A", nombre: "Espacio Recta Mod. A", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 1344421, color: 1460208, saten: 1769860 } }
  ]},
  { serie: "8100-B", nombre: "Espacio Recta Mod. B", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 1733386, color: 1926364, saten: 2415750 } }
  ]},
  { serie: "8100-C", nombre: "Espacio Recta Mod. C", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 1712871, color: 1905848, saten: 2394156 } }
  ]},
  { serie: "8100-D", nombre: "Espacio Recta Mod. D", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 2100653, color: 2370822, saten: 3038800 } }
  ]},

  // ---------- LINEA 9000 - MEKA (a medida, herraje a la vista) ----------
  { serie: "9000", nombre: "Meka Frontal", apertura: "corrediza herraje a la vista", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 1861897, color: 1969152, saten: 2294794 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 2003051, color: 2136307, saten: 2523658 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 2178177, color: 2343934, saten: 2808350 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 1975763, color: 2109831, saten: 2497350 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 2141029, color: 2307600, saten: 2771633 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 2348078, color: 2555275, saten: 3114980 } }
  ]},
  { serie: "9200", nombre: "Meka Angular", apertura: "corrediza angular (retorno 70)", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 2254935, color: 2410943, saten: 2859422 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 2372885, color: 2554893, saten: 3063792 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 2540545, color: 2755056, saten: 3340603 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 2392581, color: 2587591, saten: 3124518 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 2557848, color: 2785359, saten: 3398802 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 2757430, color: 3025568, saten: 3734267 } }
  ]},

  // ---------- MAMPARA BLINDEX CORREDIZA (a medida) ----------
  { serie: "30110", nombre: "Blindex Frontal Perfil Brillante", apertura: "corrediza", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 807828, textura: 861159, color: 914490, saten: 1182120 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 946597, textura: 1012857, color: 1079118, saten: 1408368 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 896145, textura: 959577, color: 1023009, saten: 1337631 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 1052414, textura: 1131199, color: 1209985, saten: 1597292 } }
  ]},
  { serie: "30120", nombre: "Blindex Frontal Perfil Mate", apertura: "corrediza", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 760308, textura: 810503, color: 860697, saten: 1112584 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 890915, textura: 953278, color: 1015640, saten: 1325523 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 843430, textura: 903131, color: 962832, saten: 1258946 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 990507, textura: 1064658, color: 1138809, saten: 1503333 } }
  ]},
  { serie: "30210", nombre: "Blindex Esquinero Perfil Brillante", apertura: "corrediza esquinera", medida: "estandar", items: [
    { ancho: 100, alto: 200, precios: { incoloro: 1014400, textura: 1087327, color: 1160253, saten: 1521061 } }
  ]},
  { serie: "30220", nombre: "Blindex Esquinero Perfil Mate", apertura: "corrediza esquinera", medida: "estandar", items: [
    { ancho: 100, alto: 200, precios: { incoloro: 954729, textura: 1023366, color: 1092003, saten: 1431587 } }
  ]}
];

// ------------------------------------------------------------
// Normalizacion de entradas
// ------------------------------------------------------------
function normalizarCristal(txt) {
  if (!txt) return null;
  var t = String(txt).toLowerCase();
  if (t.indexOf("incoloro") !== -1 || t.indexOf("transparente") !== -1) return "incoloro";
  if (t.indexOf("saten") !== -1 || t.indexOf("satén") !== -1 || t.indexOf("esmerilado") !== -1) return "saten";
  if (t.indexOf("gris") !== -1 || t.indexOf("bronce") !== -1 || t.indexOf("color") !== -1) return "color";
  if (t.indexOf("dreamline") !== -1 || t.indexOf("pacific") !== -1 || t.indexOf("textura") !== -1) return "textura";
  return null;
}

function buscarSerie(txt) {
  if (!txt) return null;
  var t = String(txt).toLowerCase().replace(/á/g,"a").replace(/é/g,"e").replace(/í/g,"i").replace(/ó/g,"o").replace(/ú/g,"u");
  // match exacto por codigo de serie
  for (var i = 0; i < SERIES.length; i++) {
    if (t.indexOf(SERIES[i].serie.toLowerCase()) !== -1) return SERIES[i];
  }
  // match por nombre completo (el mas largo que matchee gana, p.ej. "box angular" antes que "box")
  var mejor = null, mejorLen = 0;
  for (var j = 0; j < SERIES.length; j++) {
    var nom = SERIES[j].nombre.toLowerCase().replace(/\./g,"");
    if (t.indexOf(nom) !== -1 && nom.length > mejorLen) { mejor = SERIES[j]; mejorLen = nom.length; }
  }
  if (mejor) return mejor;
  // match por palabras clave parciales
  var keywords = [
    { k: ["box frontal"], s: "4000" }, { k: ["box angular"], s: "4200" },
    { k: ["box esquinero"], s: "4100" }, { k: ["box transfer"], s: "4050" },
    { k: ["blindex", "esquinero", "mate"], s: "30220" }, { k: ["blindex", "esquinero"], s: "30210" },
    { k: ["blindex", "mate"], s: "30120" }, { k: ["blindex"], s: "30110" },
    { k: ["steel one", "2 p"], s: "7000-2P" }, { k: ["steel one esquinero"], s: "7100" },
    { k: ["steel one angular"], s: "7200" }, { k: ["steel one"], s: "7000-1P" },
    { k: ["meka angular"], s: "9200" }, { k: ["meka"], s: "9000" },
    { k: ["open pivot", "2 p"], s: "5100" }, { k: ["plegadiza"], s: "5500" },
    { k: ["open pivot esquinero"], s: "5200" }, { k: ["open pivot corner"], s: "5300" },
    { k: ["open pivot"], s: "5000" },
    { k: ["open bolt", "2 p"], s: "6100" }, { k: ["open bolt esquinero"], s: "6200" },
    { k: ["open bolt corner"], s: "6300" }, { k: ["open bolt"], s: "6000" },
    { k: ["rebatible bolt forma"], s: "3200" }, { k: ["rebatible bolt"], s: "3100" },
    { k: ["rebatible pivot par"], s: "2100" }, { k: ["rebatible pivot forma"], s: "2200" },
    { k: ["rebatible pivot"], s: "2000" }, { k: ["rebatible"], s: "2000" },
    { k: ["panel angulo"], s: "1200" }, { k: ["panel"], s: "1000" },
    { k: ["espacio"], s: "8100-A" },
    { k: ["box", "corrediza"], s: "4000" }
  ];
  for (var m = 0; m < keywords.length; m++) {
    var todas = true;
    for (var n = 0; n < keywords[m].k.length; n++) {
      if (t.indexOf(keywords[m].k[n]) === -1) { todas = false; break; }
    }
    if (todas) {
      for (var p = 0; p < SERIES.length; p++) if (SERIES[p].serie === keywords[m].s) return SERIES[p];
    }
  }
  return null;
}

function fmt(n) {
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ------------------------------------------------------------
// Cotizador deterministico
// params: { modelo, ancho_cm, alto_cm, cristal, gran_mendoza (bool|null) }
// ------------------------------------------------------------
function cotizarMampara(params) {
  var serie = buscarSerie(params.modelo);
  if (!serie) {
    return { ok: false, error: "No se reconocio el modelo '" + (params.modelo || "?") + "'. Modelos: " + SERIES.map(function(s){return s.nombre;}).join(", ") };
  }
  var cristal = normalizarCristal(params.cristal);
  if (!cristal) {
    return { ok: false, error: "No se reconocio el cristal '" + (params.cristal || "?") + "'. Opciones: Incoloro, Color (Gris/Bronce), Textura (Dreamline/Pacific), Saten." };
  }
  var ancho = parseInt(params.ancho_cm, 10);
  var alto = parseInt(params.alto_cm, 10);
  if (!ancho || !alto) return { ok: false, error: "Faltan medidas (ancho y alto en cm)." };

  // Buscar item que matchee
  var item = null;
  var notas = [];
  var alturas = {};
  for (var i = 0; i < serie.items.length; i++) {
    var it = serie.items[i];
    alturas[it.alto] = true;
    var anchoOk = (serie.medida === "estandar") ? (it.ancho === ancho) : (ancho >= it.anchoMin && ancho <= it.anchoMax);
    if (anchoOk && it.alto === alto) { item = it; break; }
  }

  // Tolerancia de alto: si no matchea exacto, buscar el alto disponible mas cercano hacia arriba
  if (!item) {
    var candidatos = serie.items.filter(function(it2) {
      return (serie.medida === "estandar") ? (it2.ancho === ancho) : (ancho >= it2.anchoMin && ancho <= it2.anchoMax);
    });
    if (candidatos.length > 0) {
      candidatos.sort(function(a, b) { return a.alto - b.alto; });
      for (var c = 0; c < candidatos.length; c++) {
        if (candidatos[c].alto >= alto) { item = candidatos[c]; break; }
      }
      if (!item) item = candidatos[candidatos.length - 1];
      if (item.alto !== alto) notas.push("Alto solicitado " + alto + " cm: se cotiza el alto de fabrica " + item.alto + " cm (alturas disponibles: " + Object.keys(alturas).join(" / ") + " cm).");
    }
  }

  if (!item) {
    var rangosTxt = serie.items.map(function(it3) {
      return (serie.medida === "estandar" ? it3.ancho : (it3.anchoMin + " a " + it3.anchoMax)) + " x " + it3.alto;
    }).join(", ");
    return { ok: false, error: "La medida " + ancho + "x" + alto + " cm esta fuera de rango para " + serie.nombre + ". Medidas disponibles (cm): " + rangosTxt + ". Medidas especiales: consultar con el area tecnica." };
  }

  var precio = item.precios[cristal];
  if (precio === undefined) {
    var disponibles = Object.keys(item.precios).join(", ");
    return { ok: false, error: "El modelo " + serie.nombre + " no viene en cristal '" + cristal + "'. Cristales disponibles: " + disponibles + "." };
  }

  if (serie.medida === "estandar") notas.push("Modelo de medidas estandar (medidas especiales: consultar).");

  var instalacion = null;
  if (params.gran_mendoza === true) instalacion = INSTALACION_GRAN_MENDOZA;

  var subtotal = precio + (instalacion || 0);
  var res = {
    ok: true,
    listaEdicion: LISTA_EDICION,
    serie: serie.serie,
    modelo: serie.nombre,
    apertura: serie.apertura,
    medidaCotizada: ancho + " x " + item.alto + " cm",
    cristal: cristal,
    precioMampara: precio,
    instalacion: instalacion, // null si es fuera del Gran Mendoza
    granMendoza: params.gran_mendoza === true,
    subtotalSinIva: subtotal,
    iva: Math.round(subtotal * IVA),
    totalConIva: Math.round(subtotal * (1 + IVA)),
    notas: notas
  };
  return res;
}

// Texto formateado de la cotizacion (para la ficha interna del vendedor)
function formatearCotizacion(c) {
  if (!c.ok) return "\u26A0 No se pudo cotizar: " + c.error;
  var t = "\u{1F4B0} COTIZACION MAMPARA (calculada por sistema - lista " + c.listaEdicion + ")\n";
  t += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  t += "\u{1F6BF} Modelo: " + c.modelo + " (serie " + c.serie + ")\n";
  t += "\u{1F4D0} Medida: " + c.medidaCotizada + "\n";
  t += "\u{1F532} Cristal: " + c.cristal.charAt(0).toUpperCase() + c.cristal.slice(1) + "\n";
  t += "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n";
  t += "Mampara: " + fmt(c.precioMampara) + " + IVA\n";
  if (c.granMendoza) {
    t += "Medicion + flete + instalacion (Gran Mendoza): " + fmt(c.instalacion) + " + IVA\n";
    t += "TOTAL: " + fmt(c.subtotalSinIva) + " + IVA (" + fmt(c.totalConIva) + " IVA incluido)\n";
  } else {
    t += "\u26A0 FUERA DEL GRAN MENDOZA: medicion/flete/instalacion la calcula el vendedor.\n";
    t += "TOTAL (solo mampara): " + fmt(c.subtotalSinIva) + " + IVA (" + fmt(c.totalConIva) + " IVA incluido)\n";
  }
  if (c.notas.length > 0) {
    for (var i = 0; i < c.notas.length; i++) t += "\u{1F4DD} " + c.notas[i] + "\n";
  }
  t += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  t += "\u{1F449} Revisar y enviar al cliente si esta OK. Claudia NO envio este precio.";
  return t;
}

// Guia de asesoramiento para Claudia (sin precios)
var MAMPARAS_GUIA = [
  "GUIA DE MAMPARAS DE BANO GLASSIC (asesoramiento - NUNCA dar precios por chat):",
  "- PANEL (linea 1000): pano fijo de cierre parcial, sin puertas. Economico, moderno, sensacion de amplitud. Medidas estandar 80cm ancho.",
  "- REBATIBLE PIVOT (linea 2000): hoja abatible de cierre parcial, ideal BANERA. Apertura adentro/afuera. Medidas estandar.",
  "- REBATIBLE BOLT (linea 3000): hoja rebatible + pano fijo lateral, ideal BANERA, mas elegante. Medidas estandar.",
  "- BOX (linea 4000): puertas CORREDIZAS + panos fijos. El clasico para ducha. Frontal, esquinero o angular. Se fabrica A MEDIDA (frontal: anchos 100 a 250 cm, altos 160 o 200).",
  "- OPEN PIVOT (linea 5000): puerta BATIENTE + fijos, con version 2 puertas, esquinero, corner y plegadiza (ideal espacios chicos). A medida, alto 190.",
  "- OPEN BOLT (linea 6000): batiente premium con bisagra con traba, zocalo sin canaletas. A medida, alto 190.",
  "- STEEL ONE (linea 7000): corrediza premium con herrajes de acero inoxidable A LA VISTA, vanguardia. A medida.",
  "- ESPACIO (linea 8000): zona de ducha walk-in (zona humeda + zona de secado), minimalista. Mods A-D, 150x70, alto 190.",
  "- MEKA (linea 9000): corrediza premium herraje a la vista, concepto moderno. A medida.",
  "- BLINDEX CORREDIZA: la clasica corrediza Blindex, perfil brillante o mate. A medida (anchos 100 a 200).",
  "CRISTALES: todos templados de seguridad 6/8mm. Opciones: Incoloro / Color (Gris o Bronce) / Textura (Dreamline o Pacific) / Saten. Opcionales: arenados y serigrafias.",
  "PERFILES: aluminio anodizado o pintado segun linea: Plata, Acero mate, Negro, Blanco, Oro (segun modelo).",
  "PREGUNTAS PARA ASESORAR: 1) Es para banera o ducha/receptaculo? 2) Frontal, esquinero (dos vidrios en L) o angular? 3) Prefiere corrediza, batiente o solo pano fijo? 4) Que medidas tiene el hueco (ancho x alto en cm)? 5) Que cristal prefiere? 6) La obra esta dentro del Gran Mendoza (Capital, Godoy Cruz, Guaymallen, Las Heras, Maipu, Lujan de Cuyo)?",
  "RECOMENDACIONES RAPIDAS: banera -> Rebatible Pivot o Rebatible Bolt. Ducha clasica -> Box corrediza o Blindex. Espacio chico -> Open Pivot Plegadiza. Premium/moderno -> Steel One, Meka o Espacio.",
  "Para cotizar una mampara necesitas: modelo, ancho y alto en cm, cristal, y si esta dentro del Gran Mendoza. El PRECIO lo calcula el sistema y lo aprueba un asesor: vos NUNCA lo decis en el chat."
].join("\n");

module.exports = {
  cotizarMampara: cotizarMampara,
  formatearCotizacion: formatearCotizacion,
  MAMPARAS_GUIA: MAMPARAS_GUIA,
  SERIES: SERIES,
  INSTALACION_GRAN_MENDOZA: INSTALACION_GRAN_MENDOZA
};
