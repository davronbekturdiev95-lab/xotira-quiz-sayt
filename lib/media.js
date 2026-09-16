/* ============================================================================
 * MEDIA — rasm va videolarni yuklash, saqlash, berish
 *
 * Nginx serverda 1 MB dan katta so'rovni o'tkazmaydi (o'zgartirish uchun root
 * kerak). Shuning uchun fayl brauzerda 700 KB lik bo'laklarga bo'linib
 * yuboriladi va serverda qayta yig'iladi.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db.js');

const PAPKA = path.join(__dirname, '..', 'data', 'media');
const YUKLASH = path.join(PAPKA, '.yuklash');

const CHEGARA = { rasm: 10 * 1024 * 1024, video: 50 * 1024 * 1024 };
const QISM_HAJMI = 700 * 1024;
const QISM_MAX = 1000 * 1024;

const RUXSAT = {
  'image/jpeg': { tur: 'rasm', ext: 'jpg' },
  'image/png': { tur: 'rasm', ext: 'png' },
  'image/webp': { tur: 'rasm', ext: 'webp' },
  'video/mp4': { tur: 'video', ext: 'mp4' }
};

const MIME_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' };

const yuklashlar = new Map();
const tekshiruvchilar = [];

const son = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : null; };

/* ------------------------------------------------------------ yuklash */
function boshla({ nom, mime, hajm, eni, boyi } = {}, yaratgan) {
  const r = RUXSAT[mime];
  if (!r) return { xato: 'Faqat JPG, PNG, WEBP rasm yoki MP4 video yuklash mumkin' };
  const n = son(hajm);
  if (!n) return { xato: 'Fayl hajmi noma\'lum' };
  if (n > CHEGARA[r.tur]) {
    return { xato: `${r.tur === 'rasm' ? 'Rasm' : 'Video'} hajmi ${Math.round(CHEGARA[r.tur] / 1048576)} MB dan oshmasin` };
  }

  fs.mkdirSync(YUKLASH, { recursive: true });
  tozala();

  const id = crypto.randomBytes(8).toString('hex');
  yuklashlar.set(id, {
    id, mime, tur: r.tur, ext: r.ext, hajm: n,
    nom: String(nom || '').slice(0, 120), eni: son(eni), boyi: son(boyi),
    olindi: 0, qism: 0, vaqt: Date.now(), yaratgan: yaratgan || null
  });
  fs.writeFileSync(path.join(YUKLASH, id), Buffer.alloc(0));
  return { id, qismHajmi: QISM_HAJMI };
}

function qismYoz(id, tartib, buf) {
  const y = yuklashlar.get(String(id || ''));
  if (!y) return { xato: 'Yuklash topilmadi yoki eskirgan — qaytadan urinib ko\'ring' };
  const t = Number(tartib);
  if (t === y.qism - 1) return { ok: true, olindi: y.olindi };   // qayta yuborilgan bo'lak
  if (t !== y.qism) return { xato: 'Bo\'laklar tartibi buzildi' };
  if (!buf || !buf.length) return { xato: 'Bo\'sh bo\'lak' };
  if (buf.length > QISM_MAX) return { xato: 'Bo\'lak juda katta' };
  if (y.olindi + buf.length > y.hajm) return { xato: 'Fayl e\'lon qilinganidan katta' };

  fs.appendFileSync(path.join(YUKLASH, y.id), buf);
  y.olindi += buf.length;
  y.qism++;
  y.vaqt = Date.now();
  return { ok: true, olindi: y.olindi };
}

function sehrliBaytlar(bosh, mime) {
  if (mime === 'image/jpeg') return bosh[0] === 0xFF && bosh[1] === 0xD8 && bosh[2] === 0xFF;
  if (mime === 'image/png') return bosh.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  if (mime === 'image/webp') return bosh.subarray(0, 4).toString('latin1') === 'RIFF' && bosh.subarray(8, 12).toString('latin1') === 'WEBP';
  if (mime === 'video/mp4') return bosh.subarray(4, 8).toString('latin1') === 'ftyp';
  return false;
}

