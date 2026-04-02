// ============================================================
// PROPEL FUNDING MODEL — APPLICATION LOGIC v5 (FINAL FIX)
// ============================================================

let version    = '2d';
let contingency = 20;

// ── State ────────────────────────────────────────────────────
const salaryOverrides     = {};   // id → number (Y1 override)
const y2SalaryOverrides   = {};   // id → number
const y3SalaryOverrides   = {};   // id → number
const fteOverrides        = {};   // id → number
const startMonthOverrides = {};   // id → 1–36
const endMonthOverrides   = {};   // id → 1–36
const titleOverrides      = {};   // id → string
const noteOverrides       = {};   // id → string
const mergeExtras         = {};   // targetId → [{id, title, note}]
const hiddenRoleIds       = new Set();
const userRoles           = {};   // section → [role objects]
const techOverrides       = {};   // techId → {qty, unitCost, y2Cost, y3Cost, startMonth, endMonth, note, svc, cat}
const userTechRows        = [];
const revenueOverrides    = {};   // streamId-year → number
const streamNoteOverrides = {};   // streamId → string
const streamNameOverrides = {};   // streamId → string
const userStreams          = [];   // user-added revenue streams
let dragSourceId = null;
let nextCustomId = 1;
let nextRevId    = 1;

function getAllStreams() { return [...REVENUE_STREAMS, ...userStreams]; }
let _snap = null, _snapTimer = null;  // undo history helpers

const SECTIONS = ['leadership','engineering','content','ops','world'];

// ── Storage keys ─────────────────────────────────────────────
const STORAGE_KEY  = 'propel_state';
const HISTORY_KEY  = 'propel_history';
const VERSIONS_KEY = 'propel_versions';
const MAX_HISTORY  = 5;

// ============================================================
// HELPERS
// ============================================================
function fmt(n) { return '$' + Math.round(n || 0).toLocaleString(); }

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function getLifespanDesc(sm, em, yearNum) {
  const yearStart = (yearNum - 1) * 12 + 1;
  const yearEnd   = yearNum * 12;
  const activeStart = Math.max(yearStart, sm);
  const activeEnd   = Math.min(yearEnd, em);
  if (activeEnd < activeStart) return 'Inactive Y' + yearNum;
  if (activeStart === yearStart && activeEnd === yearEnd) return 'Full Y' + yearNum;
  return 'Mo ' + activeStart + '–' + activeEnd;
}

function setContingency(val) {
  markChange();
  contingency = parseInt(val) || 20;
  const pct = document.getElementById('contingency-pct');
  if (pct) pct.textContent = contingency + '%';
  recalcAll();
}

function resolveFteFromData(r, v) {
  const raw = r.fte;
  if (typeof raw === 'string' && raw.includes(',')) {
    const parts = {};
    raw.split(',').forEach(p => { const [k,vv] = p.split(':'); parts[k] = parseFloat(vv); });
    return parts[v] !== undefined ? parts[v] : parts['2d'] || 0;
  }
  return typeof raw === 'number' ? raw : parseFloat(raw);
}

function resolveSalaryFromData(r, v) {
  const raw = r.salary;
  if (typeof raw === 'string' && raw.includes(',')) {
    const parts = {};
    raw.split(',').forEach(p => { const [k,vv] = p.split(':'); parts[k] = parseFloat(vv); });
    return parts[v] !== undefined ? parts[v] : parts['2d'] || 0;
  }
  return typeof raw === 'number' ? raw : parseFloat(raw);
}

function resolveFte(r, v) { return fteOverrides[r.id] !== undefined ? fteOverrides[r.id] : resolveFteFromData(r, v); }

function resolveAnnualSalary(r, v, yearNum = 1) {
  if (yearNum === 1 && salaryOverrides[r.id] !== undefined) return salaryOverrides[r.id];
  if (yearNum === 2 && y2SalaryOverrides[r.id] !== undefined) return y2SalaryOverrides[r.id];
  if (yearNum === 3 && y3SalaryOverrides[r.id] !== undefined) return y3SalaryOverrides[r.id];
  
  if (yearNum === 1) return resolveSalaryFromData(r, v);
  if (yearNum === 2) return r.y2sal !== undefined ? r.y2sal : resolveSalaryFromData(r, v) * 1.05;
  if (yearNum === 3) return r.y3sal !== undefined ? r.y3sal : (r.y2sal || resolveSalaryFromData(r, v) * 1.05) * 1.05;
  return 0;
}

function getEffectiveStartMonth(r) {
  if (startMonthOverrides[r.id] !== undefined) return startMonthOverrides[r.id];
  return r.startMonth || 1;
}

function getEffectiveEndMonth(r) {
  if (endMonthOverrides[r.id] !== undefined) return endMonthOverrides[r.id];
  return r.endMonth || 36;
}

// proratedCostForYear: returns the actual cash to be paid in that specific year (1, 2, or 3)
function proratedCostForYear(fte, annualSal, startMonth, endMonth, yearNum) {
  const yearStart = (yearNum - 1) * 12 + 1;
  const yearEnd   = yearNum * 12;
  const activeStart = Math.max(yearStart, startMonth);
  const activeEnd   = Math.min(yearEnd, endMonth);
  const activeMonths = Math.max(0, activeEnd - activeStart + 1);
  return fte * annualSal * (activeMonths / 12);
}

function findRole(id) {
  for (const sec of SECTIONS) {
    const r = (ROLES[sec] || []).find(x => x.id === id) || (userRoles[sec] || []).find(x => x.id === id);
    if (r) return r;
  }
  return null;
}

function getSectionRoles(section) {
  return [...(ROLES[section] || []), ...(userRoles[section] || [])];
}

function getSectionTotal(section, yearNum = 1) {
  return getSectionRoles(section)
    .filter(r => !hiddenRoleIds.has(r.id))
    .reduce((sum, r) => {
      const fte = resolveFte(r, version);
      if (fte === 0) return sum;
      const sal = resolveAnnualSalary(r, version, yearNum);
      const sm  = getEffectiveStartMonth(r);
      const em  = getEffectiveEndMonth(r);
      return sum + proratedCostForYear(fte, sal, sm, em, yearNum);
    }, 0);
}

function getSummaryFteInfo(section) {
  const roles = getSectionRoles(section).filter(r => !hiddenRoleIds.has(r.id));
  let totalFte = 0, roleCount = 0;
  roles.forEach(r => {
    const fte = resolveFte(r, version);
    if (fte === 0) return;
    totalFte += fte;
    roleCount++;
  });
  return { totalFte, roleCount };
}

// ============================================================
// PERSISTENCE, HISTORY & VERSION CONTROL
// ============================================================

function captureState() {
  return JSON.stringify({
    salaryOverrides, y2SalaryOverrides, y3SalaryOverrides,
    fteOverrides, startMonthOverrides, endMonthOverrides,
    titleOverrides, noteOverrides, mergeExtras,
    hiddenRoleIds: [...hiddenRoleIds],
    techOverrides: JSON.parse(JSON.stringify(techOverrides)),
    revenueOverrides, streamNoteOverrides, streamNameOverrides,
    contingency, version,
    userRoles: JSON.parse(JSON.stringify(userRoles)),
    userTechRows: JSON.parse(JSON.stringify(userTechRows)),
    userStreams: JSON.parse(JSON.stringify(userStreams)),
    nextCustomId, nextRevId,
    curriculum: {
      grades:   document.getElementById('cc-grades')  ?.value,
      subjects: document.getElementById('cc-subjects') ?.value,
      units:    document.getElementById('cc-units')    ?.value,
      lessons:  document.getElementById('cc-lessons')  ?.value,
    },
  });
}

function applyState(json) {
  const s = JSON.parse(json);
  const cl = obj => Object.keys(obj).forEach(k => delete obj[k]);
  cl(salaryOverrides);     Object.assign(salaryOverrides,     s.salaryOverrides     || {});
  cl(y2SalaryOverrides);   Object.assign(y2SalaryOverrides,   s.y2SalaryOverrides   || {});
  cl(y3SalaryOverrides);   Object.assign(y3SalaryOverrides,   s.y3SalaryOverrides   || {});
  cl(fteOverrides);        Object.assign(fteOverrides,        s.fteOverrides        || {});
  cl(startMonthOverrides); Object.assign(startMonthOverrides, s.startMonthOverrides || {});
  cl(endMonthOverrides);   Object.assign(endMonthOverrides,   s.endMonthOverrides   || {});
  cl(titleOverrides);      Object.assign(titleOverrides,      s.titleOverrides      || {});
  cl(noteOverrides);       Object.assign(noteOverrides,       s.noteOverrides       || {});
  cl(mergeExtras);         Object.assign(mergeExtras,         s.mergeExtras         || {});
  hiddenRoleIds.clear();   (s.hiddenRoleIds || []).forEach(id => hiddenRoleIds.add(id));
  cl(techOverrides);       Object.assign(techOverrides,       JSON.parse(JSON.stringify(s.techOverrides || {})));
  cl(revenueOverrides);    Object.assign(revenueOverrides,    s.revenueOverrides    || {});
  cl(streamNoteOverrides); Object.assign(streamNoteOverrides, s.streamNoteOverrides || {});
  cl(streamNameOverrides); Object.assign(streamNameOverrides, s.streamNameOverrides || {});
  contingency = s.contingency ?? 20;
  version     = s.version     ?? '2d';
  // Restore user-added rows
  Object.keys(userRoles).forEach(k => delete userRoles[k]);
  Object.assign(userRoles, JSON.parse(JSON.stringify(s.userRoles || {})));
  userTechRows.length = 0;
  (s.userTechRows || []).forEach(r => userTechRows.push(r));
  userStreams.length = 0;
  (s.userStreams || []).forEach(r => userStreams.push(r));
  if (s.nextCustomId != null) nextCustomId = s.nextCustomId;
  if (s.nextRevId    != null) nextRevId    = s.nextRevId;
  const slider = document.getElementById('contingency-slider');
  if (slider) slider.value = contingency;
  const pctEl = document.getElementById('contingency-pct');
  if (pctEl) pctEl.textContent = contingency + '%';
  document.querySelectorAll('.vtab').forEach(el => {
    el.classList.toggle('active', version === '2d' ? el.textContent.includes('2.5D') : el.textContent.includes('3D'));
  });
  if (s.curriculum) {
    ['cc-grades','cc-subjects','cc-units','cc-lessons'].forEach((id, i) => {
      const el = document.getElementById(id);
      const val = [s.curriculum.grades, s.curriculum.subjects, s.curriculum.units, s.curriculum.lessons][i];
      if (el && val != null) el.value = val;
    });
  }
}

