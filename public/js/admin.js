// ─────────────────────────────────────────────
//  La Rose Escala · Admin
// ─────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc, query, orderBy, limit }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { FIREBASE_CONFIG, LOJAS, FUNCIONARIOS, TURNOS_PADRAO, FERIADOS_DF, CLT, AUSENCIAS }
  from './firebase-config.js';

// ── Init ─────────────────────────────────────
const app  = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(app);
const auth = getAuth(app);

const ML = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const WD = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const now = new Date();

// ── State ─────────────────────────────────────
let vY = now.getFullYear(), vM = now.getMonth();
let turnosAtivos = [...TURNOS_PADRAO]; // mutable local copy, loaded from Firestore
let lojaId = 'loja2';
let funcs  = FUNCIONARIOS[lojaId];
let sched  = {}, schedSnap = {}, meta = {};
let pubM   = new Set(), draftM = new Set();
let dragType = null, dragData = null, pendingDrop = null;
let editorMode = 'drag';
let modalDay   = {};
let holEditDay = null;
let userEmail  = '';
let ferCache   = {};
let pendingFer = [];
let selCopyKey = null;
let patternState = {};

// ── Helpers ───────────────────────────────────
const mKey   = (y,m) => `${y}-${String(m+1).padStart(2,'0')}`;

// Parse hours from shift string "08:00–16:20" → minutes
function shiftMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(/[–\-]/);
  if (parts.length < 2) return 0;
  const [sh,sm] = parts[0].trim().split(':').map(Number);
  const [eh,em] = parts[1].trim().split(':').map(Number);
  if (isNaN(sh)||isNaN(eh)) return 0;
  let mins = (eh*60+em) - (sh*60+sm);
  if (mins < 0) mins += 1440; // overnight
  return mins;
}
// Standard shift is 8h20 (500 min) — CLT base
const BASE_SHIFT_MINS = 500;
const col    = id => `escalas_${id}`;
const fByKey = k => funcs.find(x => x.key===k) || { bg:'#f1f5f9', text:'#475569', border:'#e2e8f0', label:k, key:k };
const lojaInfo = () => LOJAS.find(l => l.id===lojaId);

// ── Toast ─────────────────────────────────────
window.toast = (msg, dur=2800) => {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut .2s ease forwards';
    setTimeout(() => t.remove(), 220);
  }, dur);
};

// ── Auth ──────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    userEmail = user.email;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display   = 'block';
    buildLojaTabs(lojaId);
    loadIdx().then(() => loadMonth());
    loadFuncsFromDB();
    loadTurnos();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display   = 'none';
  }
});

window.doLogin = async () => {
  const em  = document.getElementById('inp-email').value.trim();
  const pw  = document.getElementById('inp-pass').value;
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('login-error');
  err.textContent = '';
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-top-color:#fff;margin:0 auto"></div>';
  btn.disabled  = true;
  try { await signInWithEmailAndPassword(auth, em, pw); }
  catch(e) {
    err.textContent = e.code === 'auth/invalid-credential' ? 'E-mail ou senha incorretos.' : 'Erro ao entrar.';
    btn.innerHTML = 'Entrar'; btn.disabled = false;
  }
};
window.doLogout = () => signOut(auth);
document.getElementById('inp-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

// ── Loja tabs ─────────────────────────────────
function buildLojaTabs(id) {
  document.getElementById('loja-tabs').innerHTML = LOJAS.map(l =>
    `<button class="loja-tab ${l.id===id?'loja-tab--active':''}" onclick="switchLoja('${l.id}')">${l.nome}</button>`
  ).join('');
  lojaId = id; funcs = FUNCIONARIOS[id];
  const loja = lojaInfo();
  const hdr  = document.getElementById('admin-header');
  hdr.style.background = loja.colorDark;
  document.documentElement.style.setProperty('--loja-color',  loja.color);
  document.documentElement.style.setProperty('--loja-dark',   loja.colorDark);
  document.documentElement.style.setProperty('--loja-light',  loja.colorLight);
  document.documentElement.style.setProperty('--loja-border', loja.colorBorder);
  buildDragPanel();
}
window.switchLoja = id => {
  lojaId = id; funcs = FUNCIONARIOS[id];
  pubM   = new Set(); draftM = new Set();
  sched  = {}; meta  = {};
  buildLojaTabs(id);
  loadIdx().then(() => loadMonth());
};

// ── Firestore ─────────────────────────────────
async function loadIdx() {
  try {
    const snap = await getDocs(collection(db, col(lojaId)));
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.published) { pubM.add(d.id); draftM.delete(d.id); }
      else draftM.add(d.id);
    });
    renderMonthGrid();
  } catch(e) { console.error(e); }
}

async function loadMonth() {
  try {
    const snap = await getDoc(doc(db, col(lojaId), mKey(vY,vM)));
    if (snap.exists()) { const d=snap.data(); sched=d.days||{}; meta={published:d.published||false}; }
    else { sched={}; meta={}; }
  } catch(e) { sched={}; meta={}; }
  schedSnap = JSON.parse(JSON.stringify(sched));
  renderEditor(); renderSidebar(); runCltChecks(); loadFerBanner();
}

window.saveSchedule = async (pub) => {
  const key  = mKey(vY,vM);
  const stat = document.getElementById('save-status');
  stat.innerHTML = '<div class="spinner spinner--sm"></div>';
  const diff = buildDiff(schedSnap, sched);
  try {
    await setDoc(doc(db, col(lojaId), key), {
      days: sched, published: pub,
      updatedAt: new Date().toISOString(), year: vY, month: vM,
    });
    if (diff.length) {
      await addDoc(collection(db, `historico_${lojaId}`), {
        action: pub ? 'Publicar' : 'Rascunho',
        month: key, year: vY, monthIdx: vM,
        user: userEmail, ts: new Date().toISOString(), changes: diff,
      });
    }
    schedSnap = JSON.parse(JSON.stringify(sched));
    meta.published = pub;
    if (pub) { pubM.add(key); draftM.delete(key); }
    else     { draftM.add(key); pubM.delete(key); }
    renderMonthGrid(); renderSidebar();
    stat.textContent = pub ? '✓ Publicado' : '✓ Salvo';
    toast(pub ? 'Escala publicada! Funcionários já podem ver.' : 'Rascunho salvo');
    setTimeout(() => stat.textContent='', 3500);
  } catch(e) { stat.textContent = '✗ Erro'; toast('Erro ao salvar.'); }
};

window.publishToggle = () => {
  if (meta.published) { if(confirm('Despublicar? Funcionários deixarão de ver.')) saveSchedule(false); }
  else saveSchedule(true);
};

window.clearSchedule = async () => {
  if (!confirm(`Apagar todos os dados de ${ML[vM]} ${vY}?`)) return;
  const key = mKey(vY,vM);
  try {
    await deleteDoc(doc(db, col(lojaId), key));
    sched={}; meta={}; schedSnap={};
    pubM.delete(key); draftM.delete(key);
    renderMonthGrid(); renderEditor(); renderSidebar(); runCltChecks();
    toast('Mês limpo');
  } catch(e) { toast('Erro ao limpar'); }
};

function autoSave() {
  const key = mKey(vY,vM);
  setDoc(doc(db, col(lojaId), key), {
    days: sched, published: meta.published||false,
    updatedAt: new Date().toISOString(), year: vY, month: vM,
  }).then(() => {
    if (!meta.published) { draftM.add(key); renderMonthGrid(); renderSidebar(); }
  }).catch(console.error);
}

// ── Diff ──────────────────────────────────────
function buildDiff(before, after) {
  const changes = [];
  const allDays = new Set([...Object.keys(before), ...Object.keys(after)].map(Number));
  allDays.forEach(d => {
    const b = before[d]||{}, a = after[d]||{};
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ day:d, before:b, after:a });
  });
  return changes;
}

function describeDay(d) {
  if (!d || !Object.keys(d).length) return 'Vazio';
  if (d.type==='holiday') return `Feriado: ${d.label||''}`;
  const s = (d.shifts||[]).map(x => `${fByKey(x.key).label.split(' ')[0]} ${x.time}`).join(', ');
  const f = (d.folgam||[]).map(k => fByKey(k).label.split(' ')[0]).join(', ');
  return [s && `Turnos: ${s}`, f && `Folgas: ${f}`].filter(Boolean).join(' · ') || 'Vazio';
}

