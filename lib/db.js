/* ============================================================================
 * SQLITE BAZA — obunachilar, voronka, ommaviy xabarlar, media
 *
 * Node.js'ning o'ziga o'rnatilgan node:sqlite ishlatiladi — tashqi paket yo'q.
 * Fayl: data/bot.db   Kunlik zaxira: data/zaxira/bot-YYYY-MM-DD.db (7 ta)
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

// node:sqlite hali "experimental" deb ogohlantiradi — server logini ifloslantirmasin
const asliOgohlantirish = process.emitWarning;
process.emitWarning = function (ogoh, ...qolgan) {
  const matn = typeof ogoh === 'string' ? ogoh : (ogoh && ogoh.message) || '';
  if (/SQLite/i.test(matn)) return;
  return asliOgohlantirish.call(process, ogoh, ...qolgan);
};

const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
let DB = null;

const SXEMA = `
CREATE TABLE IF NOT EXISTS sozlamalar (
  kalit TEXT PRIMARY KEY,
  qiymat TEXT
);

CREATE TABLE IF NOT EXISTS obunachilar (
  tg_id INTEGER PRIMARY KEY,
  ism TEXT, familiya TEXT, username TEXT, til TEXT,
  start_param TEXT,
  holat TEXT NOT NULL DEFAULT 'faol',
  birinchi_vaqt INTEGER NOT NULL,
  oxirgi_vaqt INTEGER NOT NULL,
  start_vaqt INTEGER,
  ochdi_vaqt INTEGER,
  boshladi_vaqt INTEGER,
  formaga_vaqt INTEGER,
  tugatdi_vaqt INTEGER,
  video_bosdi_vaqt INTEGER,
  video_id TEXT,
  daraja_kod TEXT,
  telefon TEXT
);
CREATE INDEX IF NOT EXISTS obunachilar_oxirgi ON obunachilar(oxirgi_vaqt);

CREATE TABLE IF NOT EXISTS teglar (
  tg_id INTEGER NOT NULL,
  teg TEXT NOT NULL,
  vaqt INTEGER NOT NULL,
  PRIMARY KEY (tg_id, teg)
);
CREATE INDEX IF NOT EXISTS teglar_teg ON teglar(teg);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  fayl TEXT NOT NULL,
  nom TEXT,
  tur TEXT NOT NULL,
  mime TEXT,
  hajm INTEGER,
  eni INTEGER,
  boyi INTEGER,
  tg_file_id TEXT,
  yaratilgan INTEGER NOT NULL,
  yaratgan TEXT
);

CREATE TABLE IF NOT EXISTS avtomatlar (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  faol INTEGER NOT NULL DEFAULT 0,
  malumot TEXT NOT NULL,
  yaratilgan INTEGER,
  yangilangan INTEGER
);

CREATE TABLE IF NOT EXISTS yurishlar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  avtomat_id TEXT NOT NULL,
  tg_id INTEGER NOT NULL,
  qadam_id TEXT,
  holat TEXT NOT NULL,
  keyingi_vaqt INTEGER,
  boshlangan INTEGER NOT NULL,
  yangilangan INTEGER NOT NULL,
  izoh TEXT
);
CREATE INDEX IF NOT EXISTS yurishlar_navbat ON yurishlar(holat, keyingi_vaqt);
CREATE INDEX IF NOT EXISTS yurishlar_odam ON yurishlar(tg_id, avtomat_id);

CREATE TABLE IF NOT EXISTS qadam_stat (
  avtomat_id TEXT NOT NULL,
  qadam_id TEXT NOT NULL,
  kirdi INTEGER NOT NULL DEFAULT 0,
  yuborildi INTEGER NOT NULL DEFAULT 0,
  xato INTEGER NOT NULL DEFAULT 0,
  bosildi INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (avtomat_id, qadam_id)
);

CREATE TABLE IF NOT EXISTS tarqatmalar (
  id TEXT PRIMARY KEY,
  nom TEXT,
  malumot TEXT NOT NULL,
  holat TEXT NOT NULL,
  reja_vaqt INTEGER,
  boshlangan INTEGER,
  tugagan INTEGER,
  jami INTEGER NOT NULL DEFAULT 0,
  yuborildi INTEGER NOT NULL DEFAULT 0,
  xato INTEGER NOT NULL DEFAULT 0,
  bloklagan INTEGER NOT NULL DEFAULT 0,
  bosildi INTEGER NOT NULL DEFAULT 0,
  yaratgan TEXT,
  yaratilgan INTEGER,
  yangilangan INTEGER
);

CREATE TABLE IF NOT EXISTS tarqatma_navbat (
  tarqatma_id TEXT NOT NULL,
  tg_id INTEGER NOT NULL,
  holat TEXT NOT NULL DEFAULT 'kutmoqda',
  PRIMARY KEY (tarqatma_id, tg_id)
);
CREATE INDEX IF NOT EXISTS tarqatma_navbat_holat ON tarqatma_navbat(tarqatma_id, holat);

CREATE TABLE IF NOT EXISTS havola_kodlar (
  kod TEXT PRIMARY KEY,
  tg_id INTEGER,
  manba TEXT,
  manba_id TEXT,
  qadam_id TEXT,
  url TEXT NOT NULL,
  bosildi INTEGER NOT NULL DEFAULT 0,
  yaratilgan INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS havola_kodlar_manba ON havola_kodlar(manba, manba_id, qadam_id, tg_id);
`;

function ochish(yol) {
  if (DB) return DB;
  const fayl = yol || path.join(DATA_DIR, 'bot.db');
  if (fayl !== ':memory:') fs.mkdirSync(path.dirname(fayl), { recursive: true });
  DB = new DatabaseSync(fayl);
  DB.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 3000;');
  DB.exec(SXEMA);
  return DB;
}

function db() { return DB || ochish(); }

function yopish() {
  if (DB) { try { DB.close(); } catch (_) {} DB = null; }
}

/* ----------------------------------------------------------- sozlamalar */
function sozlamaOl(kalit, standart) {
  const r = db().prepare('SELECT qiymat FROM sozlamalar WHERE kalit = ?').get(kalit);
  if (!r) return standart;
  try { return JSON.parse(r.qiymat); } catch (_) { return standart; }
}