function markChange() {
  if (!_snap) _snap = captureState();   // snapshot pre-change state on first call
  if (_snapTimer) clearTimeout(_snapTimer);
  _snapTimer = setTimeout(() => {
    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      hist.unshift(_snap);
      if (hist.length > MAX_HISTORY) hist.length = MAX_HISTORY;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch(e) {}
    _snap = null;
    updateVersionBar();
  }, 800);
}

function saveCurrentState() {
  try { localStorage.setItem(STORAGE_KEY, captureState()); } catch(e) {}
}

function loadSavedState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { try { applyState(saved); } catch(e) { console.warn('State restore failed:', e); } }
}

function undoLastChange() {
  try {
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!hist.length) return;
    applyState(hist.shift());
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    saveCurrentState();
    recalcAll();
    updateVersionBar();
  } catch(e) { console.warn('Undo failed:', e); }
}

function resetToBaseline() {
  if (!confirm('Reset ALL edits to the original baseline defaults?\n\nThis clears all salary, FTE, start/stop, note, and tech overrides.\nYour saved named versions will be preserved.\n\nThis action cannot be undone.')) return;
  const cl = obj => Object.keys(obj).forEach(k => delete obj[k]);
  cl(salaryOverrides); cl(y2SalaryOverrides); cl(y3SalaryOverrides);
  cl(fteOverrides);    cl(startMonthOverrides); cl(endMonthOverrides);
  cl(titleOverrides);  cl(noteOverrides);     cl(mergeExtras);
  cl(techOverrides);   cl(revenueOverrides);  cl(streamNoteOverrides); cl(streamNameOverrides);
  hiddenRoleIds.clear();
  Object.keys(userRoles).forEach(k => delete userRoles[k]);
  userTechRows.length = 0;
  userStreams.length = 0;
  nextCustomId = 1; nextRevId = 1;
  contingency = 20; version = '2d';
  const slider = document.getElementById('contingency-slider'); if (slider) slider.value = 20;
  const pctEl  = document.getElementById('contingency-pct');   if (pctEl)  pctEl.textContent = '20%';
  document.querySelectorAll('.vtab').forEach((el, i) => el.classList.toggle('active', i === 0));
  ['cc-grades','cc-subjects','cc-units','cc-lessons'].forEach((id, i) => {
    const el = document.getElementById(id); if (el) el.value = [3,3,10,5][i];
  });
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
  recalcAll();
  updateVersionBar();
}

function saveVersion() {
  const name = prompt('Name this version:\n(e.g. "Seed Deck v1", "Board Meeting Draft", "Pre-hire assumptions")');
  if (!name || !name.trim()) return;
  try {
    const versions = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]');
    const y1p = SECTIONS.reduce((s,sec)=>s+getSectionTotal(sec,1),0) * 1.22;
    const r1  = getAllStreams().reduce((s,x)=>s+getRV(x,1),0);
    versions.unshift({
      id: Date.now().toString(),
      name: name.trim(),
      timestamp: new Date().toISOString(),
      summary: fmt(y1p) + ' Y1 burn | ' + fmt(r1) + ' Y1 revenue | ' + (version === '2d' ? '2.5D' : '3D'),
      state: captureState(),
    });
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
    updateVersionBar();
    showVersionsPanel();
  } catch(e) { alert('Error saving version. localStorage may be full.'); }
}

function loadVersion(id) {
  if (!confirm('Load this version?\n\nYour current state will be pushed to undo history first so you can get back to it.')) return;
  try {
    const versions = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]');
    const v = versions.find(x => x.id === id); if (!v) return;
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    hist.unshift(captureState());
    if (hist.length > MAX_HISTORY) hist.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    applyState(v.state);
    saveCurrentState();
    recalcAll();
    updateVersionBar();
    closeVersionsPanel();
  } catch(e) { console.warn('Load version failed:', e); }
}

function deleteVersion(id) {
  if (!confirm('Permanently delete this saved version?')) return;
  try {
    let versions = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]');
    versions = versions.filter(x => x.id !== id);
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
    renderVersionsList();
    updateVersionBar();
  } catch(e) {}
}

function updateVersionBar() {
  try {
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const vers = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]');
    const btn = document.getElementById('btn-undo');
    if (btn) { btn.disabled = hist.length === 0; btn.textContent = hist.length ? '↩ Undo (' + hist.length + ')' : '↩ Undo'; }
    const vc = document.getElementById('version-count');
    if (vc) vc.textContent = vers.length ? String(vers.length) : '';
  } catch(e) {}
}

function showVersionsPanel() {
  renderVersionsList();
  const m = document.getElementById('versions-modal'); if (m) m.classList.add('open');
}

function closeVersionsPanel() {
  const m = document.getElementById('versions-modal'); if (m) m.classList.remove('open');
}

function renderVersionsList() {
  const list = document.getElementById('versions-list'); if (!list) return;
  try {
    const versions = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]');
    const hist     = JSON.parse(localStorage.getItem(HISTORY_KEY)  || '[]');
    if (!versions.length && !hist.length) {
      list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:20px 0;text-align:center;">No saved versions yet.<br>Click <strong style="color:var(--teal-lt)">＋ Save Version</strong> to capture the current state.</div>';
      return;
    }
    let html = '';
    if (hist.length) {
      html += '<div style="margin-bottom:18px;"><div class="vm-section-label">Undo History (' + hist.length + ' of ' + MAX_HISTORY + ' steps)</div>';
      hist.forEach((snap, i) => {
        try {
          const s = JSON.parse(snap);
          const ovCount = Object.keys(s.salaryOverrides||{}).length + Object.keys(s.fteOverrides||{}).length + Object.keys(s.techOverrides||{}).length;
          html += '<div class="version-item" style="opacity:0.65;"><div class="version-meta"><div class="version-name" style="font-size:12px;">' + (i === 0 ? 'Previous state' : (i + 1) + ' steps back') + '</div><div class="version-date">' + ovCount + ' override' + (ovCount !== 1 ? 's' : '') + ' active at that point</div></div><button class="v-btn" onclick="closeVersionsPanel();undoLastChange()" style="' + (i > 0 ? 'display:none' : '') + '">Undo to here</button></div>';
        } catch(e) {
          html += '<div class="version-item" style="opacity:0.65;"><div class="version-meta"><div class="version-name" style="font-size:12px;">Step ' + (i+1) + '</div></div></div>';
        }
      });
      html += '</div>';
    }
    if (versions.length) {
      html += '<div class="vm-section-label">Saved Versions (' + versions.length + ')</div>';
      versions.forEach(v => {
        const d   = new Date(v.timestamp);
        const ts  = d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) + ' · ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        html += '<div class="version-item"><div class="version-meta"><div class="version-name">' + escHtml(v.name) + '</div><div class="version-date">' + ts + '</div>' + (v.summary ? '<div class="version-date" style="color:var(--teal-lt);margin-top:2px;">' + escHtml(v.summary) + '</div>' : '') + '</div><button class="v-btn" onclick="loadVersion(\'' + v.id + '\')">Load</button><button class="v-btn danger" onclick="deleteVersion(\'' + v.id + '\')">Delete</button></div>';
      });
    }
    list.innerHTML = html;
  } catch(e) { list.innerHTML = '<div style="color:var(--coral-lt);font-size:12px;">Error reading versions from storage.</div>'; }
}

// ============================================================
// CURRICULUM
// ============================================================
function getCurriculum() {
  return {
    grades:   parseInt(document.getElementById('cc-grades')?.value   || 3),
    subjects: parseInt(document.getElementById('cc-subjects')?.value || 3),
    units:    parseInt(document.getElementById('cc-units')?.value     || 10),
    lessons:  parseInt(document.getElementById('cc-lessons')?.value  || 5),
  };
}
function getTotalUnits()   { const c = getCurriculum(); return c.grades * c.subjects * c.units; }
function getTotalLessons() { return getTotalUnits() * getCurriculum().lessons; }

