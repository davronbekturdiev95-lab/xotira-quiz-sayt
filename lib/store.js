/* ============================================================================
 * MA'LUMOTLARNI SAQLASH: config, foydalanuvchilar, amallar tarixi, natijalar
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { boshlangichConfig } = require('../shared/defaults.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.jsonl');
const RESULTS_FILE = path.join(DATA_DIR, 'results.jsonl');

function papkaTayyorla() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ------------------------------------------------------------------ CONFIG */
let CONFIG = null;

function configOl() {
  if (CONFIG) return CONFIG;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      CONFIG = tolatir(CONFIG);
    } else {
      CONFIG = boshlangichConfig();
      configSaqla(CONFIG);
    }
  } catch (e) {
    console.error('config.json o\'qilmadi, boshlang\'ich sozlama ishlatiladi:', e.message);
    CONFIG = boshlangichConfig();
  }
  return CONFIG;
}

/** Yetishmayotgan maydonlarni boshlang'ich qiymat bilan to'ldiradi */
function tolatir(cfg) {
  const def = boshlangichConfig();
  cfg.savollar = Array.isArray(cfg.savollar) ? cfg.savollar : def.savollar;
  cfg.videolar = Array.isArray(cfg.videolar) ? cfg.videolar : def.videolar;
  cfg.darajalar = Array.isArray(cfg.darajalar) ? cfg.darajalar : def.darajalar;
  cfg.matnlar = Object.assign({}, def.matnlar, cfg.matnlar || {});
  cfg.yoshSavoli = cfg.yoshSavoli || def.yoshSavoli;

  // Dizayn: eski (yassi) shakldan yangi (mavzuli) shaklga o'tkazamiz
  const d = cfg.dizayn || {};
  const eskiShakl = d.fon_1 && !d.qorongi;
  cfg.dizayn = {
    shakl: Object.assign({}, def.dizayn.shakl, eskiShakl
      ? { burchak: d.burchak, sarlavha_olcham: d.sarlavha_olcham }
      : (d.shakl || {})),
    qorongi: Object.assign({}, def.dizayn.qorongi, eskiShakl ? d : (d.qorongi || {})),
    yorug: Object.assign({}, def.dizayn.yorug, eskiShakl ? {} : (d.yorug || {}))
  };
  delete cfg.dizayn.qorongi.burchak;
  delete cfg.dizayn.qorongi.sarlavha_olcham;
  delete cfg.dizayn.qorongi.shakl;

  return cfg;
}

function configSaqla(yangi) {
  papkaTayyorla();
  yangi.yangilangan = new Date().toISOString();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(yangi, null, 2), 'utf8');
  CONFIG = yangi;
  return CONFIG;
}

/* ---------------------------------------------------- FOYDALANUVCHILAR */
function usersOl() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    console.error('users.json o\'qilmadi:', e.message);
    return [];
  }
}

function usersSaqla(list) {
  papkaTayyorla();
  fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/* ----------------------------------------------------- AMALLAR TARIXI */
function tarixYoz(qator) {
  try {
    papkaTayyorla();
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(Object.assign({
      vaqt: new Date().toISOString()
    }, qator)) + '\n');
  } catch (e) {
    console.error('Tarixga yozilmadi:', e.message);
  }
}

function tarixOl(limit) {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const qatorlar = fs.readFileSync(AUDIT_FILE, 'utf8').replace(/^\uFEFF/, '').split('\n').filter(Boolean);
  return qatorlar.slice(-(limit || 300)).reverse()
    .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter(Boolean);
}

/* ------------------------------------------------- HODISALAR (voronka) */
const HODISA_FILE = path.join(DATA_DIR, 'hodisalar.jsonl');

function hodisaYoz(qator) {
  try {
    papkaTayyorla();
    fs.appendFileSync(HODISA_FILE, JSON.stringify(qator) + '\n');
  } catch (e) {
    console.error('Hodisa saqlanmadi:', e.message);
  }
}

function hodisalarOl() {
  if (!fs.existsSync(HODISA_FILE)) return [];
  return fs.readFileSync(HODISA_FILE, 'utf8').replace(/^\uFEFF/, '').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter(Boolean);
}

/* --------------------------------------------------------- NATIJALAR */
function natijaYoz(qator) {
  try {
    papkaTayyorla();
    fs.appendFileSync(RESULTS_FILE, JSON.stringify(qator) + '\n');
  } catch (e) {
    console.error('Natija saqlanmadi:', e.message);
  }
}

function natijalarOl() {
  if (!fs.existsSync(RESULTS_FILE)) return [];
  return fs.readFileSync(RESULTS_FILE, 'utf8').replace(/^\uFEFF/, '').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter(Boolean);
}

/* ============================================================================
 * FARQNI ANIQLASH — tarixga "nima o'zgardi" deb yozish uchun
 * ========================================================================== */
function qisqa(s, n) {
  s = String(s == null ? '' : s);
  return s.length > (n || 45) ? s.slice(0, n || 45) + '…' : s;
}