// ── CLT ───────────────────────────────────────
function parseEndTime(str)   { const p=str.split(/[–\-]/); if(p.length<2)return null; const m=p[1].trim().match(/(\d{2}):(\d{2})/); return m?+m[1]*60+ +m[2]:null; }
function parseStartTime(str) { const m=str.match(/(\d{2}):(\d{2})/); return m?+m[1]*60+ +m[2]:null; }

function runCltChecks() {
  const alerts = [];
  const dim    = new Date(vY,vM+1,0).getDate();
  const weeks  = [];
  let week = [];
  for (let d=1; d<=dim; d++) {
    const dow = new Date(vY,vM,d).getDay();
    week.push(d);
    if (dow===0 || d===dim) { weeks.push([...week]); week=[]; }
  }
  funcs.forEach(f => {
    weeks.forEach((wk,wi) => {
      if (wk.length < 5) return;
      const hasFolga = wk.some(d => (sched[d]?.folgam||[]).includes(f.key));
      const hasShift = wk.some(d => (sched[d]?.shifts||[]).some(s => s.key===f.key));
      if (hasShift && !hasFolga)
        alerts.push({ type:'warn', msg:`${f.label} — sem folga na semana ${wi+1} (dias ${wk[0]}–${wk[wk.length-1]})`, day:wk[0] });
    });
    for (let d=1; d<dim; d++) {
      const st = (sched[d]?.shifts||[]).filter(s=>s.key===f.key);
      const sn = (sched[d+1]?.shifts||[]).filter(s=>s.key===f.key);
      if (!st.length || !sn.length) continue;
      const end   = Math.max(...st.map(s=>parseEndTime(s.time)||0));
      const start = Math.min(...sn.map(s=>parseStartTime(s.time)||1440));
      const rest  = (start+1440) - end;
      if (rest < CLT.minDescansoEntreJornadas*60)
        alerts.push({ type:'err', msg:`${f.label} — ${Math.round(rest/60)}h de descanso entre os dias ${d} e ${d+1} (mín. ${CLT.minDescansoEntreJornadas}h)`, day:d });
    }
    let sunStreak = 0;
    for (let d=1; d<=dim; d++) {
      if (new Date(vY,vM,d).getDay() !== 0) continue;
      const worked = (sched[d]?.shifts||[]).some(s=>s.key===f.key);
      if (worked) { sunStreak++; if (sunStreak > CLT.maxDomingosSeguidos) alerts.push({ type:'warn', msg:`${f.label} — ${sunStreak}º domingo seguido (dia ${d})`, day:d }); }
      else sunStreak = 0;
    }
  });
  const cont  = document.getElementById('clt-alerts');
  const badge = document.getElementById('clt-badge');
  if (!alerts.length) {
    cont.innerHTML = '<div class="no-clt">✓ Sem alertas CLT</div>';
    badge.className = 'badge badge--neutral'; badge.textContent = '✓ OK';
    return;
  }
  const hasErr = alerts.some(a => a.type==='err');
  badge.className  = `badge ${hasErr ? 'badge--red' : 'badge--amber'}`;
  badge.textContent = `⚠ ${alerts.length}`;
  cont.innerHTML = alerts.map(a =>
    `<div class="clt-alert clt-alert--${a.type}" onclick="scrollToDay(${a.day})">
      <span class="clt-alert__icon">${a.type==='err'?'●':'◐'}</span>
      <span>${a.msg}</span>
    </div>`
  ).join('');
}
window.scrollToDay = day => {
  document.getElementById(`day-${day}`)?.scrollIntoView({ behavior:'smooth', block:'center' });
};

// ── Feriados banner ───────────────────────────
async function loadFerBanner() {
  const banner = document.getElementById('fer-banner');
  banner.innerHTML = `<div class="feriados-banner"><div class="loading-state" style="padding:.5rem 0"><div class="spinner spinner--sm"></div> Verificando feriados…</div></div>`;
  let nacional = [];
  try {
    if (!ferCache[vY]) { const r=await fetch(`https://brasilapi.com.br/api/feriados/v1/${vY}`); if(r.ok) ferCache[vY]=await r.json(); }
    nacional = ferCache[vY] || [];
  } catch(e) {}
  const fromApi = nacional.filter(f => {
    const [fy,fm,fd] = f.date.split('-').map(Number);
    return fy===vY && fm===vM+1 && !(sched[fd]?.type==='holiday');
  });
  const fromDF = FERIADOS_DF.filter(f => f.month===vM+1 && !(sched[f.day]?.type==='holiday'))
    .map(f => ({ date:`${vY}-${String(vM+1).padStart(2,'0')}-${String(f.day).padStart(2,'0')}`, name:f.name, source:'DF' }));
  const all = [...fromApi, ...fromDF];
  if (!all.length) { banner.innerHTML=''; return; }
  pendingFer = all;
  const chips = all.map(f => {
    const fd = parseInt(f.date.split('-')[2]);
    const wd = WD[new Date(vY,vM,fd).getDay()];
    return `<div class="feriado-chip">
      <span class="feriado-chip__date">${fd}</span>
      <span class="feriado-chip__wd">${wd}</span>
      ${f.source==='DF'?'<span class="feriado-chip__tag">DF</span>':''}
      <span class="feriado-chip__name">${f.name}</span>
    </div>`;
  }).join('');
  banner.innerHTML = `<div class="feriados-banner">
    <div class="feriados-banner__header">
      <span class="feriados-banner__title">${all.length} feriado${all.length>1?'s':''} encontrado${all.length>1?'s':''} em ${ML[vM]}</span>
      <div class="feriados-banner__actions">
        <button class="btn btn--ghost" style="font-size:.75rem;padding:4px 10px" onclick="dismissFer()">Ignorar</button>
        <button class="btn btn--primary" style="font-size:.75rem;padding:4px 10px;background:var(--amber);border-color:var(--amber)" onclick="applyFer()">Aplicar</button>
      </div>
    </div>
    <div class="feriados-banner__chips">${chips}</div>
  </div>`;
}
window.applyFer = () => {
  pendingFer.forEach(f => { const fd=parseInt(f.date.split('-')[2]); sched[fd]={type:'holiday',label:f.name}; });
  pendingFer=[]; document.getElementById('fer-banner').innerHTML='';
  autoSave(); renderEditor(); renderSidebar(); runCltChecks(); toast('Feriados aplicados');
};
window.dismissFer = () => { pendingFer=[]; document.getElementById('fer-banner').innerHTML=''; };

// ── Navigation ────────────────────────────────
window.changeYear = d => { vY+=d; document.getElementById('year-label').textContent=vY; renderMonthGrid(); };
window.selectMonth = m => { vM=m; loadMonth(); };

// ── Render month grid ─────────────────────────
function renderMonthGrid() {
  const g = document.getElementById('month-grid'); g.innerHTML='';
  MS.forEach((lbl,i) => {
    const key  = mKey(vY,i);
    const isPub = pubM.has(key), isDraft = draftM.has(key), isSel = i===vM;
    const btn = document.createElement('button');
    const cls = ['month-btn'];
    if (isSel)   cls.push('month-btn--active');
    if (isPub)   cls.push('month-btn--pub');
    if (isDraft) cls.push('month-btn--draft');
    btn.className = cls.join(' ');
    btn.title     = isPub ? `${lbl}: Publicado ✓` : isDraft ? `${lbl}: Rascunho` : `${lbl}: Vazio`;
    btn.innerHTML = `<span>${lbl}</span><span class="month-btn__dot"></span>`;
    btn.onclick   = () => selectMonth(i);
    g.appendChild(btn);
  });
}