function updateCurriculum() {
  markChange();
  const totalUnits   = getTotalUnits();
  const totalLessons = getTotalLessons();
  if (document.getElementById('cc-total-units'))   document.getElementById('cc-total-units').textContent   = totalUnits;
  if (document.getElementById('cc-total-lessons')) document.getElementById('cc-total-lessons').textContent = totalLessons;
  if (document.getElementById('cc-cinematics'))    document.getElementById('cc-cinematics').textContent    = totalUnits;
  if (document.getElementById('cc-songs'))         document.getElementById('cc-songs').textContent         = totalLessons;
  if (document.getElementById('cc-scores'))        document.getElementById('cc-scores').textContent        = totalUnits;
  recalcAll();
}

// ============================================================
// RENDER ROLE TABLE
// ============================================================
function renderRoleTable(tableId, roles, v) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return 0;
  const section = tableId.replace('tbl-', '');
  tbody.innerHTML = '';

  const allRoles = getSectionRoles(section);
  let sectionTotalYear1 = 0;

  const isUserRole = id => (userRoles[section] || []).some(r => r.id === id);

  allRoles.forEach(r => {
    if (hiddenRoleIds.has(r.id)) return;
    const fte    = resolveFte(r, v);
    if (fte === 0) return;

    const sal    = resolveAnnualSalary(r, v, 1);
    const sal2   = resolveAnnualSalary(r, v, 2);
    const sal3   = resolveAnnualSalary(r, v, 3);

    const sm     = getEffectiveStartMonth(r);
    const em     = getEffectiveEndMonth(r);

    const paidY1 = proratedCostForYear(fte, sal, sm, em, 1);
    sectionTotalYear1 += paidY1;

    const title  = titleOverrides[r.id] || r.role;
    const note   = noteOverrides[r.id]  || r.note;
    const extras = mergeExtras[r.id]    || [];
    const combinedNote = extras.length ? note + extras.map(e => `\n\n[Merged from ${e.title}]: ${e.note}`).join('') : note;

    const smOpts = Array.from({length:36}, (_,i) => `<option value="${i+1}"${sm===i+1?' selected':''}>${i+1}</option>`).join('');
    const emOpts = Array.from({length:36}, (_,i) => `<option value="${i+1}"${em===i+1?' selected':''}>${i+1}</option>`).join('');

    const deleteBtn = isUserRole(r.id)
      ? `<button onclick="removeUserRole('${r.id}')" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:16px;padding:2px 4px;line-height:1;flex-shrink:0;" title="Remove role">✕</button>`
      : '';

    const tr = document.createElement('tr');
    if (isUserRole(r.id)) tr.style.background = 'rgba(255,255,255,0.02)';
    tr.draggable = true;
    tr.dataset.roleId  = r.id;
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:flex-start;gap:6px;">
          <span class="drag-handle">⠿</span>
          <div style="flex:1;">
            <input class="role-title-input" value="${escHtml(title)}" oninput="updateRoleTitle('${r.id}', this.value)">
            <textarea class="role-note-textarea" oninput="updateRoleNote('${r.id}', this.value);autoResize(this)">${escHtml(combinedNote)}</textarea>
          </div>
          ${deleteBtn}
        </div>
      </td>
      <td><span class="badge badge-${r.badge}">${r.dept}</span></td>
      <td><input class="num-input" type="number" step="0.5" value="${fte}" oninput="updateFte('${r.id}', this.value)"></td>
      <td>
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="display:flex;align-items:center;gap:4px;"><span class="year-tag">Y1</span><input class="num-input" type="number" step="1000" value="${sal}" oninput="updateSalYearly('${r.id}', 1, this.value)" style="width:85px;"></div>
          <div style="display:flex;align-items:center;gap:4px;"><span class="year-tag">Y2</span><input class="num-input" type="number" step="1000" value="${sal2}" oninput="updateSalYearly('${r.id}', 2, this.value)" style="width:85px;"></div>
          <div style="display:flex;align-items:center;gap:4px;"><span class="year-tag">Y3</span><input class="num-input" type="number" step="1000" value="${sal3}" oninput="updateSalYearly('${r.id}', 3, this.value)" style="width:85px;"></div>
        </div>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div class="mo-label">Start</div><select class="num-input" onchange="updateStartMonth('${r.id}', this.value)">${smOpts}</select>
          <div class="mo-label">Stop</div><select class="num-input" onchange="updateEndMonth('${r.id}', this.value)">${emOpts}</select>
        </div>
      </td>
      <td class="annual-cell" id="annual-${r.id}">${fmt(paidY1)}<div style="font-size:9px;color:var(--text3);margin-top:2px;">${getLifespanDesc(sm, em, 1)}</div></td>
    `;
    tr.addEventListener('dragstart', onRoleDragStart);
    tr.addEventListener('dragover',  onRoleDragOver);
    tr.addEventListener('drop',      onRoleDrop);
    tbody.appendChild(tr);
  });

  const sub = document.createElement('tr');
  sub.className = 'subtotal-row';
  sub.innerHTML = `<td colspan="5" align="right">Subtotal Year 1</td><td id="subtotal-${tableId}">${fmt(sectionTotalYear1)}</td>`;
  tbody.appendChild(sub);
  return sectionTotalYear1;
}

// ── Handlers ─────────────────────────────────────────────────
function updateRoleTitle(id, val) { markChange(); titleOverrides[id] = val; }
function updateRoleNote(id, val)  { markChange(); noteOverrides[id] = val; }
function updateFte(id, val)       { markChange(); fteOverrides[id] = parseFloat(val) || 0; recalcAll(); }
function updateSalYearly(id, y, val) {
  markChange();
  const v = parseFloat(val) || 0;
  if(y===1) salaryOverrides[id]=v; if(y===2) y2SalaryOverrides[id]=v; if(y===3) y3SalaryOverrides[id]=v;
  recalcAll();
}
function updateStartMonth(id, val) { markChange(); startMonthOverrides[id] = parseInt(val) || 1; recalcAll(); }
function updateEndMonth(id, val)   { markChange(); endMonthOverrides[id]   = parseInt(val) || 36; recalcAll(); }

// ============================================================
// RENDER TECH TABLE
// ============================================================
function getTV(t, field) {
  const ov = techOverrides[t.id] || {};
  if (ov[field] !== undefined) return ov[field];
  return t[field];
}

function renderTechTable(v) {
  const tbody = document.getElementById('tbl-tech');
  if (!tbody) return 0;
  tbody.innerHTML = '';
  const dataRows = TECH_COSTS[v] || [];
  const totalLessons = getTotalLessons();
  let totalY1 = 0;

  const allTechRows = [...dataRows, ...userTechRows.map(r => ({ ...r, _user: true }))];

  allTechRows.forEach(t => {
    const sm = getTV(t, 'startMonth');
    const em = getTV(t, 'endMonth');
    const q  = getTV(t, 'qty') === 'lessons' ? totalLessons : getTV(t, 'qty');
    const u1 = getTV(t, 'unitCost');
    const u2 = getTV(t, 'y2Cost') || u1 * 1.5;
    const u3 = getTV(t, 'y3Cost') || u2 * 1.5;

    const activeMonthsY1 = Math.max(0, Math.min(12, em) - Math.max(1, sm) + 1);
    const actualY1 = t.unit === 'mo' ? u1 * activeMonthsY1 : (sm <= 12 ? q * u1 : 0);
    totalY1 += actualY1;

    const smOpts = Array.from({length:36},(_,i)=>`<option value="${i+1}"${sm===i+1?' selected':''}>${i+1}</option>`).join('');
    const emOpts = Array.from({length:36},(_,i)=>`<option value="${i+1}"${em===i+1?' selected':''}>${i+1}</option>`).join('');

    const deleteBtn = t._user
      ? `<button onclick="removeUserTechRow('${t.id}')" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:16px;padding:2px 4px;line-height:1;" title="Remove row">✕</button>`
      : '';

    const tr = document.createElement('tr');
    if (t._user) tr.style.background = 'rgba(255,255,255,0.02)';
    tr.innerHTML = `
      <td><input class="tech-input" value="${escHtml(getTV(t,'cat'))}" style="width:100%;" onchange="updateTechField('${t.id}','cat',this.value)"></td>
      <td><input class="tech-input" value="${escHtml(getTV(t,'svc'))}" style="width:100%;font-weight:600;" onchange="updateTechField('${t.id}','svc',this.value)"></td>
      <td>
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="display:flex;align-items:center;gap:4px;"><span class="year-tag">Y1</span><input class="num-input" type="number" value="${u1}" oninput="updateTechField('${t.id}','unitCost',this.value)" style="width:85px;"></div>
          <div style="display:flex;align-items:center;gap:4px;"><span class="year-tag">Y2</span><input class="num-input" type="number" value="${u2}" oninput="updateTechField('${t.id}','y2Cost',this.value)" style="width:85px;"></div>
          <div style="display:flex;align-items:center;gap:4px;"><span class="year-tag">Y3</span><input class="num-input" type="number" value="${u3}" oninput="updateTechField('${t.id}','y3Cost',this.value)" style="width:85px;"></div>
        </div>
      </td>
      <td>
        <div class="mo-pair">Start <select class="tech-input" onchange="updateTechField('${t.id}','startMonth',this.value)">${smOpts}</select></div>
        <div class="mo-pair" style="margin-top:4px;">Stop <select class="tech-input" onchange="updateTechField('${t.id}','endMonth',this.value)">${emOpts}</select></div>
      </td>
      <td><input class="num-input" type="number" value="${q}" oninput="updateTechField('${t.id}','qty',this.value)" style="width:50px;"> <span style="font-size:10px">${getTV(t,'unit')||t.unit}</span></td>
      <td class="annual-cell">${fmt(actualY1)}</td>
      <td style="display:flex;align-items:flex-start;gap:4px;"><textarea class="tech-note-textarea" style="flex:1;" oninput="updateTechField('${t.id}','note',this.value)">${escHtml(getTV(t,'note')||'')}</textarea>${deleteBtn}</td>
    `;
    tbody.appendChild(tr);
  });

  const sub = document.createElement('tr');
  sub.className = 'subtotal-row';
  sub.innerHTML = `<td colspan="5" align="right">Tech Subtotal Year 1</td><td id="subtotal-tbl-tech">${fmt(totalY1)}</td><td></td>`;
  tbody.appendChild(sub);
  renderTechComparisonPanel(v);
  return totalY1;
}

