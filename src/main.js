import { animate, stagger } from "motion";

/* ------------------------------------------------------------------
 * 1. Definición de la arquitectura
 * ------------------------------------------------------------------ */
const ICONS = {
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  check: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M15 17l2 2 4-4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
};

const NODES = [
  { id: "client", lane: "client", title: "Cliente", sub: "App web o móvil", icon: "monitor" },
  { id: "gateway", lane: "in", title: "API Gateway", sub: "Auth · límite de tasa", icon: "shield" },
  { id: "validator", lane: "in", title: "Validador", sub: "Esquema y tipos", icon: "check" },
  { id: "queue", lane: "proc", title: "Cola de mensajes", sub: "Desacopla la carga", icon: "layers" },
  { id: "cache", lane: "proc", title: "Caché", sub: "Resultados recientes", icon: "zap" },
  { id: "worker", lane: "proc", title: "Worker", sub: "Lógica de negocio", icon: "cpu" },
  { id: "db", lane: "out", title: "Base de datos", sub: "Persistencia", icon: "db" },
  { id: "formatter", lane: "out", title: "Formateador", sub: "Serializa a JSON", icon: "braces" },
  { id: "response", lane: "out", title: "Respuesta", sub: "HTTP 200 / 4xx", icon: "send" },
];

const EDGES = [
  { from: "client", to: "gateway" },
  { from: "gateway", to: "validator" },
  { from: "validator", to: "queue" },
  { from: "queue", to: "cache" },
  { from: "cache", to: "worker", label: "MISS" },
  { from: "worker", to: "db" },
  { from: "db", to: "formatter" },
  { from: "cache", to: "formatter", kind: "hit", label: "HIT" },
  { from: "formatter", to: "response" },
  { from: "response", to: "client", kind: "ret", label: "JSON + código HTTP" },
];

const LANE_COLOR = { client: "--client", in: "--in", proc: "--proc", out: "--out" };
const laneOf = (id) => NODES.find((n) => n.id === id).lane;
const colorOf = (id) => `var(${LANE_COLOR[laneOf(id)]})`;

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const T = reduced ? { travel: 0.12, hold: 60 } : { travel: 0.7, hold: 360 };

/* ------------------------------------------------------------------
 * 2. Render de nodos
 * ------------------------------------------------------------------ */
const diagram = document.getElementById("diagram");
const svg = document.getElementById("wires");
const nodeEl = {};

for (const n of NODES) {
  const el = document.createElement("article");
  el.className = "node";
  el.dataset.node = n.id;
  el.innerHTML = `
    <div class="node-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n.icon]}</svg></div>
    <div class="node-text"><h3>${n.title}</h3><p>${n.sub}</p></div>
    <span class="node-badge"></span>`;
  diagram.querySelector(`[data-lane="${n.lane}"] .lane-body`).append(el);
  nodeEl[n.id] = el;
}

/* ------------------------------------------------------------------
 * 3. Cables SVG (se recalculan al cambiar el tamaño)
 * ------------------------------------------------------------------ */
const NS = "http://www.w3.org/2000/svg";
const mk = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

