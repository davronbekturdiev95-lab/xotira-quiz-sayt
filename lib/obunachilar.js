/* ============================================================================
 * OBUNACHILAR — botga yozgan / mini app'ni ochgan Telegram foydalanuvchilari
 *
 * Har bir obunachining qaysi bosqichda ekanligi saqlanadi (start, testni
 * boshladi, tugatdi, videoni bosdi), teglar va segmentlar shu yerda.
 * ========================================================================== */
'use strict';

const { db } = require('./db.js');

const hozir = () => Date.now();
const qisqa = (v, n) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, n));

const BOSQICHLAR = [
  { kod: 'start_boshlamagan', nom: '/start bosgan, testni boshlamagan' },
  { kod: 'boshlagan_tugatmagan', nom: 'Testni boshlagan, tugatmagan' },
  { kod: 'tugatgan', nom: 'Testni tugatgan' },
  { kod: 'tugatgan_video_bosmagan', nom: 'Tugatgan, videoni bosmagan' },
  { kod: 'video_bosgan', nom: '"Bepul videoni ko\'rish"ni bosgan' }
];

const SHART_TURLARI = [
  { kod: 'bosqich', nom: 'Bosqich', qiymat: 'bosqich' },
  { kod: 'video', nom: 'Tavsiya qilingan video', qiymat: 'video' },
  { kod: 'daraja', nom: 'Daraja', qiymat: 'daraja' },
  { kod: 'teg_bor', nom: 'Tegi bor', qiymat: 'matn' },
  { kod: 'teg_yoq', nom: 'Tegi yo\'q', qiymat: 'matn' },
  { kod: 'start_param', nom: 'Start parametri', qiymat: 'matn' }
];

/* ------------------------------------------------------------- yozish */
function upsert(user, qoshimcha = {}) {
  if (!user || !user.id) return null;
  const t = hozir();
  db().prepare(`
    INSERT INTO obunachilar (tg_id, ism, familiya, username, til, start_param, holat, birinchi_vaqt, oxirgi_vaqt)
    VALUES (?, ?, ?, ?, ?, ?, 'faol', ?, ?)
    ON CONFLICT(tg_id) DO UPDATE SET
      ism = excluded.ism,
      familiya = excluded.familiya,
      username = excluded.username,
      til = COALESCE(excluded.til, obunachilar.til),
      start_param = COALESCE(obunachilar.start_param, excluded.start_param),
      holat = 'faol',
      oxirgi_vaqt = excluded.oxirgi_vaqt
  `).run(
    Number(user.id),
    qisqa(user.first_name, 64), qisqa(user.last_name, 64), qisqa(user.username, 64), qisqa(user.language_code, 8),
    qisqa(qoshimcha.start_param, 64),
    t, t
  );
  return olish(user.id);
}

const HODISA_MAYDONI = {
  start: 'start_vaqt',
  miniapp_ochdi: 'ochdi_vaqt',
  test_boshladi: 'boshladi_vaqt',
  formaga_yetdi: 'formaga_vaqt',
  test_tugatdi: 'tugatdi_vaqt',
  video_bosdi: 'video_bosdi_vaqt'
};

function hodisaQayd(tgId, tur, qoshimcha = {}) {
  const maydon = HODISA_MAYDONI[tur];
  if (!maydon) return;
  const id = Number(tgId);
  const t = hozir();

  if (tur === 'test_boshladi') {
    db().prepare('UPDATE obunachilar SET boshladi_vaqt = COALESCE(boshladi_vaqt, ?), oxirgi_vaqt = ? WHERE tg_id = ?').run(t, t, id);
  } else if (tur === 'test_tugatdi') {
    db().prepare(`
      UPDATE obunachilar SET
        tugatdi_vaqt = ?, boshladi_vaqt = COALESCE(boshladi_vaqt, ?),
        video_id = ?, daraja_kod = ?, telefon = COALESCE(?, telefon), oxirgi_vaqt = ?
      WHERE tg_id = ?
    `).run(t, t, qisqa(qoshimcha.video_id, 40), qisqa(qoshimcha.daraja_kod, 40), qisqa(qoshimcha.telefon, 20), t, id);
  } else {
    db().prepare(`UPDATE obunachilar SET ${maydon} = ?, oxirgi_vaqt = ? WHERE tg_id = ?`).run(t, t, id);
  }
}