function tugat(id) {
  const y = yuklashlar.get(String(id || ''));
  if (!y) return { xato: 'Yuklash topilmadi yoki eskirgan' };
  const vaqtincha = path.join(YUKLASH, y.id);

  if (y.olindi !== y.hajm) return { xato: 'Fayl to\'liq yuklanmadi' };

  const bosh = Buffer.alloc(16);
  const fd = fs.openSync(vaqtincha, 'r');
  fs.readSync(fd, bosh, 0, 16, 0);
  fs.closeSync(fd);

  if (!sehrliBaytlar(bosh, y.mime)) {
    fs.rmSync(vaqtincha, { force: true });
    yuklashlar.delete(y.id);
    return { xato: 'Fayl ichidagi ma\'lumot turi e\'lon qilinganiga mos emas' };
  }

  const fayl = `${y.id}.${y.ext}`;
  fs.renameSync(vaqtincha, path.join(PAPKA, fayl));
  yuklashlar.delete(y.id);

  db().prepare(`
    INSERT INTO media (id, fayl, nom, tur, mime, hajm, eni, boyi, yaratilgan, yaratgan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(y.id, fayl, y.nom || null, y.tur, y.mime, y.hajm, y.eni, y.boyi, Date.now(), y.yaratgan);

  return { media: olish(y.id) };
}

/** 2 soatdan eski tugallanmagan yuklashlarni tozalaydi */
function tozala() {
  const chegara = Date.now() - 2 * 3600e3;
  for (const [id, y] of yuklashlar) {
    if (y.vaqt < chegara) {
      fs.rmSync(path.join(YUKLASH, id), { force: true });
      yuklashlar.delete(id);
    }
  }
}

/* -------------------------------------------------------------- o'qish */
function tayyorla(r) {
  if (!r) return null;
  return Object.assign({}, r, { url: '/media/' + r.fayl });
}

function olish(id) {
  return tayyorla(db().prepare('SELECT * FROM media WHERE id = ?').get(String(id || '')));
}

function royxat() {
  return db().prepare('SELECT * FROM media ORDER BY yaratilgan DESC').all()
    .map((r) => Object.assign(tayyorla(r), { foydalanish: foydalanish(r.id) }));
}

function faylYoli(r) {
  return path.join(PAPKA, r.fayl);
}

/** /media/<fayl> so'rovi uchun — faqat bazadagi fayllar beriladi */
function faylTop(nom) {
  const m = /^([0-9a-f]{16})\.(jpg|png|webp|mp4)$/.exec(String(nom || ''));
  if (!m) return null;
  const r = db().prepare('SELECT fayl, mime FROM media WHERE id = ?').get(m[1]);
  if (!r || r.fayl !== nom) return null;
  const yol = path.join(PAPKA, r.fayl);
  if (!fs.existsSync(yol)) return null;
  return { yol, mime: r.mime || MIME_EXT[m[2]] };
}

function fileIdSaqla(id, fileId) {
  db().prepare('UPDATE media SET tg_file_id = ? WHERE id = ?').run(fileId || null, String(id));
}

/* ------------------------------------------------------------ o'chirish */
/** Qaysi joyda ishlatilayotganini aytuvchi funksiya ro'yxatga olinadi: (id) => ['...'] */
function foydalanishTekshiruvchi(fn) {
  tekshiruvchilar.push(fn);
}

function foydalanish(id) {
  const n = [];
  for (const fn of tekshiruvchilar) {
    try { n.push(...(fn(id) || [])); } catch (_) {}
  }
  return n;
}

function ochir(id) {
  const r = olish(id);
  if (!r) return { xato: 'Fayl topilmadi' };
  const qayerda = foydalanish(r.id);
  if (qayerda.length) return { xato: 'Bu fayl ishlatilmoqda: ' + qayerda.join('; ') };
  fs.rmSync(faylYoli(r), { force: true });
  db().prepare('DELETE FROM media WHERE id = ?').run(r.id);
  return { ok: true, media: r };
}

module.exports = {
  CHEGARA, QISM_HAJMI,
  boshla, qismYoz, tugat,
  olish, royxat, faylYoli, faylTop, fileIdSaqla,
  foydalanishTekshiruvchi, foydalanish, ochir
};