const defs = mk("defs");
const marker = mk("marker", { id: "arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
marker.append(mk("path", { d: "M0 1 L9 5 L0 9 z", class: "arrowhead" }));
defs.append(marker);
svg.append(defs);

const baseLayer = mk("g");
const traceLayer = mk("g");
const labelLayer = mk("g");
svg.append(baseLayer, traceLayer, labelLayer);

for (const e of EDGES) {
  e.base = mk("path", { class: `wire${e.kind ? ` wire--${e.kind}` : ""}`, "marker-end": "url(#arrow)" });
  e.trace = mk("path", { class: "trace" });
  baseLayer.append(e.base);
  traceLayer.append(e.trace);
  if (e.label) {
    e.labelEl = mk("g");
    const bg = mk("rect", { class: "wire-label-bg", rx: "5" });
    const text = mk("text", { class: "wire-label", "text-anchor": "middle", "dominant-baseline": "central" });
    text.textContent = e.label;
    e.labelEl.append(bg, text);
    labelLayer.append(e.labelEl);
  }
}

const packet = mk("g", { class: "packet" });
packet.append(mk("circle", { r: "12", class: "halo" }), mk("circle", { r: "5", class: "core" }));
svg.append(packet);

function box(el) {
  const r = el.getBoundingClientRect();
  const d = diagram.getBoundingClientRect();
  const x = r.left - d.left, y = r.top - d.top;
  return { x, y, w: r.width, h: r.height, r: x + r.width, b: y + r.height, cx: x + r.width / 2, cy: y + r.height / 2 };
}

// Polilínea ortogonal con esquinas redondeadas
function ortho(pts, radius = 14) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const d1 = Math.hypot(x - px, y - py), d2 = Math.hypot(nx - x, ny - y);
    if (!d1 || !d2) continue;
    const r = Math.min(radius, d1 / 2, d2 / 2);
    d += ` L${x + ((px - x) / d1) * r},${y + ((py - y) / d1) * r} Q${x},${y} ${x + ((nx - x) / d2) * r},${y + ((ny - y) / d2) * r}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx},${ly}`;
}

const GAP = 4; // separación entre la punta de la flecha y el nodo

function route(e, vertical, W, H) {
  const a = box(nodeEl[e.from]);
  const b = box(nodeEl[e.to]);

  if (e.kind === "ret") {
    if (!vertical) {
      const y = H - 30;
      return ortho([[a.cx, a.b], [a.cx, y], [b.cx, y], [b.cx, b.b + GAP]], 18);
    }
    const x = W - 12;
    return ortho([[a.r, a.cy], [x, a.cy], [x, b.cy], [b.r + GAP, b.cy]], 18);
  }

  if (e.kind === "hit" && vertical) {
    const x = 12;
    return ortho([[a.x, a.cy], [x, a.cy], [x, b.cy], [b.x - GAP, b.cy]], 14);
  }

  if (b.x >= a.r - 2) {
    // destino a la derecha → curva horizontal
    const x1 = a.r, y1 = a.cy, x2 = b.x - GAP, y2 = b.cy;
    const k = Math.max(20, (x2 - x1) * 0.55);
    return `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`;
  }
  if (b.y >= a.b - 2) {
    // destino abajo → curva vertical
    const x1 = a.cx, y1 = a.b, x2 = b.cx, y2 = b.y - GAP;
    const k = Math.max(12, (y2 - y1) * 0.5);
    return `M${x1},${y1} C${x1},${y1 + k} ${x2},${y2 - k} ${x2},${y2}`;
  }
  const x1 = a.cx, y1 = a.y, x2 = b.cx, y2 = b.b + GAP;
  const k = Math.max(12, (y1 - y2) * 0.5);
  return `M${x1},${y1} C${x1},${y1 - k} ${x2},${y2 + k} ${x2},${y2}`;
}

function drawWires() {
  const { width: W, height: H } = diagram.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const vertical = getComputedStyle(diagram).gridTemplateColumns.trim().split(/\s+/).length === 1;

  for (const e of EDGES) {
    const d = route(e, vertical, W, H);
    e.base.setAttribute("d", d);
    e.trace.setAttribute("d", d);
    if (e.labelEl) {
      const len = e.base.getTotalLength();
      const at = e.kind === "ret" ? 0.5 : e.kind === "hit" ? 0.5 : 0.45;
      const pt = e.base.getPointAtLength(len * at);
      e.labelEl.setAttribute("transform", `translate(${pt.x} ${pt.y})${vertical && e.kind ? " rotate(-90)" : ""}`);
      const bb = e.labelEl.querySelector("text").getBBox();
      const bg = e.labelEl.querySelector("rect");
      bg.setAttribute("x", bb.x - 6);
      bg.setAttribute("y", bb.y - 2);
      bg.setAttribute("width", bb.width + 12);
      bg.setAttribute("height", bb.height + 4);
    }
  }
}

/* ------------------------------------------------------------------
 * 4. Lógica real: recibir, validar, procesar, responder
 * ------------------------------------------------------------------ */
function parseAndValidate(raw) {
  const text = raw.trim();
  if (!text) return { ok: false, error: "El cuerpo de la petición está vacío." };

  let items;
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      items = JSON.parse(text);
    } catch {
      return { ok: false, error: "JSON mal formado." };
    }
    if (!Array.isArray(items)) return { ok: false, error: "Se esperaba un arreglo de números." };
  } else {
    items = text.split(/[\s,;]+/).filter(Boolean);
  }

  if (!items.length) return { ok: false, error: "No se encontraron valores." };
  if (items.length > 200) return { ok: false, error: `Máximo 200 valores (llegaron ${items.length}).` };

  const toNum = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const bad = items.filter((v) => !Number.isFinite(toNum(v)));
  if (bad.length) {
    return { ok: false, error: `Valores no numéricos: ${bad.slice(0, 3).map((v) => JSON.stringify(v)).join(", ")}` };
  }
  return { ok: true, values: items.map(toNum) };
}

