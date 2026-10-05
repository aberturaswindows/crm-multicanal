// ============================================================
// MAMPARAS GLASSIC - Lista de precios L107 (Edicion 10/9/2026)
// Precios de lista SIN IVA. Se venden a precio de lista tal cual.
// Colocacion: lista "Colocaciones Glassic - Octubre 2026 - Version 1" (1/10/2026):
//   - Flete Glassic -> transporte: $48.200 + IVA, se suma a TODAS las mamparas.
//   - Mamparas STANDARD (series 1000, 2000, 2100, 2200, 3100, 3200 y sus
//     variantes punta curva): colocacion $167.200 + IVA (NO incluye medicion)
//     + medicion previa a domicilio $85.000 + IVA.
//   - Mamparas A MEDIDA (1200, 4000-4300, 5000-5400, 6000-6400, 7100, 8100,
//     8200, 9000-9300): colocacion $379.400 + IVA (incluye medicion).
//   - Colocacion y medicion solo dentro del Gran Mendoza. Fuera del Gran
//     Mendoza las calcula el vendedor manualmente (el flete Glassic se suma igual).
// IMPORTANTE: la cotizacion la calcula SIEMPRE este modulo (deterministico),
// nunca la IA. Claudia solo recopila los datos.
// ============================================================

var LISTA_EDICION = "L107 (10/9/2026)";
var LISTA_COLOCACION = "Colocaciones Glassic Oct-2026 v1";
var FLETE_GLASSIC = 48200;                 // + IVA, todas las mamparas
var COLOCACION_ESTANDAR = 167200;          // + IVA, no incluye medicion
var MEDICION_PREVIA_ESTANDAR = 85000;      // + IVA, solo mamparas standard
var COLOCACION_A_MEDIDA = 379400;          // + IVA, incluye medicion
// Si se pone en false, la medicion previa de las standard se muestra como opcional y no se suma al total.
var INCLUIR_MEDICION_ESTANDAR = true;
var IVA = 0.21;

// Series que figuran explicitamente en la lista de colocacion.
var COLOC_LISTA_ESTANDAR = ["1000", "1010", "2000", "2010", "2100", "2110", "2200", "3100", "3110", "3200"];
var COLOC_LISTA_A_MEDIDA = ["1200", "4000", "4100", "4200", "4300", "5000", "5100", "5200", "5300", "5400",
  "6000", "6100", "6200", "6300", "6400", "7100", "8100-A", "8100-B", "8100-C", "8100-D", "9000", "9200", "9300"];

// Devuelve el tipo de colocacion de una serie y si figura en la lista (si no figura,
// se asume segun su tipo de medida y se avisa al vendedor para que lo verifique).
function tipoColocacion(serie) {
  if (COLOC_LISTA_ESTANDAR.indexOf(serie.serie) !== -1) return { tipo: "estandar", enLista: true };
  if (COLOC_LISTA_A_MEDIDA.indexOf(serie.serie) !== -1) return { tipo: "a_medida", enLista: true };
  return { tipo: serie.medida === "estandar" ? "estandar" : "a_medida", enLista: false };
}