// ── Render sidebar ────────────────────────────
function renderSidebar() {
  const block = document.getElementById('pub-block');
  const icon  = document.getElementById('pub-icon');
  const title = document.getElementById('pub-title');
  const sub   = document.getElementById('pub-sub');
  const pb    = document.getElementById('btn-pub');
  const hasAny = Object.keys(sched).length > 0;

  if (!hasAny) {
    block.className='pub-block pub-block--empty'; icon.textContent='○'; title.textContent='Vazio'; sub.textContent='Nenhum dado neste mês';
    pb.className='btn btn--success'; pb.textContent='Publicar para funcionários'; pb.disabled=true;
  } else if (meta.published) {
    block.className='pub-block pub-block--pub'; icon.textContent='●'; title.textContent='Visível para funcionários'; sub.textContent=`Publicado · ${ML[vM]} ${vY}`;
    pb.className='btn btn--danger'; pb.style.background=''; pb.textContent='Retirar do ar'; pb.disabled=false;
  } else {
    block.className='pub-block pub-block--draft'; icon.textContent='◐'; title.textContent='Rascunho — não visível'; sub.textContent='Funcionários não veem ainda';
    pb.className='btn btn--success'; pb.textContent='Publicar para funcionários'; pb.disabled=false;
  }

  const cnt = {}; funcs.forEach(f => cnt[f.key]={s:0,f:0});
  Object.values(sched).forEach(d => {
    (d.shifts||[]).forEach(s => { if(cnt[s.key]) cnt[s.key].s++; });
    (d.folgam||[]).forEach(k => { if(cnt[k])     cnt[k].f++;    });
  });
  // Compute total minutes and extras per func
  const mins = {};
  funcs.forEach(f => mins[f.key] = 0);
  Object.values(sched).forEach(d => {
    (d.shifts||[]).forEach(s => {
      if (mins[s.key] !== undefined) mins[s.key] += shiftMinutes(s.time);
    });
  });

  document.getElementById('func-summary').innerHTML = funcs.map(f => {
    const ini = f.label.split(' ').map(w=>w[0]).slice(0,2).join('');
    const totalMin  = mins[f.key] || 0;
    const extraMin  = Math.max(0, totalMin - cnt[f.key].s * BASE_SHIFT_MINS);
    const extraH    = Math.floor(extraMin / 60);
    const extraM    = extraMin % 60;
    const extraStr  = extraMin > 0
      ? `${extraH}h${extraM>0?extraM+'m':''}`
      : '—';
    const extraColor = extraMin > 0 ? 'color:var(--green-d)' : 'color:var(--faint)';
    return `<div class="func-row">
      <div class="func-row__avatar" style="background:${f.bg};color:${f.text};border-color:${f.border}">${ini}</div>
      <div class="func-row__body">
        <div class="func-row__name">${f.label}</div>
        <div class="func-row__stats">
          <div class="func-row__stat">
            <span class="func-row__stat-v">${cnt[f.key].s}</span>
            <span class="func-row__stat-l">Turnos</span>
          </div>
          <div class="func-row__stat">
            <span class="func-row__stat-v" style="color:var(--orange)">${cnt[f.key].f}</span>
            <span class="func-row__stat-l">Folgas</span>
          </div>
          <div class="func-row__stat">
            <span class="func-row__stat-v" style="font-size:.75rem;${extraColor}">${extraStr}</span>
            <span class="func-row__stat-l">H. extra</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Render editor ─────────────────────────────
function renderEditor() {
  const todayDay = now.getFullYear()===vY&&now.getMonth()===vM ? now.getDate() : -1;
  const dim = new Date(vY,vM+1,0).getDate();
  const fw  = new Date(vY,vM,1).getDay();
  document.getElementById('editor-title').textContent = `${ML[vM]} ${vY} · ${lojaInfo().nome}`;

  // Inject print header (shown only in @media print)
  let ph = document.getElementById('print-header-admin-el');
  if (!ph) {
    ph = document.createElement('div');
    ph.id = 'print-header-admin-el';
    ph.className = 'print-header-admin';
    document.querySelector('.editor').prepend(ph);
  }
  ph.innerHTML = `
    <div class="print-header-admin__title">La Rose · ${lojaInfo().label}</div>
    <div class="print-header-admin__sub">Escala de ${ML[vM]} ${vY} · Impresso em ${new Date().toLocaleDateString('pt-BR')}</div>`;

  // Build print legend
  let printLeg = document.getElementById('print-legend-admin');
  if (!printLeg) {
    printLeg = document.createElement('div');
    printLeg.id = 'print-legend-admin';
    printLeg.className = 'print-legend';
    document.querySelector('.editor')?.appendChild(printLeg);
  }
  printLeg.innerHTML = funcs.map(f =>
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.75rem;font-weight:600;margin-right:8px">
      <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${f.bg};border:1.5px solid ${f.border}"></span>
      ${f.label}
    </span>`
  ).join('') +
  `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.75rem;font-weight:600;margin-right:8px">
    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#ea580c"></span>⛱ Folga
  </span>` +
  AUSENCIAS.map(a =>
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.75rem;font-weight:600;margin-right:8px">
      <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${a.bg};border:1.5px solid ${a.border}"></span>
      ${a.icon} ${a.label}
    </span>`
  ).join('');
  const g = document.getElementById('cal-grid'); g.innerHTML='';
  WD.forEach((w,i) => {
    const h=document.createElement('div'); h.className='cal-wday'+(i===0||i===6?' cal-wday--we':''); h.textContent=w; g.appendChild(h);
  });
  for (let i=0;i<fw;i++) { const e=document.createElement('div'); e.className='cal-cell cal-cell--empty'; g.appendChild(e); }
  for (let d=1;d<=dim;d++) {
    const data=sched[d]||{}, isToday=d===todayDay;
    const cell=document.createElement('div');
    cell.id=`day-${d}`;
    cell.className='cal-cell'+(isToday?' cal-cell--today':'')+(data.type==='holiday'?' cal-cell--holiday':'');
    cell.style.position='relative';
    cell.addEventListener('dragover', e=>onDragOver(e,d));
    cell.addEventListener('dragleave', e=>onDragLeave(e,d));
    cell.addEventListener('drop', e=>onDrop(e,d));
    cell.addEventListener('click', () => {
      if (mobilePendingType) { handleMobileCellTap(d); return; }
      if (editorMode==='click') openHolModal(d);
    });
    let inner = `<div class="cal-cell__num">
      <span class="cal-cell__num-val">${d}${isToday?'&nbsp;<span class="today-dot">HOJE</span>':''}</span>
      <span style="display:flex;gap:2px">
        <button class="cal-cell__opts" onclick="event.stopPropagation();openCopyDayModal(${d})" title="Copiar dia" style="font-size:.75rem;opacity:.5">⎘</button>
        <button class="cal-cell__opts" onclick="event.stopPropagation();openHolModal(${d})" title="Opções">•••</button>
      </span>
    </div>`;
    // Holiday label — but STILL show shifts (store may open on holidays)
    if (data.type==='holiday') {
      inner += `<div class="hol-tag">🎉 ${data.label||'Feriado'}</div>`;
    }
    // Always render shifts and folgas (even on holiday days)
    (data.shifts||[]).forEach((s,i) => {
      const f=fByKey(s.key);
      inner += `<div class="cal-chip${s.isSwap?' cal-chip--swap':''}" style="background:${f.bg};color:${f.text};border-color:${f.border}">
        <span class="cal-chip__name">${f.label.split(' ')[0]}${s.isSwap?' ⇄':''}</span>
        <span class="cal-chip__time">${s.time}</span>
        <button class="cal-chip__del" onclick="event.stopPropagation();removeShift(${d},${i})">✕</button>
      </div>`;
    });
    (data.folgam||[]).forEach((k,i) => {
      const f=fByKey(k);
      inner += `<div class="cal-off">
        <span>⛱FOLGA: ${f.label.split(' ')[0]}</span>
        <button class="cal-chip__del" onclick="event.stopPropagation();removeFolga(${d},${i})">✕</button>
      </div>`;
    });
    (data.ausencias||[]).forEach((a,i) => {
      const f=fByKey(a.key);
      const aus=AUSENCIAS.find(x=>x.key===a.tipo)||{icon:'📋',bg:'#f1f5f9',text:'#475569',border:'#cbd5e1',label:a.tipo};
      inner += `<div class="cal-ausencia" style="background:${aus.bg};color:${aus.text};border-color:${aus.border}">
        <span>${aus.icon} ${f.label.split(' ')[0]}</span>
        <button class="cal-chip__del" onclick="event.stopPropagation();removeAusencia(${d},${i})">✕</button>
      </div>`;
    });
    inner += `<div class="drop-hint">Soltar aqui</div>`;
    cell.innerHTML=inner; g.appendChild(cell);
  }
}

// ── Drag panel ────────────────────────────────

function buildDragPanel() {
  const fc=document.getElementById('func-chips'); fc.innerHTML='';
  // Build ausencia chips
  const ac=document.getElementById('ausencia-chips');
  if(ac){ac.innerHTML=AUSENCIAS.map(a=>`
    <div class="ausencia-drag" draggable="true"
      ondragstart="onDragStartAusencia(event,'${a.key}')"
      onclick="mobileAusencia('${a.key}')"
      style="background:${a.bg};color:${a.text};border-color:${a.border}"
      title="${a.label}">
      <span>${a.icon}</span><span>${a.label}</span>
    </div>`).join('');}
  funcs.forEach(f => {
    const el=document.createElement('div'); el.className='func-drag'; el.draggable=true;
    el.style.cssText=`background:${f.bg};color:${f.text};border:1.5px solid ${f.border}`;
    el.innerHTML=`<div class="func-drag__dot" style="background:${f.text}60"></div><span style="flex:1">${f.label}</span><span class="func-drag__handle">⠿</span>`;
    el.addEventListener('dragstart', e=>onDragStartFunc(e,f.key));
    el.addEventListener('dragend',   ()=>el.classList.remove('func-drag--dragging'));
    el.addEventListener('click',     ()=>mobileSelectFunc(f.key));
    fc.appendChild(el);
  });
  const tc=document.getElementById('turno-chips'); tc.innerHTML='';
  turnosAtivos.forEach(t => {
    const el=document.createElement('div'); el.className='turno-drag'; el.draggable=true;
    el.innerHTML=`<span>${t.label}</span><span class="turno-drag__time">${t.value}</span>`;
    el.addEventListener('dragstart', e=>onDragStartTurno(e,t));
    el.addEventListener('dragend',   ()=>el.classList.remove('func-drag--dragging'));
    el.addEventListener('click',     ()=>mobileSelectTurno(t));
    tc.appendChild(el);
  });
}

// ── Drag handlers ─────────────────────────────
window.onDragStartFunc  = (e,key) => { dragType='func';  dragData={key}; e.dataTransfer.effectAllowed='copy'; e.currentTarget.classList.add('func-drag--dragging'); createGhost(e,fByKey(key)); };
window.onDragStartTurno = (e,t)   => { dragType='turno'; dragData=t;     e.dataTransfer.effectAllowed='copy'; e.currentTarget.classList.add('func-drag--dragging'); };
window.onDragStartFolga   = e => { dragType='folga';   dragData={};      e.dataTransfer.effectAllowed='copy'; };
window.onDragStartAusencia= (e,key) => { dragType='ausencia'; dragData={key}; e.dataTransfer.effectAllowed='copy'; };

function createGhost(e,f) {
  let g=document.getElementById('__ghost');
  if(!g){g=document.createElement('div');g.id='__ghost';g.style.cssText='position:fixed;pointer-events:none;z-index:9999;padding:5px 11px;border-radius:6px;font-size:12px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.15);transform:rotate(3deg) scale(1.05);opacity:.9;font-family:Inter,sans-serif';document.body.appendChild(g);}
  g.style.background=f.bg; g.style.color=f.text; g.style.border=`1px solid ${f.border}`;
  g.textContent=f.label; e.dataTransfer.setDragImage(g,40,20);
}

function onDragOver(e,day) { if(!dragType)return; e.preventDefault(); e.dataTransfer.dropEffect='copy'; document.querySelectorAll('.cal-cell--drag-over').forEach(c=>c.classList.remove('cal-cell--drag-over')); document.getElementById(`day-${day}`)?.classList.add('cal-cell--drag-over'); }
function onDragLeave(e,day) { document.getElementById(`day-${day}`)?.classList.remove('cal-cell--drag-over'); }
function onDrop(e,day) {
  e.preventDefault();
  const cell=document.getElementById(`day-${day}`);
  if(cell){cell.classList.remove('cal-cell--drag-over');cell.classList.add('cal-cell--drop-flash');}
  setTimeout(()=>cell?.classList.remove('cal-cell--drop-flash'),400);
  if(!sched[day]) sched[day]={shifts:[],folgam:[]};
  if(dragType==='folga')        showFolgaSel(day,e);
  else if(dragType==='ausencia')showAusenciaSel(day,dragData.key,e);
  else if(dragType==='turno')   showFuncSelForTurno(day,dragData,e);
  else if(dragType==='func')    showTurnoPopup(day,dragData.key,e.clientX,e.clientY);
  dragType=null; dragData=null;
}

// ── Turno popup ───────────────────────────────
function showTurnoPopup(day,funcKey,cx,cy) {
  pendingDrop={day,funcKey}; const f=fByKey(funcKey); const pop=document.getElementById('turno-popup');
  document.getElementById('popup-who').innerHTML=`<div class="turno-popup__who-dot" style="background:${f.bg};border:1px solid ${f.border}"></div><span style="color:${f.text}">${f.label}</span><span style="font-size:.75rem;color:var(--text-muted);margin-left:4px">→ Dia ${day}</span>`;
  document.getElementById('popup-grid').innerHTML=turnosAtivos.map(t=>`<button class="turno-popup__btn" onclick="confirmTurno('${t.value}')"><span class="turno-popup__btn-label">${t.label}</span><span class="turno-popup__btn-time">${t.value}</span></button>`).join('');
  document.getElementById('popup-time').value=''; document.querySelector('.turno-popup__custom')?.style.removeProperty('display');
  const pw=248,ph=270; let left=cx+12,top=cy-20;
  if(left+pw>window.innerWidth-12) left=cx-pw-12;
  if(top+ph>window.innerHeight-12) top=window.innerHeight-ph-12;
  pop.style.left=left+'px'; pop.style.top=top+'px'; pop.style.display='block';
  setTimeout(()=>document.getElementById('popup-time').focus(),50);
}
window.confirmTurno = time => {
  if(!pendingDrop)return; const{day,funcKey}=pendingDrop;
  const data=sched[day]||(sched[day]={shifts:[],folgam:[]});
  if(!data.shifts) data.shifts=[];
  if(!data.shifts.some(s=>s.key===funcKey)){data.shifts.push({key:funcKey,time}); autoSave(); renderEditor(); runCltChecks();}
  closePopup();
};
window.confirmCustomTime = () => { const t=document.getElementById('popup-time').value.trim(); if(t) confirmTurno(t); };
window.closePopup = () => { document.getElementById('turno-popup').style.display='none'; pendingDrop=null; };
document.getElementById('popup-time').addEventListener('keydown',e=>{if(e.key==='Enter')confirmCustomTime();if(e.key==='Escape')closePopup();});
document.addEventListener('click',e=>{const p=document.getElementById('turno-popup');if(p.style.display!=='none'&&!p.contains(e.target))closePopup();},{capture:true});

function showAusenciaSel(day,ausKey,e) {
  const aus = AUSENCIAS.find(a=>a.key===ausKey);
  if(!aus) return;
  pendingDrop={day,funcKey:null}; const pop=document.getElementById('turno-popup');
  document.getElementById('popup-who').innerHTML=`<span style="font-size:.875rem;font-weight:700">${aus.icon} ${aus.label} — Dia ${day} — Para quem?</span>`;
  document.getElementById('popup-grid').innerHTML=funcs.map(f=>`
    <button class="turno-popup__btn" onclick="confirmAusencia(${day},'${f.key}','${ausKey}')"
      style="background:${f.bg};color:${f.text};border-color:${f.border}">
      <span class="turno-popup__btn-l">${f.label.split(' ')[0]}</span>
    </button>`).join('');
  document.querySelector('.turno-popup__custom').style.display='none';
  const cx=e.clientX,cy=e.clientY,pw=248,ph=200;
  let left=cx+12,top=cy-20;
  if(left+pw>window.innerWidth-12) left=cx-pw-12;
  if(top+ph>window.innerHeight-12) top=window.innerHeight-ph-12;
  pop.style.left=left+'px'; pop.style.top=top+'px'; pop.style.display='block';
}

window.confirmAusencia=(day,funcKey,ausKey)=>{
  if(!sched[day]) sched[day]={shifts:[],folgam:[],ausencias:[]};
  if(!sched[day].ausencias) sched[day].ausencias=[];
  sched[day].ausencias=sched[day].ausencias.filter(a=>a.key!==funcKey);
  sched[day].ausencias.push({key:funcKey,tipo:ausKey});
  closePopup(); autoSave(); renderEditor(); renderSidebar();
  const aus=AUSENCIAS.find(a=>a.key===ausKey);
  toast(`${aus?.icon} ${fByKey(funcKey).label.split(' ')[0]} — ${aus?.label} registrado`);
};

function showFolgaSel(day,e) {
  const existing=(sched[day]?.folgam)||[], avail=funcs.filter(f=>!existing.includes(f.key));
  if(!avail.length){toast('Todos já têm folga neste dia');return;}
  pendingDrop={day,funcKey:null}; const pop=document.getElementById('turno-popup');
  document.getElementById('popup-who').innerHTML=`<span style="font-size:.8125rem;font-weight:600">Folga para quem? — Dia ${day}</span>`;
  document.getElementById('popup-grid').innerHTML=avail.map(f=>`<button class="turno-popup__btn" onclick="confirmFolga(${day},'${f.key}')" style="background:${f.bg};color:${f.text};border-color:${f.border}"><span class="turno-popup__btn-label">${f.label}</span></button>`).join('');
  document.querySelector('.turno-popup__custom').style.display='none';
  const cx=e.clientX,cy=e.clientY,pw=248,ph=180;
  let left=cx+12,top=cy-20;if(left+pw>window.innerWidth-12)left=cx-pw-12;if(top+ph>window.innerHeight-12)top=window.innerHeight-ph-12;
  pop.style.left=left+'px';pop.style.top=top+'px';pop.style.display='block';
}
window.confirmFolga=(day,funcKey)=>{
  const data=sched[day]||(sched[day]={shifts:[],folgam:[]});
  if(!data.folgam) data.folgam=[];
  if(!data.folgam.includes(funcKey)){data.folgam.push(funcKey);autoSave();renderEditor();runCltChecks();}
  document.querySelector('.turno-popup__custom')?.style.removeProperty('display'); closePopup();
};
function showFuncSelForTurno(day,turno,e) {
  pendingDrop={day,funcKey:null,turno}; const pop=document.getElementById('turno-popup');
  document.getElementById('popup-who').innerHTML=`<span style="font-size:.8125rem;font-weight:600">${turno.label} <span style="font-family:var(--font-mono);font-size:.6875rem;color:var(--text-muted)">${turno.value}</span> → Dia ${day}</span>`;
  document.getElementById('popup-grid').innerHTML=funcs.map(f=>`<button class="turno-popup__btn" onclick="confirmFuncForTurno('${f.key}')" style="background:${f.bg};color:${f.text};border-color:${f.border}"><span class="turno-popup__btn-label">${f.label}</span></button>`).join('');
  document.querySelector('.turno-popup__custom').style.display='none';
  const cx=e.clientX,cy=e.clientY,pw=248,ph=180;
  let left=cx+12,top=cy-20;if(left+pw>window.innerWidth-12)left=cx-pw-12;if(top+ph>window.innerHeight-12)top=window.innerHeight-ph-12;
  pop.style.left=left+'px';pop.style.top=top+'px';pop.style.display='block';
}
window.confirmFuncForTurno=funcKey=>{
  if(!pendingDrop)return;const{day,turno}=pendingDrop;
  const data=sched[day]||(sched[day]={shifts:[],folgam:[]});
  if(!data.shifts)data.shifts=[];
  if(!data.shifts.some(s=>s.key===funcKey)){data.shifts.push({key:funcKey,time:turno.value});autoSave();renderEditor();runCltChecks();}
  document.querySelector('.turno-popup__custom')?.style.removeProperty('display'); closePopup();
};

// ── Mode ──────────────────────────────────────
window.setMode = mode => {
  editorMode=mode;
  document.getElementById('mode-drag').classList.toggle('mode-btn--active',mode==='drag');
  document.getElementById('mode-click').classList.toggle('mode-btn--active',mode==='click');
  document.getElementById('drag-panel').style.display=mode==='drag'?'flex':'none';
  renderEditor();
};

// ── Remove ────────────────────────────────────
window.removeAusencia=(day,idx)=>{
  if(sched[day]?.ausencias){
    sched[day].ausencias.splice(idx,1);
    autoSave(); renderEditor(); renderSidebar();
  }
};
window.removeShift=(day,idx)=>{if(sched[day]?.shifts){sched[day].shifts.splice(idx,1);autoSave();renderEditor();renderSidebar();runCltChecks();}};
window.removeFolga=(day,idx)=>{if(sched[day]?.folgam){sched[day].folgam.splice(idx,1);autoSave();renderEditor();renderSidebar();runCltChecks();}};

// ── Day modal ─────────────────────────────────
window.openHolModal = day => {
  holEditDay=day; const data=sched[day]||{};
  document.getElementById('hol-title').textContent=`Dia ${day} — ${WD[new Date(vY,vM,day).getDay()]}, ${ML[vM]}`;
  const isH=data.type==='holiday';
  document.getElementById('htog').checked=isH;
  document.getElementById('hnwrap').style.display=isH?'block':'none';
  document.getElementById('hname').value=data.label||'';
  document.getElementById('hol-shifts-sec').style.display=isH?'none':'block';
  document.getElementById('hol-folgas-sec').style.display=isH?'none':'block';
  modalDay={shifts:JSON.parse(JSON.stringify(data.shifts||[])),folgam:JSON.parse(JSON.stringify(data.folgam||[]))};
  document.getElementById('sfunc').innerHTML=funcs.map(f=>`<option value="${f.key}">${f.label}</option>`).join('');
  document.getElementById('spreset').innerHTML=turnosAtivos.map(t=>`<option value="${t.value}">${t.label} — ${t.value}</option>`).join('');
  document.getElementById('itime').value=turnosAtivos[0]?.value||'';
  renderHolShifts(); renderHolFolgas();
  document.getElementById('hol-modal').style.display='flex';
};
window.closeHolModal=()=>{document.getElementById('hol-modal').style.display='none';holEditDay=null;};
window.closeHolOuter=e=>{if(e.target===document.getElementById('hol-modal'))closeHolModal();};
window.toggleHol=()=>{const on=document.getElementById('htog').checked;document.getElementById('hnwrap').style.display=on?'block':'none';document.getElementById('hol-shifts-sec').style.display=on?'none':'block';document.getElementById('hol-folgas-sec').style.display=on?'none':'block';};
window.applyPreset=()=>{document.getElementById('itime').value=document.getElementById('spreset').value;};
window.addModalShift=()=>{const key=document.getElementById('sfunc').value,time=document.getElementById('itime').value.trim();if(!key||!time)return;modalDay.shifts.push({key,time});renderHolShifts();};
window.removeHolShift=i=>{modalDay.shifts.splice(i,1);renderHolShifts();};
window.toggleHolFolga=key=>{const idx=modalDay.folgam.indexOf(key);if(idx>=0)modalDay.folgam.splice(idx,1);else modalDay.folgam.push(key);renderHolFolgas();};
function renderHolShifts(){
  const l=document.getElementById('hol-shifts-list');
  if(!modalDay.shifts.length){l.innerHTML='<p style="font-size:.8125rem;color:var(--text-faint);padding:4px 0;font-style:italic">Nenhum turno</p>';return;}
  l.innerHTML=modalDay.shifts.map((s,i)=>{const f=fByKey(s.key);return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
    <div style="width:7px;height:7px;border-radius:2px;background:${f.bg};border:1px solid ${f.border};flex-shrink:0"></div>
    <span style="flex:1;font-size:.8125rem;font-weight:500">${f.label}</span>
    <span style="font-size:.75rem;font-family:var(--font-mono);color:var(--text-muted)">${s.time}</span>
    <button class="btn btn--ghost btn--icon" onclick="removeHolShift(${i})" style="width:26px;height:26px">✕</button>
  </div>`;}).join('');
}
function renderHolFolgas(){
  document.getElementById('hol-folga-grid').innerHTML=funcs.map(f=>{const on=modalDay.folgam.includes(f.key);return`<div style="display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:var(--radius);border:1.5px solid ${on?'var(--amber)':'var(--border)'};background:${on?'var(--amber-light)':'var(--surface)'};cursor:pointer;font-size:.8125rem;font-weight:500;transition:all .15s;user-select:none;color:${on?'#78350f':'var(--text)'}" onclick="toggleHolFolga('${f.key}')">
    <div style="width:7px;height:7px;border-radius:2px;background:${f.bg};border:1px solid ${f.border}"></div>
    ${f.label}${on?'<span style="margin-left:auto;font-size:.75rem">✓</span>':''}
  </div>`;}).join('');
}
window.saveDay=()=>{
  if(!holEditDay)return; const isH=document.getElementById('htog').checked;
  if(isH){sched[holEditDay]={type:'holiday',label:document.getElementById('hname').value.trim()||'Feriado'};}
  else if(!modalDay.shifts.length&&!modalDay.folgam.length){delete sched[holEditDay];}
  else{sched[holEditDay]={shifts:modalDay.shifts,folgam:modalDay.folgam};}
  closeHolModal(); autoSave(); renderEditor(); renderSidebar(); runCltChecks();
};