function updateTechField(id, field, val) {
  markChange();
  if(!techOverrides[id]) techOverrides[id] = {};
  techOverrides[id][field] = ['unitCost','y2Cost','y3Cost','qty','startMonth','endMonth'].includes(field) ? parseFloat(val) : val;
  recalcAll();
}

function addRole(section) {
  markChange();
  if (!userRoles[section]) userRoles[section] = [];
  const id = 'custom-' + (nextCustomId++);
  userRoles[section].push({
    id, role: 'New Role', dept: 'Custom', badge: 'ops',
    fte: 1, salary: 100000, note: '',
    startMonth: 1, endMonth: 36,
  });
  recalcAll();
}

function removeUserRole(id) {
  markChange();
  for (const sec of SECTIONS) {
    if (userRoles[sec]) {
      const idx = userRoles[sec].findIndex(r => r.id === id);
      if (idx !== -1) { userRoles[sec].splice(idx, 1); break; }
    }
  }
  recalcAll();
}

function addUserTechRow() {
  markChange();
  const id = 'tech-custom-' + (nextRevId++);
  userTechRows.push({
    id, cat: 'Other', svc: 'New Line Item', unit: 'mo',
    qty: 1, unitCost: 0, y2Cost: 0, y3Cost: 0,
    startMonth: 1, endMonth: 36, note: '',
  });
  recalcAll();
}

function removeUserTechRow(id) {
  markChange();
  const idx = userTechRows.findIndex(r => r.id === id);
  if (idx !== -1) { userTechRows.splice(idx, 1); recalcAll(); }
}

// ============================================================
// OUTLOOK & REVENUE
// ============================================================
function getRV(stream, year) {
  const key = `y${year}`;
  if(revenueOverrides[`${stream.id}-${key}`] !== undefined) return revenueOverrides[`${stream.id}-${key}`];
  return stream[key] || 0;
}

function addRevenueStream() {
  markChange();
  const id = 'rev-custom-' + (nextRevId++);
  userStreams.push({ id, name: 'New Revenue Stream', note: '', y1: 0, y2: 0, y3: 0, _user: true });
  recalcAll();
}

function removeRevenueStream(id) {
  markChange();
  const idx = userStreams.findIndex(s => s.id === id);
  if (idx !== -1) userStreams.splice(idx, 1);
  recalcAll();
}

function renderRevenueTab() {
  const tbody = document.getElementById('tbl-revenue-metrics');
  if(!tbody) return;
  tbody.innerHTML = getAllStreams().map(s => {
    const isUser = !!s._user;
    const name = streamNameOverrides[s.id] !== undefined ? streamNameOverrides[s.id] : s.name;
    const note = streamNoteOverrides[s.id] !== undefined ? streamNoteOverrides[s.id] : (s.note || '');
    const deleteBtn = isUser ? `<button onclick="removeRevenueStream('${s.id}')" style="background:none;border:none;color:var(--coral-lt);cursor:pointer;font-size:14px;padding:0 4px;float:right;" title="Remove stream">✕</button>` : '';
    return `
    <tr>
      <td style="vertical-align:top;width:52%;">
        ${deleteBtn}
        <input class="role-title-input" value="${escHtml(name)}" oninput="updateStreamName('${s.id}',this.value)" style="font-size:13px;font-weight:600;margin-bottom:6px;">
        <textarea class="role-note-textarea" style="min-height:80px;font-size:11px;" oninput="updateStreamNote('${s.id}',this.value);autoResize(this)">${escHtml(note)}</textarea>
      </td>
      <td align="right" style="vertical-align:top;padding-top:6px;"><input class="num-input" type="number" value="${getRV(s,1)}" oninput="updateRevVal('${s.id}',1,this.value)" style="width:100px;"></td>
      <td align="right" style="vertical-align:top;padding-top:6px;"><input class="num-input" type="number" value="${getRV(s,2)}" oninput="updateRevVal('${s.id}',2,this.value)" style="width:100px;"></td>
      <td align="right" style="vertical-align:top;padding-top:6px;"><input class="num-input" type="number" value="${getRV(s,3)}" oninput="updateRevVal('${s.id}',3,this.value)" style="width:110px;color:var(--teal-lt)"></td>
    </tr>
  `}).join('');

  const allS = getAllStreams();
  const rv1 = allS.reduce((sum,x)=>sum+getRV(x,1),0);
  const rv2 = allS.reduce((sum,x)=>sum+getRV(x,2),0);
  const rv3 = allS.reduce((sum,x)=>sum+getRV(x,3),0);
  const rcards = document.getElementById('revenue-summary-cards');
  if(rcards) rcards.innerHTML =
    `<div class="summary-card"><div class="sc-label">Year 1 Revenue</div><div class="sc-val">${fmt(rv1)}</div><div class="sc-sub">${allS.filter(x=>getRV(x,1)>0).length} active stream${allS.filter(x=>getRV(x,1)>0).length!==1?'s':''}</div></div>` +
    `<div class="summary-card"><div class="sc-label">Year 2 Revenue</div><div class="sc-val" style="color:var(--amber-lt)">${fmt(rv2)}</div><div class="sc-sub">${allS.filter(x=>getRV(x,2)>0).length} active streams</div></div>` +
    `<div class="summary-card"><div class="sc-label">Year 3 Revenue</div><div class="sc-val" style="color:var(--teal-lt)">${fmt(rv3)}</div><div class="sc-sub">${allS.filter(x=>getRV(x,3)>0).length} active streams</div></div>` +
    `<div class="summary-card"><div class="sc-label">3-Year Total</div><div class="sc-val" style="color:var(--purple-lt)">${fmt(rv1+rv2+rv3)}</div><div class="sc-sub">across all engines</div></div>`;
}

function updateStreamName(id, val) { markChange(); streamNameOverrides[id] = val; }
function updateStreamNote(id, val)  { markChange(); streamNoteOverrides[id] = val; }
function updateRevVal(id, y, v) { markChange(); revenueOverrides[`${id}-y${y}`] = parseFloat(v)||0; recalcAll(); }

function renderOutlookTab() {
  const tbody = document.getElementById('tbl-outlook-body');
  if(!tbody) return;
  
  const y1p = SECTIONS.reduce((s,sec)=>s+getSectionTotal(sec,1),0) * 1.22;
  const y2p = SECTIONS.reduce((s,sec)=>s+getSectionTotal(sec,2),0) * 1.22;
  const y3p = SECTIONS.reduce((s,sec)=>s+getSectionTotal(sec,3),0) * 1.22;

  const totalLessons = getTotalLessons();
  const getTechYearTotal = (yNum) => {
    const allRows = [...(TECH_COSTS[version] || []), ...userTechRows];
    return allRows.reduce((sum, t) => {
      const sm=getTV(t,'startMonth'), em=getTV(t,'endMonth'), q=getTV(t,'qty')==='lessons'?totalLessons:getTV(t,'qty');
      const u1=getTV(t,'unitCost'), u2=getTV(t,'y2Cost')||u1*1.5, u3=getTV(t,'y3Cost')||u2*1.5;
      const curU = yNum===1?u1 : (yNum===2?u2 : u3);
      const yearStart = (yNum-1)*12+1, yearEnd = yNum*12;
      if(t.unit==='mo') {
        const am = Math.max(0, Math.min(yearEnd, em) - Math.max(yearStart, sm) + 1);
        return sum + (am * curU);
      } else {
        return sum + (sm >= yearStart && sm <= yearEnd ? q * curU : 0);
      }
    }, 0);
  };

  const y1t = getTechYearTotal(1), y2t = getTechYearTotal(2), y3t = getTechYearTotal(3);
  const r1 = getAllStreams().reduce((sum,s)=>sum+getRV(s,1),0);
  const r2 = getAllStreams().reduce((sum,s)=>sum+getRV(s,2),0);
  const r3 = getAllStreams().reduce((sum,s)=>sum+getRV(s,3),0);

  const row = (l,v1,v2,v3,h=false) => `<tr style="${h?'background:rgba(255,255,255,0.05);font-weight:700':''}"><td>${l}</td><td align="right">${fmt(v1)}</td><td align="right">${fmt(v2)}</td><td align="right">${fmt(v3)}</td><td align="right" style="font-weight:600">${fmt(v1+v2+v3)}</td></tr>`;
  tbody.innerHTML = row('Total Revenue',r1,r2,r3,true)+row('Personnel & Benefits',y1p,y2p,y3p)+row('Infrastructure & Tech',y1t,y2t,y3t)+row('Total OpEx (Burn)',y1p+y1t,y2p+y2t,y3p+y3t,true)+row('Net Income / (Loss)',r1-(y1p+y1t),r2-(y2p+y2t),r3-(y3p+y3t),true);
}