/** Foydalanuvchi o'z raqamini ulashganda */
function telefonSaqla(tgId, telefon) {
  const t = qisqa(String(telefon || '').replace(/[^\d+]/g, ''), 20);
  if (!t) return;
  db().prepare('UPDATE obunachilar SET telefon = ?, oxirgi_vaqt = ? WHERE tg_id = ?').run(t, hozir(), Number(tgId));
}

function bloklandi(tgId) {
  db().prepare("UPDATE obunachilar SET holat = 'bloklagan' WHERE tg_id = ?").run(Number(tgId));
}

function faollashdi(tgId) {
  db().prepare("UPDATE obunachilar SET holat = 'faol', oxirgi_vaqt = ? WHERE tg_id = ?").run(hozir(), Number(tgId));
}

/* -------------------------------------------------------------- teglar */
function tegQosh(tgId, teg) {
  const t = String(teg || '').trim().slice(0, 40);
  if (!t) return false;
  const n = db().prepare('INSERT OR IGNORE INTO teglar (tg_id, teg, vaqt) VALUES (?, ?, ?)').run(Number(tgId), t, hozir());
  return n.changes > 0;
}

function tegOlib(tgId, teg) {
  db().prepare('DELETE FROM teglar WHERE tg_id = ? AND teg = ?').run(Number(tgId), String(teg || '').trim());
}

function teglar(tgId) {
  return db().prepare('SELECT teg FROM teglar WHERE tg_id = ? ORDER BY vaqt').all(Number(tgId)).map((r) => r.teg);
}

function barchaTeglar() {
  return db().prepare('SELECT teg, count(*) AS soni FROM teglar GROUP BY teg ORDER BY soni DESC').all();
}

/* ------------------------------------------------------------ o'qish */
function olish(tgId) {
  return db().prepare('SELECT * FROM obunachilar WHERE tg_id = ?').get(Number(tgId)) || null;
}

/* ============================================================================
 * SEGMENTLAR (shartlar)
 * ========================================================================== */
function shartlarniTozala(xom) {
  const royxat = Array.isArray(xom) ? xom : [];
  if (royxat.length > 10) return { xato: '10 tadan ko\'p shart bo\'lmaydi' };
  const shartlar = [];
  for (const sh of royxat) {
    const tur = SHART_TURLARI.find((t) => t.kod === (sh && sh.tur));
    if (!tur) return { xato: 'Noma\'lum shart turi' };
    const qiymat = String(sh.qiymat === undefined || sh.qiymat === null ? '' : sh.qiymat).trim().slice(0, 64);
    if (!qiymat) return { xato: `"${tur.nom}" shartining qiymatini tanlang` };
    if (tur.kod === 'bosqich' && !BOSQICHLAR.some((b) => b.kod === qiymat)) return { xato: 'Noma\'lum bosqich' };
    shartlar.push({ tur: tur.kod, qiymat });
  }
  return { shartlar };
}

/** Shartlarni SQL ga aylantiradi. Faqat faol (botni bloklamagan) obunachilar. */
function shartSql(shartlar) {
  const qism = ["o.holat = 'faol'"];
  const p = [];
  for (const sh of Array.isArray(shartlar) ? shartlar : []) {
    const q = String(sh.qiymat === undefined || sh.qiymat === null ? '' : sh.qiymat);
    switch (sh.tur) {
      case 'bosqich':
        if (q === 'start_boshlamagan') qism.push('o.boshladi_vaqt IS NULL AND o.tugatdi_vaqt IS NULL');
        else if (q === 'boshlagan_tugatmagan') qism.push('o.boshladi_vaqt IS NOT NULL AND o.tugatdi_vaqt IS NULL');
        else if (q === 'tugatgan') qism.push('o.tugatdi_vaqt IS NOT NULL');
        else if (q === 'tugatgan_video_bosmagan') qism.push('o.tugatdi_vaqt IS NOT NULL AND o.video_bosdi_vaqt IS NULL');
        else if (q === 'video_bosgan') qism.push('o.video_bosdi_vaqt IS NOT NULL');
        else qism.push('0');   // noma'lum — hech kimga mos kelmasin (xavfsiz tomon)
        break;
      case 'video': qism.push('o.video_id = ?'); p.push(q); break;
      case 'daraja': qism.push('o.daraja_kod = ?'); p.push(q); break;
      case 'teg_bor': qism.push('EXISTS (SELECT 1 FROM teglar t WHERE t.tg_id = o.tg_id AND t.teg = ?)'); p.push(q); break;
      case 'teg_yoq': qism.push('NOT EXISTS (SELECT 1 FROM teglar t WHERE t.tg_id = o.tg_id AND t.teg = ?)'); p.push(q); break;
      case 'start_param': qism.push('o.start_param = ?'); p.push(q); break;
      default: qism.push('0');
    }
  }
  return { sql: qism.map((x) => '(' + x + ')').join(' AND '), p };
}