function sozlamaQoy(kalit, qiymat) {
  db().prepare(
    'INSERT INTO sozlamalar (kalit, qiymat) VALUES (?, ?) ON CONFLICT(kalit) DO UPDATE SET qiymat = excluded.qiymat'
  ).run(kalit, JSON.stringify(qiymat));
}

/* ----------------------------------------------------------- tranzaksiya */
function tranzaksiya(fn) {
  const d = db();
  d.exec('BEGIN');
  try {
    const n = fn();
    d.exec('COMMIT');
    return n;
  } catch (e) {
    try { d.exec('ROLLBACK'); } catch (_) {}
    throw e;
  }
}

/* ------------------------------------------------------ kunlik zaxira */
function zaxiraOl() {
  if (!DB) return;
  const papka = path.join(DATA_DIR, 'zaxira');
  try {
    fs.mkdirSync(papka, { recursive: true });
    const sana = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);   // Toshkent sanasi
    const fayl = path.join(papka, `bot-${sana}.db`);
    if (fs.existsSync(fayl)) return;
    DB.exec(`VACUUM INTO '${fayl.replace(/'/g, "''")}'`);

    const fayllar = fs.readdirSync(papka).filter((f) => /^bot-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    while (fayllar.length > 7) fs.rmSync(path.join(papka, fayllar.shift()), { force: true });

    // 180 kundan eski tugma kodlari kerak emas
    DB.prepare('DELETE FROM havola_kodlar WHERE yaratilgan < ?').run(Date.now() - 180 * 86400e3);
  } catch (e) {
    console.error('[db] zaxira olinmadi:', e.message);
  }
}

function zaxiraBoshla() {
  const t1 = setTimeout(zaxiraOl, 60e3);
  const t2 = setInterval(zaxiraOl, 3600e3);
  if (t1.unref) t1.unref();
  if (t2.unref) t2.unref();
}

module.exports = { ochish, db, yopish, sozlamaOl, sozlamaQoy, tranzaksiya, zaxiraOl, zaxiraBoshla };
