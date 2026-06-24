(() => {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Estratos que piensan — motor generativo
   * Lienzo fijo de 720 × 1000. Todo el dibujo escribe sobre `ctx`
   * (intercambiable) usando la paleta activa `C`. Eso permite reutilizar
   * el mismo motor para: la vista principal, las miniaturas de una serie
   * y las capas exportables por territorio.
   * ------------------------------------------------------------------ */

  const mainCanvas = document.getElementById("world");
  const overlayCanvas = document.getElementById("overlay");
  const SCENE_W = mainCanvas.width;
  const SCENE_H = mainCanvas.height;
  const W = SCENE_W;
  const H = SCENE_H;

  const mainCtx = mainCanvas.getContext("2d");
  mainCtx.imageSmoothingEnabled = false;
  overlayCanvas.width = SCENE_W;
  overlayCanvas.height = SCENE_H;
  const octx = overlayCanvas.getContext("2d");
  octx.imageSmoothingEnabled = false;

  const THUMB_W = 108;
  const THUMB_H = Math.round(THUMB_W * (SCENE_H / SCENE_W));

  const CFG = {
    baseTextSize: 20,
    baseLeading: 18,
    textMaxChars: 25,
    extraNoise: 1.3,
    densityBoost: 1.9,
    symbolScale: 1.55,
    exportScale: 2
  };

  /* --- Tipografía pixelada CP437 (Telenova Compis) -------------------
   * Se usa para los poemas y para una familia nueva de objetos hechos de
   * glifos: estratos de sombreado (░▒▓█), marcos/diagramas de caja y signos
   * sueltos (☼☺♥♪…). El fallback monospace conserva los caracteres si la
   * fuente no carga (p. ej. al abrir el archivo vía file://). */
  const GLYPH_FONT = "'Compis', 'Courier New', monospace";
  const GLYPHS = {
    shade:    ["░", "▒", "▓", "█"],
    sky:      ["☼", "∙", "•", "○", "↑", "≡"],
    forest:   ["♣", "♠", "§", "¶", "▲"],
    sea:      ["◙", "○", "•", "↕", "↔"],
    abyss:    ["☻", "☺", "♥", "♦", "•"],
    tectonic: ["≡", "▬", "Σ", "π", "±", "÷", "■", "□", "∟"],
    signs:    ["♪", "♫", "♥", "♦", "♣", "♠", "☼", "☺", "☻", "►", "◄", "•", "∙", "§"]
  };

  /* --- Paletas cromáticas intercambiables --------------------------- *
   * Cada paleta define los mismos siete "slots" semánticos. El código de
   * dibujo nunca usa colores literales: pide C.blue, C.red, etc., de modo
   * que cambiar de paleta reordena el mundo cromático sin tocar el motor.
   * ------------------------------------------------------------------ */
  const PALETTES = {
    riso:    { name: "riso clásico",   paper: "#ffffff", ink: "#0b0b0b", blue: "#1038ff", red: "#ff1616", green: "#04be36", yellow: "#ffd400", white: "#ffffff" },
    tierra:  { name: "tierra",         paper: "#f3ead6", ink: "#2a2017", blue: "#3a6b5f", red: "#b5471f", green: "#6f7a2c", yellow: "#e0a52b", white: "#fbf6ea" },
    mineral: { name: "mineral frío",   paper: "#eef1f4", ink: "#1b2430", blue: "#2f4b7c", red: "#a05195", green: "#4c8577", yellow: "#cab43d", white: "#ffffff" },
    abismo:  { name: "abismo oscuro",  paper: "#0a0e1a", ink: "#e8eefc", blue: "#4f8cff", red: "#ff5d73", green: "#39d98a", yellow: "#ffd166", white: "#ffffff" },
    neon:    { name: "neón nocturno",  paper: "#0d0d12", ink: "#f5f5ff", blue: "#00e5ff", red: "#ff2bd6", green: "#7bff3d", yellow: "#fff14d", white: "#ffffff" },
    mono:    { name: "monocromo",      paper: "#ffffff", ink: "#111111", blue: "#444444", red: "#222222", green: "#666666", yellow: "#999999", white: "#ffffff" },
    aleatoria: { name: "aleatoria (color disperso)", random: true, paper: "#ffffff" }
  };

  /* --- Selección de paleta -------------------------------------------
   * El selector incluye un modo "auto" (sorpresa): por cada lámina se
   * elige una paleta concreta al azar, ponderada y derivada de la semilla
   * (reproducible). El riso colorido es mayoritario; el monocromo, raro;
   * se incluyen las paletas de fondo nocturno y la per-elemento "aleatoria". */
  const PALETTE_WEIGHTS = [
    ["riso", 56], ["abismo", 15], ["tierra", 7], ["neon", 6],
    ["mineral", 6], ["aleatoria", 5], ["mono", 5]
  ];

  function weightedPaletteForSeed(seed) {
    const total = PALETTE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    const x = mulberry32(hashString((seed || "") + "|palette"))() * total;
    let acc = 0;
    for (const [key, w] of PALETTE_WEIGHTS) { acc += w; if (x < acc) return key; }
    return "riso";
  }

  function resolvePaletteKey(key, seed) {
    return key === "auto" ? weightedPaletteForSeed(seed) : key;
  }

  /* Paleta per-elemento "aleatoria": cada forma toma un color al azar,
   * con bastante color y poco negro, sobre algo de vacío blanco. */
  const RANDOM_ACCENTS = ["#1038ff", "#ff1616", "#04be36", "#ffd400"];

  function weightedRandomColor() {
    const r = rng();
    if (r < 0.42) return "#ffffff";   // vacío
    if (r < 0.52) return "#000000";   // negro ocasional
    return RANDOM_ACCENTS[Math.floor(rng() * RANDOM_ACCENTS.length)];
  }

  function makeRandomProxy(paper) {
    return new Proxy({}, {
      get(_t, prop) {
        if (prop === "paper") return paper;
        if (prop === "name") return "aleatoria";
        if (prop === "random") return true;
        return weightedRandomColor();
      }
    });
  }

  function paletteObject(key) {
    const p = PALETTES[key] || PALETTES.riso;
    return p.random ? makeRandomProxy(p.paper) : p;
  }

  function paperFor(key, seed) {
    return (PALETTES[resolvePaletteKey(key, seed)] || PALETTES.riso).paper;
  }

  const ui = {
    seed: document.getElementById("seed"),
    mode: document.getElementById("mode"),
    palette: document.getElementById("palette"),
    regenerate: document.getElementById("regenerate"),
    toggleText: document.getElementById("toggleText"),
    toggleAnim: document.getElementById("toggleAnim"),
    save: document.getElementById("save"),
    seriesCount: document.getElementById("seriesCount"),
    buildSeries: document.getElementById("buildSeries"),
    exportSeries: document.getElementById("exportSeries"),
    seriesStrip: document.getElementById("seriesStrip"),
    exportLayers: document.getElementById("exportLayers")
  };

  const lexicon = {
    sky: [
      "nube que deriva", "cielo sin centro", "el aire recuerda",
      "un borde escucha", "la altura titubea", "la luz no termina",
      "el cielo procesa", "circulación mínima", "el viento ensaya",
      "una nube calcula", "el azul respira", "lo alto se dispersa",
      "el universo en una gota", "respira la distancia", "aire que duda",
      "un ave traza el aire", "vuelo que escribe", "bandada que decide",
      "pájaro sin mapa", "el viento lleva un nombre"
    ],
    mountain: [
      "la montaña emerge", "piedra que recuerda", "un pico traduce",
      "la presión imagina", "la grieta aprende", "relieve sensible",
      "la roca piensa lento", "cumbre que duda", "lo sólido fluye",
      "tiempo apilado", "la altura se pliega", "mineral que sueña"
    ],
    forest: [
      "el árbol escucha", "bosque de señales", "raíz que calcula",
      "vida sin modelo", "una rama ensaya", "el verde responde",
      "fotosíntesis mínima", "la corteza registra", "la hoja traduce luz",
      "una semilla calcula el bosque", "germina un número",
      "lo vivo se ramifica", "la savia recuerda", "follaje que codifica",
      "el helecho se despliega", "una flor calcula el sol",
      "el hongo teje abajo", "caracol que mide el tiempo",
      "el escarabajo insiste", "la hierba susurra datos",
      "el polen viaja sin permiso", "una raíz abraza la red",
      "el micelio recuerda", "micorrizas que negocian",
      "una seta es el borde de la red", "el bosque comparte por la raíz",
      "hifas que calculan", "esporas sin permiso",
      "hongos traducen entre raíces", "hacer parientes con el bosque",
      "devenir-con, nunca solo", "especies de compañía",
      "ni natura ni cultura", "simbiosis bajo el suelo",
      "la red no tiene dueño"
    ],
    shore: [
      "la orilla traduce", "playa transitoria", "el límite respira",
      "la arena registra", "un resto deriva", "borde poroso",
      "entre dos estados", "la espuma anota", "frontera que duda",
      "cada grano es un dato", "el cangrejo duda de lado",
      "la concha guarda un eco", "lo que la marea olvida"
    ],
    sea: [
      "el mar respira", "superficie sensible", "cuerpos pelágicos",
      "la corriente piensa", "un pez procesa", "el azul duda",
      "espuma que calcula", "la ola escucha", "el agua tiene memoria",
      "deriva una célula", "lo salado recuerda", "el alga traduce",
      "un cardumen decide", "la marea coordina", "nadar es pensar",
      "la estrella de mar recuerda", "el pulpo piensa con los brazos",
      "ocho ideas a la vez", "un brazo decide solo"
    ],
    abyss: [
      "memoria abisal", "nadie toca el fondo", "vida bajo la vida",
      "lo hundido responde", "un ojo sin animal", "la profundidad coordina",
      "silencio pelágico", "medusa sin centro", "luz que no llega",
      "el universo en unas células", "lo oscuro también piensa",
      "presión que sueña", "un latido sin cuerpo", "abismo que registra",
      "ocho corazones laten", "tinta que escribe el miedo",
      "lo que brilla sin sol", "pensar es tentacular",
      "tentáculos que preguntan", "parentescos en lo hondo",
      "el Chthuluceno enreda"
    ],
    tectonic: [
      "el sedimento piensa", "la presión recuerda", "un fósil titubea",
      "raíces de señal", "cables como algas", "archivo hundido",
      "la piedra procesa", "la falla respira", "conciencia mineral",
      "el silencio calcula", "el sistema sueña sin centro",
      "todo se traduce en variación", "fin que continúa",
      "geología sensible", "restos que escuchan", "la memoria no tiene fondo",
      "una célula contiene un cielo", "lo mínimo repite lo inmenso",
      "cada grano guarda una galaxia", "polvo que fue estrella",
      "la materia ensaya memoria", "un átomo recuerda el mar",
      "la escala se pliega", "número que florece",
      "la red sueña raíces", "lo inorgánico despierta",
      "el cosmos late en un nervio", "la forma duda de sí",
      "todo está hecho de lo mismo", "el micelio enlaza el subsuelo",
      "nada se hace solo: simpoiesis", "descomponer también es crear",
      "lo podrido alimenta la red", "somos humus, somos compost",
      "seguir con el problema", "el juego del hilo entre especies",
      "la red subterránea recuerda", "responder es hacerse-con",
      "vivir y morir con, en suelo dañado", "parentescos raros, alianzas raras"
    ],
    desierto: [
      "el desierto recuerda agua", "duna que se desplaza", "calor que piensa",
      "la arena cuenta el tiempo", "un cactus guarda lluvia", "sed que sueña",
      "la víbora traza un signo", "piedra que arde", "espejismo que calcula",
      "lo seco también vive", "el sol repite la pregunta", "lagarto al acecho"
    ],
    pantano: [
      "el pantano fermenta ideas", "junco que escucha", "niebla que duda",
      "la rana traduce la lluvia", "agua quieta que piensa", "lo turbio recuerda",
      "la garza espera un dato", "libélula sin rumbo fijo", "barro que archiva",
      "entre el agua y la tierra", "lo estancado madura", "raíz que respira lodo"
    ],
    hielo: [
      "el hielo guarda el aire", "cristal que ordena el frío", "grieta que avanza",
      "lo congelado recuerda", "un copo calcula su caída", "blanco que escucha",
      "el témpano deriva", "tiempo detenido", "la escarcha dibuja",
      "frío que también sueña", "lo sólido espera deshielo", "silencio bajo cero"
    ]
  };

  /* --- Estado del motor (intercambiable entre destinos de dibujo) --- */
  let ctx = mainCtx;          // contexto activo donde se dibuja
  let C = PALETTES.riso;      // paleta activa
  let rng = Math.random;      // generador pseudoaleatorio sembrado
  let activeMode = "total";   // modo de territorio del render en curso
  let textVisible = true;     // dibuja frases
  let symbolsEnabled = true;  // dibuja especies gráficas (las primitivas obedecen)
  let occupied = [];

  let currentPalette = "auto";

  function hashString(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rand(min, max) { return min + rng() * (max - min); }
  function rint(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(array) { return array[Math.floor(rng() * array.length)]; }
  function chance(probability) { return rng() < probability; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  // Tinta legible para texto: en la paleta aleatoria evita el blanco; en
  // paletas fijas usa el ink propio (claro sobre papeles oscuros).
  function textInk() { return C.random ? "#0b0b0b" : C.ink; }

  /* --- Primitivas de dibujo -----------------------------------------
   * Obedecen `symbolsEnabled`. Cuando está apagado, las funciones de
   * especie siguen ejecutándose (y devuelven su punto de anclaje) pero no
   * pintan nada: así la capa de texto puede colocarse junto a las formas
   * sin que las formas aparezcan. */
  function px(x, y, color = C.ink, size = 1) {
    if (!symbolsEnabled) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
  }

  function line(points, color = C.ink, width = 1) {
    if (!symbolsEnabled) return;
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(Math.round(points[0][0]) + .5, Math.round(points[0][1]) + .5);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(Math.round(points[i][0]) + .5, Math.round(points[i][1]) + .5);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function dottedLine(x1, y1, x2, y2, color = C.ink, step = 4) {
    if (!symbolsEnabled) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.max(1, Math.hypot(dx, dy));
    for (let t = 0; t <= 1; t += step / distance) {
      px(x1 + dx * t, y1 + dy * t, color);
    }
  }

  function dottedEllipse(cx, cy, rx, ry, color = C.blue, density = 24) {
    if (!symbolsEnabled) return;
    for (let i = 0; i < density; i++) {
      const a = (i / density) * Math.PI * 2;
      px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, color);
    }
  }

  function looseDots(x, y, radius, count, colors = [C.ink, C.blue, C.red, C.green]) {
    if (!symbolsEnabled) return;
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const d = Math.sqrt(rng()) * radius;
      px(x + Math.cos(a) * d, y + Math.sin(a) * d, pick(colors));
    }
  }

  function inMode(...allowed) {
    return activeMode === "total" || allowed.includes(activeMode);
  }

  /* --- Especies gráficas (devuelven punto de anclaje para el texto) - */
  function drawLenticularCloud(x, y, s, color) {
    dottedEllipse(x, y, 20 * s, 4 * s, color, 28);
    dottedEllipse(x + 6 * s, y + 6 * s, 15 * s, 3 * s, color, 22);
    if (chance(.6)) dottedEllipse(x - 7 * s, y - 4 * s, 11 * s, 2.3 * s, color, 18);
    return { x, y, zone: "sky" };
  }

  function drawSpiral(x, y, s, color) {
    let last = null;
    for (let a = 0; a < Math.PI * 5.2; a += 0.16) {
      const radius = (a / (Math.PI * 5.2)) * 13 * s;
      const pt = [x + Math.cos(a) * radius, y + Math.sin(a) * radius];
      if (last) line([last, pt], color);
      last = pt;
    }
    return { x, y, zone: "sky" };
  }

  // Cresta quebrada (diseño original)
  function mountainJagged(x, y, width, color) {
    const pts = [[x, y]];
    const peakCount = rint(4, 7);
    for (let i = 1; i <= peakCount; i++) {
      const xx = x + (width / peakCount) * i;
      const yy = y - rand(28, 72) + (i % 2 ? rand(-8, 10) : rand(5, 15));
      pts.push([xx, yy]);
      if (chance(.65)) pts.push([xx + rand(4, 10), yy + rand(-12, 5)]);
    }
    pts.push([x + width + rand(0, 8), y - rand(1, 10)]);
    line(pts, color);
    if (chance(.85)) line(pts.map(([xx, yy]) => [xx + 5, yy + 8]), C.ink);
  }

  // Picos triangulares con sombreado de ladera
  function mountainTriangle(x, y, width, color) {
    const peaks = rint(1, 3);
    const seg = width / peaks;
    for (let p = 0; p < peaks; p++) {
      const bx = x + seg * p;
      const h = rand(45, 95);
      const apex = [bx + seg * .5, y - h];
      line([[bx, y], apex, [bx + seg, y]], color);
      for (let k = 1; k <= rint(2, 4); k++) {
        const t = k / 5;
        line([[apex[0], apex[1] + h * t], [bx + seg * (.5 - t * .5), y]], C.ink);
      }
    }
  }

  // Montaña en terrazas / escalones
  function mountainTerraced(x, y, width, color) {
    let cx = x, cy = y;
    const steps = rint(4, 7);
    const up = width / (steps * 2);
    const pts = [[cx, cy]];
    for (let i = 0; i < steps; i++) { cy -= rand(8, 16); pts.push([cx, cy]); cx += up; pts.push([cx, cy]); }
    for (let i = 0; i < steps; i++) { cx += up; pts.push([cx, cy]); cy += rand(8, 16); pts.push([cx, cy]); }
    line(pts, color);
  }

  // Contorno punteado
  function mountainStipple(x, y, width, color) {
    const peakCount = rint(3, 5);
    let prev = [x, y];
    for (let i = 1; i <= peakCount; i++) {
      const xx = x + (width / peakCount) * i;
      const yy = y - rand(30, 70) * (i % 2 ? 1 : .5);
      dottedLine(prev[0], prev[1], xx, yy, color, 4);
      prev = [xx, yy];
    }
    dottedLine(prev[0], prev[1], x + width, y, color, 4);
  }

  function drawMountain(x, y, width, color = C.blue) {
    const v = rint(0, 3);
    if (v === 0) mountainJagged(x, y, width, color);
    else if (v === 1) mountainTriangle(x, y, width, color);
    else if (v === 2) mountainTerraced(x, y, width, color);
    else mountainStipple(x, y, width, color);
    return { x: x + width * .5, y: y - 30, zone: "mountain" };
  }

  // Abeto: chevrones; ahora las ramas crecen hacia ABAJO (más anchas al pie)
  function treeFir(x, y, s, color) {
    line([[x, y], [x, y - 18 * s]], color);
    const levels = rint(3, 5);
    for (let i = 0; i < levels; i++) {
      const yy = y - (7 + i * 6) * s;
      const arm = (6 + (levels - 1 - i) * 2.5) * s;
      line([[x - arm, yy - 5 * s], [x, yy], [x + arm, yy - 5 * s]], color);
    }
    if (chance(.35)) { px(x - 1, y - 22 * s, C.red, 2); px(x + 3, y - 16 * s, C.red, 2); }
  }

  // Pino: filas de agujas horizontales, anchas abajo
  function treePine(x, y, s, color) {
    const h = 22 * s;
    line([[x, y], [x, y - h]], color);
    const rows = rint(4, 7);
    for (let i = 0; i < rows; i++) {
      const yy = y - (h * (i + 1)) / (rows + 1);
      const arm = (3 + (rows - 1 - i) * 1.6) * s;
      line([[x - arm, yy], [x + arm, yy]], color);
      px(x - arm, yy, color); px(x + arm, yy, color);
    }
    px(x, y - h - 1, color);
  }

  // Árbol desnudo: ramificación recursiva en Y
  function treeBare(x, y, s, color) {
    function branch(bx, by, ang, len, depth) {
      const ex = bx + Math.cos(ang) * len;
      const ey = by + Math.sin(ang) * len;
      line([[bx, by], [ex, ey]], color);
      if (depth <= 0) { if (chance(.5)) px(ex, ey, C.red, 2); return; }
      branch(ex, ey, ang - rand(.3, .6), len * .7, depth - 1);
      branch(ex, ey, ang + rand(.3, .6), len * .7, depth - 1);
    }
    branch(x, y, -Math.PI / 2, 12 * s, rint(2, 3));
  }

  // Árbol redondo: tronco + copa punteada
  function treeRound(x, y, s, color) {
    line([[x, y], [x, y - 14 * s]], color);
    const cy = y - 20 * s;
    dottedEllipse(x, cy, 9 * s, 8 * s, color, 26);
    looseDots(x, cy, 7 * s, rint(8, 16), [color, C.green, C.yellow]);
  }

  function drawTree(x, y, s, color = C.green) {
    const v = rint(0, 3);
    if (v === 0) treeFir(x, y, s, color);
    else if (v === 1) treePine(x, y, s, color);
    else if (v === 2) treeBare(x, y, s, color);
    else treeRound(x, y, s, color);
    return { x, y: y - 11 * s, zone: "forest" };
  }

  function drawRootCable(x, y, s, color = C.green) {
    const stem = [[x, y], [x + rand(-4, 4), y + 12 * s], [x + rand(-8, 8), y + 25 * s]];
    line(stem, color);
    for (let i = 0; i < rint(3, 5); i++) {
      const yy = y + rand(6, 21) * s;
      line([[x + rand(-4, 4), yy], [x + rand(-15, 15), yy + rand(4, 11)]], color);
      if (chance(.6)) px(x + rand(-15, 15), yy + rand(4, 11), pick([C.blue, C.red, C.yellow]), 2);
    }
    return { x, y: y + 12 * s, zone: "tectonic" };
  }

  function drawShore(x, y, length) {
    const pts = [];
    for (let i = 0; i <= length; i += 3) {
      pts.push([x + i, y + Math.sin(i * .11) * 2 + rand(-1, 1)]);
    }
    line(pts, C.yellow);
    for (let i = 0; i < rint(8, 14); i++) {
      px(x + rand(0, length), y + rand(3, 12), pick([C.ink, C.red, C.blue]));
    }
    return { x: x + length * .5, y, zone: "shore" };
  }

  function waveSine(x, y, length, amp, color) {
    const pts = [];
    for (let i = 0; i <= length; i += 2) pts.push([x + i, y + Math.sin(i * .16) * amp + Math.sin(i * .045) * 1.5]);
    line(pts, color);
  }
  function waveZig(x, y, length, amp, color) {
    const pts = []; const step = Math.max(6, amp * 3);
    for (let i = 0, up = true; i <= length; i += step, up = !up) pts.push([x + i, y + (up ? -amp : amp)]);
    line(pts, color);
  }
  function waveDots(x, y, length, amp, color) {
    for (let i = 0; i <= length; i += 4) px(x + i, y + Math.sin(i * .14) * amp, color);
  }
  function waveDouble(x, y, length, amp, color) {
    const a = [], b = [];
    for (let i = 0; i <= length; i += 2) {
      a.push([x + i, y + Math.sin(i * .15) * amp]);
      b.push([x + i, y + 4 + Math.sin(i * .15 + 1) * amp * .7]);
    }
    line(a, color); line(b, C.ink);
  }
  function drawWave(x, y, length, amp, color = C.blue) {
    const v = rint(0, 3);
    if (v === 0) waveSine(x, y, length, amp, color);
    else if (v === 1) waveZig(x, y, length, amp, color);
    else if (v === 2) waveDots(x, y, length, amp, color);
    else waveDouble(x, y, length, amp, color);
    return { x: x + length * .5, y, zone: "sea" };
  }

  function fishDiamond(x, y, s, color) {
    line([[x - 8 * s, y], [x, y - 4 * s], [x + 7 * s, y], [x, y + 4 * s], [x - 8 * s, y]], color);
    line([[x - 8 * s, y], [x - 13 * s, y - 5 * s]], color);
    line([[x - 8 * s, y], [x - 13 * s, y + 5 * s]], color);
    px(x + 3 * s, y - 1 * s, C.ink);
  }
  function fishRound(x, y, s, color) {
    dottedEllipse(x, y, 7 * s, 4.5 * s, color, 20);
    line([[x + 6 * s, y], [x + 12 * s, y - 4 * s], [x + 12 * s, y + 4 * s], [x + 6 * s, y]], color);
    px(x - 3 * s, y - 1, C.ink);
  }
  function fishLong(x, y, s, color) {
    line([[x - 11 * s, y], [x, y - 3 * s], [x + 11 * s, y], [x, y + 3 * s], [x - 11 * s, y]], color);
    line([[x + 11 * s, y], [x + 16 * s, y - 4 * s]], color);
    line([[x + 11 * s, y], [x + 16 * s, y + 4 * s]], color);
    px(x - 6 * s, y - 1, C.ink);
  }
  function fishArrow(x, y, s, color) {
    line([[x - 7 * s, y - 4 * s], [x + 6 * s, y], [x - 7 * s, y + 4 * s]], color);
    line([[x + 6 * s, y], [x + 10 * s, y]], color);
    px(x - 3 * s, y - 1, C.ink);
  }
  function drawFish(x, y, s, color = C.blue) {
    const v = rint(0, 3);
    if (v === 0) fishDiamond(x, y, s, color);
    else if (v === 1) fishRound(x, y, s, color);
    else if (v === 2) fishLong(x, y, s, color);
    else fishArrow(x, y, s, color);
    return { x, y, zone: "sea" };
  }

  function jellyDome(x, y, s, color) {
    dottedEllipse(x, y, 7 * s, 4 * s, color, 18);
    for (let i = -1; i <= 1; i++) line([[x + i * 4 * s, y + 3 * s], [x + i * 4 * s + rand(-2, 2), y + 11 * s]], color);
  }
  function jellyBell(x, y, s, color) {
    line([[x - 7 * s, y], [x - 4 * s, y - 7 * s], [x + 4 * s, y - 7 * s], [x + 7 * s, y]], color);
    line([[x - 7 * s, y], [x + 7 * s, y]], color);
    for (let i = -2; i <= 2; i++) {
      const tx = x + i * 3 * s; const pts = [];
      for (let k = 0; k <= 5; k++) pts.push([tx + Math.sin(k) * 2 * s, y + k * 3 * s]);
      line(pts, color);
    }
  }
  function jellyDots(x, y, s, color) {
    dottedEllipse(x, y, 8 * s, 5 * s, color, 26);
    for (let i = -2; i <= 2; i++) for (let k = 1; k <= 4; k++) px(x + i * 3 * s, y + 4 * s + k * 3 * s, color);
  }
  function jellyTiny(x, y, s, color) {
    dottedEllipse(x, y, 4 * s, 2.5 * s, color, 12);
    for (let i = -1; i <= 1; i++) line([[x + i * 2 * s, y + 2 * s], [x + i * 2 * s, y + 6 * s]], color);
  }
  function drawJelly(x, y, s, color = C.blue) {
    const v = rint(0, 3);
    if (v === 0) jellyDome(x, y, s, color);
    else if (v === 1) jellyBell(x, y, s, color);
    else if (v === 2) jellyDots(x, y, s, color);
    else jellyTiny(x, y, s, color);
    return { x, y, zone: "sea" };
  }

  function coralBranch(x, y, s, color) {
    line([[x, y], [x, y - 15 * s]], color);
    line([[x, y - 7 * s], [x - 7 * s, y - 12 * s]], color);
    line([[x, y - 10 * s], [x + 8 * s, y - 16 * s]], color);
    line([[x - 4 * s, y - 12 * s], [x - 7 * s, y - 18 * s]], color);
    line([[x + 4 * s, y - 14 * s], [x + 8 * s, y - 21 * s]], color);
  }
  function coralFan(x, y, s, color) {
    for (let i = -3; i <= 3; i++) {
      const ang = -Math.PI / 2 + i * 0.22;
      line([[x, y], [x + Math.cos(ang) * 16 * s, y + Math.sin(ang) * 16 * s]], color);
    }
    for (let i = -2; i <= 2; i++) px(x + i * 3 * s, y - 14 * s, color);
  }
  function coralTube(x, y, s, color) {
    for (let i = -1; i <= 1; i++) {
      const tx = x + i * 5 * s;
      const ty = y - rand(10, 18) * s;
      line([[tx, y], [tx, ty]], color);
      dottedEllipse(tx, ty, 1.5 * s, 1.5 * s, color, 6);
    }
  }
  function drawCoral(x, y, s, color = C.red) {
    const v = rint(0, 2);
    if (v === 0) coralBranch(x, y, s, color);
    else if (v === 1) coralFan(x, y, s, color);
    else coralTube(x, y, s, color);
    return { x, y: y - 10 * s, zone: "abyss" };
  }

  // Algas: crecen hacia arriba desde la base (y)
  function algaeStrand(x, y, s, color) {
    const pts = []; const h = rint(5, 9);
    for (let i = 0; i <= h; i++) pts.push([x + Math.sin(i * .9) * 4 * s, y - i * 5 * s]);
    line(pts, color);
    for (let i = 2; i < h; i += 2) {
      const lx = x + Math.sin(i * .9) * 4 * s, ly = y - i * 5 * s;
      line([[lx, ly], [lx + rand(-6, 6) * s, ly - 4 * s]], color);
    }
  }
  function algaeBushy(x, y, s, color) {
    for (let b = -2; b <= 2; b++) {
      const pts = []; const h = rint(4, 7);
      for (let i = 0; i <= h; i++) pts.push([x + b * 3 * s + Math.sin(i + b) * 3 * s, y - i * 5 * s]);
      line(pts, color);
    }
  }
  function algaeKelp(x, y, s, color) {
    const h = rint(6, 10); const pts = [];
    for (let i = 0; i <= h; i++) pts.push([x + Math.sin(i * .6) * 5 * s, y - i * 5 * s]);
    line(pts, color);
    for (let i = 1; i < h; i += 2) px(x + Math.sin(i * .6) * 5 * s, y - i * 5 * s, pick([C.yellow, C.red, color]), 2);
  }
  function drawAlgae(x, y, s, color = C.green) {
    const v = rint(0, 2);
    if (v === 0) algaeStrand(x, y, s, color);
    else if (v === 1) algaeBushy(x, y, s, color);
    else algaeKelp(x, y, s, color);
    return { x, y: y - 15 * s, zone: "sea" };
  }

  /* --- Animalitos --------------------------------------------------- */
  function drawBird(x, y, s, color = C.ink) {
    const v = rint(0, 2);
    if (v === 0) {
      line([[x - 6 * s, y], [x, y - 3 * s], [x + 6 * s, y]], color);
    } else if (v === 1) {
      line([[x - 7 * s, y], [x - 3 * s, y - 4 * s], [x, y - 1 * s], [x + 3 * s, y - 4 * s], [x + 7 * s, y]], color);
    } else {
      dottedLine(x - 6 * s, y, x, y - 3 * s, color, 3);
      dottedLine(x, y - 3 * s, x + 6 * s, y, color, 3);
    }
    return { x, y, zone: "sky" };
  }

  function drawSnail(x, y, s, color = C.ink) {
    line([[x - 7 * s, y], [x + 4 * s, y]], color);
    line([[x - 7 * s, y], [x - 9 * s, y - 4 * s]], color);
    let last = null;
    for (let a = 0; a < Math.PI * 3; a += 0.3) {
      const r = (a / (Math.PI * 3)) * 5 * s;
      const pt = [x + Math.cos(a) * r, y - 4 * s + Math.sin(a) * r];
      if (last) line([last, pt], color);
      last = pt;
    }
    return { x, y: y - 4 * s, zone: "forest" };
  }

  function drawBeetle(x, y, s, color = C.ink) {
    dottedEllipse(x, y, 4 * s, 6 * s, color, 18);
    line([[x, y - 6 * s], [x, y + 6 * s]], color);
    for (let i = -1; i <= 1; i++) {
      line([[x - 4 * s, y + i * 3 * s], [x - 8 * s, y + i * 3 * s - 2 * s]], color);
      line([[x + 4 * s, y + i * 3 * s], [x + 8 * s, y + i * 3 * s - 2 * s]], color);
    }
    line([[x, y - 6 * s], [x - 2 * s, y - 9 * s]], color);
    line([[x, y - 6 * s], [x + 2 * s, y - 9 * s]], color);
    return { x, y, zone: "forest" };
  }

  function drawCrab(x, y, s, color = C.red) {
    dottedEllipse(x, y, 5 * s, 3 * s, color, 16);
    line([[x - 5 * s, y], [x - 9 * s, y - 3 * s]], color); px(x - 9 * s, y - 3 * s, color, 2);
    line([[x + 5 * s, y], [x + 9 * s, y - 3 * s]], color); px(x + 9 * s, y - 3 * s, color, 2);
    for (let i = -1; i <= 1; i++) {
      line([[x - 3 * s, y + 1 * s], [x - 7 * s, y + 3 * s + i * 2 * s]], color);
      line([[x + 3 * s, y + 1 * s], [x + 7 * s, y + 3 * s + i * 2 * s]], color);
    }
    px(x - 2 * s, y - 3 * s, C.ink); px(x + 2 * s, y - 3 * s, C.ink);
    return { x, y, zone: "shore" };
  }

  function drawStarfish(x, y, s, color = C.yellow) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = (i % 2 ? 2.4 : 6) * s;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    line(pts, color);
    px(x, y, C.ink);
    return { x, y, zone: "sea" };
  }

  function drawOctopus(x, y, s, color = C.red) {
    dottedEllipse(x, y, 6 * s, 5 * s, color, 22);
    px(x - 2 * s, y - 1 * s, C.ink); px(x + 2 * s, y - 1 * s, C.ink);
    for (let i = -2; i <= 2; i++) {
      const ax = x + i * 2.5 * s; const arm = [];
      for (let k = 0; k <= 5; k++) arm.push([ax + Math.sin(k + i) * 2 * s, y + 4 * s + k * 3 * s]);
      line(arm, color);
    }
    return { x, y, zone: "abyss" };
  }

  /* --- Plantas ------------------------------------------------------ */
  function drawFern(x, y, s, color = C.green) {
    let cx = x, cy = y; const segs = rint(6, 10); const spine = [[cx, cy]];
    for (let i = 0; i < segs; i++) { cx += rand(-1, 1) * s; cy -= 4 * s; spine.push([cx, cy]); }
    line(spine, color);
    for (let i = 1; i < segs; i++) {
      const [sx, sy] = spine[i]; const arm = (segs - i) * 1.1 * s;
      line([[sx, sy], [sx - arm, sy + 2 * s]], color);
      line([[sx, sy], [sx + arm, sy + 2 * s]], color);
    }
    return { x, y: y - segs * 2 * s, zone: "forest" };
  }

  function drawFlower(x, y, s, color = C.red) {
    line([[x, y], [x, y - 12 * s]], C.green);
    const cy = y - 12 * s;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      px(x + Math.cos(a) * 4 * s, cy + Math.sin(a) * 4 * s, color, 2);
    }
    px(x, cy, C.yellow, 2);
    line([[x, y - 6 * s], [x - 4 * s, y - 8 * s]], C.green);
    return { x, y: cy, zone: "forest" };
  }

  function drawMushroom(x, y, s, color = C.red) {
    line([[x - 2 * s, y], [x - 2 * s, y - 6 * s]], C.ink);
    line([[x + 2 * s, y], [x + 2 * s, y - 6 * s]], C.ink);
    const cap = [];
    for (let t = Math.PI; t <= Math.PI * 2; t += 0.3) cap.push([x + Math.cos(t) * 6 * s, y - 6 * s + Math.sin(t) * 4 * s]);
    line(cap, color);
    line([[x - 6 * s, y - 6 * s], [x + 6 * s, y - 6 * s]], color);
    px(x - 2 * s, y - 8 * s, C.ink); px(x + 1 * s, y - 9 * s, C.ink);
    return { x, y: y - 6 * s, zone: "forest" };
  }

  function drawGrass(x, y, s, color = C.green) {
    const blades = rint(3, 6);
    for (let k = 0; k < blades; k++) {
      const bx = x + (k - blades / 2) * 2 * s;
      line([[bx, y], [bx + rand(-2, 2) * s, y - rand(6, 13) * s]], color);
    }
    return { x, y: y - 8 * s, zone: "forest" };
  }

  /* --- Objetos de glifos CP437 (fuente Compis) ---------------------- */
  function glyph(x, y, ch, size, color = C.ink) {
    if (!symbolsEnabled) return;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.font = Math.max(7, Math.round(size)) + "px " + GLYPH_FONT;
    ctx.fillText(ch, Math.round(x), Math.round(y));
  }

  // Estrato de sombreado: rejilla de ░▒▓█ (textura tipo dither / capa)
  function drawShadeBlock(x, y, s, color = C.ink, zone = "tectonic") {
    const cols = rint(4, 8), rows = rint(2, 4);
    const size = Math.max(7, Math.round(8 * s));
    if (symbolsEnabled) {
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.font = size + "px " + GLYPH_FONT;
      for (let r = 0; r < rows; r++) {
        let ln = "";
        for (let c = 0; c < cols; c++) ln += GLYPHS.shade[rint(0, 3)];
        ctx.fillText(ln, Math.round(x), Math.round(y + r * size));
      }
    }
    return { x, y, zone };
  }

  // Marco / diagrama de caja con un glifo dentro
  function drawBoxFrame(x, y, s, color = C.ink) {
    const w = rint(3, 6), h = rint(1, 3);
    const size = Math.max(8, Math.round(9 * s));
    if (symbolsEnabled) {
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.font = size + "px " + GLYPH_FONT;
      const rows = ["┌" + "─".repeat(w) + "┐"];
      for (let i = 0; i < h; i++) rows.push("│" + " ".repeat(w) + "│");
      rows.push("└" + "─".repeat(w) + "┘");
      rows.forEach((ln, i) => ctx.fillText(ln, Math.round(x), Math.round(y + i * size)));
    }
    if (chance(.55)) glyph(x + size * 0.8, y + size * 1.3, pick(GLYPHS.tectonic), size, color);
    return { x, y, zone: "tectonic" };
  }

  // Signo CP437 suelto (1–3 glifos temáticos), otra especie del dibujo
  function drawGlyphSign(x, y, s, set, color = C.ink, zone = "tectonic") {
    const n = rint(1, 3);
    const size = Math.max(8, Math.round(11 * s));
    for (let i = 0; i < n; i++) glyph(x + i * size * 0.8, y + rand(-2, 2) * s, pick(set), size, color);
    return { x, y, zone };
  }

  function drawButterfly(x, y, s, color = C.red) {
    line([[x, y - 3 * s], [x, y + 3 * s]], C.ink);
    dottedEllipse(x - 3 * s, y - 2 * s, 3 * s, 2.5 * s, color, 12);
    dottedEllipse(x + 3 * s, y - 2 * s, 3 * s, 2.5 * s, color, 12);
    dottedEllipse(x - 3 * s, y + 2 * s, 2.5 * s, 2 * s, color, 10);
    dottedEllipse(x + 3 * s, y + 2 * s, 2.5 * s, 2 * s, color, 10);
    line([[x, y - 3 * s], [x - 2 * s, y - 6 * s]], C.ink);
    line([[x, y - 3 * s], [x + 2 * s, y - 6 * s]], C.ink);
    return { x, y, zone: "forest" };
  }

  // Garza / ave acuática (de pie sobre el agua)
  function drawHeron(x, y, s, color = C.ink) {
    line([[x, y], [x, y - 14 * s]], color);
    line([[x - 2 * s, y], [x - 2 * s, y + 6 * s]], color);
    line([[x + 2 * s, y], [x + 2 * s, y + 6 * s]], color);
    line([[x, y - 14 * s], [x + 4 * s, y - 20 * s]], color);
    line([[x + 4 * s, y - 20 * s], [x + 9 * s, y - 19 * s]], color);
    line([[x, y - 14 * s], [x - 6 * s, y - 9 * s]], color);
    return { x, y: y - 14 * s, zone: "shore" };
  }

  /* --- Desierto ----------------------------------------------------- */
  function drawSun(x, y, s, color = C.yellow) {
    dottedEllipse(x, y, 8 * s, 8 * s, color, 28);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      line([[x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s], [x + Math.cos(a) * 15 * s, y + Math.sin(a) * 15 * s]], color);
    }
    return { x, y, zone: "sky" };
  }

  function drawDune(x, y, length, color = C.yellow) {
    const pts = [];
    for (let i = 0; i <= length; i += 4) pts.push([x + i, y + Math.sin(i * .03) * 14 + Math.sin(i * .09) * 4]);
    line(pts, color);
    return { x: x + length * .5, y, zone: "desierto" };
  }

  function cactusSaguaro(x, y, s, color) {
    line([[x, y], [x, y - 22 * s]], color);
    line([[x, y - 12 * s], [x - 7 * s, y - 12 * s], [x - 7 * s, y - 18 * s]], color);
    line([[x, y - 16 * s], [x + 6 * s, y - 16 * s], [x + 6 * s, y - 23 * s]], color);
  }
  function cactusBarrel(x, y, s, color) {
    dottedEllipse(x, y - 7 * s, 6 * s, 8 * s, color, 24);
    for (let i = -4; i <= 4; i += 2) line([[x + i * s, y - 1 * s], [x + i * s, y - 14 * s]], color);
  }
  function cactusPrickly(x, y, s, color) {
    line([[x, y], [x, y - 16 * s]], color);
    for (let k = 0; k < 6; k++) {
      const yy = y - rand(3, 14) * s; const dir = chance(.5) ? 1 : -1;
      line([[x, yy], [x + dir * 4 * s, yy - 3 * s]], color);
    }
  }
  function drawCactus(x, y, s, color = C.green) {
    const v = rint(0, 2);
    if (v === 0) cactusSaguaro(x, y, s, color);
    else if (v === 1) cactusBarrel(x, y, s, color);
    else cactusPrickly(x, y, s, color);
    return { x, y: y - 14 * s, zone: "desierto" };
  }

  function drawRock(x, y, s, color = C.ink) {
    line([[x - 6 * s, y], [x - 3 * s, y - 5 * s], [x + 2 * s, y - 6 * s], [x + 6 * s, y - 2 * s], [x + 5 * s, y], [x - 6 * s, y]], color);
    return { x, y: y - 3 * s, zone: "desierto" };
  }

  function drawSnake(x, y, s, color = C.red) {
    const pts = []; const len = rint(8, 13);
    for (let i = 0; i <= len; i++) pts.push([x + i * 4 * s, y + Math.sin(i * .8) * 4 * s]);
    line(pts, color);
    px(x + len * 4 * s, y + Math.sin(len * .8) * 4 * s - 1, C.ink);
    return { x: x + len * 2 * s, y, zone: "desierto" };
  }

  function drawLizard(x, y, s, color = C.green) {
    line([[x, y], [x + 10 * s, y]], color);
    line([[x + 10 * s, y], [x + 16 * s, y + 3 * s]], color);
    for (const bx of [2, 7]) {
      line([[x + bx * s, y], [x + bx * s - 3 * s, y + 3 * s]], color);
      line([[x + bx * s, y], [x + bx * s + 3 * s, y + 3 * s]], color);
    }
    px(x - 1, y - 1, C.ink);
    return { x: x + 6 * s, y, zone: "desierto" };
  }

  /* --- Pantano ------------------------------------------------------ */
  function drawMist(x, y, length) {
    for (let i = 0; i <= length; i += 5) {
      if (chance(.6)) px(x + i, y + Math.sin(i * .05) * 4, pick([C.blue, C.green, C.ink]));
    }
    return { x: x + length * .5, y, zone: "pantano" };
  }

  function drawReed(x, y, s, color = C.green) {
    const h = rint(12, 22) * s;
    line([[x, y], [x, y - h]], color);
    if (chance(.7)) for (let k = 0; k < 4; k++) px(x, y - h + k * 2 * s, C.ink, 2);
    line([[x, y - h * .5], [x - 4 * s, y - h * .5 - 5 * s]], color);
    return { x, y: y - h, zone: "pantano" };
  }

  function drawLilyPad(x, y, s, color = C.green) {
    dottedEllipse(x, y, 6 * s, 2.5 * s, color, 18);
    line([[x - 6 * s, y], [x, y]], C.ink);
    if (chance(.4)) px(x + 2 * s, y - 2 * s, C.red, 2);
    return { x, y, zone: "pantano" };
  }

  function drawFrog(x, y, s, color = C.green) {
    dottedEllipse(x, y, 5 * s, 3 * s, color, 16);
    px(x - 2 * s, y - 3 * s, C.ink); px(x + 2 * s, y - 3 * s, C.ink);
    line([[x - 4 * s, y + 2 * s], [x - 7 * s, y + 4 * s]], color);
    line([[x + 4 * s, y + 2 * s], [x + 7 * s, y + 4 * s]], color);
    return { x, y, zone: "pantano" };
  }

  function drawDragonfly(x, y, s, color = C.blue) {
    line([[x - 8 * s, y], [x + 6 * s, y]], color);
    for (const wx of [-2, 1]) {
      dottedEllipse(x + wx * s, y - 2 * s, 4 * s, 1.5 * s, color, 10);
      dottedEllipse(x + wx * s, y + 2 * s, 4 * s, 1.5 * s, color, 10);
    }
    px(x + 6 * s, y, C.ink, 2);
    return { x, y, zone: "pantano" };
  }

  /* --- Hielo -------------------------------------------------------- */
  function drawSnowflake(x, y, s, color = C.blue) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      line([[x, y], [x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s]], color);
      const mx = x + Math.cos(a) * 3 * s, my = y + Math.sin(a) * 3 * s;
      line([[mx, my], [mx + Math.cos(a + 1) * 2 * s, my + Math.sin(a + 1) * 2 * s]], color);
    }
    return { x, y, zone: "sky" };
  }

  function drawIcePeak(x, y, width, color = C.blue) {
    const pts = [[x, y]];
    const n = rint(3, 5);
    for (let i = 1; i <= n; i++) {
      pts.push([x + (width / n) * (i - .5), y - rand(40, 90)]);
      pts.push([x + (width / n) * i, y - rand(0, 20)]);
    }
    line(pts, color);
    return { x: x + width * .5, y: y - 30, zone: "mountain" };
  }

  function drawIceberg(x, y, s, color = C.blue) {
    line([[x - 8 * s, y], [x - 3 * s, y - 12 * s], [x + 4 * s, y - 16 * s], [x + 9 * s, y], [x - 8 * s, y]], color);
    for (let i = -6; i <= 6; i += 3) px(x + i * s, y + rand(2, 8) * s, color);
    return { x, y: y - 10 * s, zone: "hielo" };
  }

  function drawCrystal(x, y, s, color = C.blue) {
    line([[x, y - 7 * s], [x + 4 * s, y - 3 * s], [x + 3 * s, y + 4 * s], [x - 3 * s, y + 4 * s], [x - 4 * s, y - 3 * s], [x, y - 7 * s]], color);
    line([[x, y - 7 * s], [x, y + 4 * s]], color);
    return { x, y, zone: "hielo" };
  }

  function drawFossil(x, y, s, color = C.ink) {
    dottedEllipse(x, y, 8 * s, 6 * s, color, 24);
    for (let i = -5; i <= 5; i += 2) {
      line([[x - 6 * s, y + i * s], [x + 6 * s, y + i * s]], color);
    }
    line([[x, y - 8 * s], [x, y + 8 * s]], color);
    return { x, y, zone: "tectonic" };
  }

  function drawCircuit(x, y, s, color = C.blue) {
    const w = 12 * s;
    const h = 10 * s;
    if (symbolsEnabled) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x - w / 2) + .5, Math.round(y - h / 2) + .5, Math.round(w), Math.round(h));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const x2 = x + Math.cos(a) * 14 * s;
      const y2 = y + Math.sin(a) * 14 * s;
      line([[x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2], [x2, y2]], color);
      px(x2 - 1, y2 - 1, color, 3);
    }
    return { x, y, zone: "tectonic" };
  }

  function drawMolecule(x, y, s, color = C.ink) {
    const nodes = [[0,0], [8,-5], [-8,-4], [7,8], [-7,8], [0,12]];
    nodes.forEach(([dx,dy], i) => {
      if (i) line([[x, y], [x + dx*s, y + dy*s]], color);
      dottedEllipse(x + dx*s, y + dy*s, 2*s, 2*s, color, 8);
    });
    return { x, y, zone: "tectonic" };
  }

  function drawCrack(x, y, s, color = C.red) {
    const pts = [[x,y]];
    let xx = x, yy = y;
    for (let i = 0; i < 7; i++) {
      xx += rand(-5, 6) * s;
      yy += rand(4, 9) * s;
      pts.push([xx, yy]);
      if (chance(.45)) line([[xx, yy], [xx + rand(-7, 7) * s, yy + rand(3, 7) * s]], color);
    }
    line(pts, color);
    return { x, y: y + 18*s, zone: "tectonic" };
  }

  function drawVoid(x, y, s) {
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = (15 + rand(-4, 4)) * s;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * .66]);
    }
    if (symbolsEnabled) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fillStyle = C.ink;
      ctx.fill();
    }
    for (let i = 0; i < 10; i++) {
      px(x + rand(-10, 10) * s, y + rand(-5, 5) * s, pick([C.white, C.blue, C.yellow]), chance(.4) ? 2 : 1);
    }
    for (let i = 0; i < 6; i++) dottedLine(x + rand(-11, 11)*s, y + 6*s, x + rand(-17,17)*s, y + rand(12, 27)*s, C.blue, 3);
    return { x, y, zone: "tectonic" };
  }

  /* --- Texto como especie del dibujo -------------------------------- */
  function splitPhrase(phrase, maxChars = CFG.textMaxChars) {
    const words = phrase.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? current + " " + word : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
  }

  function overlaps(x, y, w, h) {
    return occupied.some(box =>
      x < box.x + box.w + 8 &&
      x + w + 8 > box.x &&
      y < box.y + box.h + 8 &&
      y + h + 8 > box.y
    );
  }

  function zoneRange(zone) {
    const ranges = {
      sky: [18, 170],
      mountain: [110, 280],
      forest: [200, 400],
      shore: [350, 470],
      sea: [420, 650],
      abyss: [580, 810],
      tectonic: [690, 965],
      desierto: [250, 760],
      pantano: [380, 760],
      hielo: [220, 740]
    };
    return ranges[zone] || [20, H - 20];
  }

  function textAt(phrase, anchor, yMin, yMax) {
    if (!textVisible) return;
    ctx.font = `${CFG.baseTextSize}px ${GLYPH_FONT}`;
    ctx.textBaseline = "top";
    const lines = splitPhrase(phrase, CFG.textMaxChars);
    const width = Math.max(...lines.map(lineText => ctx.measureText(lineText).width));
    const height = lines.length * CFG.baseLeading;
    let x = 0, y = 0;

    for (let attempt = 0; attempt < 40; attempt++) {
      const nearAnchor = anchor && chance(.82);
      x = nearAnchor ? anchor.x + rand(-72, 42) : rand(20, W - width - 20);
      y = nearAnchor ? anchor.y + rand(-25, 30) : rand(yMin, yMax);
      x = clamp(x, 14, W - width - 14);
      y = clamp(y, yMin, yMax - height);
      if (!overlaps(x, y, width, height)) break;
    }

    if (anchor && chance(.7)) {
      // El conector se dibuja como texto (no como símbolo) para que la
      // capa de texto conserve su atadura aunque las especies se oculten.
      const prev = symbolsEnabled;
      symbolsEnabled = true;
      dottedLine(anchor.x, anchor.y, x + rand(0, Math.max(2, width)), y + rand(0, height), textInk(), 5);
      symbolsEnabled = prev;
    }

    ctx.fillStyle = textInk();
    lines.forEach((lineText, i) => ctx.fillText(lineText, Math.round(x), Math.round(y + i * CFG.baseLeading)));
    occupied.push({ x, y, w: width, h: height });
  }

  function inferZone(phrase) {
    for (const [zone, values] of Object.entries(lexicon)) {
      if (values.includes(phrase)) return zone;
    }
    return "tectonic";
  }

  function placeTexts(anchors, groups) {
    const all = groups.flatMap(group => lexicon[group] || []);
    const count = Math.min(all.length, rint(28, 44));
    const pool = [...all].sort(() => rng() - .5).slice(0, count);
    pool.forEach(phrase => {
      const home = inferZone(phrase);
      const zoneAnchors = anchors.filter(a => a.zone === home);
      const anchor = zoneAnchors.length ? pick(zoneAnchors) : pick(anchors);
      const [yMin, yMax] = zoneRange(home);
      textAt(phrase, anchor, yMin, yMax);
    });
  }

  function resetPaper(fillPaper) {
    if (fillPaper) {
      ctx.fillStyle = C.paper;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }
    occupied = [];
  }

  function drawGlobalNoise() {
    const n = Math.round(rint(90, 150) * CFG.extraNoise);
    for (let i = 0; i < n; i++) {
      px(rand(7, W - 7), rand(7, H - 7), pick([C.ink, C.blue, C.red, C.green, C.yellow]));
    }
    for (let i = 0; i < rint(18, 30); i++) {
      const x = rand(14, W - 14);
      const y = rand(10, H - 10);
      if (chance(.5)) {
        line([[x - 4, y], [x + 4, y]], C.ink);
        line([[x, y - 4], [x, y + 4]], C.ink);
      } else {
        dottedEllipse(x, y, 2.5, 2.5, C.ink, 8);
      }
    }
    // signos CP437 sueltos entre el ruido
    for (let i = 0; i < rint(7, 14); i++) {
      glyph(rand(16, W - 16), rand(16, H - 16), pick(GLYPHS.signs), rint(8, 13), pick([C.ink, C.blue, C.red, C.green, C.yellow]));
    }
  }

  /* --- Render de una escena completa sobre el `ctx` activo ---------- */
  function drawScene(seedSource, mode, flags) {
    const source = (seedSource || "").trim() || "memoria-sin-centro";
    activeMode = mode;
    rng = mulberry32(hashString(source + "|" + mode));
    resetPaper(flags.fillPaper);
    if (flags.drawNoise) drawGlobalNoise();

    const anchors = [];
    const add = item => { if (item) anchors.push(item); };

    if (inMode("aire")) {
      for (let i = 0; i < rint(7, 11); i++) add(drawLenticularCloud(rand(40, W - 50), rand(20, 110), rand(.9, 1.8), pick([C.blue, C.red])));
      for (let i = 0; i < rint(3, 6); i++) add(drawSpiral(rand(35, W - 35), rand(30, 145), rand(.8, 1.6), pick([C.blue, C.green])));
      for (let i = 0; i < rint(4, 8); i++) add(drawBird(rand(30, W - 30), rand(22, 150), rand(.8, 1.7), pick([C.ink, C.blue, C.red])));
      for (let i = 0; i < rint(4, 6); i++) add(drawMountain(rand(24, W - 220), rand(180, 280), rand(120, 240), pick([C.blue, C.ink])));
      for (let i = 0; i < rint(9, 15); i++) add(drawTree(rand(20, W - 20), rand(250, 405), rand(.9, 1.7), C.green));
      for (let i = 0; i < rint(3, 6); i++) add(drawFern(rand(20, W - 20), rand(280, 405), rand(.8, 1.5), C.green));
      for (let i = 0; i < rint(3, 6); i++) add(drawFlower(rand(20, W - 20), rand(280, 405), rand(.8, 1.5), pick([C.red, C.yellow, C.blue])));
      for (let i = 0; i < rint(2, 4); i++) add(drawMushroom(rand(20, W - 20), rand(300, 405), rand(.8, 1.4), pick([C.red, C.yellow])));
      for (let i = 0; i < rint(4, 8); i++) add(drawGrass(rand(15, W - 15), rand(300, 408), rand(.8, 1.5), C.green));
      for (let i = 0; i < rint(2, 4); i++) add(drawSnail(rand(20, W - 20), rand(300, 405), rand(.8, 1.4), pick([C.ink, C.yellow])));
      for (let i = 0; i < rint(2, 4); i++) add(drawBeetle(rand(20, W - 20), rand(280, 405), rand(.8, 1.3), pick([C.ink, C.blue, C.red])));
      for (let i = 0; i < rint(3, 6); i++) add(drawButterfly(rand(20, W - 20), rand(190, 400), rand(.8, 1.5), pick([C.red, C.blue, C.yellow])));
      for (let i = 0; i < rint(2, 5); i++) add(drawGlyphSign(rand(30, W - 30), rand(25, 150), rand(.9, 1.6), GLYPHS.sky, pick([C.yellow, C.blue, C.ink]), "sky"));
      for (let i = 0; i < rint(2, 4); i++) add(drawGlyphSign(rand(20, W - 20), rand(280, 405), rand(.8, 1.3), GLYPHS.forest, pick([C.green, C.ink]), "forest"));
    }

    if (inMode("mar")) {
      for (let i = 0; i < rint(2, 3); i++) add(drawShore(rand(18, 75), rand(385, 430), rand(260, 520)));
      for (let i = 0; i < rint(5, 8); i++) add(drawWave(rand(20, 70), rand(450, 590), rand(350, 600), rand(2, 6), C.blue));
      for (let i = 0; i < rint(12, 20); i++) {
        if (chance(.58)) add(drawFish(rand(22, W - 22), rand(475, 650), rand(.95, 1.8), pick([C.blue, C.green, C.red])));
        else add(drawJelly(rand(22, W - 22), rand(470, 660), rand(.95, 1.9), pick([C.blue, C.red])));
      }
      for (let i = 0; i < rint(12, 20); i++) add(drawCoral(rand(18, W - 18), rand(660, 815), rand(.9, 1.7), pick([C.green, C.red, C.yellow])));
      for (let i = 0; i < rint(6, 12); i++) add(drawAlgae(rand(18, W - 18), rand(640, 815), rand(.9, 1.7), pick([C.green, C.blue, C.yellow])));
      for (let i = 0; i < rint(2, 5); i++) add(drawCrab(rand(20, W - 20), rand(415, 470), rand(.9, 1.6), pick([C.red, C.yellow, C.ink])));
      for (let i = 0; i < rint(4, 8); i++) add(drawStarfish(rand(20, W - 20), rand(640, 815), rand(.9, 1.6), pick([C.yellow, C.red, C.green])));
      for (let i = 0; i < rint(2, 4); i++) add(drawOctopus(rand(30, W - 30), rand(600, 790), rand(.9, 1.6), pick([C.red, C.blue])));
      for (let i = 0; i < rint(1, 3); i++) add(drawHeron(rand(30, W - 30), rand(415, 458), rand(1.0, 1.6), pick([C.ink, C.blue])));
      for (let i = 0; i < rint(2, 4); i++) add(drawShadeBlock(rand(20, W - 90), rand(700, 815), rand(.9, 1.5), pick([C.blue, C.ink]), "abyss"));
      for (let i = 0; i < rint(2, 4); i++) add(drawGlyphSign(rand(20, W - 20), rand(580, 800), rand(.9, 1.5), GLYPHS.abyss, pick([C.red, C.blue, C.ink]), "abyss"));
    }

    if (inMode("tectonica")) {
      for (let i = 0; i < rint(10, 16); i++) add(drawFossil(rand(22, W - 22), rand(620, 760), rand(.85, 1.45), C.ink));
      for (let i = 0; i < rint(14, 24); i++) add(drawRootCable(rand(15, W - 20), rand(670, 835), rand(.85, 1.55), pick([C.green, C.ink, C.blue])));
      for (let i = 0; i < rint(9, 14); i++) add(drawCircuit(rand(24, W - 24), rand(720, 945), rand(.85, 1.4), pick([C.blue, C.red, C.green])));
      for (let i = 0; i < rint(10, 16); i++) add(drawMolecule(rand(22, W - 22), rand(700, 955), rand(.85, 1.4), C.ink));
      for (let i = 0; i < rint(5, 9); i++) add(drawCrack(rand(20, W - 20), rand(720, 905), rand(1.0, 1.8), pick([C.red, C.ink])));
      if (chance(.8)) add(drawVoid(rand(180, 520), rand(840, 920), rand(1.0, 1.7)));
      for (let i = 0; i < rint(3, 5); i++) add(drawShadeBlock(rand(20, W - 90), rand(700, 930), rand(1.0, 1.7), pick([C.ink, C.blue]), "tectonic"));
      for (let i = 0; i < rint(2, 4); i++) add(drawBoxFrame(rand(30, W - 110), rand(715, 930), rand(1.0, 1.6), pick([C.blue, C.green, C.ink])));
      for (let i = 0; i < rint(3, 6); i++) add(drawGlyphSign(rand(20, W - 30), rand(700, 950), rand(.9, 1.6), GLYPHS.tectonic, pick([C.ink, C.red, C.blue]), "tectonic"));
    }

    if (activeMode === "desierto") {
      add(drawSun(rand(80, W - 80), rand(45, 110), rand(1.4, 2.2), C.yellow));
      for (let i = 0; i < rint(3, 6); i++) add(drawBird(rand(40, W - 40), rand(60, 170), rand(.9, 1.6), C.ink));
      for (let i = 0; i < rint(4, 7); i++) add(drawDune(rand(0, 120), rand(380, 760), rand(360, 640), pick([C.yellow, C.red])));
      for (let i = 0; i < rint(6, 11); i++) add(drawCactus(rand(25, W - 25), rand(420, 780), rand(1.0, 1.9), C.green));
      for (let i = 0; i < rint(5, 9); i++) add(drawRock(rand(20, W - 20), rand(620, 900), rand(.9, 1.7), C.ink));
      for (let i = 0; i < rint(2, 5); i++) add(drawSnake(rand(40, W - 120), rand(700, 900), rand(1.0, 1.7), pick([C.red, C.ink])));
      for (let i = 0; i < rint(2, 5); i++) add(drawLizard(rand(30, W - 60), rand(640, 900), rand(.9, 1.6), pick([C.green, C.ink])));
      for (let i = 0; i < rint(5, 9); i++) add(drawGrass(rand(15, W - 15), rand(560, 780), rand(.7, 1.2), pick([C.yellow, C.green])));
    }

    if (activeMode === "pantano") {
      for (let i = 0; i < rint(5, 9); i++) add(drawLenticularCloud(rand(40, W - 50), rand(20, 120), rand(.8, 1.5), pick([C.green, C.blue])));
      for (let i = 0; i < rint(3, 6); i++) add(drawMist(rand(0, 150), rand(300, 700), rand(380, 640)));
      for (let i = 0; i < rint(5, 9); i++) add(drawWave(rand(20, 70), rand(520, 760), rand(380, 620), rand(1, 3), pick([C.green, C.blue])));
      for (let i = 0; i < rint(8, 14); i++) add(drawReed(rand(20, W - 20), rand(560, 830), rand(1.0, 2.0), pick([C.green, C.ink])));
      for (let i = 0; i < rint(4, 8); i++) add(drawLilyPad(rand(25, W - 25), rand(560, 740), rand(1.0, 1.8), C.green));
      for (let i = 0; i < rint(4, 8); i++) add(drawFrog(rand(25, W - 25), rand(560, 760), rand(1.0, 1.7), C.green));
      for (let i = 0; i < rint(2, 5); i++) add(drawHeron(rand(30, W - 30), rand(470, 600), rand(1.1, 1.8), pick([C.ink, C.blue])));
      for (let i = 0; i < rint(4, 8); i++) add(drawDragonfly(rand(30, W - 30), rand(380, 620), rand(.9, 1.6), pick([C.blue, C.green, C.red])));
      for (let i = 0; i < rint(6, 11); i++) add(drawFish(rand(22, W - 22), rand(640, 820), rand(.9, 1.5), pick([C.green, C.blue])));
    }

    if (activeMode === "hielo") {
      for (let i = 0; i < rint(8, 14); i++) add(drawSnowflake(rand(20, W - 20), rand(20, 300), rand(.7, 1.4), pick([C.blue, C.ink])));
      for (let i = 0; i < rint(3, 6); i++) add(drawIcePeak(rand(20, W - 200), rand(220, 340), rand(140, 260), pick([C.blue, C.ink])));
      for (let i = 0; i < rint(4, 8); i++) add(drawIceberg(rand(40, W - 40), rand(420, 640), rand(1.2, 2.4), pick([C.blue, C.ink])));
      for (let i = 0; i < rint(8, 14); i++) add(drawCrystal(rand(20, W - 20), rand(360, 820), rand(.9, 1.7), pick([C.blue, C.ink, C.green])));
      for (let i = 0; i < rint(4, 8); i++) add(drawCrack(rand(20, W - 20), rand(700, 920), rand(1.0, 1.9), pick([C.blue, C.ink])));
      for (let i = 0; i < rint(30, 60); i++) px(rand(10, W - 10), rand(10, H - 10), pick([C.blue, C.ink]));
    }

    if (!flags.pure) {
      if (activeMode !== "total") {
        for (let i = 0; i < rint(10, 18); i++) {
          const y = rand(50, 920);
          looseDots(rand(15, W - 15), y, rand(10, 24), rint(6, 16));
        }
      }
      if (activeMode === "aire") {
        add(drawShore(100, 430, 420));
        add(drawWave(60, 470, 520, 4));
      } else if (activeMode === "mar") {
        add(drawMountain(100, 270, 220, C.blue));
        for (let i = 0; i < 10; i++) add(drawTree(rand(28, W-28), rand(290, 405), rand(.7, 1.25)));
      } else if (activeMode === "tectonica") {
        add(drawWave(70, 560, 520, 3, C.blue));
        for (let i = 0; i < 6; i++) add(drawJelly(rand(20,W-20), rand(575,650), 1.1, C.blue));
      }
    }

    const activeGroups = ({
      total: ["sky", "mountain", "forest", "shore", "sea", "abyss", "tectonic"],
      aire: ["sky", "mountain", "forest"],
      mar: ["shore", "sea", "abyss"],
      tectonica: ["tectonic", "abyss"],
      desierto: ["sky", "desierto", "tectonic"],
      pantano: ["sky", "pantano", "sea"],
      hielo: ["sky", "hielo", "tectonic"]
    })[activeMode] || ["tectonic"];

    placeTexts(anchors, activeGroups);

    if (textVisible) {
      ctx.font = `10px ${GLYPH_FONT}`;
      ctx.fillStyle = textInk();
      const sigil = `seed:${source.slice(0, 26).toLowerCase()}`;
      ctx.fillText(sigil, rint(280, 420), rint(958, 986));
    }
  }

  /* --- Punto de entrada reutilizable: compone una escena en cualquier
   * contexto (vista principal, miniatura, capa). Guarda y restaura el
   * estado global del motor. ----------------------------------------- */
  function composeScene(targetCtx, opts) {
    const prevCtx = ctx, prevC = C, prevText = textVisible, prevSym = symbolsEnabled;
    ctx = targetCtx;
    ctx.imageSmoothingEnabled = false;
    C = paletteObject(resolvePaletteKey(opts.palette, opts.seed));
    textVisible = opts.text !== false;
    symbolsEnabled = opts.symbols !== false;
    drawScene(opts.seed, opts.mode || "total", {
      fillPaper: opts.paper !== false,
      drawNoise: opts.noise !== false,
      pure: opts.pure === true
    });
    ctx = prevCtx; C = prevC; textVisible = prevText; symbolsEnabled = prevSym;
  }

  /* --- Vista principal ---------------------------------------------- */
  function drawMain() {
    composeScene(mainCtx, {
      seed: ui.seed.value,
      mode: ui.mode.value,
      palette: currentPalette,
      text: textVisible
    });
    syncAnim();
  }

  function regenerate(newSeed = false) {
    if (newSeed) {
      ui.seed.value = [
        pick(["memoria", "nube", "raíz", "falla", "sedimento", "archivo", "sistema", "orilla", "algoritmo"]),
        pick(["sin-centro", "que-deriva", "subterráneo", "que-respira", "disperso", "mínimo", "pelágico", "mineral"]),
        rint(10, 999)
      ].join("-");
    }
    drawMain();
  }

  /* --- Utilidades de exportación ------------------------------------ */
  function newSceneCanvas() {
    const c = document.createElement("canvas");
    c.width = SCENE_W;
    c.height = SCENE_H;
    return c;
  }

  function safeSeed(value) {
    return (value || "mundo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 42);
  }

  function scaledExportCanvas(src, transparent, paperColor) {
    const s = CFG.exportScale;
    const ec = document.createElement("canvas");
    ec.width = SCENE_W * s;
    ec.height = SCENE_H * s;
    const ex = ec.getContext("2d");
    ex.imageSmoothingEnabled = false;
    if (!transparent) {
      ex.fillStyle = paperColor || "#ffffff";
      ex.fillRect(0, 0, ec.width, ec.height);
    }
    ex.drawImage(src, 0, 0, ec.width, ec.height);
    return ec;
  }

  function download(canvas, filename) {
    const link = document.createElement("a");
    link.download = filename + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function exportPNG() {
    // Render limpio a una escena propia + capa animada si está activa.
    const off = newSceneCanvas();
    composeScene(off.getContext("2d"), {
      seed: ui.seed.value,
      mode: ui.mode.value,
      palette: currentPalette,
      text: textVisible
    });
    if (animOn) off.getContext("2d").drawImage(overlayCanvas, 0, 0, SCENE_W, SCENE_H);
    download(scaledExportCanvas(off, false, paperFor(currentPalette, ui.seed.value)), `estratos-${safeSeed(ui.seed.value)}`);
  }

  /* --- Series: misma ecología, semilla que muta -------------------- */
  let seriesItems = [];

  function buildSeries() {
    const base = (ui.seed.value || "").trim() || "memoria-sin-centro";
    const count = clamp(parseInt(ui.seriesCount.value, 10) || 6, 2, 12);
    ui.seriesStrip.innerHTML = "";
    seriesItems = [];

    for (let i = 0; i < count; i++) {
      const seed = i === 0 ? base : `${base}·${i + 1}`;
      const off = newSceneCanvas();
      composeScene(off.getContext("2d"), {
        seed, mode: ui.mode.value, palette: currentPalette, text: textVisible
      });
      seriesItems.push({ seed, canvas: off });

      const thumb = document.createElement("canvas");
      thumb.width = THUMB_W;
      thumb.height = THUMB_H;
      thumb.className = "thumb";
      thumb.title = `${seed}  ·  clic para cargar`;
      const tc = thumb.getContext("2d");
      tc.imageSmoothingEnabled = false;
      tc.fillStyle = paperFor(currentPalette, seed);
      tc.fillRect(0, 0, THUMB_W, THUMB_H);
      tc.drawImage(off, 0, 0, THUMB_W, THUMB_H);
      thumb.addEventListener("click", () => {
        ui.seed.value = seed;
        drawMain();
      });
      ui.seriesStrip.appendChild(thumb);
    }
    ui.exportSeries.disabled = false;
  }

  function exportSeries() {
    if (!seriesItems.length) buildSeries();
    seriesItems.forEach((item, i) => {
      const filename = `serie-${safeSeed((ui.seed.value || "").trim() || "mundo")}-${String(i + 1).padStart(2, "0")}`;
      download(scaledExportCanvas(item.canvas, false, paperFor(currentPalette, item.seed)), filename);
    });
  }

  /* --- Capas exportables por territorio (PNG transparentes) --------- */
  function exportLayers() {
    const base = (ui.seed.value || "").trim() || "memoria-sin-centro";
    const mode = ui.mode.value;
    const territories = mode === "total" ? ["aire", "mar", "tectonica"] : [mode];

    territories.forEach(terr => {
      const off = newSceneCanvas();
      composeScene(off.getContext("2d"), {
        seed: base, mode: terr, palette: currentPalette,
        text: false, symbols: true, noise: false, paper: false, pure: true
      });
      download(scaledExportCanvas(off, true), `capa-${terr}-${safeSeed(base)}`);
    });

    // Capa de texto: las especies se calculan (para los anclajes) pero no
    // se pintan; sólo quedan las frases sobre fondo transparente.
    const offText = newSceneCanvas();
    composeScene(offText.getContext("2d"), {
      seed: base, mode, palette: currentPalette,
      text: true, symbols: false, noise: false, paper: false, pure: true
    });
    download(scaledExportCanvas(offText, true), `capa-texto-${safeSeed(base)}`);
  }

  /* --- Animación lenta: corrientes, nubes y signos ------------------
   * Vive en una capa superpuesta y transparente, independiente del
   * lienzo estático. Se siembra con la semilla activa para ser estable. */
  let animOn = false;
  let rafId = null;
  let particles = [];
  let currents = [];
  let fireflies = [];
  let fireflyCol = "#ffd400";

  function buildAnim() {
    const r = mulberry32(hashString((ui.seed.value || "x") + "|anim|" + ui.mode.value + "|" + currentPalette));
    const p = PALETTES[resolvePaletteKey(currentPalette, ui.seed.value)] || PALETTES.riso;
    // En la paleta per-elemento se omite el blanco (invisible) y se usan negro + acentos.
    const cols = p.random
      ? ["#000000", "#000000", ...RANDOM_ACCENTS]
      : [p.blue, p.red, p.green, p.yellow, p.ink];
    const currentCol = p.random ? "#1038ff" : p.blue;

    particles = [];
    for (let i = 0; i < 80; i++) {
      const roll = r();
      particles.push({
        x: r() * SCENE_W,
        y: r() * SCENE_H,
        vx: (r() - .5) * 0.2,
        vy: -(0.04 + r() * 0.16),
        ph: r() * Math.PI * 2,
        kind: roll < .55 ? "dot" : roll < .8 ? "cross" : "streak",
        col: cols[Math.floor(r() * cols.length)]
      });
    }

    currents = [];
    for (let i = 0; i < 5; i++) {
      currents.push({
        y: 460 + i * 38 + r() * 10,
        amp: 3 + r() * 5,
        phase: r() * Math.PI * 2,
        speed: 0.15 + r() * 0.25,
        col: currentCol
      });
    }

    // Luciérnagas: titilan en la banda de bosque/pantano.
    fireflyCol = p.random ? "#ffd400" : p.yellow;
    fireflies = [];
    const lush = ["pantano", "aire", "total"].includes(ui.mode.value);
    const fcount = lush ? 24 : 9;
    for (let i = 0; i < fcount; i++) {
      fireflies.push({
        x: r() * SCENE_W,
        y: 230 + r() * 540,
        drift: r() * Math.PI * 2,
        speed: 0.5 + r() * 0.9,
        phase: r() * Math.PI * 2
      });
    }
  }

  function stepAnim(ts) {
    if (!animOn) return;
    const t = ts * 0.001;
    octx.clearRect(0, 0, SCENE_W, SCENE_H);

    octx.globalAlpha = 0.5;
    octx.lineWidth = 1;
    currents.forEach(c => {
      octx.strokeStyle = c.col;
      octx.beginPath();
      for (let x = 0; x <= SCENE_W; x += 4) {
        const y = c.y + Math.sin(x * 0.05 + c.phase + t * c.speed) * c.amp;
        if (x === 0) octx.moveTo(x + .5, y + .5);
        else octx.lineTo(x + .5, y + .5);
      }
      octx.stroke();
    });
    octx.globalAlpha = 1;

    particles.forEach(pt => {
      pt.x += pt.vx + Math.sin(t * 0.3 + pt.ph) * 0.12;
      pt.y += pt.vy;
      if (pt.y < -8) pt.y = SCENE_H + 8;
      if (pt.x < -8) pt.x = SCENE_W + 8;
      else if (pt.x > SCENE_W + 8) pt.x = -8;

      const x = Math.round(pt.x), y = Math.round(pt.y);
      octx.fillStyle = pt.col;
      if (pt.kind === "dot") {
        octx.fillRect(x, y, 1, 1);
      } else if (pt.kind === "cross") {
        octx.fillRect(x - 2, y, 5, 1);
        octx.fillRect(x, y - 2, 1, 5);
      } else {
        octx.globalAlpha = 0.6;
        octx.fillRect(x, y, 3, 1);
        octx.globalAlpha = 1;
      }
    });

    octx.fillStyle = fireflyCol;
    fireflies.forEach(f => {
      f.x += Math.cos(f.drift + t * 0.2) * 0.3;
      f.y += Math.sin(f.drift * 1.3 + t * 0.15) * 0.2;
      const glow = 0.2 + 0.8 * Math.abs(Math.sin(t * f.speed + f.phase));
      const x = Math.round(f.x), y = Math.round(f.y);
      octx.globalAlpha = glow;
      octx.fillRect(x, y, 2, 2);
      if (glow > 0.8) { octx.globalAlpha = glow * 0.35; octx.fillRect(x - 1, y - 1, 4, 4); }
    });
    octx.globalAlpha = 1;

    rafId = requestAnimationFrame(stepAnim);
  }

  function syncAnim() {
    // Llamado tras cada redibujo: re-siembra la capa si la animación está activa.
    if (animOn) buildAnim();
    else octx.clearRect(0, 0, SCENE_W, SCENE_H);
  }

  function setAnim(on) {
    animOn = on;
    ui.toggleAnim.textContent = `A animación: ${on ? "activa" : "detenida"}`;
    if (on) {
      buildAnim();
      if (!rafId) rafId = requestAnimationFrame(stepAnim);
    } else {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      octx.clearRect(0, 0, SCENE_W, SCENE_H);
    }
  }

  const PALETTE_OPTIONS = ["auto", ...Object.keys(PALETTES)];

  function cyclePalette() {
    const next = PALETTE_OPTIONS[(PALETTE_OPTIONS.indexOf(currentPalette) + 1) % PALETTE_OPTIONS.length];
    currentPalette = next;
    ui.palette.value = next;
    drawMain();
  }

  /* --- Eventos ------------------------------------------------------ */
  ui.regenerate.addEventListener("click", () => regenerate(false));
  ui.toggleText.addEventListener("click", () => {
    textVisible = !textVisible;
    ui.toggleText.textContent = `T texto: ${textVisible ? "activo" : "oculto"}`;
    drawMain();
  });
  ui.toggleAnim.addEventListener("click", () => setAnim(!animOn));
  ui.save.addEventListener("click", exportPNG);
  ui.palette.addEventListener("change", () => {
    currentPalette = ui.palette.value;
    drawMain();
  });
  ui.buildSeries.addEventListener("click", buildSeries);
  ui.exportSeries.addEventListener("click", exportSeries);
  ui.exportLayers.addEventListener("click", exportLayers);
  ui.seed.addEventListener("keydown", event => {
    if (event.key === "Enter") regenerate(false);
  });
  ui.mode.addEventListener("change", drawMain);
  mainCanvas.addEventListener("click", () => regenerate(true));

  window.addEventListener("keydown", event => {
    if (event.target.matches("input, select, textarea")) return;
    const key = event.key.toLowerCase();
    if (key === "r") regenerate(true);
    if (key === "t") ui.toggleText.click();
    if (key === "a") setAnim(!animOn);
    if (key === "p") cyclePalette();
    if (key === "s") {
      event.preventDefault();
      exportPNG();
    }
  });

  // Poblar el selector: primero "auto" (sorpresa), luego el catálogo fijo.
  [["auto", { name: "auto: sorpresa (riso mayoritario)" }], ...Object.entries(PALETTES)]
    .forEach(([key, value]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = value.name;
      ui.palette.appendChild(option);
    });
  ui.palette.value = currentPalette;

  drawMain();

  // La fuente Compis puede no estar lista en el primer dibujo: al cargar,
  // se redibuja para que poemas y glifos salgan con la pixel-tipografía.
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load(`${CFG.baseTextSize}px 'Compis'`),
      document.fonts.load(`10px 'Compis'`)
    ]).then(() => drawMain()).catch(() => {});
  }
})();