const round = (v) => Math.round(v * 100) / 100;

function compute(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  return {
    cantidad: n,
    suma: round(sum),
    promedio: round(mean),
    mediana: round(median),
    minimo: sorted[0],
    maximo: sorted[n - 1],
    desviacion: round(Math.sqrt(variance)),
    ordenados: sorted,
  };
}

const cache = new Map();
const database = [];
const stats = { req: 0, hit: 0, err: 0 };
let jobSeq = 0;

/* ------------------------------------------------------------------
 * 5. Animación del recorrido
 * ------------------------------------------------------------------ */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function findEdge(from, to) {
  const fwd = EDGES.find((e) => e.from === from && e.to === to);
  if (fwd) return { e: fwd, reverse: false };
  return { e: EDGES.find((e) => e.from === to && e.to === from), reverse: true };
}

async function travel(from, to, { error = false } = {}) {
  const { e, reverse } = findEdge(from, to);
  const color = error ? "var(--err)" : colorOf(to);
  e.trace.style.stroke = color;
  e.trace.classList.add("on");
  packet.style.setProperty("--pc", color);
  packet.classList.add("on");

  await animate(0, 1, {
    duration: T.travel * (e.kind === "ret" ? 1.6 : 1),
    ease: [0.45, 0, 0.25, 1],
    onUpdate: (p) => {
      const len = e.base.getTotalLength();
      const pt = e.base.getPointAtLength(len * (reverse ? 1 - p : p));
      packet.setAttribute("transform", `translate(${pt.x},${pt.y})`);
      e.trace.style.strokeDasharray = `${len} ${len}`;
      e.trace.style.strokeDashoffset = reverse ? -len * (1 - p) : len * (1 - p);
    },
  });
  e.trace.style.strokeDasharray = "none";
}

function activate(id) {
  const el = nodeEl[id];
  el.classList.remove("is-done", "is-error", "is-skip");
  el.classList.add("is-active");
  animate(el, { scale: [1, 1.06, 1] }, { duration: 0.45, ease: "easeOut" });
}

function settle(id, state = "done") {
  nodeEl[id].classList.remove("is-active");
  nodeEl[id].classList.add(`is-${state}`);
}

function badge(id, text, isErr = false) {
  const b = nodeEl[id].querySelector(".node-badge");
  b.textContent = text;
  b.classList.toggle("err", isErr);
  animate(b, { opacity: 1, scale: [0.6, 1.1, 1] }, { duration: 0.35 });
}

async function step(id, title, msg, opts = {}) {
  activate(id);
  log(id, title, msg, opts.error);
  await wait(T.hold);
  settle(id, opts.error ? "error" : "done");
}

