// ─────────────────────────────────────────────
//  La Rose · Painel Público
// ─────────────────────────────────────────────
import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { FIREBASE_CONFIG, LOJAS, FUNCIONARIOS, AUSENCIAS } from './firebase-config.js';

const app = initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WDAYS  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const now    = new Date();

// ── State ──────────────────────────────────
let lojaId   = localStorage.getItem('lr_loja') || null;
let lojaData = null;
let funcs    = [];
let filter   = 'todos';
let cache    = {};

// ── Helpers ────────────────────────────────
const mKey  = (y,m) => `${y}-${String(m+1).padStart(2,'0')}`;
const colId = id  => `escalas_${id}`;
const fByKey= k   => funcs.find(f=>f.key===k) || { bg:'#f1f5f9',text:'#475569',border:'#e2e8f0',label:k,key:k };

// ── Store selector ──────────────────────────
function buildSelector() {
  document.getElementById('ss-list').innerHTML = LOJAS.map(l => `
    <button class="ss-item ${l.id}" onclick="selectStore('${l.id}')">
      <div class="ss-item__bar" style="background:${l.color}"></div>
      <div class="ss-item__text">
        <div class="ss-item__name" style="color:${l.color}">${l.nome}</div>
        <div class="ss-item__label">${l.label}</div>
      </div>
      <div class="ss-item__arrow">›</div>
    </button>`).join('');
}

