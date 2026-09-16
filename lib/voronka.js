/* ============================================================================
 * VORONKA — avtomatik xabarlar zanjiri (ChatPlace uslubida)
 *
 * Avtomat = boshlanish sharti (trigger) + qadamlar ketma-ketligi:
 *   xabar   — matn / rasm / video / tugmalar
 *   kutish  — N daqiqa / soat / kun
 *   shart   — segmentga mos bo'lsa davom etadi yoki to'xtaydi
 *   teg     — teg qo'shish / olib tashlash
 *   avtomat — boshqa avtomatni ishga tushirish
 *
 * Har bir odamning avtomat ichidagi yo'li "yurish" deb saqlanadi (bazada) —
 * server qayta ishga tushsa ham hech narsa yo'qolmaydi.
 *
 * Tinch vaqt: xabarlar faqat ruxsat etilgan soatlarda (Toshkent vaqti) ketadi,
 * qolganlari ertalabgacha kutadi.
 * ========================================================================== */
'use strict';

const crypto = require('crypto');
const { db, sozlamaOl, sozlamaQoy, tranzaksiya } = require('./db.js');
const obunachilar = require('./obunachilar.js');
const yuboruvchi = require('./yuboruvchi.js');

const TRIGGERLAR = [
  { kod: 'start', nom: 'Botga /start bosdi' },
  { kod: 'miniapp_ochdi', nom: 'Mini app\'ni ochdi' },
  { kod: 'test_boshladi', nom: 'Testni boshladi' },
  { kod: 'test_tugatdi', nom: 'Testni tugatdi' },
  { kod: 'video_bosdi', nom: '"Bepul videoni ko\'rish"ni bosdi' },
  { kod: 'teg_qoshildi', nom: 'Teg qo\'shildi' },
  { kod: 'qolda', nom: 'Faqat qo\'lda / tugma yoki boshqa avtomatdan' }
];

const TOXTATISH_HODISALARI = ['start', 'miniapp_ochdi', 'test_boshladi', 'test_tugatdi', 'video_bosdi'];

const QADAM_TURLARI = ['xabar', 'kutish', 'shart', 'teg', 'avtomat'];
const BIRLIKLAR = { daqiqa: 60e3, soat: 3600e3, kun: 86400e3 };
const TZ_MS = 5 * 3600e3;   // Toshkent: UTC+5, yozgi vaqt yo'q

const STANDART_SOZLAMA = { tinch: { yoqilgan: true, dan: '09:00', gacha: '21:00' } };

const hozir = () => Date.now();
const yangiId = (p) => p + crypto.randomBytes(5).toString('hex');

/* ============================================================================
 * SOZLAMA (tinch vaqt)
 * ========================================================================== */
function sozlama() {
  const s = sozlamaOl('voronka', null) || {};
  return { tinch: Object.assign({}, STANDART_SOZLAMA.tinch, s.tinch || {}) };
}