// ============================================================
// MAIN RECALC
// ============================================================
function recalcAll() {
  SECTIONS.forEach(sec => renderRoleTable('tbl-' + sec, ROLES[sec] || [], version));
  const t1 = renderTechTable(version);
  renderRevenueTab();
  renderOutlookTab();
  recalcSectionTotals();
  
  // Per-section breakdown for summary cards
  const sectionDefs = [
    { key:'leadership',  label:'Leadership',            color:'var(--purple-lt)' },
    { key:'engineering', label:'Engineering & Product', color:'var(--blue-lt)'   },
    { key:'content',     label:'Content & Creative',    color:'var(--amber-lt)'  },
    { key:'ops',         label:'Operations & GTM',      color:'var(--coral-lt)'  },
    { key:'world',       label:'World & Collectibles',  color:'var(--purple-lt)' },
  ];
  let salarySubtotal = 0;
  const cardHtml = sectionDefs.map(c => {
    const cost = getSectionTotal(c.key, 1);
    salarySubtotal += cost;
    const { totalFte, roleCount } = getSummaryFteInfo(c.key);
    const fteStr = totalFte % 1 === 0 ? totalFte : totalFte.toFixed(1);
    return `<div class="summary-card"><div class="sc-label">${c.label}</div><div class="sc-val" style="color:${c.color}">${fmt(cost)}</div><div class="sc-sub">${fteStr} FTE · ${roleCount} role${roleCount !== 1 ? 's' : ''}</div></div>`;
  });
  const benefits = salarySubtotal * 0.22;
  const techLineCount = (TECH_COSTS[version] || []).length + userTechRows.length;
  cardHtml.push(`<div class="summary-card"><div class="sc-label">Infrastructure & Tech</div><div class="sc-val" style="color:var(--teal-lt)">${fmt(t1)}</div><div class="sc-sub">${techLineCount} line items</div></div>`);
  cardHtml.push(`<div class="summary-card"><div class="sc-label">Benefits & Payroll (22%)</div><div class="sc-val" style="color:var(--text3)">${fmt(benefits)}</div><div class="sc-sub">Applied to salary only</div></div>`);

  const p1 = salarySubtotal + benefits;
  const base = p1 + t1;
  const grand = base + (base * contingency/100);
  cardHtml.push(`<div class="summary-card" style="border-color:var(--teal-lt);"><div class="sc-label">Total Year 1 Burn</div><div class="sc-val" style="color:var(--teal-lt)">${fmt(grand)}</div><div class="sc-sub">${contingency}% contingency included</div></div>`);

  const tbTotal = document.getElementById('topbar-total'); if(tbTotal) tbTotal.textContent = fmt(grand);
  const gTotal = document.getElementById('grand-total'); if(gTotal) gTotal.textContent = fmt(grand);
  const gSub = document.getElementById('grand-total-sub'); if(gSub) gSub.textContent = `Salary: ${fmt(salarySubtotal)} | Benefits (22%): ${fmt(benefits)} | Tech: ${fmt(t1)} | Contingency (${contingency}%): ${fmt(base*contingency/100)}`;

  const cards = document.getElementById('summary-cards');
  if(cards) cards.innerHTML = cardHtml.join('');
  
  renderPhaseGrid(grand);
  renderRisks();
  renderRunway(grand);
  saveCurrentState();
  updateVersionBar();
}

function recalcSectionTotals() {
  SECTIONS.forEach(sec => {
    const t = getSectionTotal(sec, 1);
    const subEl = document.getElementById('subtotal-tbl-' + sec); if(subEl) subEl.textContent = fmt(t);
    const secEl = document.getElementById('section-total-' + sec); if(secEl) secEl.textContent = fmt(t);
  });
  const allTechForTotal = [...(TECH_COSTS[version] || []), ...userTechRows];
  const techTotal = allTechForTotal.reduce((sum, t) => {
    const sm=getTV(t,'startMonth'), em=getTV(t,'endMonth'), uc=getTV(t,'unitCost'), q=getTV(t,'qty')==='lessons'?getTotalLessons():getTV(t,'qty');
    return sum + (t.unit==='mo' ? uc * Math.max(0, Math.min(12, em) - Math.max(1, sm) + 1) : (sm<=12 ? q*uc : 0));
  }, 0);
  const st = document.getElementById('section-total-tech'); if(st) st.textContent = fmt(techTotal);
}

// ============================================================
// DYNAMIC TIMELINE & RISKS
// ============================================================
function renderPhaseGrid(grand) {
  const container = document.getElementById('phase-grid'); if(!container) return;
  container.innerHTML = PHASES.map(ph => `
    <div class="phase-card">
      <div class="ph-num">${ph.num}</div><div class="ph-title">${ph.title}</div>
      <div class="ph-dur">${ph.dur}</div>
      <div class="ph-items">${(version==='3d'?ph.items3d:ph.items2d).map(item => `<div class="phase-item">${item}</div>`).join('')}</div>
    </div>
  `).join('');
}

function renderRisks() {
  const list = document.getElementById('risk-list'); if(!list) return;
  list.innerHTML = KEY_RISKS.map(r => `
    <div class="risk-card">
      <div class="risk-header"><span class="severity-badge severity-${r.severity}">${r.severity}</span><span class="risk-title">${r.title}</span></div>
      <div class="risk-body">${r.description}</div>
      <div class="risk-section-label">Impact</div><div class="risk-body">${r.impact}</div>
      <div class="risk-section-label" style="color:var(--teal-lt)">Mitigation</div><div class="risk-body" style="color:var(--teal-lt)">${r.mitigation}</div>
    </div>
  `).join('');
}

function renderRunway(grand) {
  const container = document.getElementById('runway-cards'); if(!container) return;
  const m = grand / 12;
  container.innerHTML = `
    <div class="runway-card"><div class="sc-label">Monthly Burn</div><div class="sc-val">${fmt(m)}</div></div>
    <div class="runway-card"><div class="sc-label">18-Mo Raise Req</div><div class="sc-val" style="color:var(--amber-lt)">${fmt(grand * 1.5)}</div></div>
  `;
}

