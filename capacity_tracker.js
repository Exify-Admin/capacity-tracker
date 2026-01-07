import os, json, textwrap, zipfile, pathlib, datetime, re

base = "/mnt/data/team-capacity-widget"
frontend_dir = os.path.join(base, "frontend")
worker_dir = os.path.join(base, "cloudflare-worker")
os.makedirs(frontend_dir, exist_ok=True)
os.makedirs(worker_dir, exist_ok=True)

index_html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Team Capacity Widget</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div id="app" class="app">
    <header class="header">
      <div class="header__left">
        <div class="title">Team Capacity</div>
        <div id="updated" class="updated">Updated —</div>
      </div>

      <div class="header__right">
        <label class="control">
          <span class="control__label">Project</span>
          <select id="projectSelect" class="select">
            <option value="">All Projects</option>
          </select>
        </label>

        <label class="control">
          <span class="control__label">Department</span>
          <select id="deptSelect" class="select">
            <option value="">All Departments</option>
          </select>
        </label>

        <label class="control control--search">
          <span class="control__label">Search</span>
          <input id="searchInput" class="search" placeholder="Search teammate…" />
        </label>
      </div>
    </header>

    <main class="table" aria-label="Team capacity table">
      <div class="table__head">
        <div class="th th--person">Person</div>
        <div class="th th--bar">Tasks</div>
        <div class="th th--metrics">Metrics</div>
        <div class="th th--current">Current task</div>
      </div>
      <div id="rows" class="table__body"></div>
    </main>

    <!-- Click-triggered popover -->
    <div id="popover" class="popover" role="dialog" aria-modal="false" aria-hidden="true">
      <div class="popover__inner">
        <div class="popover__top">
          <a id="popTitle" class="popTitle" href="#" target="_blank" rel="noreferrer"></a>
          <div class="popMeta">
            <span id="popStatus" class="muted"></span>
            <span class="muted">•</span>
            <span id="popDue" class="muted"></span>
            <span id="popOverdue" class="overdueTag" hidden>Overdue</span>
            <span id="popPriority" class="priorityPill">P2 Medium</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="popover__actions">
          <button id="popUnblock" class="btn" type="button" hidden>Mark Unblocked</button>

          <div class="commentRow">
            <input id="popComment" class="commentInput" placeholder="Add comment…" />
            <button id="popSend" class="btn btn--ghost" type="button">Send</button>
          </div>
        </div>

        <div class="divider"></div>

        <a id="popOpen" class="openLink" href="#" target="_blank" rel="noreferrer">Open task in Notion →</a>
      </div>
    </div>

    <div id="toast" class="toast" aria-live="polite" aria-atomic="true" hidden></div>
  </div>

  <script src="./app.js"></script>
</body>
</html>
"""

styles_css = """/* Notion-ish minimal style. Color is used only for: task segments, priority pill, queue pill. */
:root{
  --text: #111827;
  --muted: #6b7280;
  --line: rgba(17,24,39,0.10);

  --seg-green: #22c55e; /* In Progress */
  --seg-yellow: #facc15; /* Blocked */
  --seg-red: #ef4444; /* Overflow cap */
  --queue-green: rgba(34,197,94,0.15);
  --queue-red: rgba(239,68,68,0.15);

  --priority-p1: rgba(239,68,68,0.18);
  --priority-p2: rgba(250,204,21,0.22);
  --priority-p3: rgba(107,114,128,0.16);

  --shadow: 0 10px 24px rgba(0,0,0,0.12);
  --shadow-soft: 0 8px 18px rgba(0,0,0,0.10);
  --seg-glow: 0 0 0 2px rgba(17,24,39,0.10), 0 8px 16px rgba(0,0,0,0.10);
}

*{ box-sizing: border-box; }
html, body { height: 100%; }
body{
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--text);
  background: transparent;
}

.app{
  width: 100%;
  height: 100%;
  padding: 0; /* edge-to-edge for embed */
}

.header{
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}

