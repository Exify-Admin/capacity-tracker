// api/_util.js
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function env(name, fallback = "") {
  return process.env[name] ?? fallback;
}

function json(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // CORS (optional but useful if you ever host frontend elsewhere)
  const allow = env("ALLOWED_ORIGINS", "*");
  const origin = res.req?.headers?.origin || "";
  if (allow === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const list = allow.split(",").map(s => s.trim()).filter(Boolean);
    res.setHeader("Access-Control-Allow-Origin", list.includes(origin) ? origin : list[0] || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));

  res.end(JSON.stringify(data));
}

function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 200, { ok: true });
    return true;
  }
  return false;
}

async function notionFetch(path, { method = "GET", body } = {}) {
  const token = env("NOTION_TOKEN");
  if (!token) throw new Error("Missing NOTION_TOKEN env var");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
  };

  let init = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const r = await fetch(`${NOTION_API}${path}`, init);
  const text = await r.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!r.ok) {
    const msg = parsed?.message || text || `HTTP ${r.status}`;
    throw new Error(`Notion API error (${r.status}): ${msg}`);
  }
  return parsed;
}

// -------- Notion property helpers --------

function titlePlain(prop) {
  const t = prop?.title;
  if (!Array.isArray(t)) return "";
  return t.map(x => x?.plain_text || "").join("").trim();
}

function richTextPlain(prop) {
  const rt = prop?.rich_text;
  if (!Array.isArray(rt)) return "";
  return rt.map(x => x?.plain_text || "").join("").trim();
}

function selectName(prop) {
  return prop?.select?.name || prop?.status?.name || "";
}

function multiSelectFirst(prop) {
  const ms = prop?.multi_select;
  if (!Array.isArray(ms) || ms.length === 0) return "";
  return ms[0]?.name || "";
}

function peopleFirst(prop) {
  const ppl = prop?.people;
  if (!Array.isArray(ppl) || ppl.length === 0) return null;
  return ppl[0]; // {id, name, avatar_url}
}

function dateStart(prop) {
  return prop?.date?.start || "";
}

function dateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isOverdue(dueIso, statusLabel) {
  if (!dueIso) return false;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return false;
  const status = (statusLabel || "").toLowerCase();
  if (status.includes("done") || status.includes("complete")) return false;
  return due.getTime() < Date.now();
}

function normalizeStatus(raw) {
  const s = (raw || "").toLowerCase();
  if (s.includes("block")) return "blocked";
  if (s.includes("not started") || s.includes("todo") || s.includes("to do") || s.includes("backlog")) return "queue";
  if (s.includes("done") || s.includes("complete")) return "done";
  // default is WIP
  return "inprogress";
}

function priorityRank(p) {
  const s = (p || "").toLowerCase();
  if (s.includes("p0")) return 0;
  if (s.includes("p1")) return 1;
  if (s.includes("p2")) return 2;
  if (s.includes("p3")) return 3;
  return 2;
}

function statusRank(task) {
  // priority to completion: overdue > blocked > in progress > queue > done
  if (task.overdue) return 0;
  if (task.blocked) return 1;
  const st = normalizeStatus(task.statusLabel);
  if (st === "inprogress") return 2;
  if (st === "queue") return 3;
  if (st === "done") return 4;
  return 2;
}

function sortTasks(tasks) {
  return tasks.sort((a, b) => {
    const sr = statusRank(a) - statusRank(b);
    if (sr !== 0) return sr;

    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;

    if (a.dueLabel && b.dueLabel) return a.dueLabel.localeCompare(b.dueLabel);
    if (a.dueLabel) return -1;
    if (b.dueLabel) return 1;

    return (a.title || "").localeCompare(b.title || "");
  });
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function segmentsForWip(allTasks, maxSegments = 10) {
  const wip = allTasks.filter(t => {
    const st = normalizeStatus(t.statusLabel);
    return st === "inprogress" || st === "blocked";
  });

  const sorted = sortTasks(wip.slice());
  const segs = [];

  const visible = sorted.slice(0, maxSegments);
  for (const t of visible) {
    segs.push({
      kind: "task",
      status: t.blocked ? "blocked" : "inprogress",
      overdue: t.overdue,
      task: t,
    });
  }

  if (sorted.length > maxSegments) {
    const overflow = sorted.length - maxSegments;
    segs.pop();
    segs.push({ kind: "overflow", overflow });
  }

  while (segs.length < maxSegments) segs.push({ kind: "empty" });
  return segs;
}

module.exports = {
  env,
  json,
  handleOptions,
  notionFetch,
  titlePlain,
  richTextPlain,
  selectName,
  multiSelectFirst,
  peopleFirst,
  dateStart,
  dateLabel,
  isOverdue,
  normalizeStatus,
  uniqueSorted,
  segmentsForWip,
  sortTasks,
};