window.selectStore = id => {
  lojaData = LOJAS.find(l=>l.id===id);
  lojaId   = id;
  funcs    = FUNCIONARIOS[id] || [];
  filter   = 'todos';
  cache    = {};
  localStorage.setItem('lr_loja', id);
  applyTheme();
  document.getElementById('store-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'block';
  document.getElementById('hdr-store').textContent = lojaData.nome;
  render();
};

window.backToStores = () => {
  document.getElementById('store-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display   = 'none';
};

function applyTheme() {
  const r  = document.documentElement;
  const l1 = lojaId === 'loja1';
  r.style.setProperty('--loja-color',  l1 ? '#16a34a' : '#1d4ed8');
  r.style.setProperty('--loja-dark',   l1 ? '#14532d' : '#1e3a8a');
  r.style.setProperty('--loja-light',  l1 ? '#f0fdf4' : '#eff6ff');
  r.style.setProperty('--loja-border', l1 ? '#bbf7d0' : '#bfdbfe');
  document.getElementById('app-header').style.background = l1 ? '#14532d' : '#1e3a8a';
  document.getElementById('theme-meta').content = l1 ? '#16a34a' : '#1d4ed8';
}

// ── Firebase ────────────────────────────────
async function loadMonth() {
  const key = mKey(now.getFullYear(), now.getMonth());
  if (cache[key] !== undefined) return cache[key];
  try {
    const snap = await getDoc(doc(db, colId(lojaId), key));
    cache[key] = (snap.exists() && snap.data().published) ? snap.data() : null;
    return cache[key];
  } catch(e) { return null; }
}

// ── Render ──────────────────────────────────
async function render() {
  const y = now.getFullYear(), m = now.getMonth();
  const main = document.getElementById('main');
  main.innerHTML = '<div class="loading-state"><div class="spinner"></div> Carregando…</div>';

  const data = await loadMonth();
  const monthStr = `${MONTHS[m]} ${y}`;
  document.getElementById('hdr-month').textContent = monthStr;

  if (!data) {
    main.innerHTML = `<div class="no-sched">
      <div class="no-sched__icon">📅</div>
      <div class="no-sched__title">Escala de ${MONTHS[m]} não disponível</div>
      <div class="no-sched__desc">A escala ainda não foi publicada. Fale com o gestor.</div>
    </div>`;
    return;
  }

  const days    = data.days || {};
  const dim     = new Date(y,m+1,0).getDate();
  const fw      = new Date(y,m,1).getDay();
  const today   = now.getDate();
  const isF     = filter !== 'todos';
  const aFund   = isF ? fByKey(filter) : null;

  // Compute per-person stats
  // Feriados não pulam mais o dia — folgas e turnos em feriados entram na contagem
  const offDays = [];
  let tShifts=0, tOff=0, feriados=0;
  for (let d=1; d<=dim; d++) {
    const dd=days[d]||{};
    if (dd.type==='holiday') feriados++;
    const sh=(dd.shifts||[]).filter(s=>!isF||s.key===filter);
    const fo=(dd.folgam||[]).filter(k=>!isF||k===filter);
    tShifts+=sh.length; tOff+=fo.length;
    if (isF && fo.length) offDays.push(d);
  }

  const visFuncs = funcs.filter(f =>
    Object.values(days).some(d =>
      (d.shifts||[]).some(s=>s.key===f.key) || (d.folgam||[]).includes(f.key)
    )
  );

  let h = '';

  // Stats row
  h += `<div class="stats">
    <div class="stat">
      <div class="stat__label">Mês</div>
      <div class="stat__value stat__value--word">${MONTHS[m]}</div>
    </div>
    <div class="stat">
      <div class="stat__label">Dias</div>
      <div class="stat__value">${dim}</div>
    </div>
    <div class="stat">
      <div class="stat__label">Semanas</div>
      <div class="stat__value">${Math.ceil(dim/7)}</div>
    </div>
    <div class="stat">
      <div class="stat__label">Feriados</div>
      <div class="stat__value">${feriados}</div>
    </div>
  </div>`;

  // Filter pills
  h += `<div class="filter-bar">
    <span class="filter-bar__lbl">Ver</span>
    <div class="filter-pills">
      <button class="pill ${!isF?'pill--on':''}" onclick="setFilter('todos')">Todos</button>
      ${visFuncs.map(f=>`
        <button class="pill ${filter===f.key?'pill--on':''}" onclick="setFilter('${f.key}')">
          <span class="pill__dot" style="background:${f.bg};border-color:${f.border}"></span>
          ${f.label}
        </button>`).join('')}
    </div>
  </div>`;

  // Profile panel
  if (isF && aFund) {
    const ini = aFund.label.split(' ').map(w=>w[0]).slice(0,2).join('');
    const free = Math.max(0, dim - feriados - tShifts - tOff);
    h += `<div class="profile">
      <div class="profile__head">
        <div class="profile__who">
          <div class="profile__avatar" style="background:${aFund.bg};color:${aFund.text};border:2px solid ${aFund.border}">${ini}</div>
          <div>
            <div class="profile__name" style="color:${aFund.text}">${aFund.label}</div>
            <div class="profile__month">${monthStr}</div>
          </div>
        </div>
        <button class="profile__close" onclick="setFilter('todos')">✕</button>
      </div>
      <div class="profile__stats">
        <div class="profile__stat">
          <div class="profile__stat-v" style="color:${aFund.text}">${tShifts}</div>
          <div class="profile__stat-l">Turnos</div>
        </div>
        <div class="profile__stat profile__stat--off">
          <div class="profile__stat-v">${tOff}</div>
          <div class="profile__stat-l">Folgas</div>
        </div>
        <div class="profile__stat">
          <div class="profile__stat-v" style="color:var(--muted);font-size:1.5rem">${free}</div>
          <div class="profile__stat-l">Dias livres</div>
        </div>
      </div>
      ${offDays.length ? `
        <div class="profile__off-strip">
          <div class="profile__off-title">🏖 Dias de folga</div>
          <div class="profile__off-days">
            ${offDays.map(d=>{
              const wd=WDAYS[new Date(y,m,d).getDay()];
              return `<div class="off-day"><span>${d}</span><span class="off-day__wd">${wd}</span></div>`;
            }).join('')}
          </div>
        </div>` : ''}
    </div>`;
  }

  // Calendar
  h += `<div class="print-header">
    <div class="print-header__title">La Rose · ${lojaData.label}</div>
    <div class="print-header__sub">Escala de ${monthStr}</div>
  </div>
  <div class="calendar">
    ${WDAYS.map((w,i)=>`<div class="cal-wday ${i===0||i===6?'cal-wday--we':''}">${w}</div>`).join('')}
    ${Array(fw).fill('<div class="cal-day cal-day--empty"></div>').join('')}`;

  for (let d=1; d<=dim; d++) {
    const dd      = days[d]||{};
    const isToday = d===today;
    const isPast  = today>0 && d<today;
    const myShifts= (dd.shifts||[]).filter(s=>!isF||s.key===filter);
    const myOff   = (dd.folgam||[]).filter(k=>!isF||k===filter);
    const iAmOff  = isF && myOff.length>0;
    const iAmWork = isF && myShifts.length>0;

    let cls = 'cal-day';
    if (isToday)           cls += ' cal-day--today';
    else if (isPast)       cls += ' cal-day--past';
    if (dd.type==='holiday')cls += ' cal-day--hol';
    if (iAmOff)            cls += ' cal-day--off';
    else if (iAmWork)      cls += ' cal-day--work';

    h += `<div class="${cls}">
      <div class="cal-day__num">${d}${isToday?'<span class="today-pip">HOJE</span>':''}</div>`;

    // Feriado: mostra o label mas continua renderizando turnos e folgas normalmente
    if (dd.type==='holiday') {
      h += `<div class="hol-label">🎉 ${dd.label||'Feriado'}</div>`;
    }

    if (iAmOff) {
      h += `<div class="off-hero">
        <div class="off-hero__icon">⛱</div>
        <div class="off-hero__text">Folga</div>
        <div class="off-hero__name">${aFund.label.split(' ')[0]}</div>
      </div>`;
    } else if (isF) {
      myShifts.forEach(s=>{
        const f=fByKey(s.key);
        h+=`<div class="chip chip--hero" style="background:${f.bg};color:${f.text};border-color:${f.border}">
          <span class="chip__n">${f.label.split(' ')[0]}</span>
          <span class="chip__t">${s.time}</span>
        </div>`;
      });
      (dd.ausencias||[]).filter(a=>a.key===filter).forEach(a=>{
        const aus=AUSENCIAS.find(x=>x.key===a.tipo)||{icon:'📋',bg:'#f1f5f9',text:'#475569',label:a.tipo};
        h+=`<div class="ausencia-badge ausencia-badge--hero" style="background:${aus.bg};color:${aus.text};border-color:${aus.border}">
          <span style="font-size:.875rem">${aus.icon}</span>
          <span>${aus.label}</span>
        </div>`;
      });
    } else {
      (dd.shifts||[]).forEach(s=>{
        const f=fByKey(s.key);
        h+=`<div class="chip" style="background:${f.bg};color:${f.text};border-color:${f.border}">
          <span class="chip__n">${f.label.split(' ')[0]}</span>
          <span class="chip__t">${s.time}</span>
        </div>`;
      });
      (dd.folgam||[]).forEach(k=>{
        const f=fByKey(k);
        h+=`<div class="off-badge" style="background:var(--green);border-color:var(--green)">⛱ ${f.label.split(' ')[0]}</div>`;
      });
      (dd.ausencias||[]).filter(a=>!isF||a.key===filter).forEach(a=>{
        const f=fByKey(a.key);
        const aus=AUSENCIAS.find(x=>x.key===a.tipo)||{icon:'📋',bg:'#f1f5f9',text:'#475569',border:'#e2e8f0',label:a.tipo};
        h+=`<div class="ausencia-badge" style="background:${aus.bg};color:${aus.text};border-color:${aus.border}">${aus.icon} ${f.label.split(' ')[0]}</div>`;
      });
    }
    h += `</div>`;
  }

  h += `</div>
  <div class="legend">
    <span class="legend__lbl">Legenda</span>
    <div class="legend__items">
      ${visFuncs.map(f=>`
        <div class="legend__item">
          <div class="legend__sw" style="background:${f.bg};border-color:${f.text}"></div>
          ${f.label}
        </div>`).join('')}
      <div class="legend__off" style="background:var(--green);border-color:var(--green)">⛱ Folga</div>
      ${AUSENCIAS.map(a=>`
        <div class="legend__item legend__item--aus" style="background:${a.bg};color:${a.text};border-color:${a.border}">
          <span>${a.icon}</span>${a.label}
        </div>`).join('')}
    </div>
  </div>`;

  main.innerHTML = h;
}

// ── Controls ────────────────────────────────
window.setFilter = key => { filter=key; cache={}; render(); };

window.exportPDF = () => {
  // Ensure print header has store + month info
  let ph = document.querySelector('.print-header');
  if (ph) {
    ph.querySelector('.print-header__title').textContent =
      `La Rose · ${lojaData ? lojaData.label : ''}`;
    ph.querySelector('.print-header__sub').textContent =
      `Escala de ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }
  const prev = document.title;
  document.title = `Escala-LaRose-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;
  window.print();
  document.title = prev;
};

// ── Day tap expand (mobile) ───────────────────
// Adds press-and-hold / tap-to-expand on calendar days
// Works with both touch (mobile) and mouse (desktop preview)
// ── Day tap expand — 1 tap expands, 1 tap on same day collapses ──
// Uses native 'click' event — browser already handles tap vs scroll distinction
let _expandedDay = null;

function setupDayTap() {
  // Only register once, on document — survives render() replacing innerHTML
  if (document._dayTapReady) return;
  document._dayTapReady = true;

  document.addEventListener('click', e => {
    const cell = e.target.closest('.cal-day:not(.cal-day--empty)');

    // Tapped outside calendar — collapse
    if (!cell) {
      if (_expandedDay) {
        _expandedDay.classList.remove('cal-day--expanded');
        _expandedDay = null;
      }
      return;
    }

    // Same day tapped — collapse
    if (_expandedDay === cell) {
      cell.classList.remove('cal-day--expanded');
      _expandedDay = null;
      return;
    }

    // Different day — collapse old, expand new
    if (_expandedDay) _expandedDay.classList.remove('cal-day--expanded');
    cell.classList.add('cal-day--expanded');
    _expandedDay = cell;
  });
}

// ── Boot ────────────────────────────────────
setupDayTap();
buildSelector();
// Always start at store selector — user must choose each visit