// tipo de medida: "estandar" (medidas fijas) o "rango" (se fabrica a medida dentro del rango)
// cristales: incoloro | color (Gris y Bronce) | textura (Dreamline y Pacific) | saten
var SERIES = [
  // ---------- LINEA 1000 - PANEL (estandar) ----------
  { serie: "1000", nombre: "Panel", apertura: "panel fijo", medida: "estandar", items: [
    { ancho: 80, alto: 160, precios: { incoloro: 370375, color: 435631, textura: 425932, saten: 608297 } },
    { ancho: 80, alto: 200, precios: { incoloro: 450359, color: 527850, textura: 517913, saten: 733794 } }
  ]},
  { serie: "1010", nombre: "Panel Punta Curva", apertura: "panel fijo", medida: "estandar", items: [
    { ancho: 80, alto: 160, precios: { incoloro: 376725, color: 443099, textura: 433234, saten: 617902 } },
    { ancho: 80, alto: 200, precios: { incoloro: 458080, color: 536899, textura: 526791, saten: 745380 } }
  ]},
  { serie: "1200", nombre: "Panel Angulo", apertura: "panel fijo en angulo", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 160, precios: { incoloro: 760493, color: 908996, textura: 874567, saten: 1280242 } },
    { anchoMin: 70, anchoMax: 90, alto: 200, precios: { incoloro: 901784, color: 1078132, textura: 1037052, saten: 1518890 } }
  ]},

  // ---------- LINEA 2000 - REBATIBLE PIVOT (estandar) ----------
  { serie: "2000", nombre: "Rebatible Pivot", apertura: "hoja rebatible", medida: "estandar", items: [
    { ancho: 85, alto: 150, precios: { incoloro: 389627, color: 424959, textura: 448071, saten: 574122 } },
    { ancho: 85, alto: 190, precios: { incoloro: 677576, color: 759757, textura: 779212, saten: 992283 } }
  ]},
  { serie: "2010", nombre: "Rebatible Pivot Punta Curva", apertura: "hoja rebatible", medida: "estandar", items: [
    { ancho: 85, alto: 150, precios: { incoloro: 396711, color: 432686, textura: 456218, saten: 583691 } },
    { ancho: 85, alto: 190, precios: { incoloro: 709083, color: 772280, textura: 815445, saten: 1007394 } }
  ]},
  { serie: "2100", nombre: "Rebatible Pivot Par", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 505390, color: 559655, textura: 581198, saten: 752236 } },
    { ancho: 100, alto: 190, precios: { incoloro: 750047, color: 846545, textura: 862555, saten: 1115820 } }
  ]},
  { serie: "2110", nombre: "Rebatible Pivot Par Punta Curva", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 513721, color: 568880, textura: 590779, saten: 763692 } },
    { ancho: 100, alto: 190, precios: { incoloro: 762411, color: 860499, textura: 876773, saten: 1132812 } }
  ]},
  { serie: "2200", nombre: "Rebatible Pivot Forma", apertura: "hoja rebatible", medida: "estandar", items: [
    { ancho: 95, alto: 141, precios: { incoloro: 472214, color: 519867, textura: 543047, saten: 709462 } }
  ]},

  // ---------- LINEA 3000 - REBATIBLE BOLT (estandar) ----------
  { serie: "3100", nombre: "Rebatible Bolt", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 969486, color: 1041406, textura: 1114909, saten: 1238350 } },
    { ancho: 100, alto: 190, precios: { incoloro: 1068826, color: 1161659, textura: 1229150, saten: 1406644 } }
  ]},
  { serie: "3110", nombre: "Rebatible Bolt Punta Curva", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 150, precios: { incoloro: 1018481, color: 1094036, textura: 1171253, saten: 1297289 } },
    { ancho: 100, alto: 190, precios: { incoloro: 1122842, color: 1220367, textura: 1291268, saten: 1473592 } }
  ]},
  { serie: "3200", nombre: "Rebatible Bolt Forma", apertura: "hoja rebatible + fijo", medida: "estandar", items: [
    { ancho: 100, alto: 143, precios: { incoloro: 1078386, color: 1169481, textura: 1240144, saten: 1406731 } }
  ]},

  // ---------- LINEA 4000 - BOX (a medida) ----------
  { serie: "4000", nombre: "Box Frontal", apertura: "corrediza", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 1019337, color: 1153928, saten: 1491631 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 1194441, color: 1361659, saten: 1777114 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 1411441, color: 1619444, saten: 2131982 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 1130778, color: 1290859, saten: 1687857 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 1327962, color: 1526788, saten: 2015503 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 1555541, color: 1797701, saten: 2389396 } }
  ]},
  { serie: "4050", nombre: "Box Transfer", apertura: "corrediza", medida: "estandar", items: [
    { ancho: 120, alto: 160, precios: { incoloro: 1070304, color: 1211623, saten: 1566213 } },
    { ancho: 120, alto: 200, precios: { incoloro: 1187316, color: 1355402, saten: 1772250 } }
  ]},
  { serie: "4100", nombre: "Box Esquinero", apertura: "corrediza esquinera", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 200, precios: { incoloro: 1279994, color: 1464037, saten: 1919313 } },
    { anchoMin: 91, anchoMax: 120, alto: 200, precios: { incoloro: 1553364, color: 1795525, saten: 2387096 } }
  ]},
  { serie: "4200", nombre: "Box Angular", apertura: "corrediza angular (retorno 70)", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 1403914, color: 1599681, saten: 2086385 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 1579017, color: 1807413, saten: 2371869 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 1796017, color: 2065198, saten: 2726737 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 1558591, color: 1791065, saten: 2362823 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 1755775, color: 2026995, saten: 2690469 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 2003007, color: 2322658, saten: 3100822 } }
  ]},

  // ---------- LINEA 5000 - OPEN PIVOT (a medida) ----------
  { serie: "5000", nombre: "Open Pivot", apertura: "puerta batiente + fijo", medida: "rango", items: [
    { anchoMin: 50, anchoMax: 75, alto: 190, precios: { incoloro: 763675, color: 836038, saten: 1028383 } },
    { anchoMin: 76, anchoMax: 100, alto: 190, precios: { incoloro: 871269, color: 968279, saten: 1217660 } },
    { anchoMin: 101, anchoMax: 160, alto: 190, precios: { incoloro: 1123275, color: 1278491, saten: 1662459 } }
  ]},
  { serie: "5100", nombre: "Open Pivot 2 Puertas", apertura: "2 puertas batientes", medida: "rango", items: [
    { anchoMin: 75, anchoMax: 100, alto: 190, precios: { incoloro: 1084226, color: 1181236, saten: 1442449 } },
    { anchoMin: 101, anchoMax: 160, alto: 190, precios: { incoloro: 1364776, color: 1519993, saten: 1917377 } }
  ]},
  { serie: "5200", nombre: "Open Pivot Esquinero", apertura: "batiente esquinera", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 1244667, color: 1419284, saten: 1850192 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 1481803, color: 1714627, saten: 2279294 } }
  ]},
  { serie: "5300", nombre: "Open Pivot Corner", apertura: "batiente corner", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 1472448, color: 1647065, saten: 2090628 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 1709137, color: 1941960, saten: 2519258 } }
  ]},
  { serie: "5500", nombre: "Open Pivot Plegadiza", apertura: "2 hojas plegadizas", medida: "estandar", items: [
    { ancho: 100, alto: 190, precios: { incoloro: 901498, color: 951611, saten: 1076893 } }
  ]},

  // ---------- LINEA 6000 - OPEN BOLT (a medida) ----------
  { serie: "6000", nombre: "Open Bolt", apertura: "puerta batiente + fijo", medida: "rango", items: [
    { anchoMin: 75, anchoMax: 100, alto: 190, precios: { incoloro: 1167095, color: 1261458, saten: 1513782 } },
    { anchoMin: 101, anchoMax: 160, alto: 190, precios: { incoloro: 1452668, color: 1603650, saten: 1986633 } }
  ]},
  { serie: "6100", nombre: "Open Bolt 2 Puertas", apertura: "2 puertas batientes", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 190, precios: { incoloro: 1969159, color: 2120141, saten: 2528949 } }
  ]},
  { serie: "6200", nombre: "Open Bolt Esquinero", apertura: "batiente esquinera", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 1536252, color: 1706106, saten: 2132062 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 1766919, color: 1993390, saten: 2547262 } }
  ]},
  { serie: "6300", nombre: "Open Bolt Corner", apertura: "batiente corner", medida: "rango", items: [
    { anchoMin: 70, anchoMax: 90, alto: 190, precios: { incoloro: 2063126, color: 2232980, saten: 2685280 } },
    { anchoMin: 91, anchoMax: 120, alto: 190, precios: { incoloro: 2293357, color: 2519829, saten: 3100022 } }
  ]},

  // ---------- LINEA 7000 - STEEL ONE (a medida, herrajes acero inox.) ----------
  { serie: "7000-1P", nombre: "Steel One Frontal 1 Puerta", apertura: "corrediza herraje a la vista", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 200, alto: 160, precios: { incoloro: 1380341, color: 1442247, saten: 1592553 } },
    { anchoMin: 100, anchoMax: 200, alto: 200, precios: { incoloro: 1451093, color: 1527713, saten: 1716363 } }
  ]},
  { serie: "7000-2P", nombre: "Steel One Frontal 2 Puertas", apertura: "corrediza herraje a la vista", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 200, alto: 160, precios: { incoloro: 1992482, color: 2054364, saten: 2204693 } },
    { anchoMin: 100, anchoMax: 200, alto: 200, precios: { incoloro: 2063211, color: 2139854, saten: 2328481 } }
  ]},
  { serie: "7100", nombre: "Steel One Esquinero", apertura: "corrediza esquinera", medida: "estandar", items: [
    { ancho: 100, alto: 200, precios: { incoloro: 2131598, color: 2208218, saten: 2396868 } }
  ]},
  { serie: "7200", nombre: "Steel One Angular", apertura: "corrediza angular (retorno 70)", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 200, alto: 160, precios: { incoloro: 1494941, color: 1582478, saten: 1794689 } },
    { anchoMin: 100, anchoMax: 200, alto: 200, precios: { incoloro: 1593394, color: 1704810, saten: 1967124 } }
  ]},

  // ---------- LINEA 8000 - ESPACIO (zona de ducha) ----------
  { serie: "8100-A", nombre: "Espacio Recta Mod. A", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 1451975, color: 1577025, saten: 1911449 } }
  ]},
  { serie: "8100-B", nombre: "Espacio Recta Mod. B", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 1872057, color: 2080473, saten: 2609010 } }
  ]},
  { serie: "8100-C", nombre: "Espacio Recta Mod. C", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 1849901, color: 2058316, saten: 2585688 } }
  ]},
  { serie: "8100-D", nombre: "Espacio Recta Mod. D", apertura: "panos fijos + aleta", medida: "estandar", items: [
    { ancho: 150, alto: 190, precios: { incoloro: 2268705, color: 2560487, saten: 3281904 } }
  ]},

  // ---------- LINEA 9000 - MEKA (a medida, herraje a la vista) ----------
  { serie: "9000", nombre: "Meka Frontal", apertura: "corrediza herraje a la vista", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 2010848, color: 2126684, saten: 2478377 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 2163295, color: 2307212, saten: 2725551 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 2352431, color: 2531449, saten: 3033018 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 2133824, color: 2278618, saten: 2697138 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 2312312, color: 2492208, saten: 2993364 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 2535924, color: 2759697, saten: 3364179 } }
  ]},
  { serie: "9200", nombre: "Meka Angular", apertura: "corrediza angular (retorno 70)", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 2435330, color: 2603818, saten: 3088175 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 2562716, color: 2759285, saten: 3308896 } },
    { anchoMin: 201, anchoMax: 250, alto: 160, precios: { incoloro: 2743788, color: 2975460, saten: 3607851 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 2583988, color: 2794599, saten: 3374479 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 2762475, color: 3008187, saten: 3670706 } },
    { anchoMin: 201, anchoMax: 250, alto: 200, precios: { incoloro: 2978025, color: 3267613, saten: 4033008 } }
  ]},

  // ---------- MAMPARA BLINDEX CORREDIZA (a medida) ----------
  { serie: "30110", nombre: "Blindex Frontal Perfil Brillante", apertura: "corrediza", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 872454, textura: 930052, color: 987650, saten: 1276690 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 1022325, textura: 1093886, color: 1165447, saten: 1521037 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 967836, textura: 1036343, color: 1104850, saten: 1444641 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 1136607, textura: 1221695, color: 1306783, saten: 1725075 } }
  ]},
  { serie: "30120", nombre: "Blindex Frontal Perfil Mate", apertura: "corrediza", medida: "rango", items: [
    { anchoMin: 100, anchoMax: 160, alto: 160, precios: { incoloro: 821133, textura: 875343, color: 929553, saten: 1201590 } },
    { anchoMin: 161, anchoMax: 200, alto: 160, precios: { incoloro: 962188, textura: 1029540, color: 1096892, saten: 1431565 } },
    { anchoMin: 100, anchoMax: 160, alto: 200, precios: { incoloro: 910905, textura: 975382, color: 1039858, saten: 1359662 } },
    { anchoMin: 161, anchoMax: 200, alto: 200, precios: { incoloro: 1069748, textura: 1149831, color: 1229914, saten: 1623600 } }
  ]},
  { serie: "30210", nombre: "Blindex Esquinero Perfil Brillante", apertura: "corrediza esquinera", medida: "estandar", items: [
    { ancho: 100, alto: 200, precios: { incoloro: 1095552, textura: 1174313, color: 1253074, saten: 1642746 } }
  ]},
  { serie: "30220", nombre: "Blindex Esquinero Perfil Mate", apertura: "corrediza esquinera", medida: "estandar", items: [
    { ancho: 100, alto: 200, precios: { incoloro: 1031107, textura: 1105236, color: 1179364, saten: 1546114 } }
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
    var sugerencia = "";
    if (serie.medida === "estandar") {
      sugerencia = " Ofrecer al cliente la medida estandar mas cercana";
      if (esPanelFijo(serie)) sugerencia += " o una " + MAMPARA_FIJA_A_MEDIDA + " a medida, que cotiza el asesor";
      sugerencia += ".";
    } else {
      sugerencia = " Medidas especiales: consultar con el area tecnica.";
    }
    return { ok: false, error: "La medida " + ancho + "x" + alto + " cm no esta disponible para " + serie.nombre + ". Medidas disponibles (cm): " + rangosTxt + "." + sugerencia };
  }

  var precio = item.precios[cristal];
  if (precio === undefined) {
    var disponibles = Object.keys(item.precios).join(", ");
    return { ok: false, error: "El modelo " + serie.nombre + " no viene en cristal '" + cristal + "'. Cristales disponibles: " + disponibles + "." };
  }

  if (serie.medida === "estandar") notas.push("Modelo de medidas estandar (medidas especiales: consultar).");

  // Servicios: flete Glassic siempre; colocacion/medicion solo en Gran Mendoza.
  var coloc = tipoColocacion(serie);
  var colocacion = null, medicion = null, medicionOpcional = null;
  if (params.gran_mendoza === true) {
    if (coloc.tipo === "estandar") {
      colocacion = COLOCACION_ESTANDAR;
      if (INCLUIR_MEDICION_ESTANDAR) medicion = MEDICION_PREVIA_ESTANDAR;
      else medicionOpcional = MEDICION_PREVIA_ESTANDAR;
    } else {
      colocacion = COLOCACION_A_MEDIDA;
    }
    if (!coloc.enLista) notas.push("La serie " + serie.serie + " no figura en la lista de colocacion: se aplico la colocacion " + (coloc.tipo === "estandar" ? "standard" : "a medida") + " segun el tipo de mampara. Verificar con tecnica.");
  }
  var instalacion = (colocacion !== null) ? colocacion + (medicion || 0) : null;

  var subtotal = precio + FLETE_GLASSIC + (instalacion || 0);
  var res = {
    ok: true,
    listaEdicion: LISTA_EDICION,
    listaColocacion: LISTA_COLOCACION,
    serie: serie.serie,
    modelo: serie.nombre,
    apertura: serie.apertura,
    medidaCotizada: ancho + " x " + item.alto + " cm",
    cristal: cristal,
    precioMampara: precio,
    flete: FLETE_GLASSIC,
    tipoColocacion: coloc.tipo,
    colocacion: colocacion,             // null si es fuera del Gran Mendoza o zona sin confirmar
    medicion: medicion,                 // solo standard (si esta incluida)
    medicionOpcional: medicionOpcional, // solo standard (si NO esta incluida)
    instalacion: instalacion,           // colocacion + medicion (null fuera del Gran Mendoza)
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
  t += "Flete Glassic: " + fmt(c.flete) + " + IVA\n";
  if (c.granMendoza) {
    if (c.tipoColocacion === "estandar") {
      t += "Colocacion (mampara standard): " + fmt(c.colocacion) + " + IVA\n";
      if (c.medicion) t += "Medicion previa a domicilio: " + fmt(c.medicion) + " + IVA\n";
      if (c.medicionOpcional) t += "(Opcional, no sumado) Medicion previa a domicilio: " + fmt(c.medicionOpcional) + " + IVA\n";
    } else {
      t += "Colocacion a medida (incluye medicion): " + fmt(c.colocacion) + " + IVA\n";
    }
    t += "TOTAL: " + fmt(c.subtotalSinIva) + " + IVA (" + fmt(c.totalConIva) + " IVA incluido)\n";
  } else {
    t += "\u26A0 FUERA DEL GRAN MENDOZA: medicion/colocacion la calcula el vendedor.\n";
    t += "TOTAL (mampara + flete Glassic): " + fmt(c.subtotalSinIva) + " + IVA (" + fmt(c.totalConIva) + " IVA incluido)\n";
  }
  if (c.notas.length > 0) {
    for (var i = 0; i < c.notas.length; i++) t += "\u{1F4DD} " + c.notas[i] + "\n";
  }
  t += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
  t += "\u{1F449} Revisar y enviar al cliente si esta OK. Claudia NO envio este precio.";
  return t;
}

// Guia de asesoramiento para Claudia (sin precios)
// Alternativa a medida para paneles fijos cuando la medida estandar no sirve (la cotiza el asesor).
var MAMPARA_FIJA_A_MEDIDA = "mampara fija con perfil U 15x40 y cristal laminado 5+5 mm";

function esPanelFijo(serie) { return String(serie.apertura || "").indexOf("panel fijo") === 0; }

// Lista de modelos de medida estandar con sus medidas (se arma desde SERIES).
function textoMedidasEstandar() {
  return SERIES.filter(function(s) { return s.medida === "estandar"; }).map(function(s) {
    var medidas = s.items.map(function(it) { return it.ancho + "x" + it.alto; });
    medidas = medidas.filter(function(m, i) { return medidas.indexOf(m) === i; });
    return s.nombre + " (" + medidas.join(" / ") + ")";
  }).join("; ");
}

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
  "MODELOS DE MEDIDA ESTANDAR (ancho x alto en cm, NO se fabrican en otras medidas): " + textoMedidasEstandar() + ".",
  "SI EL CLIENTE PIDE UN MODELO ESTANDAR EN UNA MEDIDA QUE NO EXISTE (ej: Panel de 85 cm, que viene solo en 80): NO lo cotices con su medida. Explicale que ese modelo viene en medida estandar y ofrecele DOS opciones: (1) el mismo modelo en la medida estandar mas cercana (ej: Panel de 80 cm), o (2) si es un panel/mampara FIJA, una " + MAMPARA_FIJA_A_MEDIDA + " fabricada a su medida, que la cotiza un asesor. Si es otro modelo estandar (rebatible, etc.), la opcion 2 es consultar medidas especiales con un asesor.",
  "- Si elige la opcion 1: anota el modelo con la MEDIDA ESTANDAR (ej: Panel, ancho_cm 80) y segui normalmente.",
  "- Si elige la opcion 2: en resumen.aberturas anota tipo 'Mampara fija a medida (perfil U 15x40, cristal laminado 5+5)', modelo null, y sus medidas reales (ej: 85 x 200). La cotiza el asesor; vos no prometas precio ni plazo distinto al habitual.",
  "- Mientras el cliente no elija, NO marques datos_completos.",
  "Para cotizar una mampara necesitas: modelo, ancho y alto en cm, cristal, y si esta dentro del Gran Mendoza. El PRECIO lo calcula el sistema y lo aprueba un asesor: vos NUNCA lo decis en el chat."
].join("\n");