function soatTogrimi(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')); }
function daqiqaga(s) { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; }

function sozlamaSaqla(xom) {
  const t = (xom && xom.tinch) || {};
  const tinch = { yoqilgan: !!t.yoqilgan, dan: String(t.dan || ''), gacha: String(t.gacha || '') };
  if (!soatTogrimi(tinch.dan) || !soatTogrimi(tinch.gacha)) return { xato: 'Vaqtni SS:DD ko\'rinishida yozing, masalan 09:00' };
  if (tinch.dan === tinch.gacha) return { xato: 'Boshlanish va tugash vaqti bir xil bo\'lmasin' };
  sozlamaQoy('voronka', { tinch });
  return { sozlama: { tinch } };
}

/** Xabar yuborishga ruxsat etilgan eng yaqin vaqt (ms) */
function keyingiRuxsat(ms) {
  const { tinch } = sozlama();
  if (!tinch.yoqilgan) return ms;
  const dan = daqiqaga(tinch.dan);
  const gacha = daqiqaga(tinch.gacha);
  const mahalliy = ms + TZ_MS;
  const kunBoshi = Math.floor(mahalliy / 86400e3) * 86400e3;
  const m = (mahalliy - kunBoshi) / 60e3;
  const ichida = dan < gacha ? (m >= dan && m < gacha) : (m >= dan || m < gacha);
  if (ichida) return ms;
  let nishon = kunBoshi + dan * 60e3;
  if (nishon <= mahalliy) nishon += 86400e3;
  return nishon - TZ_MS;
}

/* ============================================================================
 * AVTOMATLAR (saqlash / o'qish)
 * ========================================================================== */
const kesh = new Map();

function qatorniOch(r) {
  if (!r) return null;
  let m = {};
  try { m = JSON.parse(r.malumot); } catch (_) {}
  return {
    id: r.id,
    nom: r.nom,
    faol: !!r.faol,
    trigger: m.trigger || { tur: 'qolda', qiymat: '' },
    shartlar: m.shartlar || [],
    toxtatish: m.toxtatish || [],
    qayta: !!m.qayta,
    qadamlar: m.qadamlar || [],
    yaratilgan: r.yaratilgan,
    yangilangan: r.yangilangan
  };
}

function avtomatOl(id) {
  const k = String(id || '');
  if (kesh.has(k)) return kesh.get(k);
  const a = qatorniOch(db().prepare('SELECT * FROM avtomatlar WHERE id = ?').get(k));
  if (a) kesh.set(k, a);
  return a;
}

function avtomatlarOl() {
  return db().prepare('SELECT * FROM avtomatlar ORDER BY yaratilgan').all().map(qatorniOch);
}

function avtomatBormi(id) {
  return !!db().prepare('SELECT 1 FROM avtomatlar WHERE id = ?').get(String(id || ''));
}

function qadamniTekshir(q, i, avtomatId) {
  const raqam = `${i + 1}-qadam`;
  const tur = QADAM_TURLARI.includes(q && q.tur) ? q.tur : null;
  if (!tur) return { xato: `${raqam}: noma'lum qadam turi` };
  const id = /^[a-z0-9]{4,24}$/.test(String(q.id || '')) ? q.id : yangiId('q');

  if (tur === 'xabar') {
    const t = yuboruvchi.tekshirXabar(q.xabar, { avtomatBormi: (x) => x === avtomatId || avtomatBormi(x) });
    if (t.xato) return { xato: `${raqam} (xabar): ${t.xato}` };
    return { qadam: { id, tur, xabar: t.xabar } };
  }
  if (tur === 'kutish') {
    const miqdor = Math.round(Number(q.miqdor));
    const birlik = BIRLIKLAR[q.birlik] ? q.birlik : 'soat';
    if (!Number.isFinite(miqdor) || miqdor < 1) return { xato: `${raqam} (kutish): vaqtni kiriting` };
    if (miqdor * BIRLIKLAR[birlik] > 365 * 86400e3) return { xato: `${raqam} (kutish): 1 yildan oshmasin` };
    return { qadam: { id, tur, miqdor, birlik } };
  }
  if (tur === 'shart') {
    const s = obunachilar.shartlarniTozala(q.shartlar);
    if (s.xato) return { xato: `${raqam} (shart): ${s.xato}` };
    if (!s.shartlar.length) return { xato: `${raqam} (shart): kamida bitta shart qo'shing` };
    const amal = (x, std) => (x === 'davom' || x === 'toxtat' ? x : std);
    return { qadam: { id, tur, shartlar: s.shartlar, mos: amal(q.mos, 'davom'), mosEmas: amal(q.mosEmas, 'toxtat') } };
  }
  if (tur === 'teg') {
    const teg = String(q.teg || '').trim().slice(0, 40);
    if (!teg) return { xato: `${raqam} (teg): teg nomini yozing` };
    return { qadam: { id, tur, amal: q.amal === 'olib' ? 'olib' : 'qosh', teg } };
  }
  // avtomat
  const avtomatQ = String(q.avtomatId || '');
  if (!avtomatQ) return { xato: `${raqam}: ishga tushiriladigan avtomatni tanlang` };
  if (avtomatQ === avtomatId) return { xato: `${raqam}: avtomat o'zini o'zi ishga tushira olmaydi` };
  if (!avtomatBormi(avtomatQ)) return { xato: `${raqam}: tanlangan avtomat topilmadi` };
  return { qadam: { id, tur, avtomatId: avtomatQ } };
}

function saqla(xom) {
  xom = xom || {};
  const eski = xom.id ? avtomatOl(xom.id) : null;
  if (xom.id && !eski) return { xato: 'Avtomat topilmadi' };
  const id = eski ? eski.id : yangiId('a');

  const nom = String(xom.nom || '').trim().slice(0, 80);
  if (!nom) return { xato: 'Avtomat nomini yozing' };

  const triggerTur = TRIGGERLAR.some((t) => t.kod === (xom.trigger && xom.trigger.tur)) ? xom.trigger.tur : null;
  if (!triggerTur) return { xato: 'Boshlanish shartini tanlang' };
  const triggerQiymat = String((xom.trigger && xom.trigger.qiymat) || '').trim().slice(0, 40);
  if (triggerTur === 'teg_qoshildi' && !triggerQiymat) return { xato: 'Qaysi teg qo\'shilganda boshlanishini yozing' };

  const sh = obunachilar.shartlarniTozala(xom.shartlar);
  if (sh.xato) return { xato: 'Kirish shartlari: ' + sh.xato };

  const toxtatish = (Array.isArray(xom.toxtatish) ? xom.toxtatish : []).filter((t) => TOXTATISH_HODISALARI.includes(t));

  const qadamlarXom = Array.isArray(xom.qadamlar) ? xom.qadamlar : [];
  if (!qadamlarXom.length) return { xato: 'Kamida bitta qadam qo\'shing' };
  if (qadamlarXom.length > 40) return { xato: '40 tadan ko\'p qadam bo\'lmaydi' };

  const qadamlar = [];
  const idlar = new Set();
  for (const [i, q] of qadamlarXom.entries()) {
    const t = qadamniTekshir(q, i, id);
    if (t.xato) return { xato: t.xato };
    if (idlar.has(t.qadam.id)) t.qadam.id = yangiId('q');
    idlar.add(t.qadam.id);
    qadamlar.push(t.qadam);
  }

  const malumot = JSON.stringify({
    trigger: { tur: triggerTur, qiymat: triggerQiymat },
    shartlar: sh.shartlar, toxtatish, qayta: !!xom.qayta, qadamlar
  });
  const t = hozir();
  if (eski) {
    db().prepare('UPDATE avtomatlar SET nom = ?, malumot = ?, yangilangan = ? WHERE id = ?').run(nom, malumot, t, id);
  } else {
    db().prepare('INSERT INTO avtomatlar (id, nom, faol, malumot, yaratilgan, yangilangan) VALUES (?, ?, 0, ?, ?, ?)').run(id, nom, malumot, t, t);
  }
  kesh.delete(id);
  return { avtomat: avtomatOl(id), yangi: !eski };
}

function holatQoy(id, faol) {
  const a = avtomatOl(id);
  if (!a) return { xato: 'Avtomat topilmadi' };
  db().prepare('UPDATE avtomatlar SET faol = ?, yangilangan = ? WHERE id = ?').run(faol ? 1 : 0, hozir(), a.id);
  kesh.delete(a.id);
  if (!faol) {
    db().prepare("UPDATE yurishlar SET holat = 'toxtatildi', izoh = 'avtomat o''chirildi', yangilangan = ? WHERE avtomat_id = ? AND holat = 'faol'").run(hozir(), a.id);
  }
  return { avtomat: avtomatOl(a.id) };
}

function ochir(id) {
  const a = avtomatOl(id);
  if (!a) return { xato: 'Avtomat topilmadi' };
  const boglangan = avtomatlarOl().filter((b) => b.id !== a.id && JSON.stringify(b.qadamlar).includes(`"${a.id}"`));
  if (boglangan.length) return { xato: 'Bu avtomat boshqa avtomatlarda ishlatilgan: ' + boglangan.map((b) => b.nom).join(', ') };
  tranzaksiya(() => {
    db().prepare('DELETE FROM avtomatlar WHERE id = ?').run(a.id);
    db().prepare('DELETE FROM yurishlar WHERE avtomat_id = ?').run(a.id);
    db().prepare('DELETE FROM qadam_stat WHERE avtomat_id = ?').run(a.id);
  });
  kesh.delete(a.id);
  return { avtomat: a };
}

/* ----------------------------------------------------------- statistika */
function statistika(avtomatId) {
  const umumiy = db().prepare(`
    SELECT count(*) AS jami, sum(holat = 'faol') AS faol, sum(holat = 'tugadi') AS tugadi,
           sum(holat = 'toxtatildi') AS toxtatildi, sum(holat = 'bloklagan') AS bloklagan
    FROM yurishlar WHERE avtomat_id = ?
  `).get(avtomatId);
  const qadamlar = {};
  for (const r of db().prepare('SELECT * FROM qadam_stat WHERE avtomat_id = ?').all(avtomatId)) {
    qadamlar[r.qadam_id] = { kirdi: r.kirdi, yuborildi: r.yuborildi, xato: r.xato, bosildi: r.bosildi, kutmoqda: 0 };
  }
  for (const r of db().prepare("SELECT qadam_id, count(*) AS n FROM yurishlar WHERE avtomat_id = ? AND holat = 'faol' GROUP BY qadam_id").all(avtomatId)) {
    qadamlar[r.qadam_id] = Object.assign({ kirdi: 0, yuborildi: 0, xato: 0, bosildi: 0 }, qadamlar[r.qadam_id] || {}, { kutmoqda: r.n });
  }
  const son = (x) => Number(x || 0);
  return {
    jami: son(umumiy.jami), faol: son(umumiy.faol), tugadi: son(umumiy.tugadi),
    toxtatildi: son(umumiy.toxtatildi), bloklagan: son(umumiy.bloklagan), qadamlar
  };
}

function royxat() {
  return avtomatlarOl().map((a) => Object.assign(a, { stat: statistika(a.id) }));
}

/* ============================================================================
 * ISHGA TUSHIRISH
 * ========================================================================== */
/**
 * opts.majburiy — "qayta kirish" va kirish shartlari tekshirilmaydi (tugma bosilganda)
 * → true agar yangi yurish boshlangan bo'lsa
 */
function avtomatBoshla(avtomatId, tgId, opts = {}) {
  const a = avtomatOl(avtomatId);
  const id = Number(tgId);
  if (!a || !a.faol || !a.qadamlar.length || !id) return false;

  const o = obunachilar.olish(id);
  if (!o || o.holat !== 'faol') return false;

  if (db().prepare("SELECT 1 FROM yurishlar WHERE avtomat_id = ? AND tg_id = ? AND holat = 'faol'").get(a.id, id)) return false;

  if (!opts.majburiy) {
    if (!a.qayta && db().prepare('SELECT 1 FROM yurishlar WHERE avtomat_id = ? AND tg_id = ?').get(a.id, id)) return false;
    if (a.shartlar.length && !obunachilar.mosmi(id, a.shartlar)) return false;
  }

  // Aylanib qolmaslik uchun: bir odamga soatiga 30 tadan ko'p yurish boshlanmaydi
  const soatlik = db().prepare('SELECT count(*) AS n FROM yurishlar WHERE tg_id = ? AND boshlangan > ?').get(id, hozir() - 3600e3).n;
  if (soatlik >= 30) return false;

  const t = hozir();
  db().prepare(`
    INSERT INTO yurishlar (avtomat_id, tg_id, qadam_id, holat, keyingi_vaqt, boshlangan, yangilangan)
    VALUES (?, ?, ?, 'faol', ?, ?, ?)
  `).run(a.id, id, a.qadamlar[0].id, t, t, t);
  tezTick();
  return true;
}

/**
 * Obunachi bilan biror hodisa yuz berdi.
 * Avval shu hodisada to'xtashi kerak bo'lgan zanjirlar to'xtatiladi,
 * keyin shu hodisa bilan boshlanadigan avtomatlar ishga tushadi.
 */
function hodisa(tgId, tur, qiymat) {
  const id = Number(tgId);
  if (!id) return 0;
  const hammasi = avtomatlarOl();

  for (const a of hammasi) {
    if (!a.toxtatish.includes(tur)) continue;
    db().prepare(`
      UPDATE yurishlar SET holat = 'toxtatildi', izoh = ?, yangilangan = ?
      WHERE avtomat_id = ? AND tg_id = ? AND holat = 'faol'
    `).run('hodisa: ' + tur, hozir(), a.id, id);
  }

  let boshlandi = 0;
  for (const a of hammasi) {
    if (!a.faol || a.trigger.tur !== tur) continue;
    if (a.trigger.qiymat && String(qiymat || '') !== a.trigger.qiymat) continue;
    if (avtomatBoshla(a.id, id)) boshlandi++;
  }
  return boshlandi;
}

/** Segmentdagi hamma obunachilar uchun avtomatni qo'lda ishga tushirish */
function qoldaIshgaTushir(avtomatId) {
  const a = avtomatOl(avtomatId);
  if (!a) return { xato: 'Avtomat topilmadi' };
  if (!a.faol) return { xato: 'Avval avtomatni yoqing' };
  const { sql, p } = obunachilar.shartSql(a.shartlar);
  const idlar = db().prepare(`SELECT o.tg_id FROM obunachilar o WHERE ${sql}`).all(...p).map((r) => r.tg_id);
  let soni = 0;
  for (const tgId of idlar) if (avtomatBoshla(a.id, tgId)) soni++;
  return { soni, jami: idlar.length };
}

/* ============================================================================
 * DVIGATEL
 * ========================================================================== */
function statQosh(avtomatId, qadamId, maydon) {
  if (!['kirdi', 'yuborildi', 'xato'].includes(maydon)) return;
  db().prepare(`
    INSERT INTO qadam_stat (avtomat_id, qadam_id, ${maydon}) VALUES (?, ?, 1)
    ON CONFLICT(avtomat_id, qadam_id) DO UPDATE SET ${maydon} = ${maydon} + 1
  `).run(avtomatId, qadamId);
}

function yurishYangila(y, qadamId, keyingiVaqt, izoh) {
  db().prepare(`
    UPDATE yurishlar SET qadam_id = ?, keyingi_vaqt = ?, izoh = ?, yangilangan = ?
    WHERE id = ? AND holat = 'faol'
  `).run(qadamId, keyingiVaqt, izoh || null, hozir(), y.id);
}

function yakunla(y, holat, izoh) {
  db().prepare(`
    UPDATE yurishlar SET holat = ?, izoh = ?, keyingi_vaqt = NULL, yangilangan = ?
    WHERE id = ? AND holat = 'faol'
  `).run(holat, izoh || null, hozir(), y.id);
}

function haliFaolmi(y) {
  const r = db().prepare('SELECT holat FROM yurishlar WHERE id = ?').get(y.id);
  return !!r && r.holat === 'faol';
}

async function yurishniDavomEttir(y) {
  const a = avtomatOl(y.avtomat_id);
  if (!a || !a.faol) return yakunla(y, 'toxtatildi', 'avtomat o\'chirilgan');

  let indeks = a.qadamlar.findIndex((q) => q.id === y.qadam_id);
  if (indeks < 0) return yakunla(y, 'toxtatildi', 'qadam o\'chirilgan');

  for (let n = 0; n < 60; n++) {
    if (indeks >= a.qadamlar.length) return yakunla(y, 'tugadi');
    const q = a.qadamlar[indeks];
    const davomi = n === 0 && (y.izoh === 'kutish' || y.izoh === 'tinch');
    if (!davomi) statQosh(a.id, q.id, 'kirdi');

    const obunachi = obunachilar.olish(y.tg_id);
    if (!obunachi) return yakunla(y, 'toxtatildi', 'obunachi topilmadi');
    if (obunachi.holat !== 'faol') return yakunla(y, 'bloklagan');

    if (q.tur === 'kutish') {
      if (davomi && y.izoh === 'kutish') { indeks++; continue; }
      return yurishYangila(y, q.id, hozir() + q.miqdor * BIRLIKLAR[q.birlik], 'kutish');
    }

    if (q.tur === 'xabar') {
      const ruxsat = keyingiRuxsat(hozir());
      if (ruxsat > hozir() + 1000) return yurishYangila(y, q.id, ruxsat, 'tinch');
      if (!haliFaolmi(y)) return;
      const natija = await yuboruvchi.yubor(y.tg_id, q.xabar, { manba: 'avtomat', manbaId: a.id, qadamId: q.id, obunachi });
      statQosh(a.id, q.id, natija.ok ? 'yuborildi' : 'xato');
      if (natija.bloklagan) return yakunla(y, 'bloklagan');
      if (!haliFaolmi(y)) return;
      indeks++;
      continue;
    }

    if (q.tur === 'shart') {
      const amal = obunachilar.mosmi(y.tg_id, q.shartlar) ? q.mos : q.mosEmas;
      if (amal === 'toxtat') return yakunla(y, 'tugadi', 'shart bo\'yicha to\'xtadi');
      indeks++;
      continue;
    }

    if (q.tur === 'teg') {
      if (q.amal === 'olib') obunachilar.tegOlib(y.tg_id, q.teg);
      else if (obunachilar.tegQosh(y.tg_id, q.teg)) {
        // yangi yurish faqat navbatga qo'yiladi — shu yerda chuqurlashib ketmaydi
        setImmediate(() => { try { hodisa(y.tg_id, 'teg_qoshildi', q.teg); } catch (_) {} });
      }
      indeks++;
      continue;
    }

    if (q.tur === 'avtomat') {
      avtomatBoshla(q.avtomatId, y.tg_id, { majburiy: true });
      indeks++;
      continue;
    }

    indeks++;
  }
  return yurishYangila(y, a.qadamlar[Math.min(indeks, a.qadamlar.length - 1)].id, hozir() + 60e3, null);
}

let band = false;
let yana = false;
let taymer = null;
let tezTaymer = null;

async function tick() {
  if (band) { yana = true; return; }
  band = true;
  try {
    do {
      yana = false;
      const navbat = db().prepare(`
        SELECT * FROM yurishlar WHERE holat = 'faol' AND keyingi_vaqt <= ?
        ORDER BY keyingi_vaqt LIMIT 100
      `).all(hozir());
      for (const y of navbat) {
        try {
          await yurishniDavomEttir(y);
        } catch (e) {
          console.error('[voronka] yurish xatosi:', e.message);
          yakunla(y, 'toxtatildi', 'xato: ' + String(e.message).slice(0, 120));
        }
      }
      if (navbat.length === 100) yana = true;
    } while (yana);
  } finally {
    band = false;
  }
}

function tezTick() {
  if (!taymer || tezTaymer) return;          // dvigatel ishlamayotgan bo'lsa (sinovda) — o'zimiz chaqiramiz
  tezTaymer = setTimeout(() => { tezTaymer = null; tick().catch(() => {}); }, 300);
}

function ishgaTushir() {
  if (taymer) return;
  boshlangichlarniQosh();
  taymer = setInterval(() => { tick().catch((e) => console.error('[voronka]', e.message)); }, 15000);
  if (taymer.unref) taymer.unref();
  setTimeout(() => tick().catch(() => {}), 3000);
}

function toxtat() {
  if (taymer) clearInterval(taymer);
  taymer = null;
}

/* ============================================================================
 * MEDIA ISHLATILISHI
 * ========================================================================== */
function mediaFoydalanish(mediaId) {
  return avtomatlarOl()
    .filter((a) => a.qadamlar.some((q) => q.tur === 'xabar' && q.xabar && q.xabar.media && q.xabar.media.id === mediaId))
    .map((a) => `voronka: ${a.nom}`);
}

/* ============================================================================
 * TAYYOR NAMUNALAR (birinchi ishga tushirishda, o'chiq holda)
 * ========================================================================== */
function boshlangichlarniQosh() {
  if (sozlamaOl('voronka_namunalar', false)) return;
  if (db().prepare('SELECT count(*) AS n FROM avtomatlar').get().n > 0) { sozlamaQoy('voronka_namunalar', true); return; }

  const miniapp = (matn) => ({ matn, tur: 'miniapp', qiymat: '' });
  const namunalar = [
    {
      nom: 'Testni boshlamaganlar — eslatma',
      trigger: { tur: 'start' },
      toxtatish: ['test_boshladi', 'test_tugatdi'],
      qadamlar: [
        { tur: 'teg', amal: 'qosh', teg: 'bot_start' },
        { tur: 'kutish', miqdor: 1, birlik: 'soat' },
        { tur: 'xabar', xabar: { matn: '{ism}, testni boshlashni unutmang 🙂\n\nAtigi **2 daqiqa** — va xotirangiz qaysi holatda ekanini, sizga aynan qaysi usul mos kelishini bilib olasiz.', tugmalar: [miniapp('🧠 Testni boshlash')] } },
        { tur: 'kutish', miqdor: 1, birlik: 'kun' },
        { tur: 'xabar', xabar: { matn: 'Xotira va diqqat testi sizni kutyapti.\n\n15 ta qisqa savolga javob bering — natijada **shaxsiy tahlil** va sizga mos **bepul videodars** olasiz.', tugmalar: [miniapp('🧠 Testni boshlash')] } },
        { tur: 'kutish', miqdor: 3, birlik: 'kun' },
        { tur: 'xabar', xabar: { matn: '{ism}, bu oxirgi eslatma 🙏\n\nKo\'pchilik xotirasi haqida o\'ylaydi, lekin tekshirib ko\'rmaydi. 2 daqiqa ajrating — natijani o\'zingiz ko\'rasiz.', tugmalar: [miniapp('🧠 Testni boshlash')] } }
      ]
    },
    {
      nom: 'Testni oxirigacha yechmaganlar',
      trigger: { tur: 'test_boshladi' },
      toxtatish: ['test_tugatdi'],
      qadamlar: [
        { tur: 'kutish', miqdor: 30, birlik: 'daqiqa' },
        { tur: 'xabar', xabar: { matn: 'Testni yarmida qoldirdingiz 🙂\n\nBir necha savol qoldi xolos — oxirigacha yeching va **shaxsiy natijangizni** oling.', tugmalar: [miniapp('🧠 Testni yakunlash')] } },
        { tur: 'kutish', miqdor: 1, birlik: 'kun' },
        { tur: 'xabar', xabar: { matn: '{ism}, natijangiz hali tayyor emas — test yakunlanmagan.\n\n2 daqiqada tugatib, sizga mos bepul videodarsni oling 👇', tugmalar: [miniapp('🧠 Testni yakunlash')] } }
      ]
    },
    {
      nom: 'Tavsiya videosini ko\'rmaganlar',
      trigger: { tur: 'test_tugatdi' },
      toxtatish: ['video_bosdi'],
      qadamlar: [
        { tur: 'kutish', miqdor: 2, birlik: 'soat' },
        { tur: 'xabar', xabar: { matn: '{ism}, siz uchun tanlangan videodars hali ko\'rilmadi 👀\n\n**{video}**\n\nNatijangizdagi muammolarni qanday hal qilishni aynan shu videoda ko\'rsatib berganman.', tugmalar: [{ matn: '▶️ Bepul videoni ko\'rish', tur: 'video', qiymat: '' }] } },
        { tur: 'kutish', miqdor: 1, birlik: 'kun' },
        { tur: 'xabar', xabar: { matn: 'Bepul videodarsingiz hali ham sizni kutyapti.\n\n**{video}**\n\nBugun 15 daqiqa ajrating — birinchi natijani o\'zingiz sezasiz.', tugmalar: [{ matn: '▶️ Videoni ko\'rish', tur: 'video', qiymat: '' }] } }
      ]
    }
  ];

  for (const n of namunalar) {
    const r = saqla(n);
    if (r.xato) console.error('[voronka] namuna qo\'shilmadi:', r.xato);
  }
  sozlamaQoy('voronka_namunalar', true);
}

module.exports = {
  TRIGGERLAR, TOXTATISH_HODISALARI, QADAM_TURLARI, BIRLIKLAR,
  sozlama, sozlamaSaqla, keyingiRuxsat,
  avtomatOl, avtomatlarOl, avtomatBormi, saqla, holatQoy, ochir, royxat, statistika,
  avtomatBoshla, hodisa, qoldaIshgaTushir,
  tick, ishgaTushir, toxtat, mediaFoydalanish, boshlangichlarniQosh
};
