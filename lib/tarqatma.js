/* ============================================================================
 * OMMAVIY XABAR (tarqatma)
 *
 * Holatlar:  qoralama → (rejalashtirilgan) → yuborilmoqda ⇄ pauza → tugadi
 *                                                          ↘ bekor
 * Yuborish boshlanganda auditoriya ro'yxati bazaga yozib qo'yiladi — server
 * qayta ishga tushsa ham qolgan joyidan davom etadi va hech kimga ikki marta
 * yuborilmaydi.
 * ========================================================================== */
'use strict';

const crypto = require('crypto');
const { db, tranzaksiya } = require('./db.js');
const obunachilar = require('./obunachilar.js');
const yuboruvchi = require('./yuboruvchi.js');

const hozir = () => Date.now();
const PORSIYA = 30;

function qatorniOch(r) {
  if (!r) return null;
  let m = {};
  try { m = JSON.parse(r.malumot); } catch (_) {}
  return Object.assign({}, r, { malumot: undefined, xabar: m.xabar || { matn: '', tugmalar: [] }, shartlar: m.shartlar || [] });
}

function olish(id) {
  return qatorniOch(db().prepare('SELECT * FROM tarqatmalar WHERE id = ?').get(String(id || '')));
}

function royxat() {
  return db().prepare('SELECT * FROM tarqatmalar ORDER BY yaratilgan DESC LIMIT 200').all().map((r) => {
    const t = qatorniOch(r);
    t.qolgan = db().prepare("SELECT count(*) AS n FROM tarqatma_navbat WHERE tarqatma_id = ? AND holat = 'kutmoqda'").get(t.id).n;
    if (t.holat === 'qoralama' || t.holat === 'rejalashtirilgan') t.auditoriya = obunachilar.soni(t.shartlar);
    return t;
  });
}

/* ------------------------------------------------------------- saqlash */
function saqla(xom, login, avtomatBormi) {
  xom = xom || {};
  const eski = xom.id ? olish(xom.id) : null;
  if (xom.id && !eski) return { xato: 'Xabar topilmadi' };
  if (eski && !['qoralama', 'rejalashtirilgan'].includes(eski.holat)) {
    return { xato: 'Yuborilgan xabarni tahrirlab bo\'lmaydi — nusxa oling' };
  }

  const nom = String(xom.nom || '').trim().slice(0, 80) || 'Nomsiz xabar';
  const t = yuboruvchi.tekshirXabar(xom.xabar, { avtomatBormi });
  if (t.xato) return { xato: t.xato };
  const sh = obunachilar.shartlarniTozala(xom.shartlar);
  if (sh.xato) return { xato: 'Auditoriya: ' + sh.xato };

  const malumot = JSON.stringify({ xabar: t.xabar, shartlar: sh.shartlar });
  const vaqt = hozir();
  if (eski) {
    db().prepare('UPDATE tarqatmalar SET nom = ?, malumot = ?, yangilangan = ? WHERE id = ?').run(nom, malumot, vaqt, eski.id);
    return { tarqatma: olish(eski.id) };
  }
  const id = 't' + crypto.randomBytes(5).toString('hex');
  db().prepare(`
    INSERT INTO tarqatmalar (id, nom, malumot, holat, yaratgan, yaratilgan, yangilangan)
    VALUES (?, ?, ?, 'qoralama', ?, ?, ?)
  `).run(id, nom, malumot, login || null, vaqt, vaqt);
  return { tarqatma: olish(id), yangi: true };
}

/* ------------------------------------------------------------ boshqarish */
function boshla(id, opts = {}) {
  const t = olish(id);
  if (!t) return { xato: 'Xabar topilmadi' };
  if (!['qoralama', 'rejalashtirilgan'].includes(t.holat)) return { xato: 'Bu xabar allaqachon yuborilgan' };

  const reja = Number(opts.rejaVaqt || 0);
  if (reja && reja > hozir() + 60e3) {
    if (reja > hozir() + 90 * 86400e3) return { xato: '90 kundan uzoqqa rejalashtirib bo\'lmaydi' };
    db().prepare("UPDATE tarqatmalar SET holat = 'rejalashtirilgan', reja_vaqt = ?, yangilangan = ? WHERE id = ?").run(reja, hozir(), t.id);
    return { tarqatma: olish(t.id) };
  }

  const { sql, p } = obunachilar.shartSql(t.shartlar);
  tranzaksiya(() => {
    const n = db().prepare(`
      INSERT OR IGNORE INTO tarqatma_navbat (tarqatma_id, tg_id, holat)
      SELECT ?, o.tg_id, 'kutmoqda' FROM obunachilar o WHERE ${sql}
    `).run(t.id, ...p);
    const jami = Number(n.changes || 0);
    db().prepare(`
      UPDATE tarqatmalar SET holat = ?, jami = ?, boshlangan = ?, tugagan = ?, reja_vaqt = NULL, yangilangan = ?
      WHERE id = ?
    `).run(jami ? 'yuborilmoqda' : 'tugadi', jami, hozir(), jami ? null : hozir(), hozir(), t.id);
  });
  tezIshla();
  return { tarqatma: olish(t.id) };
}