// ------------------------------------------------------------
// MODO PRUEBA: cotizacion directa al cliente
// Variable de entorno MAMPARAS_COTIZACION_DIRECTA (en Railway):
//   - vacia / no existe -> APAGADO (el precio solo lo ve el vendedor, como siempre)
//   - "todos"           -> Claudia cotiza directo a TODOS los clientes
//   - "2613539384,2615551234" -> solo a esos numeros de WhatsApp (ultimos 10 digitos)
// El precio SIEMPRE lo calcula este modulo; Claudia nunca escribe numeros.
// ------------------------------------------------------------
function soloDigitos(x) { return String(x || "").replace(/\D/g, ""); }

// Normaliza un celular argentino a 10 digitos (codigo de area + numero), sin 54, 9, 0 ni 15.
// Acepta: "2614445566", "261 444 5566", "+54 9 261 444-5566", "0261 15 444-5566", "5492614445566".
function normalizarCelularAR(x) {
  var d = soloDigitos(x);
  if (d.indexOf("549") === 0 && d.length >= 12) d = d.slice(3);
  else if (d.indexOf("54") === 0 && d.length >= 12) d = d.slice(2);
  if (d.charAt(0) === "0") d = d.slice(1);
  if (d.length === 12) {
    // Sacar el "15" despues del codigo de area (2, 3 o 4 digitos)
    for (var a = 2; a <= 4; a++) {
      if (d.substr(a, 2) === "15") { d = d.slice(0, a) + d.slice(a + 2); break; }
    }
  }
  return d.slice(-10);
}