function farqla(eski, yangi) {
  const o = [];

  // ---- Savollar ----
  const eskiS = indeksla(eski.savollar || [], 'id');
  const yangiS = indeksla(yangi.savollar || [], 'id');

  for (const id of Object.keys(yangiS)) {
    if (!eskiS[id]) {
      o.push(`Yangi savol qo'shildi: "${qisqa(yangiS[id].matn)}"`);
      continue;
    }
    const a = eskiS[id], b = yangiS[id];
    const raqam = (yangi.savollar || []).indexOf(b) + 1;

    if (a.matn !== b.matn) o.push(`${raqam}-savol matni: "${qisqa(a.matn)}" → "${qisqa(b.matn)}"`);

    const aV = indeksla(a.variantlar || [], 'key');
    const bV = indeksla(b.variantlar || [], 'key');
    for (const k of Object.keys(bV)) {
      if (!aV[k]) { o.push(`${raqam}-savolga yangi variant (${k}): "${qisqa(bV[k].matn)}"`); continue; }
      if (aV[k].matn !== bV[k].matn) {
        o.push(`${raqam}-savol, ${k} varianti: "${qisqa(aV[k].matn)}" → "${qisqa(bV[k].matn)}"`);
      }
      if (JSON.stringify(aV[k].ball || {}) !== JSON.stringify(bV[k].ball || {}) ||
          JSON.stringify(aV[k].belgi || {}) !== JSON.stringify(bV[k].belgi || {}) ||
          Number(aV[k].daraja || 0) !== Number(bV[k].daraja || 0)) {
        o.push(`${raqam}-savol, ${k} varianti ballari o'zgartirildi`);
      }
    }
    for (const k of Object.keys(aV)) {
      if (!bV[k]) o.push(`${raqam}-savoldan ${k} varianti o'chirildi`);
    }
  }
  for (const id of Object.keys(eskiS)) {
    if (!yangiS[id]) o.push(`Savol o'chirildi: "${qisqa(eskiS[id].matn)}"`);
  }
  if (JSON.stringify((eski.savollar || []).map((s) => s.id)) !==
      JSON.stringify((yangi.savollar || []).map((s) => s.id)) &&
      Object.keys(eskiS).length === Object.keys(yangiS).length) {
    o.push('Savollar tartibi o\'zgartirildi');
  }

  // ---- Videolar ----
  const eskiV = indeksla(eski.videolar || [], 'id');
  const yangiV = indeksla(yangi.videolar || [], 'id');

  for (const id of Object.keys(yangiV)) {
    const b = yangiV[id];
    if (!eskiV[id]) { o.push(`Yangi video qo'shildi: ${id.toUpperCase()} — "${qisqa(b.nom)}"`); continue; }
    const a = eskiV[id];
    if (a.havola !== b.havola) o.push(`${id.toUpperCase()} havolasi: ${a.havola} → ${b.havola}`);
    if (a.nom !== b.nom) o.push(`${id.toUpperCase()} nomi: "${qisqa(a.nom)}" → "${qisqa(b.nom)}"`);
    if (a.matn !== b.matn) o.push(`${id.toUpperCase()} natija matni o'zgartirildi`);
    if (a.yonalish !== b.yonalish) o.push(`${id.toUpperCase()} yo'nalishi: ${a.yonalish} → ${b.yonalish}`);
    if (Number(a.ustunlik) !== Number(b.ustunlik)) o.push(`${id.toUpperCase()} ustunligi: ${a.ustunlik} → ${b.ustunlik}`);
    if (JSON.stringify(a.shartlar || []) !== JSON.stringify(b.shartlar || [])) {
      o.push(`${id.toUpperCase()} shartlari o'zgartirildi`);
    }
    if (!!a.zaxira !== !!b.zaxira) o.push(`${id.toUpperCase()} zaxira holati: ${b.zaxira ? 'yoqildi' : 'o\'chirildi'}`);
  }
  for (const id of Object.keys(eskiV)) {
    if (!yangiV[id]) o.push(`Video o'chirildi: ${id.toUpperCase()} — "${qisqa(eskiV[id].nom)}"`);
  }

  // ---- Darajalar ----
  const eskiD = indeksla(eski.darajalar || [], 'kod');
  const yangiD = indeksla(yangi.darajalar || [], 'kod');
  for (const kod of Object.keys(yangiD)) {
    const a = eskiD[kod], b = yangiD[kod];
    if (!a) { o.push(`Yangi daraja qo'shildi: ${b.nom}`); continue; }
    if (a.matn !== b.matn) o.push(`"${b.nom}" darajasi matni o'zgartirildi`);
    if (Number(a.max) !== Number(b.max)) o.push(`"${b.nom}" darajasi chegarasi: ${a.max}% → ${b.max}%`);
    if (a.nom !== b.nom) o.push(`Daraja nomi: "${a.nom}" → "${b.nom}"`);
  }
  for (const kod of Object.keys(eskiD)) {
    if (!yangiD[kod]) o.push(`Daraja o'chirildi: ${eskiD[kod].nom}`);
  }

  // ---- Matnlar ----
  const matnFarq = Object.keys(yangi.matnlar || {}).filter(
    (k) => (eski.matnlar || {})[k] !== yangi.matnlar[k]
  );
  if (matnFarq.length) o.push(`Sayt matnlari o'zgartirildi: ${matnFarq.join(', ')}`);

  // ---- Dizayn ----
  const bolimNom = { qorongi: 'Qorong\'i mavzu', yorug: 'Yorug\' mavzu', shakl: 'Shakl' };
  for (const bolim of ['qorongi', 'yorug', 'shakl']) {
    const a = (eski.dizayn || {})[bolim] || {};
    const b = (yangi.dizayn || {})[bolim] || {};
    const farq = Object.keys(b).filter((k) => a[k] !== b[k]);
    if (farq.length) {
      o.push(`${bolimNom[bolim]}: ${farq.map((k) => `${k} (${a[k]} → ${b[k]})`).join(', ')}`);
    }
  }

  return o;
}

function indeksla(arr, kalit) {
  const o = {};
  for (const x of arr) if (x && x[kalit]) o[x[kalit]] = x;
  return o;
}

module.exports = {
  DATA_DIR, RESULTS_FILE,
  configOl, configSaqla,
  usersOl, usersSaqla,
  tarixYoz, tarixOl,
  hodisaYoz, hodisalarOl,
  natijaYoz, natijalarOl,
  farqla
};