function mosmi(tgId, shartlar) {
  const { sql, p } = shartSql(shartlar);
  return !!db().prepare(`SELECT 1 FROM obunachilar o WHERE o.tg_id = ? AND ${sql}`).get(Number(tgId), ...p);
}

function soni(shartlar) {
  const { sql, p } = shartSql(shartlar);
  return db().prepare(`SELECT count(*) AS n FROM obunachilar o WHERE ${sql}`).get(...p).n;
}

/* -------------------------------------------------------- panel uchun */
function bosqichNomi(o) {
  if (o.video_bosdi_vaqt) return 'Videoni bosgan';
  if (o.tugatdi_vaqt) return 'Testni tugatgan';
  if (o.boshladi_vaqt) return 'Testni boshlagan';
  if (o.ochdi_vaqt) return 'Mini app\'ni ochgan';
  return '/start bosgan';
}

function royxat({ q = '', sahifa = 1, hajm = 50 } = {}) {
  const shart = [];
  const p = [];
  const qidiruv = String(q || '').trim().replace(/^@/, '');
  if (qidiruv) {
    shart.push('(o.ism LIKE ? OR o.familiya LIKE ? OR o.username LIKE ? OR CAST(o.tg_id AS TEXT) = ? OR o.telefon LIKE ?)');
    const like = '%' + qidiruv.replace(/[%_]/g, '') + '%';
    p.push(like, like, like, qidiruv, like);
  }
  const where = shart.length ? 'WHERE ' + shart.join(' AND ') : '';
  const jami = db().prepare(`SELECT count(*) AS n FROM obunachilar o ${where}`).get(...p).n;
  const olcham = Math.max(1, Math.min(200, Number(hajm) || 50));
  const boshi = (Math.max(1, Number(sahifa) || 1) - 1) * olcham;

  const qatorlar = db().prepare(`
    SELECT o.*, (SELECT group_concat(teg, ', ') FROM teglar t WHERE t.tg_id = o.tg_id) AS teglar
    FROM obunachilar o ${where}
    ORDER BY o.oxirgi_vaqt DESC
    LIMIT ? OFFSET ?
  `).all(...p, olcham, boshi).map((o) => Object.assign(o, { bosqich: bosqichNomi(o) }));

  return { jami, qatorlar };
}

function statistika() {
  const r = db().prepare(`
    SELECT
      count(*) AS jami,
      sum(holat = 'faol') AS faol,
      sum(holat = 'bloklagan') AS bloklagan,
      sum(holat = 'faol' AND boshladi_vaqt IS NULL AND tugatdi_vaqt IS NULL) AS start_boshlamagan,
      sum(holat = 'faol' AND boshladi_vaqt IS NOT NULL AND tugatdi_vaqt IS NULL) AS boshlagan_tugatmagan,
      sum(holat = 'faol' AND tugatdi_vaqt IS NOT NULL) AS tugatgan,
      sum(holat = 'faol' AND tugatdi_vaqt IS NOT NULL AND video_bosdi_vaqt IS NULL) AS tugatgan_video_bosmagan,
      sum(holat = 'faol' AND video_bosdi_vaqt IS NOT NULL) AS video_bosgan,
      sum(birinchi_vaqt >= ?) AS bugun
    FROM obunachilar
  `).get(hozir() - 86400e3);
  const n = {};
  for (const k of Object.keys(r)) n[k] = Number(r[k] || 0);
  return n;
}

module.exports = {
  BOSQICHLAR, SHART_TURLARI,
  upsert, hodisaQayd, telefonSaqla, bloklandi, faollashdi,
  tegQosh, tegOlib, teglar, barchaTeglar,
  olish, shartlarniTozala, shartSql, mosmi, soni,
  royxat, statistika
};