function cotizacionDirectaHabilitada(contact) {
  var cfg = String(process.env.MAMPARAS_COTIZACION_DIRECTA || "").trim().toLowerCase();
  if (!cfg || cfg === "no" || cfg === "false" || cfg === "0") return false;
  if (cfg === "todos" || cfg === "si" || cfg === "true" || cfg === "1") return true;
  if (!contact) return false;
  // La lista se separa SOLO por comas o punto y coma (los espacios son parte del numero).
  var lista = cfg.split(/[,;]+/).map(normalizarCelularAR).filter(function(n) { return n.length === 10; });
  var numeros = [contact.channel_id, contact.phone].map(normalizarCelularAR).filter(function(n) { return n.length === 10; });
  for (var i = 0; i < lista.length; i++) {
    if (numeros.indexOf(lista[i]) !== -1) return true;
  }
  return false;
}

// Texto de la cotizacion para el CLIENTE (formato WhatsApp, sin datos internos).
function formatearCotizacionCliente(c, cantidad) {
  if (!c || !c.ok) return null;
  var cristalTxt = { incoloro: "Incoloro", color: "Color (Gris o Bronce)", textura: "Textura (Dreamline o Pacific)", saten: "Saten" }[c.cristal] || c.cristal;
  var t = "*Cotizacion mampara de bano*\n";
  t += "Modelo: " + c.modelo + "\n";
  t += "Medida: " + c.medidaCotizada + "\n";
  t += "Cristal: " + cristalTxt + "\n\n";
  t += "Mampara: " + fmt(c.precioMampara) + " + IVA\n";
  t += "Flete: " + fmt(c.flete) + " + IVA\n";
  if (c.granMendoza) {
    if (c.tipoColocacion === "estandar") {
      t += "Colocacion: " + fmt(c.colocacion) + " + IVA\n";
      if (c.medicion) t += "Medicion previa en domicilio: " + fmt(c.medicion) + " + IVA\n";
    } else {
      t += "Medicion y colocacion: " + fmt(c.colocacion) + " + IVA\n";
    }
    t += "\n*Total: " + fmt(c.subtotalSinIva) + " + IVA (" + fmt(c.totalConIva) + " IVA incluido)*\n";
  } else {
    t += "\n*Total: " + fmt(c.subtotalSinIva) + " + IVA (" + fmt(c.totalConIva) + " IVA incluido)*\n";
    t += "La colocacion fuera del Gran Mendoza se cotiza aparte segun la ubicacion de la obra.\n";
  }
  if (cantidad > 1) t += "Precios por unidad. Cantidad solicitada: " + cantidad + ".\n";
  for (var i = 0; i < c.notas.length; i++) {
    // Solo notas utiles para el cliente (el aviso de serie sin colocacion en lista es interno)
    if (c.notas[i].indexOf("lista de colocacion") === -1) t += c.notas[i] + "\n";
  }
  t += "\nPrecios sujetos a verificacion de medidas en obra.";
  return t;
}