// ============================================================
// EXCEL EXPORT
// ============================================================
async function exportToExcel() {
  const workbook = new ExcelJS.Workbook();
  const totalLessons = getTotalLessons();

  // ── PERSONNEL PLAN ─────────────────────────────────────────
  // Columns: A=Role  B=Description  C=Dept  D=FTE  E=Y1Sal  F=Y2Sal  G=Y3Sal  H=Start  I=End  J=Y1Paid  K=Y2Paid  L=Y3Paid
  const persSheet = workbook.addWorksheet('Personnel Plan');
  persSheet.columns = [
    {header:'Role Title',        key:'role', width:30},
    {header:'Description',       key:'desc', width:55},
    {header:'Department',        key:'dept', width:16},
    {header:'FTE',               key:'fte',  width:8 },
    {header:'Y1 Annual Salary',  key:'s1',   width:15},
    {header:'Y2 Annual Salary',  key:'s2',   width:15},
    {header:'Y3 Annual Salary',  key:'s3',   width:15},
    {header:'Start Month',       key:'st',   width:10},
    {header:'End Month',         key:'en',   width:10},
    {header:'Y1 Paid Cost',      key:'p1',   width:15},
    {header:'Y2 Paid Cost',      key:'p2',   width:15},
    {header:'Y3 Paid Cost',      key:'p3',   width:15},
  ];
  let pRow = 2;
  SECTIONS.forEach(sec => {
    getSectionRoles(sec).forEach(r => {
      if (hiddenRoleIds.has(r.id)) return;
      const fte = resolveFte(r, version); if (fte === 0) return;
      const baseNote = noteOverrides[r.id] || r.note || '';
      const extras   = mergeExtras[r.id] || [];
      const fullDesc = extras.length ? baseNote + extras.map(e => ' | Merged: ' + e.title + ' — ' + e.note).join('') : baseNote;
      persSheet.addRow({ role:titleOverrides[r.id]||r.role, desc:fullDesc, dept:r.dept||'', fte,
        s1:resolveAnnualSalary(r,version,1), s2:resolveAnnualSalary(r,version,2), s3:resolveAnnualSalary(r,version,3),
        st:getEffectiveStartMonth(r), en:getEffectiveEndMonth(r) });
      persSheet.getCell('J'+pRow).value = {formula:'D'+pRow+'*E'+pRow+'*MAX(0,MIN(12,I'+pRow+')-MAX(1,H'+pRow+')+1)/12'};
      persSheet.getCell('K'+pRow).value = {formula:'D'+pRow+'*F'+pRow+'*MAX(0,MIN(24,I'+pRow+')-MAX(13,H'+pRow+')+1)/12'};
      persSheet.getCell('L'+pRow).value = {formula:'D'+pRow+'*G'+pRow+'*MAX(0,MIN(36,I'+pRow+')-MAX(25,H'+pRow+')+1)/12'};
      persSheet.getCell('B'+pRow).alignment = {wrapText:true, vertical:'top'};
      pRow++;
    });
  });
  const pTotalRow = pRow;
  persSheet.addRow({role:'TOTAL PERSONNEL (pre-benefits)'});
  ['J','K','L'].forEach(c => persSheet.getCell(c+pTotalRow).value = {formula:'SUM('+c+'2:'+c+(pTotalRow-1)+')'});

  // ── INFRASTRUCTURE ─────────────────────────────────────────
  // Columns: A=Cat  B=Service  C=Description  D=Unit  E=Qty  F=Y1Cost  G=Y2Cost  H=Y3Cost  I=Start  J=End  K=Y1Total  L=Y2Total  M=Y3Total
  const techSheet = workbook.addWorksheet('Infrastructure');
  techSheet.columns = [
    {header:'Category',          key:'cat',  width:18},
    {header:'Service',           key:'svc',  width:28},
    {header:'Description',       key:'desc', width:50},
    {header:'Unit',              key:'un',   width:10},
    {header:'Qty',               key:'qty',  width:8 },
    {header:'Y1 Unit Cost',      key:'c1',   width:14},
    {header:'Y2 Unit Cost',      key:'c2',   width:14},
    {header:'Y3 Unit Cost',      key:'c3',   width:14},
    {header:'Start Month',       key:'st',   width:10},
    {header:'End Month',         key:'en',   width:10},
    {header:'Y1 Total',          key:'t1',   width:14},
    {header:'Y2 Total',          key:'t2',   width:14},
    {header:'Y3 Total',          key:'t3',   width:14},
  ];
  let tRow = 2;
  TECH_COSTS[version].forEach(t => {
    const sm=getTV(t,'startMonth'), em=getTV(t,'endMonth');
    const q =getTV(t,'qty')==='lessons'?totalLessons:getTV(t,'qty');
    const u1=getTV(t,'unitCost'), u2=getTV(t,'y2Cost')||u1*1.5, u3=getTV(t,'y3Cost')||u2*1.5;
    const desc=(techOverrides[t.id]&&techOverrides[t.id].note!==undefined)?techOverrides[t.id].note:(t.note||'');
    techSheet.addRow({cat:getTV(t,'cat'), svc:getTV(t,'svc'), desc, un:t.unit, qty:q, c1:u1, c2:u2, c3:u3, st:sm, en:em});
    if (t.unit === 'mo') {
      techSheet.getCell('K'+tRow).value = {formula:'E'+tRow+'*F'+tRow+'*MAX(0,MIN(12,J'+tRow+')-MAX(1,I'+tRow+')+1)'};
      techSheet.getCell('L'+tRow).value = {formula:'E'+tRow+'*G'+tRow+'*MAX(0,MIN(24,J'+tRow+')-MAX(13,I'+tRow+')+1)'};
      techSheet.getCell('M'+tRow).value = {formula:'E'+tRow+'*H'+tRow+'*MAX(0,MIN(36,J'+tRow+')-MAX(25,I'+tRow+')+1)'};
    } else {
      techSheet.getCell('K'+tRow).value = {formula:'IF(AND(I'+tRow+'>=1,I'+tRow+'<=12),E'+tRow+'*F'+tRow+',0)'};
      techSheet.getCell('L'+tRow).value = {formula:'IF(AND(I'+tRow+'>=13,I'+tRow+'<=24),E'+tRow+'*G'+tRow+',0)'};
      techSheet.getCell('M'+tRow).value = {formula:'IF(AND(I'+tRow+'>=25,I'+tRow+'<=36),E'+tRow+'*H'+tRow+',0)'};
    }
    techSheet.getCell('C'+tRow).alignment = {wrapText:true, vertical:'top'};
    tRow++;
  });
  const tTotalRow = tRow;
  techSheet.addRow({svc:'TOTAL INFRASTRUCTURE'});
  ['K','L','M'].forEach(c => techSheet.getCell(c+tTotalRow).value = {formula:'SUM('+c+'2:'+c+(tTotalRow-1)+')'});

  // ── REVENUE GROWTH ─────────────────────────────────────────
  // Columns: A=Stream  B=Pricing Model  C=Analysis  D=Y1  E=Y2  F=Y3  G=3-Year Total
  const revSheet = workbook.addWorksheet('Revenue Growth');
  revSheet.columns = [
    {header:'Revenue Stream',            key:'n',       width:28},
    {header:'Pricing Model',             key:'pricing', width:50},
    {header:'Analysis & Considerations', key:'analysis',width:65},
    {header:'Year 1',                    key:'y1',      width:14},
    {header:'Year 2',                    key:'y2',      width:14},
    {header:'Year 3',                    key:'y3',      width:14},
    {header:'3-Year Total',              key:'tot',     width:14},
  ];
  getAllStreams().forEach((s, i) => {
    const name  = streamNameOverrides[s.id]!==undefined ? streamNameOverrides[s.id] : s.name;
    const note  = streamNoteOverrides[s.id]!==undefined ? streamNoteOverrides[s.id] : (s.note || '');
    const parts = note.split('\nANALYSIS:');
    const pricing  = parts[0].replace(/^PRICING:\s*/,'').trim();
    const analysis = parts.length>1 ? parts[1].trim() : '';
    const rIdx = i+2;
    revSheet.addRow({n:name, pricing, analysis, y1:getRV(s,1), y2:getRV(s,2), y3:getRV(s,3)});
    revSheet.getCell('G'+rIdx).value = {formula:'D'+rIdx+'+E'+rIdx+'+F'+rIdx};
    revSheet.getCell('B'+rIdx).alignment = {wrapText:true, vertical:'top'};
    revSheet.getCell('C'+rIdx).alignment = {wrapText:true, vertical:'top'};
  });
  const rTotalRow = getAllStreams().length+2;
  revSheet.addRow({n:'TOTAL REVENUE'});
  ['D','E','F','G'].forEach(c => revSheet.getCell(c+rTotalRow).value = {formula:'SUM('+c+'2:'+c+(rTotalRow-1)+')'});

  // ── 3-YEAR OUTLOOK ─────────────────────────────────────────
  // Cross-sheet column references (updated for new column layouts above)
  const revCols  = ['D','E','F'];   // Revenue Growth  Y1/Y2/Y3 totals
  const persCols = ['J','K','L'];   // Personnel Plan  Y1/Y2/Y3 paid totals
  const techCols = ['K','L','M'];   // Infrastructure  Y1/Y2/Y3 totals
  const outlookSheet = workbook.addWorksheet('3-Year Outlook');
  outlookSheet.columns = [
    {header:'Financial Category',key:'l', width:34},
    {header:'Year 1',            key:'y1',width:16},
    {header:'Year 2',            key:'y2',width:16},
    {header:'Year 3',            key:'y3',width:16},
    {header:'3-Year Total',      key:'t', width:16},
  ];
  const outlookDefs = [
    {l:'Total Revenue',                     fn:(col,j)=>"'Revenue Growth'!"+revCols[j]+rTotalRow},
    {l:'Personnel & Benefits (22% loaded)', fn:(col,j)=>"'Personnel Plan'!"+persCols[j]+pTotalRow+'*1.22'},
    {l:'Infrastructure & Tech',             fn:(col,j)=>"'Infrastructure'!"+techCols[j]+tTotalRow},
    {l:'Total OpEx (Burn)',                 fn:(col,j)=>col+'3+'+col+'4'},
    {l:'Net Income / (Loss)',               fn:(col,j)=>col+'2-'+col+'5'},
  ];
  outlookDefs.forEach((od, i) => {
    const outRow = i+2;
    const r = outlookSheet.addRow({l:od.l});
    ['B','C','D'].forEach((col,j) => { r.getCell(col).value = {formula:od.fn(col,j)}; });
    r.getCell('E').value = {formula:'SUM(B'+outRow+':D'+outRow+')'};
  });

  // ── CALCULATIONS GUIDE ─────────────────────────────────────
  const calcSheet = workbook.addWorksheet('Calculations Guide');
  calcSheet.columns = [
    {header:'Section',                    key:'sec',  width:22},
    {header:'Formula Name',               key:'name', width:30},
    {header:'Formula / Rule',             key:'form', width:55},
    {header:'Plain English Explanation',  key:'expl', width:68},
    {header:'Example',                    key:'ex',   width:55},
  ];
  const calcRows = [
    ['PERSONNEL','','','',''],
    ['Personnel','Year Range Definition',
     'Y1 = Mo 1-12  |  Y2 = Mo 13-24  |  Y3 = Mo 25-36',
     'All months are numbered 1 through 36 across the full 3-year model. Year 1 covers months 1-12, Year 2 covers 13-24, Year 3 covers 25-36. A role starting at month 3 and ending at month 18 is active in all of Year 1 and the first 6 months of Year 2.',
     'Role: Start=Mo 3, End=Mo 18. Y1 active = Mo 3-12 (10 months). Y2 active = Mo 13-18 (6 months). Y3 active = none (0 months).'],
    ['Personnel','Active Months in Year',
     'MAX(0, MIN(YearEnd, StopMonth) - MAX(YearStart, StartMonth) + 1)',
     'Counts how many months within a given year a role is active. YearStart and YearEnd are the boundary months of the year being calculated. MAX(0,...) ensures the result is never negative when a role falls entirely outside the year.',
     'Role Start=3, Stop=15, Year 1 (bounds 1-12). Active = MAX(0, MIN(12,15) - MAX(1,3) + 1) = MAX(0, 12-3+1) = 10 months.'],
    ['Personnel','Y1 Prorated Cost (single role)',
     'FTE x Y1AnnualSalary x MAX(0,MIN(12,EndMonth)-MAX(1,StartMonth)+1) / 12',
     'Multiplies the FTE count by the annual salary, then scales by the fraction of Year 1 months the role is active. Dividing by 12 converts the annual salary into a per-month rate so partial-year roles are paid correctly.',
     '1 FTE, $165K/yr, Start=Mo 1, End=Mo 36: Y1 = 1x165000x12/12 = $165,000.  |  0.5 FTE, $160K, Start=Mo 4: Y1 = 0.5x160000x9/12 = $60,000.'],
    ['Personnel','Y2 Prorated Cost (single role)',
     'FTE x Y2AnnualSalary x MAX(0,MIN(24,EndMonth)-MAX(13,StartMonth)+1) / 12',
     'Same proration logic as Y1 applied to the Year 2 window (months 13-24) using the Y2 salary field. Y2 salary defaults to Y1 x 1.05 (5% merit increase) if not explicitly set in the model.',
     '1 FTE, $173,250 Y2 salary, Start=Mo 1, End=Mo 36: Y2 = 1x173250x12/12 = $173,250.  |  Role ending Mo 12: Y2 active = MAX(0,MIN(24,12)-MAX(13,1)+1) = MAX(0,12-13+1) = 0. No Y2 cost.'],
    ['Personnel','Y3 Prorated Cost (single role)',
     'FTE x Y3AnnualSalary x MAX(0,MIN(36,EndMonth)-MAX(25,StartMonth)+1) / 12',
     'Same logic for Year 3 (months 25-36). Y3 salary defaults to Y2 x 1.05 if not explicitly set. Roles with EndMonth < 25 contribute $0 in Year 3 — typically content production roles that sunset post-launch.',
     'Role ends at Mo 18. Y3 active = MAX(0,MIN(36,18)-MAX(25,1)+1) = MAX(0,18-25+1) = MAX(0,-6) = 0. No Y3 cost.'],
    ['Personnel','Y2 Salary Default',
     'Y1 Salary x 1.05 (5% annual merit increase)',
     'If a role has no explicit Y2 salary set, the model applies a 5% annual increase from Y1. Most roles have explicit Y2/Y3 salaries in the source data. Any value can be overridden inline in the web model.',
     'Lead Frontend Engineer: Y1=$165K. Y2 default = $165Kx1.05 = $173,250 (matches explicit y2sal field).'],
    ['Personnel','Y3 Salary Default',
     'Y2 Salary x 1.05',
     'If Y3 salary is not explicitly set, it defaults to the Y2 salary (whether explicit or computed) times 1.05. Roles that sunset before Year 3 have y3sal = 0 set explicitly in the model to prevent phantom cost projection.',
     'Music Director: Y1=$138K, Y2=$144,900, Y3=$152,145 (each year is explicit 5% step).'],
    ['Personnel','Benefits Loading (22%)',
     'PersonnelSubtotal x 1.22',
     '22% is added to all personnel salary costs to cover employer obligations: FICA ~7.65%, health insurance ~10%, 401k match ~4%. This rate is standard for a US early-stage startup. Benefits loading is NOT applied to infrastructure or tech costs.',
     'Y1 personnel subtotal = $4.2M. Loaded cost = $4.2M x 1.22 = $5.124M.'],

    ['INFRASTRUCTURE','','','',''],
    ['Infrastructure','Monthly Service Cost',
     'Qty x UnitCost x MAX(0, MIN(YearEnd, EndMonth) - MAX(YearStart, StartMonth) + 1)',
     'For services billed per month (unit = "mo"), cost equals qty times the monthly rate times the number of active months in the year. Uses the same overlap formula as personnel proration. No division by 12 because the rate is already monthly.',
     'Supabase: Qty=1, $400/mo, Start=1, End=36. Y1=1x400x12=$4,800.  |  Cloudflare Stream starts Mo 4: Y1=1x800xMAX(0,MIN(12,36)-MAX(1,4)+1)=1x800x9=$7,200.'],
    ['Infrastructure','One-Time / Annual Cost',
     'IF(StartMonth falls within year bounds, Qty x YearUnitCost, 0)',
     'For services billed annually or per-unit (yr, song, session), cost applies only in the year when StartMonth falls. Y2Cost and Y3Cost fields hold the explicit cost for those years. This correctly handles annual contracts that recur each year at a different rate.',
     'Compliance Audit: Qty=1, Y1=$10K, Start=Mo 10. Mo 10 is in Y1 (1-12) so Y1=$10,000. Y2Cost field=$15,000 so Y2=$15,000 (separate annual audit).'],
    ['Infrastructure','Y2/Y3 Cost Escalation',
     'Y2Cost field (defaults to Y1Cost x 1.5 if blank). Y3Cost field (defaults to Y2Cost x 1.5 if blank).',
     'Each line item has explicit Y2Cost and Y3Cost fields for scaled unit costs as the platform and user base grow. If these fields are blank, the model defaults to 1.5x the prior year as a conservative growth escalator reflecting user base expansion.',
     'Vercel: Y1=$200/mo, Y2Cost=$400/mo (explicit), Y3Cost=$800/mo (explicit). Y2 annual=400x12=$4,800.  |  If Y2Cost were blank: default=$200x1.5=$300/mo.'],

    ['REVENUE','','','',''],
    ['Revenue','Stream Annual Value',
     'Y1 / Y2 / Y3 fields per stream (directly entered or user-overridden in the web model)',
     'Each revenue stream has explicit Y1, Y2, Y3 projected cash receipt values. All values are editable inline in the Revenue Growth tab. Override values persist for the session. The Pricing Model and Analysis columns explain the assumptions behind each number.',
     'DTC Subscriptions: Y1=$60K (5% of 10K pilot users x $12/mo x ~10 months avg), Y2=$960K (8% of 100K users x $12/mo x 12 months), Y3=$4.8M (10% of 400K x $12/mo x 12).'],
    ['Revenue','Total Revenue per Year',
     'SUM of all 10 stream Y-values for the year',
     'All revenue streams (DTC, school licensing, district deals, sponsored rewards, AI premium, AI/data licensing, content/IP, social/influencer, events+merch, federal grants) are summed for each year.',
     'Y1 Total = $60K+$150K+$0+$50K+$0+$0+$0+$0+$25K+$0 = $285K'],
    ['Revenue','3-Year Stream Total',
     'Y1 + Y2 + Y3 for each stream row',
     'Summed horizontally to show the cumulative 3-year contribution of each revenue engine. Used in investor conversations to identify dominant long-term value drivers versus early-stage contributors.',
     'School Licensing 3-year total = $150K+$1.2M+$4.5M = $5.85M cumulative.'],
    ['Revenue','Federal / Title Grant Revenue',
     'Grant award received from district x number of active grant relationships',
     'Not a direct sale — districts apply for federal Title I, Title IV-A, or E-Rate grants and use the funds to pay for Propel licenses. Revenue is recognized when the district is awarded the grant and pays the license invoice. 6-12 month cycle from application to payment.',
     'Y2: 3 grant-funded districts x $50K avg award = $150K. Y3: 10-15 active grant relationships = $750K.'],

    ['3-YEAR P&L','','','',''],
    ['3-Year P&L','Total OpEx (Burn)',
     'Personnel & Benefits (loaded) + Infrastructure & Tech',
     'Operating expenses per year are the sum of all prorated personnel costs with 22% benefits loading, plus all infrastructure and tech costs active in that year. This is the total cash required to operate the platform before revenue offsets any burn.',
     'Y1: $5.1M loaded personnel + $320K tech = $5.42M total Y1 OpEx.'],
    ['3-Year P&L','Net Income / (Loss)',
     'Total Revenue - Total OpEx',
     'The P&L bottom line per year. Year 1 and Year 2 are expected to show significant net losses (build and early traction phases). Year 3 begins to show the slope toward cash flow breakeven. The narrowing of annual losses is the primary investor metric.',
     'Y1: $285K revenue - $5.42M OpEx = ($5.14M) net loss.  |  Y3: ~$20.4M revenue - ~$19M OpEx = ~$1.4M approaching breakeven.'],
    ['3-Year P&L','3-Year Total Column',
     'SUM(Year 1, Year 2, Year 3) for each P&L row',
     'Each row summed across all three years shows the cumulative picture. For revenue: total cash received over 3 years. For costs: total burn. The cumulative net loss = minimum total capital required to reach Year 3 revenue levels.',
     'Total 3-Year Revenue ~$24.7M. Total 3-Year OpEx ~$44M. Cumulative loss ~$19.3M = total Series A+B capital consumed to reach scale.'],

    ['FUNDRAISING','','','',''],
    ['Fundraising','Contingency Buffer',
     '(Y1 Personnel Loaded + Y1 Tech) x ContingencyPct',
     'A buffer (default 20%, adjustable 5-30% in the web model) applied to Year 1 base burn to cover schedule overruns, unexpected hires, content production variance, and compliance delays. 20% is the recommended floor for a first-time ed-tech content build.',
     'Y1 base burn = $5.42M. Contingency at 20% = $1.08M. Grand Total = $6.5M fundraising ask.'],
    ['Fundraising','Year 1 Grand Total (Seed Ask)',
     'Y1 Personnel (loaded) + Y1 Tech + Contingency Buffer',
     'The primary fundraising figure for seed investors. Represents full capital needed to operate through Year 1 with a safety buffer. Displayed in the topbar of the web model and the Executive Summary. Does not include Year 2 or Year 3 OpEx — those are funded by Series A/B.',
     '$5.1M personnel + $320K tech + $1.08M contingency = $6.5M Seed raise target.'],
    ['Fundraising','18-Month Runway Requirement',
     'Year 1 Grand Total x 1.5',
     'Best practice for seed-stage fundraising is to raise 18 months of runway rather than 12. The 14-month build window ends exactly as pilot evaluations complete — the highest-risk moment to run low on cash. Raising only for 14 months leaves no buffer for a slower-than-expected Series A close.',
     '$6.5M x 1.5 = $9.75M recommended raise for 18 months of full-team runway.'],
    ['Fundraising','Monthly Burn Rate',
     'Year 1 Grand Total / 12',
     'Average monthly cash consumed. Actual burn is front-loaded during the hiring ramp (Mo 1-6) and peaks during the content production sprint (Mo 9-14) when the render farm, session recording, and full team overlap. The monthly rate shown in Risks & Runway is an average, not a peak.',
     '$6.5M / 12 = ~$541K/month average. Actual peak burn months (Mo 9-12) may reach $700K+ due to render farm and full content team overlap.'],
  ];

  calcRows.forEach(([sec, name, form, expl, ex]) => {
    const r = calcSheet.addRow({sec, name, form, expl, ex});
    if (sec === 'PERSONNEL' || sec === 'INFRASTRUCTURE' || sec === 'REVENUE' || sec === '3-YEAR P&L' || sec === 'FUNDRAISING') {
      for (let col = 1; col <= 5; col++) {
        const cell = r.getCell(col);
        cell.font = {bold:true, size:11, color:{argb:'FF4A9DE8'}};
        cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF1A2E45'}};
      }
    }
  });
  calcSheet.getColumn('form').alignment = {wrapText:true, vertical:'top'};
  calcSheet.getColumn('expl').alignment = {wrapText:true, vertical:'top'};
  calcSheet.getColumn('ex').alignment   = {wrapText:true, vertical:'top'};

  // ── GLOBAL FORMATTING ───────────────────────────────────────
  workbook.eachSheet(s => {
    if (s.name === 'Calculations Guide') {
      s.getRow(1).font = {bold:true, color:{argb:'FFE8EDF5'}};
      s.getRow(1).fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF0D1B2A'}};
      return;
    }
    s.getRow(1).font = {bold:true, color:{argb:'FFE8EDF5'}};
    s.getRow(1).fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF0D1B2A'}};
    s.eachRow((r, rNum) => {
      if (rNum < 2) return;
      r.eachCell(c => {
        if (typeof c.value === 'number' || (c.value && c.value.formula)) c.numFmt = '"$"#,##0';
      });
    });
  });
  // Override: Start/End Month columns should show as plain integers, not currency
  [[persSheet,['H','I']], [techSheet,['I','J']]].forEach(([sh, cols]) => {
    sh.eachRow((r, rNum) => {
      if (rNum < 2) return;
      cols.forEach(c => { const cell = r.getCell(c); if (typeof cell.value === 'number') cell.numFmt = '0'; });
    });
  });
  // FTE column should also be plain number
  persSheet.eachRow((r, rNum) => { if (rNum >= 2) { const c = r.getCell('D'); if (typeof c.value === 'number') c.numFmt = '0.0'; } });

  const buffer = await workbook.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buffer]));
  a.download = 'Propel_3Year_Outlook.xlsx';
  a.click();
}

