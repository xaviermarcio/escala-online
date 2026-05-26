// ─────────────────────────────────────────────
//  La Rose Escala · Firebase Config
// ─────────────────────────────────────────────
export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBI18jcxoehYL_2Fs8o82SqiqBTZTVVzEQ",
  authDomain:        "larose-escala.firebaseapp.com",
  projectId:         "larose-escala",
  storageBucket:     "larose-escala.firebasestorage.app",
  messagingSenderId: "120340322283",
  appId:             "1:120340322283:web:4099a841830d219b6eaba"
};

// ─────────────────────────────────────────────
//  Lojas
// ─────────────────────────────────────────────
export const LOJAS = [
  {
    id:         'loja1',
    nome:       'Entre Lagos',
    label:      'Loja 1 · Entre Lagos',
    color:      '#16a34a',
    colorLight: '#f0fdf4',
    colorDark:  '#14532d',
    colorBorder:'#bbf7d0',
  },
  {
    id:         'loja2',
    nome:       'Itapoã Parque',
    label:      'Loja 2 · Itapoã Parque',
    color:      '#2563eb',
    colorLight: '#eff6ff',
    colorDark:  '#1e3a8a',
    colorBorder:'#bfdbfe',
  },
];

// ─────────────────────────────────────────────
//  Funcionários
// ─────────────────────────────────────────────
export const FUNCIONARIOS = {
  // Colors chosen to NOT conflict with absence legend colors:
  // Absences use: red (atestado), blue (ferias), purple (licenca), amber (falta), green (folga extra)
  // Employee colors: DISTINCTLY different from absence types
  // Absence bg colors: red(atestado), blue(ferias), purple(licenca), amber/yellow(falta), green(folga_ex)
  // Employees: teal (≠ any absence), fuchsia (≠ red), coral/tomato (≠ amber), slate-blue (≠ blue/purple)
  loja1: [
    { key: 'michele',  label: 'Michele Moreira', bg: '#cffafe', text: '#155e75', border: '#22d3ee' }, // cyan — distinct from all
    { key: 'rosanea',  label: 'Rosanea',          bg: '#fdf2ff', text: '#86198f', border: '#d946ef' }, // fuchsia — distinct from red
    { key: 'rosilene', label: 'Rosilene',          bg: '#fff1f2', text: '#9f1239', border: '#fb7185' }, // rose/coral — distinct from amber
    { key: 'italo',    label: 'Ítalo',             bg: '#f0fdf4', text: '#14532d', border: '#4ade80' }, // lime-green — OK since folga_ex is soft green
  ],
  loja2: [
    { key: 'amanda',     label: 'Amanda',      bg: '#fdf2ff', text: '#86198f', border: '#d946ef' }, // fuchsia
    { key: 'mariapaula', label: 'Maria Paula',  bg: '#cffafe', text: '#155e75', border: '#22d3ee' }, // cyan
    { key: 'gardenia',   label: 'Gardênia',     bg: '#fff1f2', text: '#9f1239', border: '#fb7185' }, // rose/coral
    { key: 'ygor',       label: 'Ygor',         bg: '#f0fdf4', text: '#14532d', border: '#4ade80' }, // lime-green
  ],
};

// ─────────────────────────────────────────────
//  Turnos padrão
// ─────────────────────────────────────────────
export const TURNOS_PADRAO = [
  { label: 'Manhã A',  value: '07:30–15:50' },
  { label: 'Manhã B',  value: '08:00–16:20' },
  { label: 'Tarde A',  value: '10:00–18:20' },
  { label: 'Tarde B',  value: '11:00–19:20' },
  { label: 'Noite',    value: '12:40–21:00' },
];

// ─────────────────────────────────────────────
//  Feriados municipais do DF
// ─────────────────────────────────────────────
export const FERIADOS_DF = [
  { month:  2, day:  9, name: 'Fundação do Distrito Federal' },
  { month:  4, day: 21, name: 'Fundação de Brasília'         },
  { month: 11, day: 30, name: 'Dia do Evangélico'            },
];

// ─────────────────────────────────────────────
//  Tipos de ausência
// ─────────────────────────────────────────────
export const AUSENCIAS = [
  { key: 'atestado', label: 'Atestado',      icon: '🏥', bg: '#fef2f2', text: '#7f1d1d', border: '#fca5a5' },
  { key: 'ferias',   label: 'Férias',         icon: '✈️', bg: '#eff6ff', text: '#1e3a8a', border: '#93c5fd' },
  { key: 'licenca',  label: 'Licença',        icon: '📋', bg: '#fdf4ff', text: '#701a75', border: '#e879f9' },
  { key: 'falta',    label: 'Falta',          icon: '⚠️', bg: '#fffbeb', text: '#78350f', border: '#fcd34d' },
  { key: 'folga_ex', label: 'Folga extra',    icon: '⭐', bg: '#f0fdf4', text: '#14532d', border: '#86efac' },
];

// ─────────────────────────────────────────────
//  Regras CLT
// ─────────────────────────────────────────────
export const CLT = {
  minDescansoEntreJornadas: 11,
  maxDomingosSeguidos:       2,
  folgansPorSemana:          1,
};