// Aviso para el vendedor cuando no quedo claro si la obra es en Gran Mendoza.
function avisoZonaSinConfirmar(c) {
  if (!c || !c.ok) return "";
  var extra;
  if (c.tipoColocacion === "estandar") {
    extra = fmt(COLOCACION_ESTANDAR) + " + IVA de colocacion" + (INCLUIR_MEDICION_ESTANDAR ? " + " + fmt(MEDICION_PREVIA_ESTANDAR) + " + IVA de medicion previa" : "");
  } else {
    extra = fmt(COLOCACION_A_MEDIDA) + " + IVA de colocacion a medida (incluye medicion)";
  }
  return "\n⚠ No quedo claro si la obra esta dentro del Gran Mendoza: confirmar antes de enviar (dentro suma " + extra + ").";
}

module.exports = {
  cotizarMampara: cotizarMampara,
  formatearCotizacion: formatearCotizacion,
  avisoZonaSinConfirmar: avisoZonaSinConfirmar,
  cotizacionDirectaHabilitada: cotizacionDirectaHabilitada,
  formatearCotizacionCliente: formatearCotizacionCliente,
  MAMPARAS_GUIA: MAMPARAS_GUIA,
  SERIES: SERIES,
  FLETE_GLASSIC: FLETE_GLASSIC,
  COLOCACION_ESTANDAR: COLOCACION_ESTANDAR,
  MEDICION_PREVIA_ESTANDAR: MEDICION_PREVIA_ESTANDAR,
  COLOCACION_A_MEDIDA: COLOCACION_A_MEDIDA
};