function setVersion(v) {
  markChange();
  version = v;
  document.querySelectorAll('.vtab').forEach(el => {
    el.classList.toggle('active', v === '2d' ? el.textContent.includes('2.5D') : el.textContent.includes('3D'));
  });
  recalcAll();
}
function showSection(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('section-' + id)?.classList.add('active');
  event.currentTarget.classList.add('active');
  const titles = { summary:'Funding Overview', curriculum:'Curriculum Scope', personnel:'Personnel Plan', tech:'Infrastructure & Tech', phases:'Phase Timeline', risks:'Risks & Runway', outlook:'3-Year P&L', revenue:'Revenue Growth' };
  document.getElementById('page-title').textContent = titles[id] || id;
}

document.addEventListener('DOMContentLoaded', () => { loadSavedState(); recalcAll(); restoreSidebarState(); });
function onRoleDragStart(e) { dragSourceId = this.dataset.roleId; e.dataTransfer.effectAllowed = 'move'; }
function onRoleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function onRoleDrop(e) { e.preventDefault(); const targetId = this.dataset.roleId; if(dragSourceId && dragSourceId !== targetId) mergeRoles(dragSourceId, targetId); }
function mergeRoles(s,t) {
  markChange();
  const sr = findRole(s), tr = findRole(t); if(!sr || !tr) return;
  titleOverrides[t] = (titleOverrides[t]||tr.role) + ' / ' + (titleOverrides[s]||sr.role);
  if(!mergeExtras[t]) mergeExtras[t]=[]; mergeExtras[t].push({id:s, title:(titleOverrides[s]||sr.role), note:(noteOverrides[s]||sr.note)});
  hiddenRoleIds.add(s); recalcAll();
}
function renderTechComparisonPanel(v) {
  const container = document.getElementById('tech-comparison-panel');
  if (!container) return;
  const drivers = v === '3d' ? TECH_DRIVERS_3D : TECH_DRIVERS_2D;
  const versionLabel = v === '3d' ? '3D Immersive (Yr 2+)' : '2.5D Platform (Y1)';
  const isThreeD = v === '3d';
  container.innerHTML = `
    <div style="margin-bottom:10px; font-size:12px; color:var(--text3); font-weight:500; text-transform:uppercase; letter-spacing:.8px;">${versionLabel} — Cost Driver Summary</div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px,1fr)); gap:8px; margin-bottom:16px;">
      ${drivers.map(d => `
        <div style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:3px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div style="font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:.6px;">${d.label}</div>
            <div style="font-size:12px; font-weight:600; color:${d.color}; text-align:right; flex-shrink:0;">${d.val}</div>
          </div>
          <div style="font-size:11px; color:var(--text3); line-height:1.5;">${d.note}</div>
        </div>
      `).join('')}
    </div>
    ${isThreeD ? `
    <div style="background:rgba(216,79,48,.08); border:1px solid rgba(216,79,48,.2); border-radius:8px; padding:12px 14px; margin-bottom:12px; font-size:12px; color:var(--text2); line-height:1.6;">
      <strong style="color:var(--coral-lt);">Why 3D tech costs are substantially higher</strong><br>
      The render farm alone ($12K/mo × 6 production months = $72K) exceeds the entire 2.5D tech budget for those same months.
      Chromebook GPU constraints mean performance engineering is not optional — it is a prerequisite for shipping.
      3D asset pipelines generate 2.5× the storage and CDN traffic of 2.5D, and the NPC AI layer adds persistent compute costs
      that have no 2.5D equivalent. Tooling licenses (Maya, ZBrush, Substance, Houdini, ShotGrid) add ~$24K+/yr
      that simply don't exist in the 2.5D workflow. 3D is explicitly a Year 2+ product track.
    </div>` : `
    <div style="background:rgba(18,168,122,.08); border:1px solid rgba(18,168,122,.2); border-radius:8px; padding:12px 14px; margin-bottom:12px; font-size:12px; color:var(--text2); line-height:1.6;">
      <strong style="color:var(--teal-lt);">Why 2.5D tech costs are lean</strong><br>
      Pre-rendered 2D animation (After Effects + Spine) requires no cloud GPU compute — renders run locally on artist workstations
      in minutes. Asset sizes are compact enough that Cloudflare R2's zero-egress model eliminates CDN costs entirely.
      Standard web QA tooling applies, AI footprint is limited to the hint ladder (pilot-scale cost ~$300/mo),
      and no spatial audio engine or GPU performance engineering is required.
      The 2.5D stack is designed to scale without proportional infrastructure cost increases.
    </div>`}
  `;
}

// ============================================================
// SIDEBAR COLLAPSE
// ============================================================
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const btn     = document.getElementById('sidebar-toggle-btn');
  if (!sidebar) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  if (btn) btn.textContent = collapsed ? '▶' : '◀';
  try { localStorage.setItem('propel_sidebar_collapsed', collapsed ? '1' : '0'); } catch(e) {}
}

function restoreSidebarState() {
  try {
    if (localStorage.getItem('propel_sidebar_collapsed') === '1') {
      const sidebar = document.querySelector('.sidebar');
      const btn     = document.getElementById('sidebar-toggle-btn');
      if (sidebar) sidebar.classList.add('collapsed');
      if (btn) btn.textContent = '▶';
    }
  } catch(e) {}
}