function resetDiagram() {
  for (const el of Object.values(nodeEl)) {
    el.classList.remove("is-active", "is-done", "is-error", "is-skip");
    const b = el.querySelector(".node-badge");
    b.textContent = "";
    b.style.opacity = 0;
  }
  for (const e of EDGES) {
    e.trace.classList.remove("on");
    e.trace.style.strokeDasharray = "";
  }
  packet.classList.remove("on");
}

/* ------------------------------------------------------------------
 * 6. Panel: registro, métricas, resultado
 * ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const input = $("input");
const sendBtn = $("send");
const logEl = $("log");
const resultEl = $("result");
const codeBadge = $("code-badge");
const statusEl = $("status");
const statusText = $("status-text");
let t0 = 0;

function setStatus(state, text) {
  statusEl.dataset.state = state;
  statusText.textContent = text;
}

function log(id, title, msg, isErr = false) {
  logEl.querySelector(".log-empty")?.remove();
  const li = document.createElement("li");
  li.className = `log-item${isErr ? " err" : ""}`;
  li.style.setProperty("--c", colorOf(id));
  li.innerHTML = `<span class="log-time">+${((performance.now() - t0) / 1000).toFixed(2)}s</span>
    <div><div class="log-title"></div><div class="log-msg"></div></div>`;
  li.querySelector(".log-title").textContent = title;
  li.querySelector(".log-msg").textContent = msg;
  logEl.append(li);
  logEl.scrollTop = logEl.scrollHeight;
  animate(li, { opacity: [0, 1], x: [-8, 0] }, { duration: 0.3 });
}

function bumpMetric(id, value) {
  const el = $(id);
  el.textContent = value;
  animate(el, { scale: [1, 1.25, 1] }, { duration: 0.4 });
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlight(json) {
  return escapeHtml(json).replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "n";
      if (m.startsWith('"')) cls = m.trimEnd().endsWith(":") ? "k" : "s";
      else if (m === "true" || m === "false") cls = "b";
      else if (m === "null") cls = "z";
      return `<span class="j-${cls}">${m}</span>`;
    }
  );
}

function showResult(code, body) {
  codeBadge.hidden = false;
  codeBadge.textContent = `HTTP ${code}`;
  codeBadge.classList.toggle("err", code >= 400);
  resultEl.innerHTML = highlight(JSON.stringify(body, null, 2));
  animate(resultEl, { opacity: [0, 1], y: [6, 0] }, { duration: 0.35 });
}

/* ------------------------------------------------------------------
 * 7. Orquestación de una petición
 * ------------------------------------------------------------------ */
let running = false;