function holatAlmashtir(id, danHolatlar, yangiHolat, xatoMatn) {
  const t = olish(id);
  if (!t) return { xato: 'Xabar topilmadi' };
  if (!danHolatlar.includes(t.holat)) return { xato: xatoMatn };
  const qoshimcha = yangiHolat === 'bekor' ? ', tugagan = ' + hozir() : '';
  db().prepare(`UPDATE tarqatmalar SET holat = ?, yangilangan = ?${qoshimcha} WHERE id = ?`).run(yangiHolat, hozir(), t.id);
  if (yangiHolat === 'yuborilmoqda') tezIshla();
  return { tarqatma: olish(t.id) };
}

const pauza = (id) => holatAlmashtir(id, ['yuborilmoqda'], 'pauza', 'Faqat yuborilayotgan xabarni to\'xtatib turish mumkin');
const davom = (id) => holatAlmashtir(id, ['pauza'], 'yuborilmoqda', 'Bu xabar to\'xtatilmagan');
const bekor = (id) => holatAlmashtir(id, ['yuborilmoqda', 'pauza', 'rejalashtirilgan'], 'bekor', 'Bu xabarni bekor qilib bo\'lmaydi');

function rejaniOlibTashla(id) {
  return holatAlmashtir(id, ['rejalashtirilgan'], 'qoralama', 'Bu xabar rejalashtirilmagan');
}

function ochir(id) {
  const t = olish(id);
  if (!t) return { xato: 'Xabar topilmadi' };
  if (['yuborilmoqda', 'pauza'].includes(t.holat)) return { xato: 'Avval yuborishni bekor qiling' };
  tranzaksiya(() => {
    db().prepare('DELETE FROM tarqatma_navbat WHERE tarqatma_id = ?').run(t.id);
    db().prepare('DELETE FROM tarqatmalar WHERE id = ?').run(t.id);
  });
  return { tarqatma: t };
}

/* --------------------------------------------------------------- ishchi */
let band = false;
let taymer = null;
let tezTaymer = null;

async function ishla() {
  if (band) return;
  band = true;
  try {
    // Vaqti kelgan rejalashtirilgan xabarlar
    for (const r of db().prepare("SELECT id FROM tarqatmalar WHERE holat = 'rejalashtirilgan' AND reja_vaqt <= ?").all(hozir())) {
      boshla(r.id);
    }

    for (;;) {
      const t = qatorniOch(db().prepare("SELECT * FROM tarqatmalar WHERE holat = 'yuborilmoqda' ORDER BY boshlangan LIMIT 1").get());
      if (!t) break;

      const porsiya = db().prepare(`
        SELECT tg_id FROM tarqatma_navbat WHERE tarqatma_id = ? AND holat = 'kutmoqda' LIMIT ?
      `).all(t.id, PORSIYA);

      if (!porsiya.length) {
        db().prepare("UPDATE tarqatmalar SET holat = 'tugadi', tugagan = ?, yangilangan = ? WHERE id = ? AND holat = 'yuborilmoqda'").run(hozir(), hozir(), t.id);
        continue;
      }

      for (const { tg_id: tgId } of porsiya) {
        const joriy = db().prepare('SELECT holat FROM tarqatmalar WHERE id = ?').get(t.id);
        if (!joriy || joriy.holat !== 'yuborilmoqda') break;

        const o = obunachilar.olish(tgId);
        let holat;
        if (!o || o.holat !== 'faol') {
          holat = 'bloklagan';
        } else {
          const n = await yuboruvchi.yubor(tgId, t.xabar, { manba: 'tarqatma', manbaId: t.id, obunachi: o });
          holat = n.ok ? 'yuborildi' : n.bloklagan ? 'bloklagan' : 'xato';
        }
        const maydon = holat === 'yuborildi' ? 'yuborildi' : holat === 'bloklagan' ? 'bloklagan' : 'xato';
        db().prepare('UPDATE tarqatma_navbat SET holat = ? WHERE tarqatma_id = ? AND tg_id = ?').run(holat, t.id, tgId);
        db().prepare(`UPDATE tarqatmalar SET ${maydon} = ${maydon} + 1, yangilangan = ? WHERE id = ?`).run(hozir(), t.id);
      }
    }
  } catch (e) {
    console.error('[tarqatma]', e.message);
  } finally {
    band = false;
  }
}

function tezIshla() {
  if (!taymer || tezTaymer) return;
  tezTaymer = setTimeout(() => { tezTaymer = null; ishla(); }, 200);
}

function ishgaTushir() {
  if (taymer) return;
  taymer = setInterval(ishla, 10000);
  if (taymer.unref) taymer.unref();
  setTimeout(ishla, 4000);
}

function mediaFoydalanish(mediaId) {
  return db().prepare("SELECT id, nom, malumot, holat FROM tarqatmalar WHERE holat IN ('qoralama', 'rejalashtirilgan', 'yuborilmoqda', 'pauza')").all()
    .filter((r) => { try { const m = JSON.parse(r.malumot); return m.xabar && m.xabar.media && m.xabar.media.id === mediaId; } catch (_) { return false; } })
    .map((r) => `ommaviy xabar: ${r.nom}`);
}

module.exports = {
  olish, royxat, saqla, boshla, pauza, davom, bekor, rejaniOlibTashla, ochir,
  ishla, ishgaTushir, mediaFoydalanish
};