// ── Swap modal ────────────────────────────────
window.openSwapModal=()=>{
  const opts=funcs.map(f=>`<option value="${f.key}">${f.label}</option>`).join('');
  ['sw-fa','sw-fb'].forEach(id=>document.getElementById(id).innerHTML=opts);
  ['sw-da','sw-da-new','sw-db','sw-db-new','sw-reason'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('swap-modal').style.display='flex';
};
window.closeSwapModal=()=>document.getElementById('swap-modal').style.display='none';
window.closeSwapOuter=e=>{if(e.target===document.getElementById('swap-modal'))closeSwapModal();};
window.confirmSwap=async()=>{
  const fA=document.getElementById('sw-fa').value,fB=document.getElementById('sw-fb').value;
  const dA=+document.getElementById('sw-da').value,dAnew=+document.getElementById('sw-da-new').value;
  const dB=+document.getElementById('sw-db').value,dBnew=+document.getElementById('sw-db-new').value;
  const reason=document.getElementById('sw-reason').value.trim();
  if(!fA||!fB||!dA||!dAnew||!dB||!dBnew){toast('Preencha todos os campos');return;}
  const move=(from,to,key)=>{
    if(!sched[from])return; const idx=sched[from].shifts?.findIndex(s=>s.key===key);
    if(idx===-1||idx===undefined)return;
    const shift={...sched[from].shifts[idx],isSwap:true};
    sched[from].shifts.splice(idx,1);
    if(!sched[to])sched[to]={shifts:[],folgam:[]};
    if(!sched[to].shifts)sched[to].shifts=[];
    sched[to].shifts.push(shift);
  };
  move(dA,dAnew,fA); move(dB,dBnew,fB);
  await addDoc(collection(db,`historico_${lojaId}`),{
    action:'Troca de turno',month:mKey(vY,vM),year:vY,monthIdx:vM,user:userEmail,
    ts:new Date().toISOString(),
    changes:[{type:'swap',funcA:fA,labelA:fByKey(fA).label,dayA:dA,dayAnew:dAnew,funcB:fB,labelB:fByKey(fB).label,dayB:dB,dayBnew:dBnew,reason}],
  });
  closeSwapModal(); autoSave(); renderEditor(); renderSidebar(); runCltChecks();
  toast(`Troca registrada: ${fByKey(fA).label.split(' ')[0]} ↔ ${fByKey(fB).label.split(' ')[0]}`);
};

// ── History modal ─────────────────────────────
window.openHistoryModal=async()=>{
  document.getElementById('history-modal').style.display='flex';
  const body=document.getElementById('hist-body');
  body.innerHTML='<div class="loading-state"><div class="spinner spinner--sm"></div> Carregando…</div>';
  try{
    const snap=await getDocs(query(collection(db,`historico_${lojaId}`),orderBy('ts','desc'),limit(50)));
    if(snap.empty){body.innerHTML='<div class="no-hist">Nenhuma alteração registrada ainda.</div>';return;}
    body.innerHTML=snap.docs.map(d=>{
      const h=d.data(); const dt=new Date(h.ts);
      const dtStr=`${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
      const ch=(h.changes||[]).map(c=>{
        if(c.type==='swap')
          return `<div style="margin-top:3px">Troca: ${c.labelA?.split(' ')[0]} dia ${c.dayA}→${c.dayAnew} ↔ ${c.labelB?.split(' ')[0]} dia ${c.dayB}→${c.dayBnew}${c.reason?` (${c.reason})`:''}</div>`;
        return `<div style="margin-top:3px">Dia ${c.day}: <span class="diff-before">Antes: ${describeDay(c.before)}</span><span class="diff-after">Depois: ${describeDay(c.after)}</span></div>`;
      }).join('');
      return `<div class="hist-entry">
        <div class="hist-entry__time">${dtStr}</div>
        <div class="hist-entry__body">
          <div class="hist-action">${h.action} · ${ML[h.monthIdx]} ${h.year}</div>
          <div class="hist-user">por ${h.user}</div>
          <div class="hist-detail">${ch}</div>
        </div>
      </div>`;
    }).join('');
  }catch(e){body.innerHTML='<div class="no-hist">Erro ao carregar.</div>';}
};
window.closeHistModal=()=>document.getElementById('history-modal').style.display='none';
window.closeHistOuter=e=>{if(e.target===document.getElementById('history-modal'))closeHistModal();};

// ── Archive modal ─────────────────────────────
window.openArchiveModal=async()=>{
  document.getElementById('archive-modal').style.display='flex';
  document.getElementById('arch-title').textContent=`Escalas anteriores · ${lojaInfo().nome}`;
  const body=document.getElementById('arch-body');
  body.innerHTML='<div class="loading-state"><div class="spinner spinner--sm"></div></div>';
  try{
    const snap=await getDocs(collection(db,col(lojaId)));
    const nowKey=mKey(now.getFullYear(),now.getMonth());
    const months=snap.docs.map(d=>({key:d.id,data:d.data()})).filter(m=>m.key<nowKey).sort((a,b)=>b.key.localeCompare(a.key));
    if(!months.length){body.innerHTML='<div class="no-hist">Nenhuma escala anterior.</div>';return;}
    body.innerHTML='<div class="archive-list">'+months.map(m=>{
      const[y,mo]=m.key.split('-').map(Number);
      const total=Object.values(m.data.days||{}).reduce((a,d)=>a+(d.shifts||[]).length,0);
      const fo=Object.values(m.data.days||{}).reduce((a,d)=>a+(d.folgam||[]).length,0);
      const pubBadge=m.data.published?`<span class="badge badge--green">Publicado</span>`:`<span class="badge badge--neutral">Rascunho</span>`;
      return`<div class="archive-item" onclick="openArchiveMonth('${m.key}',${JSON.stringify(m.data.days||{}).replace(/'/g,'&#39;')})">
        <div><div class="archive-item__label">${ML[mo-1]} ${y}</div><div class="archive-item__meta">${total} turnos · ${fo} folgas</div></div>
        <div class="archive-item__right">${pubBadge}<span style="color:var(--text-faint)">›</span></div>
      </div>`;
    }).join('')+'</div>';
  }catch(e){body.innerHTML='<div class="no-hist">Erro ao carregar.</div>';}
};
window.openArchiveMonth=(key,days)=>{
  const[y,mo]=key.split('-').map(Number);
  const dim=new Date(y,mo,0).getDate(), fw=new Date(y,mo-1,1).getDay();
  let html=`<button class="arch-back" onclick="openArchiveModal()">‹ Voltar</button>
    <div style="font-size:1rem;font-weight:700;margin-bottom:.5rem">${ML[mo-1]} ${y}</div>
    <div class="arch-cal">
      ${WD.map(w=>`<div class="arch-wday">${w}</div>`).join('')}
      ${Array(fw).fill('<div class="arch-day arch-day--empty"></div>').join('')}`;
  for(let d=1;d<=dim;d++){
    const data=days[d]||{};
    html+=`<div class="arch-day"><div class="arch-day__num">${d}</div>`;
    if(data.type==='holiday'){html+=`<div class="arch-chip" style="background:var(--amber-light);color:#78350f;border-color:#fde68a">${data.label||'Feriado'}</div>`;}
    else{(data.shifts||[]).forEach(s=>{const f=fByKey(s.key);html+=`<div class="arch-chip" style="background:${f.bg};color:${f.text};border-color:${f.border}">${f.label.split(' ')[0]}</div>`;});(data.folgam||[]).forEach(k=>{const f=fByKey(k);html+=`<div class="arch-off">${f.label.split(' ')[0]}</div>`;});}
    html+=`</div>`;
  }
  html+='</div>';
  document.getElementById('arch-body').innerHTML=html;
};
window.closeArchiveModal=()=>document.getElementById('archive-modal').style.display='none';
window.closeArchiveOuter=e=>{if(e.target===document.getElementById('archive-modal'))closeArchiveModal();};

// ── Copy modal ────────────────────────────────
window.openCopyModal=async()=>{
  selCopyKey=null;
  document.getElementById('copy-target').textContent=`${ML[vM]} ${vY}`;
  document.getElementById('btn-confirm-copy').disabled=true;
  document.getElementById('btn-confirm-copy').style.opacity='.4';
  document.getElementById('copy-modal').style.display='flex';
  const list=document.getElementById('copy-list');
  list.innerHTML='<div class="loading-state"><div class="spinner spinner--sm"></div></div>';
  try{
    const snap=await getDocs(collection(db,col(lojaId)));
    const curKey=mKey(vY,vM);
    const months=snap.docs.map(d=>({key:d.id,data:d.data()})).filter(m=>m.key!==curKey).sort((a,b)=>b.key.localeCompare(a.key)).slice(0,12);
    if(!months.length){list.innerHTML='<div class="no-hist">Nenhum mês disponível.</div>';return;}
    list.innerHTML='<div class="copy-list">'+months.map(m=>{
      const[y,mo]=m.key.split('-').map(Number);
      const total=Object.values(m.data.days||{}).reduce((a,d)=>a+(d.shifts||[]).length,0);
      return`<div class="copy-item" id="ci-${m.key}" onclick="selectCopyMonth('${m.key}')">
        <div class="copy-item__label">${ML[mo-1]} ${y}</div>
        <div class="copy-item__count">${total} turnos</div>
      </div>`;
    }).join('')+'</div>';
  }catch(e){list.innerHTML='<div class="no-hist">Erro ao carregar.</div>';}
};
window.selectCopyMonth=key=>{
  selCopyKey=key;
  document.querySelectorAll('.copy-item').forEach(el=>el.classList.remove('copy-item--selected'));
  document.getElementById('ci-'+key)?.classList.add('copy-item--selected');
  const btn=document.getElementById('btn-confirm-copy'); btn.disabled=false; btn.style.opacity='1';
};
window.confirmCopy=async()=>{
  if(!selCopyKey)return;
  try{
    const snap=await getDoc(doc(db,col(lojaId),selCopyKey));
    if(!snap.exists()){toast('Mês não encontrado');return;}
    const src=snap.data().days||{};
    sched={};
    Object.entries(src).forEach(([d,data])=>{
      sched[d]={type:data.type,label:data.label,shifts:(data.shifts||[]).map(s=>({key:s.key,time:s.time})),folgam:[...(data.folgam||[])]};
      if(!sched[d].type)delete sched[d].type; if(!sched[d].label)delete sched[d].label;
    });
    closeCopyModal(); autoSave(); renderEditor(); renderSidebar(); runCltChecks(); loadFerBanner();
    toast('Escala copiada! Ajuste as exceções e publique.');
  }catch(e){toast('Erro ao copiar.');}
};
window.closeCopyModal=()=>{document.getElementById('copy-modal').style.display='none';selCopyKey=null;};
window.closeCopyOuter=e=>{if(e.target===document.getElementById('copy-modal'))closeCopyModal();};

// ── Pattern modal ─────────────────────────────
window.openPatternModal=()=>{
  patternState={};
  document.getElementById('pattern-turno').innerHTML=turnosAtivos.map(t=>`<option value="${t.value}">${t.label} — ${t.value}</option>`).join('');
  document.getElementById('pattern-rows').innerHTML=WD.map((w,i)=>`
    <div class="pattern-row">
      <span class="pattern-wday ${i===0||i===6?'pattern-wday--we':''}">${w}</span>
      <div class="pattern-funcs" id="pf-${i}">
        ${funcs.map(f=>`<div class="pattern-func" id="pfc-${i}-${f.key}" onclick="togglePatternFunc(${i},'${f.key}')">${f.label.split(' ')[0]}</div>`).join('')}
      </div>
    </div>`).join('');
  document.getElementById('pattern-modal').style.display='flex';
};
window.togglePatternFunc=(dow,key)=>{
  if(!patternState[dow])patternState[dow]=[];
  const idx=patternState[dow].indexOf(key); const chip=document.getElementById(`pfc-${dow}-${key}`); const f=fByKey(key);
  if(idx>=0){patternState[dow].splice(idx,1);chip.className='pattern-func';chip.style.background='var(--neutral-100)';chip.style.color='var(--text-muted)';chip.style.borderColor='var(--border)';}
  else{patternState[dow].push(key);chip.className='pattern-func pattern-func--on';chip.style.background=f.bg;chip.style.color=f.text;chip.style.borderColor=f.border;}
};
window.applyPattern=()=>{
  const turno=document.getElementById('pattern-turno').value;
  const dim=new Date(vY,vM+1,0).getDate(); let applied=0;
  for(let d=1;d<=dim;d++){
    const dow=new Date(vY,vM,d).getDay(); const fs=patternState[dow]||[];
    if(!fs.length||sched[d]?.type==='holiday')continue;
    if(!sched[d])sched[d]={shifts:[],folgam:[]};
    fs.forEach(key=>{if(!(sched[d].shifts||[]).some(s=>s.key===key)){if(!sched[d].shifts)sched[d].shifts=[];sched[d].shifts.push({key,time:turno});applied++;}});
  }
  closePatternModal(); autoSave(); renderEditor(); renderSidebar(); runCltChecks();
  toast(`Padrão aplicado — ${applied} turnos adicionados`);
};
window.closePatternModal=()=>document.getElementById('pattern-modal').style.display='none';
window.closePatternOuter=e=>{if(e.target===document.getElementById('pattern-modal'))closePatternModal();};


// ── PDF Export (admin) ────────────────────────
window.exportSchedulePDF = () => {
  const prev = document.title;
  document.title = `Escala-LaRose-${lojaInfo().nome.replace(/ /g,'-')}-${ML[vM]}-${vY}`;
  window.print();
  document.title = prev;
};

// ── Funcionários Manager ──────────────────────
// Paleta de cores: 12 cores distintas e profissionais.
// Evita conflito visual com os tipos de ausência (vermelho, azul, roxo, âmbar, verde).
const FUNC_COLORS = [
  // Warm spectrum
  { bg:'#fff0f6', text:'#9d174d', border:'#f9a8d4', label:'Rosa'     }, // hot-pink — vivid
  { bg:'#fff7ed', text:'#c2410c', border:'#fb923c', label:'Laranja'   }, // deep-orange
  { bg:'#fefce8', text:'#854d0e', border:'#fbbf24', label:'Dourado'   }, // golden-yellow
  // Cool spectrum
  { bg:'#ecfdf5', text:'#065f46', border:'#34d399', label:'Esmeralda' }, // emerald-green
  { bg:'#e0fdfa', text:'#164e63', border:'#22d3ee', label:'Cyan'      }, // cyan-teal
  { bg:'#eff6ff', text:'#1d4ed8', border:'#60a5fa', label:'Azul'      }, // royal-blue
  { bg:'#f5f3ff', text:'#5b21b6', border:'#a78bfa', label:'Violeta'   }, // violet
  // Neutral-warm
  { bg:'#fdf2ff', text:'#7e22ce', border:'#c084fc', label:'Púrpura'   }, // purple
  { bg:'#fef2f2', text:'#b91c1c', border:'#f87171', label:'Vermelho'  }, // red (kept for its uniqueness)
  { bg:'#f0fdf4', text:'#15803d', border:'#4ade80', label:'Verde'     }, // bright-green
  { bg:'#fff1f2', text:'#be123c', border:'#fb7185', label:'Rose'      }, // rose-coral
  { bg:'#fafafa', text:'#374151', border:'#9ca3af', label:'Cinza'     }, // slate-gray
];

let funcEditList = []; // working copy
let selectedColor = 0;

window.openFuncManager = () => {
  // Clone current funcs
  funcEditList = JSON.parse(JSON.stringify(funcs));
  selectedColor = 0;

  document.getElementById('func-modal-title').textContent =
    `Equipe · ${lojaInfo().nome}`;

  renderFuncList();
  renderColorPicker();

  // Clear add form
  document.getElementById('fnew-name').value = '';
  document.getElementById('fnew-key').value  = '';

  document.getElementById('func-modal').style.display = 'flex';
};

function renderFuncList() {
  const el = document.getElementById('func-list');
  if (!funcEditList.length) {
    el.innerHTML = '<p style="font-size:.8125rem;color:var(--faint);font-style:italic;padding:4px 0">Nenhum funcionário nesta loja.</p>';
    return;
  }
  el.innerHTML = funcEditList.map((f, i) => `
    <div class="func-manager-item">
      <div class="fmi-swatch" style="background:${f.bg};color:${f.text};border-color:${f.border}">
        ${f.label.split(' ').map(w=>w[0]).slice(0,2).join('')}
      </div>
      <span class="fmi-name">${f.label}</span>
      <button class="fmi-del" onclick="removeFuncLocal(${i})" title="Remover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`).join('');
}

function renderColorPicker() {
  const el = document.getElementById('func-colors');
  el.innerHTML = FUNC_COLORS.map((col, i) => `
    <div class="color-opt ${i===selectedColor?'color-opt--on':''}"
      style="background:${col.bg};border-color:${i===selectedColor?col.text:'rgba(0,0,0,.08)'}"
      onclick="selectColor(${i})" title="${col.label}">
      <span style="font-size:.5625rem;font-weight:700;color:${col.text};opacity:${i===selectedColor?1:.7}">${col.label}</span>
    </div>`).join('');
}

window.selectColor = i => { selectedColor = i; renderColorPicker(); };

window.removeFuncLocal = i => {
  funcEditList.splice(i, 1);
  renderFuncList();
};

// Auto-generate key from name
document.addEventListener('input', e => {
  if (e.target.id !== 'fnew-name') return;
  const key = e.target.value
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'')
    .slice(0, 20);
  document.getElementById('fnew-key').value = key;
});

window.addFuncLocal = () => {
  const name = document.getElementById('fnew-name').value.trim();
  const key  = document.getElementById('fnew-key').value.trim().toLowerCase();

  if (!name) { toast('Digite o nome do funcionário'); return; }
  if (!key)  { toast('Digite a chave interna'); return; }
  if (funcEditList.some(f => f.key === key)) { toast('Esta chave já existe'); return; }

  const col = FUNC_COLORS[selectedColor];
  funcEditList.push({ key, label: name, bg: col.bg, text: col.text, border: col.border });
  document.getElementById('fnew-name').value = '';
  document.getElementById('fnew-key').value  = '';
  renderFuncList();
  toast(`${name} adicionado`);
};

window.saveFuncs = async () => {
  // Save to Firestore under config collection
  const key = `config_${lojaId}`;
  try {
    await setDoc(doc(db, 'configuracoes', key), {
      funcionarios: funcEditList,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    });
    // Update local state
    FUNCIONARIOS[lojaId] = funcEditList;
    funcs = funcEditList;
    buildDragPanel();
    renderSidebar();
    closeFuncModal();
    toast('✓ Equipe salva com sucesso');
  } catch(e) {
    console.error(e);
    toast('Erro ao salvar. Verifique as regras do Firestore.');
  }
};

// Load funcs from Firestore on startup (overrides config file if saved)
async function loadFuncsFromDB() {
  try {
    const snap = await getDoc(doc(db, 'configuracoes', `config_${lojaId}`));
    if (snap.exists() && snap.data().funcionarios?.length) {
      FUNCIONARIOS[lojaId] = snap.data().funcionarios;
      funcs = snap.data().funcionarios;
      buildDragPanel();
    }
  } catch(e) { /* use defaults */ }
}

window.closeFuncModal  = () => document.getElementById('func-modal').style.display='none';
window.closeFuncOuter  = e => { if(e.target===document.getElementById('func-modal')) closeFuncModal(); };

// ── Copy Day ─────────────────────────────────
let copyDaySource = null;

window.openCopyDayModal = (day) => {
  copyDaySource = day;
  document.getElementById('copy-from-label').textContent =
    `${day} de ${ML[vM]} (${WD[new Date(vY,vM,day).getDay()]})`;
  document.getElementById('copy-to-day').value = '';
  document.getElementById('copy-append').checked = false;
  document.getElementById('copy-day-modal').style.display = 'flex';
};
window.closeCopyDayModal = () => {
  document.getElementById('copy-day-modal').style.display = 'none';
  copyDaySource = null;
};
window.confirmCopyDay = () => {
  const toDay  = parseInt(document.getElementById('copy-to-day').value);
  const append = document.getElementById('copy-append').checked;
  const dim    = new Date(vY,vM+1,0).getDate();
  if (!toDay || toDay < 1 || toDay > dim) { toast('Dia inválido'); return; }
  if (toDay === copyDaySource)            { toast('Escolha um dia diferente'); return; }
  const src = sched[copyDaySource] || {};
  if (append) {
    const dest = sched[toDay] || {};
    sched[toDay] = {
      ...dest,
      shifts:    [...(dest.shifts||[]),    ...(src.shifts||[]).filter(s=>!(dest.shifts||[]).some(d=>d.key===s.key&&d.time===s.time))],
      folgam:    [...new Set([...(dest.folgam||[]),    ...(src.folgam||[])])],
      ausencias: [...(dest.ausencias||[]), ...(src.ausencias||[]).filter(a=>!(dest.ausencias||[]).some(d=>d.key===a.key&&d.tipo===a.tipo))],
    };
  } else {
    sched[toDay] = JSON.parse(JSON.stringify(src));
  }
  closeCopyDayModal();
  autoSave(); renderEditor(); renderSidebar(); runCltChecks();
  toast(`Dia ${copyDaySource} → Dia ${toDay} copiado`);
};


// ── Turno Manager ─────────────────────────────
async function loadTurnos() {
  try {
    const snap = await getDoc(doc(db, 'configuracoes', `turnos_${lojaId}`));
    if (snap.exists() && snap.data().turnos?.length) {
      turnosAtivos = snap.data().turnos;
      buildDragPanel();
    }
  } catch(e) { /* use defaults */ }
}

async function saveTurnos() {
  try {
    await setDoc(doc(db, 'configuracoes', `turnos_${lojaId}`), {
      turnos: turnosAtivos, updatedAt: new Date().toISOString()
    });
    toast('✓ Turnos salvos');
  } catch(e) { toast('Erro ao salvar turnos'); }
}

window.openTurnoManager = () => {
  renderTurnoList();
  document.getElementById('turno-modal').style.display = 'flex';
};
window.closeTurnoModal = () => document.getElementById('turno-modal').style.display = 'none';
window.closeTurnoOuter = e => { if(e.target===document.getElementById('turno-modal')) closeTurnoModal(); };

function renderTurnoList() {
  document.getElementById('turno-list').innerHTML = turnosAtivos.map((t,i) => `
    <div class="turno-mgr-item">
      <div class="turno-mgr-item__body">
        <input class="input turno-mgr-item__label" value="${t.label}"
          onchange="turnosAtivos[${i}].label=this.value;buildDragPanel()"
          style="height:32px;font-size:.8125rem;font-weight:700;width:90px">
        <input class="input turno-mgr-item__time" value="${t.value}"
          onchange="turnosAtivos[${i}].value=this.value;buildDragPanel()"
          placeholder="08:00–16:20"
          style="height:32px;font-size:.8125rem;font-family:var(--mono);width:110px">
      </div>
      <button class="btn btn--danger btn--sm btn--icon" onclick="deleteTurno(${i})" title="Remover">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>`).join('');
}

window.deleteTurno = i => {
  if (turnosAtivos.length <= 1) { toast('Precisa ter ao menos 1 turno'); return; }
  turnosAtivos.splice(i, 1);
  buildDragPanel();
  renderTurnoList();
};

window.addTurno = () => {
  const label = document.getElementById('new-turno-label').value.trim();
  const value = document.getElementById('new-turno-value').value.trim();
  if (!label || !value) { toast('Preencha nome e horário'); return; }
  turnosAtivos.push({ label, value });
  document.getElementById('new-turno-label').value = '';
  document.getElementById('new-turno-value').value = '';
  buildDragPanel();
  renderTurnoList();
  toast(`✓ Turno "${label}" adicionado`);
};

window.saveTurnosAndClose = async () => {
  await saveTurnos();
  closeTurnoModal();
};


// ── Mobile tap — chip selection without drag ──────────
let mobilePendingType = null;
let mobilePendingData = null;

window.mobileSelectFunc = funcKey => {
  mobilePendingType = 'func';
  mobilePendingData = { key: funcKey };
  toast(`${fByKey(funcKey).label.split(' ')[0]} selecionado — toque num dia`);
  highlightCells(true);
};

window.mobileSelectTurno = turno => {
  mobilePendingType = 'turno';
  mobilePendingData = turno;
  toast(`${turno.label} selecionado — toque num dia`);
  highlightCells(true);
};

window.mobileAusencia = key => {
  mobilePendingType = 'ausencia';
  mobilePendingData = { key };
  const aus = AUSENCIAS.find(a=>a.key===key);
  toast(`${aus?.icon} ${aus?.label} — toque num dia`);
  highlightCells(true);
};

function highlightCells(on) {
  document.querySelectorAll('.cal-cell:not(.cal-cell--empty)').forEach(el => {
    el.style.outline = on ? '2px dashed var(--loja-color)' : '';
  });
}

function handleMobileCellTap(day) {
  if (!mobilePendingType) return;
  highlightCells(false);
  const e = { clientX: window.innerWidth/2, clientY: window.innerHeight/2 };
  if (mobilePendingType === 'func')    { showTurnoPopup(day, mobilePendingData.key, e.clientX, e.clientY); }
  else if (mobilePendingType === 'turno')  { showFuncSelForTurno(day, mobilePendingData, e); }
  else if (mobilePendingType === 'ausencia') { showAusenciaSel(day, mobilePendingData.key, e); }
  mobilePendingType = null;
  mobilePendingData = null;
}

// ── Boot ──────────────────────────────────────
document.getElementById('year-label').textContent=vY;
renderMonthGrid();