.title{
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}
.updated{
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.header__right{
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.control{
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}
.control--search{ min-width: 220px; }

.control__label{
  font-size: 11px;
  color: var(--muted);
}

.select, .search{
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0 10px;
  font-size: 13px;
  outline: none;
  background: rgba(255,255,255,0.92);
}

.search{ width: 100%; }

.select:focus, .search:focus{
  box-shadow: 0 0 0 3px rgba(17,24,39,0.08);
  border-color: rgba(17,24,39,0.18);
}

.table{
  width: 100%;
}

.table__head{
  display: grid;
  grid-template-columns: 280px 260px 200px 1fr;
  gap: 12px;
  padding: 10px 12px 8px;
  font-size: 11px;
  color: var(--muted);
}
.th{ user-select: none; }
.table__body{
  display: flex;
  flex-direction: column;
}

.row{
  display: grid;
  grid-template-columns: 280px 260px 200px 1fr;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
  min-height: 56px;
}
.row:hover{ background: rgba(17,24,39,0.02); }

.person{
  display: flex;
  gap: 10px;
  min-width: 0;
}
.avatar{
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(17,24,39,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(17,24,39,0.55);
  flex: 0 0 auto;
}
.personText{ min-width: 0; }
.projectLine{
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 230px;
}
.name{
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 230px;
}
.role{
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 230px;
}

.barWrap{
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.barLabel{
  font-size: 11px;
  color: var(--muted);
}
.bar{
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  align-items: center;
}

.seg{
  position: relative;
  height: 12px;
  border-radius: 4px;
  background: rgba(17,24,39,0.10); /* empty */
  cursor: default;
  transform: translateY(0);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.seg--clickable{
  cursor: pointer;
}
.seg--clickable:hover{
  transform: translateY(-1px);
  box-shadow: var(--seg-glow);
}

/* Status fills */
.seg--inprogress{ background: var(--seg-green); }
.seg--blocked{ background: var(--seg-yellow); }
.seg--overflow{ background: var(--seg-red); color: white; font-size: 10px; display:flex; align-items:center; justify-content:center; font-weight:600; }

/* Overdue corner marker overlay (top-right) */
.seg--overdue::after{
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-top: 7px solid var(--seg-red);
  border-left: 7px solid transparent;
  border-top-right-radius: 4px;
}

/* Prohibition icon overlay for blocked segments */
.seg--blocked::before{
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 11px;
  height: 11px;
  opacity: 0.78;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  /* inline SVG: thin prohibition sign */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111827' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M7.5 7.5l9 9'/%3E%3C/svg%3E");
}

/* Metrics */
.metrics{
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  white-space: nowrap;
}
.metrics .dot{ color: var(--muted); }

.queuePill{
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid rgba(17,24,39,0.12);
}
.queuePill--ok{
  background: var(--queue-green);
}
.queuePill--bad{
  background: var(--queue-red);
}

/* Current task text */
.currentTask{
  font-size: 12px;
  color: rgba(17,24,39,0.80);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.currentTask a{
  color: inherit;
  text-decoration: none;
}
.currentTask a:hover{ text-decoration: underline; }

/* Popover */
.popover{
  position: fixed;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  z-index: 50;
  display: none;
}
.popover[aria-hidden="false"]{ display: block; }

.popover__inner{
  position: absolute;
  min-width: 280px;
  max-width: 340px;
  background: rgba(255,255,255,0.98);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 10px 8px;
  box-shadow: var(--shadow);
}

.popTitle{
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  margin-bottom: 6px;
  line-height: 1.25;
  max-height: 2.5em;
  overflow: hidden;
}
.popTitle:hover{ text-decoration: underline; }

.popMeta{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.muted{ color: var(--muted); }

.overdueTag{
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(239,68,68,0.35);
  background: rgba(239,68,68,0.10);
  color: rgba(239,68,68,0.95);
}

.priorityPill{
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid rgba(17,24,39,0.12);
  margin-left: auto;
}
.priorityPill--p1{ background: var(--priority-p1); }
.priorityPill--p2{ background: var(--priority-p2); }
.priorityPill--p3{ background: var(--priority-p3); }

.divider{
  height: 1px;
  background: var(--line);
  margin: 10px 0;
}

.popover__actions{
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn{
  height: 30px;
  border-radius: 10px;
  border: 1px solid rgba(17,24,39,0.14);
  background: rgba(255,255,255,0.92);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover{ background: rgba(17,24,39,0.04); }

.btn--ghost{
  font-weight: 600;
  background: rgba(17,24,39,0.03);
}
.btn--ghost:hover{ background: rgba(17,24,39,0.06); }

.commentRow{
  display: flex;
  gap: 8px;
}
.commentInput{
  flex: 1;
  height: 30px;
  border-radius: 10px;
  border: 1px solid var(--line);
  padding: 0 10px;
  font-size: 12px;
  outline: none;
  background: rgba(255,255,255,0.92);
}
.commentInput:focus{
  box-shadow: 0 0 0 3px rgba(17,24,39,0.08);
  border-color: rgba(17,24,39,0.18);
}

.openLink{
  display: block;
  font-size: 12px;
  color: rgba(17,24,39,0.85);
  text-decoration: none;
  padding: 6px 2px;
}
.openLink:hover{ text-decoration: underline; }

/* Toast */
.toast{
  position: fixed;
  right: 12px;
  bottom: 12px;
  background: rgba(17,24,39,0.92);
  color: white;
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  box-shadow: var(--shadow-soft);
  max-width: 340px;
}

/* Responsive */
@media (max-width: 900px){
  .table__head{ display:none; }
  .row{
    grid-template-columns: 1fr;
    gap: 8px;
    min-height: 86px;
  }
  .barWrap{ width: 100%; }
  .metrics{ justify-content: flex-start; }
}
"""

app_js = """// Team Capacity Widget Frontend
// Configure API base URL by adding ?api=https://YOUR_WORKER_DOMAIN to the iframe src,
// or set window.localStorage.API_BASE once.
(() => {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("API_BASE") || "").replace(/\\/$/, "");

  const $ = (id) => document.getElementById(id);

  const rowsEl = $("rows");
  const updatedEl = $("updated");
  const projectSelect = $("projectSelect");
  const deptSelect = $("deptSelect");
  const searchInput = $("searchInput");
  const popover = $("popover");
  const popTitle = $("popTitle");
  const popStatus = $("popStatus");
  const popDue = $("popDue");
  const popOverdue = $("popOverdue");
  const popPriority = $("popPriority");
  const popUnblock = $("popUnblock");
  const popComment = $("popComment");
  const popSend = $("popSend");
  const popOpen = $("popOpen");
  const toast = $("toast");

  let state = {
    people: [],
    options: { projects: [], departments: [] },
    filters: { project: "", department: "", search: "" },
    openTask: null, // {task, anchorRect}
  };

  function toastMsg(msg){
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toast.hidden = true), 2200);
  }

  function notionUrlFromId(pageId){
    // generic notion redirect
    return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
  }

  function setSelectOptions(selectEl, options, placeholder){
    const current = selectEl.value;
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      selectEl.appendChild(opt);
    }
    // restore if still present
    if ([...selectEl.options].some(x => x.value === current)) selectEl.value = current;
  }

  async function apiGet(path){
    const url = API_BASE ? `${API_BASE}${path}` : path;
    const res = await fetch(url, { headers: { "Accept": "application/json" }});
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return await res.json();
  }

  async function apiPost(path, body){
    const url = API_BASE ? `${API_BASE}${path}` : path;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `POST ${path} failed: ${res.status}`);
    return data;
  }

  function initials(name){
    const parts = (name || "").trim().split(/\\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const a = parts[0]?.[0] || "";
    const b = parts.length > 1 ? parts[parts.length-1][0] : "";
    return (a + b).toUpperCase();
  }

  function isOverdue(dueISO){
    if (!dueISO) return false;
    const due = new Date(dueISO);
    const now = new Date();
    return due.getTime() < now.getTime();
  }

  function priorityClass(priority){
    const p = (priority || "").toLowerCase();
    if (p.includes("p1") || p.includes("high")) return ["priorityPill--p1", "P1 High"];
    if (p.includes("p2") || p.includes("med")) return ["priorityPill--p2", "P2 Medium"];
    if (p.includes("p3") || p.includes("low")) return ["priorityPill--p3", "P3 Low"];
    return ["priorityPill--p3", priority || "Priority"];
  }

  function clearPopover(){
    state.openTask = null;
    popover.setAttribute("aria-hidden", "true");
    popover.style.display = "none";
    popover.style.left = "0px";
    popover.style.top = "0px";
    popTitle.textContent = "";
    popTitle.href = "#";
    popOpen.href = "#";
    popComment.value = "";
  }

  function positionPopover(anchorRect){
    // place under or above based on viewport
    const margin = 8;
    const pop = popover.querySelector(".popover__inner");
    // temporarily display to measure
    popover.style.display = "block";
    popover.setAttribute("aria-hidden", "false");
    popover.style.left = "0px";
    popover.style.top = "0px";

    const popRect = pop.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    let x = anchorRect.left;
    x = Math.min(x, vw - popRect.width - margin);
    x = Math.max(margin, x);

    let y = anchorRect.bottom + 8;
    if (y + popRect.height + margin > vh){
      y = anchorRect.top - popRect.height - 8;
    }
    y = Math.max(margin, y);

    pop.style.left = "0px";
    pop.style.top = "0px";
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
  }

  function openPopover(task, anchorRect){
    state.openTask = { task, anchorRect };
    // Fill content
    popTitle.textContent = task.title || "(Untitled)";
    popTitle.href = task.url || notionUrlFromId(task.id);
    popOpen.href = task.url || notionUrlFromId(task.id);

    popStatus.textContent = task.statusLabel || "—";
    popDue.textContent = task.dueLabel || "No due date";

    popOverdue.hidden = !task.overdue;
    const [cls, label] = priorityClass(task.priority || "");
    popPriority.className = `priorityPill ${cls}`;
    popPriority.textContent = label;

    // unblock button: only if blocked
    popUnblock.hidden = !task.blocked;

    // Position and show
    positionPopover(anchorRect);
  }

  function render(){
    // filters
    const f = state.filters;
    const search = (f.search || "").toLowerCase().trim();

    const filteredPeople = state.people.filter(p => {
      if (f.project && p.projectsAll.indexOf(f.project) === -1) return false;
      if (f.department && p.departmentsAll.indexOf(f.department) === -1) return false;
      if (search){
        const hay = `${p.name} ${p.role || ""} ${p.currentProject || ""} ${(p.currentTask?.title || "")}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    rowsEl.innerHTML = "";
    for (const p of filteredPeople){
      const row = document.createElement("div");
      row.className = "row";

      // person cell
      const person = document.createElement("div");
      person.className = "person";
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = initials(p.name);
      const personText = document.createElement("div");
      personText.className = "personText";
      const projLine = document.createElement("div");
      projLine.className = "projectLine";
      projLine.textContent = p.currentProject ? `Current Project • ${p.currentProject}` : "Current Project • —";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = p.name;
      const role = document.createElement("div");
      role.className = "role";
      role.textContent = p.role || "—";
      personText.appendChild(projLine);
      personText.appendChild(name);
      personText.appendChild(role);
      person.appendChild(avatar);
      person.appendChild(personText);

      // bar cell
      const barWrap = document.createElement("div");
      barWrap.className = "barWrap";
      const barLabel = document.createElement("div");
      barLabel.className = "barLabel";
      barLabel.textContent = "Tasks";
      const bar = document.createElement("div");
      bar.className = "bar";

      const segs = p.segments || [];
      for (const s of segs){
        const seg = document.createElement("div");
        let cls = "seg";
        if (s.kind === "empty"){
          // nothing
        } else if (s.kind === "overflow"){
          cls += " seg--overflow seg--clickable";
          seg.textContent = `+${s.overflow}`;
        } else {
          cls += " seg--clickable";
          if (s.status === "inprogress") cls += " seg--inprogress";
          if (s.status === "blocked") cls += " seg--blocked";
          if (s.overdue) cls += " seg--overdue";
        }
        seg.className = cls;
        if (s.task){
          seg.dataset.taskId = s.task.id;
          seg.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const rect = seg.getBoundingClientRect();
            openPopover(s.task, rect);
          });
        } else if (s.kind === "overflow"){
          // overflow cap click opens person's current task if exists
          seg.addEventListener("click", (ev) => {
            ev.stopPropagation();
            if (!p.currentTask) return;
            const rect = seg.getBoundingClientRect();
            openPopover(p.currentTask, rect);
          });
        }
        bar.appendChild(seg);
      }

      barWrap.appendChild(barLabel);
      barWrap.appendChild(bar);

      // metrics cell
      const metrics = document.createElement("div");
      metrics.className = "metrics";
      const wip = document.createElement("span");
      wip.textContent = `WIP ${p.wip}/${p.wipLimit}`;
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.textContent = "•";
      const q = document.createElement("span");
      q.className = "queuePill " + (p.queue <= p.queueLimit ? "queuePill--ok" : "queuePill--bad");
      q.textContent = `Queue ${p.queue}/${p.queueLimit}`;
      metrics.appendChild(wip);
      metrics.appendChild(dot);
      metrics.appendChild(q);

      // current task cell
      const current = document.createElement("div");
      current.className = "currentTask";
      if (p.currentTask){
        const a = document.createElement("a");
        a.href = p.currentTask.url || notionUrlFromId(p.currentTask.id);
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = `Current task: ${p.currentTask.title}`;
        current.appendChild(a);
      } else {
        current.textContent = "Current task: —";
      }

      row.appendChild(person);
      row.appendChild(barWrap);
      row.appendChild(metrics);
      row.appendChild(current);

      rowsEl.appendChild(row);
    }

    // updated time
    if (state.updatedText) updatedEl.textContent = state.updatedText;
  }

  async function load(){
    rowsEl.innerHTML = "<div style='padding:12px;color:#6b7280;font-size:12px'>Loading…</div>";
    try{
      const data = await apiGet("/api/tasks");
      state.people = data.people || [];
      state.options = data.options || { projects: [], departments: [] };
      state.updatedText = data.updatedText || "Updated —";

      setSelectOptions(projectSelect, state.options.projects || [], "All Projects");
      setSelectOptions(deptSelect, state.options.departments || [], "All Departments");

      render();
    }catch(err){
      rowsEl.innerHTML = `<div style='padding:12px;color:#ef4444;font-size:12px'>Failed to load: ${String(err.message || err)}</div>`;
    }
  }

  // Events
  projectSelect.addEventListener("change", () => {
    state.filters.project = projectSelect.value;
    render();
  });
  deptSelect.addEventListener("change", () => {
    state.filters.department = deptSelect.value;
    render();
  });
  searchInput.addEventListener("input", () => {
    state.filters.search = searchInput.value;
    render();
  });

  // Popover close on outside click
  document.addEventListener("click", () => {
    clearPopover();
  });
  // prevent closing when clicking inside popover
  popover.addEventListener("click", (e) => e.stopPropagation());

  // Popover actions
  popUnblock.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!state.openTask?.task) return;
    const task = state.openTask.task;
    try{
      popUnblock.disabled = true;
      await apiPost("/api/unblock", { taskId: task.id });
      toastMsg("Updated in Notion");
      await load();
      clearPopover();
    }catch(err){
      toastMsg(String(err.message || err));
    }finally{
      popUnblock.disabled = false;
    }
  });

  popSend.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!state.openTask?.task) return;
    const task = state.openTask.task;
    const comment = (popComment.value || "").trim();
    if (!comment) return toastMsg("Type a comment first");
    try{
      popSend.disabled = true;
      await apiPost("/api/comment", { taskId: task.id, comment });
      toastMsg("Comment added");
      popComment.value = "";
      // keep popover open
    }catch(err){
      toastMsg(String(err.message || err));
    }finally{
      popSend.disabled = false;
    }
  });

  // close popover on escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearPopover();
  });

  // initial load
  load();
})();
"""

# Cloudflare Worker (TypeScript)
worker_index_ts = """export interface Env {
  NOTION_TOKEN: string;
  NOTION_VERSION: string; // e.g. 2025-09-03
  DATA_SOURCE_ID?: string;
  DATABASE_ID?: string; // fallback
  ALLOWED_ORIGINS?: string; // comma-separated
  // Property names (exact)
  PROP_TITLE?: string; // default: Name
  PROP_ASSIGNEE?: string; // default: Assignee
  PROP_STATUS?: string; // default: Status
  PROP_DUE?: string; // default: Due Date
  PROP_PROJECT?: string; // default: Project
  PROP_DEPARTMENT?: string; // default: Department
  PROP_PRIORITY?: string; // default: Priority
  PROP_ROLE?: string; // default: Role (optional)
  // Status names (comma-separated)
  IN_PROGRESS_STATUSES?: string; // default: In Progress
  BLOCKED_STATUSES?: string; // default: Blocked
  NOT_STARTED_STATUSES?: string; // default: Not Started,To Do
  DONE_STATUSES?: string; // default: Done
  UNBLOCK_TO_STATUS?: string; // default: In Progress
  WIP_LIMIT?: string; // default: 10
  QUEUE_LIMIT?: string; // default: 5
}

type NotionRichText = { type: "text"; text: { content: string } };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function allowedOrigin(origin: string | null, env: Env): string {
  const allow = (env.ALLOWED_ORIGINS || "*").trim();
  if (!origin) return "*";
  if (allow === "*") return "*";
  const allowed = allow.split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "null";
}

function withCors(req: Request, env: Env, res: Response) {
  const origin = req.headers.get("Origin");
  const ao = allowedOrigin(origin, env);
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", ao);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Notion-Version");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function strList(v: string | undefined, fallback: string[]): string[] {
  if (!v) return fallback;
  return v.split(",").map(s => s.trim()).filter(Boolean);
}

function notionHeaders(env: Env) {
  return {
    "Authorization": `Bearer ${env.NOTION_TOKEN}`,
    "Notion-Version": env.NOTION_VERSION || "2025-09-03",
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

function notionUrl(pageId: string) {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

function getProp(obj: any, name: string) {
  return obj?.properties?.[name];
}

function extractTitle(page: any, propName: string): string {
  const p = getProp(page, propName);
  const title = p?.title || p?.name?.title || [];
  if (!Array.isArray(title)) return "(Untitled)";
  return title.map((t: any) => t?.plain_text || "").join("").trim() || "(Untitled)";
}

function extractSelectLike(page: any, propName: string): string[] {
  const p = getProp(page, propName);
  if (!p) return [];
  if (p.type === "select" && p.select?.name) return [p.select.name];
  if (p.type === "status" && p.status?.name) return [p.status.name];
  if (p.type === "multi_select" && Array.isArray(p.multi_select)) return p.multi_select.map((x: any) => x.name).filter(Boolean);
  if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
    const s = p.rich_text.map((t: any) => t.plain_text || "").join("").trim();
    return s ? [s] : [];
  }
  return [];
}

function extractDateISO(page: any, propName: string): string | null {
  const p = getProp(page, propName);
  const d = p?.date?.start || null;
  return d;
}

function extractAssignee(page: any, propName: string): { id: string; name: string } | null {
  const p = getProp(page, propName);
  const ppl = p?.people;
  if (!Array.isArray(ppl) || ppl.length === 0) return null;
  const first = ppl[0];
  return { id: first.id, name: first.name || "Unknown" };
}

function isOverdue(dueISO: string | null, now: number): boolean {
  if (!dueISO) return false;
  const t = Date.parse(dueISO);
  return Number.isFinite(t) && t < now;
}

function formatDue(dueISO: string | null): string {
  if (!dueISO) return "No due date";
  const d = new Date(dueISO);
  // yyyy-mm-dd -> concise label
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function priorityRank(label: string): number {
  const s = (label || "").toLowerCase();
  if (s.includes("p1") || s.includes("high")) return 1;
  if (s.includes("p2") || s.includes("med")) return 2;
  if (s.includes("p3") || s.includes("low")) return 3;
  return 9;
}

async function notionPost(env: Env, url: string, body: any) {
  const res = await fetch(url, { method: "POST", headers: notionHeaders(env), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
async function notionPatch(env: Env, url: string, body: any) {
  const res = await fetch(url, { method: "PATCH", headers: notionHeaders(env), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function queryAllTasks(env: Env): Promise<any[]> {
  const dataSourceId = env.DATA_SOURCE_ID;
  const databaseId = env.DATABASE_ID;

  const statusProp = env.PROP_STATUS || "Status";
  const inProg = strList(env.IN_PROGRESS_STATUSES, ["In Progress"]);
  const blocked = strList(env.BLOCKED_STATUSES, ["Blocked"]);
  const notStarted = strList(env.NOT_STARTED_STATUSES, ["Not Started", "To Do"]);
  const done = strList(env.DONE_STATUSES, ["Done"]);

  // Filter: status in (inProg, blocked, notStarted) and not in done (for safety)
  const includeStatuses = [...new Set([...inProg, ...blocked, ...notStarted])];

  const filter = {
    and: [
      { property: statusProp, status: { is_not_empty: true } },
      { or: includeStatuses.map(name => ({ property: statusProp, status: { equals: name } })) }
    ]
  };

  // With the 2025-09-03 API, query via data_sources.
  if (dataSourceId) {
    let results: any[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 20; i++) { // guard
      const body: any = { page_size: 100, filter };
      if (cursor) body.start_cursor = cursor;
      const { res, data } = await notionPost(env, `https://api.notion.com/v1/data_sources/${dataSourceId}/query`, body);
      if (!res.ok) throw new Error(`Notion query failed (${res.status})`);
      results = results.concat(data.results || []);
      cursor = data.next_cursor || null;
      if (!cursor) break;
    }
    return results;
  }

  // Fallback for older setups (deprecated in 2025-09-03)
  if (databaseId) {
    let results: any[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 20; i++) {
      const body: any = { page_size: 100, filter };
      if (cursor) body.start_cursor = cursor;
      const { res, data } = await notionPost(env, `https://api.notion.com/v1/databases/${databaseId}/query`, body);
      if (!res.ok) throw new Error(`Notion database query failed (${res.status})`);
      results = results.concat(data.results || []);
      cursor = data.next_cursor || null;
      if (!cursor) break;
    }
    return results;
  }

  throw new Error("Missing DATA_SOURCE_ID (recommended) or DATABASE_ID");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return withCors(req, env, new Response(null, { status: 204 }));
    }

    try {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === "/api/tasks" && req.method === "GET") {
        const wipLimit = Number(env.WIP_LIMIT || "10") || 10;
        const queueLimit = Number(env.QUEUE_LIMIT || "5") || 5;

        const propTitle = env.PROP_TITLE || "Name";
        const propAssignee = env.PROP_ASSIGNEE || "Assignee";
        const propStatus = env.PROP_STATUS || "Status";
        const propDue = env.PROP_DUE || "Due Date";
        const propProject = env.PROP_PROJECT || "Project";
        const propDept = env.PROP_DEPARTMENT || "Department";
        const propPriority = env.PROP_PRIORITY || "Priority";
        const propRole = env.PROP_ROLE || "Role";

        const inProg = strList(env.IN_PROGRESS_STATUSES, ["In Progress"]);
        const blocked = strList(env.BLOCKED_STATUSES, ["Blocked"]);
        const notStarted = strList(env.NOT_STARTED_STATUSES, ["Not Started", "To Do"]);
        const done = strList(env.DONE_STATUSES, ["Done"]);

        const now = Date.now();

        const pages = await queryAllTasks(env);

        // Transform pages into tasks
        const tasks = pages.map(page => {
          const title = extractTitle(page, propTitle);
          const statusArr = extractSelectLike(page, propStatus);
          const status = statusArr[0] || "";
          const dueISO = extractDateISO(page, propDue);
          const assignee = extractAssignee(page, propAssignee);
          const projArr = extractSelectLike(page, propProject);
          const deptArr = extractSelectLike(page, propDept);
          const prioArr = extractSelectLike(page, propPriority);
          const roleArr = extractSelectLike(page, propRole);

          const isDone = done.includes(status);
          const isInProgress = inProg.includes(status);
          const isBlocked = blocked.includes(status);
          const isNotStarted = notStarted.includes(status);

          return {
            id: page.id,
            url: page.url || notionUrl(page.id),
            title,
            status,
            statusLabel: status || "—",
            dueISO,
            dueLabel: formatDue(dueISO),
            overdue: !isDone && isOverdue(dueISO, now),
            blocked: isBlocked,
            inProgress: isInProgress,
            notStarted: isNotStarted,
            project: projArr[0] || "",
            department: deptArr[0] || "",
            priority: prioArr[0] || "",
            role: roleArr[0] || "",
            assignee,
          };
        }).filter(t => t.assignee && !done.includes(t.status));

        // Build option sets
        const projects = Array.from(new Set(tasks.map(t => t.project).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
        const departments = Array.from(new Set(tasks.map(t => t.department).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

        // Aggregate by assignee name (simple, stable)
        const byPerson = new Map<string, any>();
        for (const t of tasks) {
          const key = t.assignee.name;
          if (!byPerson.has(key)) {
            byPerson.set(key, {
              name: t.assignee.name,
              role: t.role || t.department || "",
              tasks: [],
            });
          }
          byPerson.get(key).tasks.push(t);
        }

        const people = Array.from(byPerson.values()).map(p => {
          const allTasks = p.tasks as any[];

          const wipTasks = allTasks.filter(t => t.inProgress || t.blocked);
          const queueTasks = allTasks.filter(t => t.notStarted);

          // completion priority: In Progress first, then Blocked
          const inProgTasks = wipTasks.filter(t => t.inProgress);
          const blockedTasks = wipTasks.filter(t => t.blocked);

          const sortKey = (t: any) => {
            const pr = priorityRank(t.priority);
            const due = t.dueISO ? Date.parse(t.dueISO) : Number.POSITIVE_INFINITY;
            return [pr, due, (t.title || "").toLowerCase()];
          };
          const cmp = (a: any, b: any) => {
            const ka = sortKey(a), kb = sortKey(b);
            for (let i = 0; i < ka.length; i++) {
              if (ka[i] < kb[i]) return -1;
              if (ka[i] > kb[i]) return 1;
            }
            return 0;
          };

          inProgTasks.sort(cmp);
          blockedTasks.sort(cmp);

          const orderedWip = [...inProgTasks, ...blockedTasks];

          // current task = first segment task
          const currentTask = orderedWip[0] || null;

          // current project: mode among WIP tasks else queue
          const projCandidates = (wipTasks.length ? wipTasks : queueTasks).map(t => t.project).filter(Boolean);
          let currentProject = "";
          if (projCandidates.length) {
            const counts = new Map<string, number>();
            for (const x of projCandidates) counts.set(x, (counts.get(x) || 0) + 1);
            currentProject = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0][0];
          }

          // 10 segments rule:
          // - if wip <= 10: show each task as segment, rest empty
          // - if wip > 10: show 9 tasks, 10th overflow cap +N where N = wip - 9
          const segments: any[] = [];
          if (orderedWip.length > wipLimit) {
            const shown = orderedWip.slice(0, wipLimit - 1);
            for (const t of shown) {
              segments.push({
                kind: "task",
                status: t.blocked ? "blocked" : "inprogress",
                overdue: t.overdue,
                task: t,
              });
            }
            segments.push({ kind: "overflow", overflow: orderedWip.length - (wipLimit - 1) });
          } else {
            for (const t of orderedWip.slice(0, wipLimit)) {
              segments.push({
                kind: "task",
                status: t.blocked ? "blocked" : "inprogress",
                overdue: t.overdue,
                task: t,
              });
            }
            while (segments.length < wipLimit) segments.push({ kind: "empty" });
          }

          // collect project/department sets for filters
          const projectsAll = Array.from(new Set(allTasks.map(t => t.project).filter(Boolean)));
          const departmentsAll = Array.from(new Set(allTasks.map(t => t.department).filter(Boolean)));

          return {
            name: p.name,
            role: p.role || "",
            currentProject,
            wip: orderedWip.length,
            wipLimit,
            queue: queueTasks.length,
            queueLimit,
            currentTask: currentTask ? {
              id: currentTask.id,
              title: currentTask.title,
              url: currentTask.url,
              statusLabel: currentTask.statusLabel,
              dueLabel: currentTask.dueLabel,
              overdue: currentTask.overdue,
              blocked: currentTask.blocked,
              priority: currentTask.priority,
            } : null,
            segments: segments.map(s => {
              if (s.kind === "task") {
                return {
                  kind: "task",
                  status: s.status,
                  overdue: s.overdue,
                  task: {
                    id: s.task.id,
                    title: s.task.title,
                    url: s.task.url,
                    statusLabel: s.task.statusLabel,
                    dueLabel: s.task.dueLabel,
                    overdue: s.task.overdue,
                    blocked: s.task.blocked,
                    priority: s.task.priority,
                  }
                };
              }
              return s;
            }),
            projectsAll,
            departmentsAll,
          };
        }).sort((a,b) => (b.wip - a.wip) || a.name.localeCompare(b.name));

        const updatedText = `Updated ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

        const res = jsonResponse({ people, options: { projects, departments }, updatedText });
        return withCors(req, env, res);
      }

      if (path === "/api/unblock" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const taskId = body.taskId as string;
        if (!taskId) return withCors(req, env, jsonResponse({ error: "Missing taskId" }, { status: 400 }));

        const statusProp = env.PROP_STATUS || "Status";
        const unblockTo = env.UNBLOCK_TO_STATUS || "In Progress";

        const patchBody = {
          properties: {
            [statusProp]: { status: { name: unblockTo } }
          }
        };

        const { res, data } = await notionPatch(env, `https://api.notion.com/v1/pages/${taskId}`, patchBody);
        if (!res.ok) {
          return withCors(req, env, jsonResponse({ error: data?.message || "Notion update failed", data }, { status: res.status }));
        }
        return withCors(req, env, jsonResponse({ ok: true }));
      }

      if (path === "/api/comment" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const taskId = body.taskId as string;
        const comment = (body.comment as string) || "";
        if (!taskId) return withCors(req, env, jsonResponse({ error: "Missing taskId" }, { status: 400 }));
        if (!comment.trim()) return withCors(req, env, jsonResponse({ error: "Missing comment" }, { status: 400 }));

        const rich_text: NotionRichText[] = [{ type: "text", text: { content: comment.trim() } }];
        const { res, data } = await notionPost(env, "https://api.notion.com/v1/comments", {
          parent: { page_id: taskId },
          rich_text,
        });

        if (!res.ok) {
          return withCors(req, env, jsonResponse({ error: data?.message || "Comment failed", data }, { status: res.status }));
        }
        return withCors(req, env, jsonResponse({ ok: true }));
      }

      return withCors(req, env, jsonResponse({ error: "Not found" }, { status: 404 }));
    } catch (err: any) {
      return withCors(req, env, jsonResponse({ error: err?.message || String(err) }, { status: 500 }));
    }
  }
};
"""

wrangler_toml = """name = "team-capacity-notion-proxy"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
NOTION_VERSION = "2025-09-03"
# Set these in Cloudflare dashboard or via `wrangler secret put` / `wrangler deploy --var`
# DATA_SOURCE_ID = ""
# DATABASE_ID = ""
# ALLOWED_ORIGINS = "*"

# Property names (edit to match your DB)
PROP_TITLE = "Name"
PROP_ASSIGNEE = "Assignee"
PROP_STATUS = "Status"
PROP_DUE = "Due Date"
PROP_PROJECT = "Project"
PROP_DEPARTMENT = "Department"
PROP_PRIORITY = "Priority"
PROP_ROLE = "Role"

# Status names
IN_PROGRESS_STATUSES = "In Progress"
BLOCKED_STATUSES = "Blocked"
NOT_STARTED_STATUSES = "Not Started,To Do"
DONE_STATUSES = "Done"

UNBLOCK_TO_STATUS = "In Progress"
WIP_LIMIT = "10"
QUEUE_LIMIT = "5"
"""

worker_package = """{
  "name": "team-capacity-notion-proxy",
  "private": true,
  "type": "module",
  "devDependencies": {
    "wrangler": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
"""

worker_tsconfig = """{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ES2022", "WebWorker"],
    "types": ["@cloudflare/workers-types"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
"""

readme = f"""# Team Capacity Widget (Notion + Embed)

This repo contains:
- **frontend/**: a static widget (works on GitHub Pages)
- **cloudflare-worker/**: a tiny API proxy that talks to Notion (keeps your Notion token secret)

## How it works
- The widget calls the worker:
  - `GET /api/tasks` (read)
  - `POST /api/unblock` (write status -> unblocked)
  - `POST /api/comment` (add Notion comment)

The widget shows:
- **10 fixed task segments** per person (WIP): green = In Progress, yellow = Blocked (with prohibition icon), overdue = red corner, overflow = red `+N`
- **Metrics**: `WIP X/10 • Queue Y/5` (Queue pill green/red)
- **Current Project** line above name
- **Current task** is the left-most segment task

Popover is **click-triggered** (not hover), and includes:
- Priority pill
- **Mark Unblocked** (only if the task is blocked)
- Add Comment
- Footer link: "Open task in Notion →"

---

## 1) Notion setup
1. Create an Integration in Notion and copy the token.
2. Share your Tasks database with the integration (Connections).
3. Enable comment capability if you want comments (Notion → integration capabilities).

> Notion API v2025-09-03 recommends querying via **data sources**.

---

## 2) Deploy the Cloudflare Worker
### Prereqs
- Node 18+
- Cloudflare account

### Steps
```bash
cd cloudflare-worker
npm i
npx wrangler secret put NOTION_TOKEN
# set DATA_SOURCE_ID (recommended) or DATABASE_ID in wrangler.toml or Cloudflare dashboard
npx wrangler deploy