async function run() {
  if (running) return;
  running = true;
  sendBtn.disabled = true;
  resetDiagram();
  setStatus("busy", "Procesando…");
  t0 = performance.now();

  const raw = input.value;
  const requestId = `req_${Date.now().toString(36)}`;
  bumpMetric("m-req", ++stats.req);
  if (logEl.querySelector(".log-item")) log("client", "──────────", `Nueva petición ${requestId}`);

  try {
    await step("client", "Cliente", `POST /api/procesar · ${new Blob([raw]).size} bytes`);

    await travel("client", "gateway");
    await step("gateway", "API Gateway", "Token válido · 1 de 100 peticiones/min");

    await travel("gateway", "validator");
    const v = parseAndValidate(raw);
    if (!v.ok) {
      badge("validator", "422", true);
      await step("validator", "Validador · rechazado", v.error, { error: true });
      bumpMetric("m-err", ++stats.err);
      for (const id of ["queue", "cache", "worker", "db", "formatter", "response"]) nodeEl[id].classList.add("is-skip");
      await travel("validator", "gateway", { error: true });
      await travel("gateway", "client", { error: true });
      await step("client", "Cliente", "Recibió HTTP 422 · datos inválidos", { error: true });
      showResult(422, { estado: "error", codigo: 422, requestId, mensaje: v.error });
      setStatus("error", "Rechazada (422)");
      return;
    }
    badge("validator", "OK");
    await step("validator", "Validador", `${v.values.length} valores numéricos válidos`);

    await travel("validator", "queue");
    const jobId = ++jobSeq;
    await step("queue", "Cola de mensajes", `Job #${jobId} encolado · posición 1`);

    await travel("queue", "cache");
    const key = v.values.join(",");
    let data, source, computeMs = 0;

    if (cache.has(key)) {
      badge("cache", "HIT");
      data = cache.get(key);
      source = "cache";
      bumpMetric("m-hit", ++stats.hit);
      await step("cache", "Caché · HIT", "Resultado ya calculado; se salta el Worker y la BD");
      nodeEl.worker.classList.add("is-skip");
      nodeEl.db.classList.add("is-skip");
      await travel("cache", "formatter");
    } else {
      badge("cache", "MISS");
      await step("cache", "Caché · MISS", "No hay resultado previo para estos datos");

      await travel("cache", "worker");
      const c0 = performance.now();
      data = compute(v.values);
      computeMs = performance.now() - c0;
      await step("worker", "Worker", `Calculó 7 métricas en ${computeMs.toFixed(3)} ms`);

      await travel("worker", "db");
      database.push({ id: database.length + 1, requestId, data, at: new Date().toISOString() });
      cache.set(key, data);
      source = "worker";
      badge("db", `#${database.length}`);
      bumpMetric("m-db", database.length);
      await step("db", "Base de datos", `INSERT fila #${database.length} · guardado también en caché`);

      await travel("db", "formatter");
    }

    const body = {
      estado: "ok",
      codigo: 200,
      requestId,
      job: jobId,
      origen: source,
      resultado: data,
      procesadoEnMs: round(computeMs * 1000) / 1000,
    };
    await step("formatter", "Formateador", `Serializado a JSON · ${JSON.stringify(body).length} bytes`);

    await travel("formatter", "response");
    badge("response", "200");
    await step("response", "Respuesta", "HTTP 200 OK · Content-Type: application/json");

    await travel("response", "client");
    await step("client", "Cliente", `Resultado recibido en ${((performance.now() - t0) / 1000).toFixed(2)} s`);
    showResult(200, body);
    setStatus("ok", source === "cache" ? "Completado (caché)" : "Completado");
  } finally {
    packet.classList.remove("on");
    running = false;
    sendBtn.disabled = false;
  }
}

/* ------------------------------------------------------------------
 * 8. Eventos y animación de entrada
 * ------------------------------------------------------------------ */
sendBtn.addEventListener("click", run);
input.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) run();
});
document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    input.value = chip.dataset.preset;
    animate(input, { scale: [0.99, 1] }, { duration: 0.2 });
  })
);
$("clear-log").addEventListener("click", () => {
  logEl.innerHTML = '<li class="log-empty">Todavía no hay peticiones.</li>';
});

new ResizeObserver(drawWires).observe(diagram);

async function intro() {
  svg.style.opacity = 0;
  await document.fonts.ready;
  if (reduced) {
    drawWires();
    svg.style.opacity = 1;
    return;
  }
  animate(".top-text > *", { opacity: [0, 1], y: [12, 0] }, { duration: 0.5, delay: stagger(0.08) });
  animate(".panel > *, .legend-card", { opacity: [0, 1], y: [16, 0] }, { duration: 0.5, delay: stagger(0.06, { startDelay: 0.3 }) });
  animate(".node", { opacity: [0, 1], scale: [0.92, 1] }, { duration: 0.4, delay: stagger(0.05, { startDelay: 0.2 }) });
  await animate(".diagram .col", { opacity: [0, 1], y: [20, 0] }, { duration: 0.5, delay: stagger(0.1) });
  drawWires();
  svg.style.opacity = 1;
}

intro();

