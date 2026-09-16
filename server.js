/* ============================================================================
 * XOTIRA TESTI — sayt + to'liq boshqaruv paneli
 * Node.js 18+ , hech qanday npm paket kerak emas.
 *
 *   /          — test sayti
 *   /admin     — boshqaruv paneli (login + parol)
 * ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const db = require('./lib/db.js');
const store = require('./lib/store.js');
const auth = require('./lib/auth.js');
const quiz = require('./lib/quiz.js');
const amo = require('./lib/amo.js');
const telegram = require('./lib/telegram.js');
const tgapi = require('./lib/tgapi.js');
const obunachilar = require('./lib/obunachilar.js');
const media = require('./lib/media.js');
const yuboruvchi = require('./lib/yuboruvchi.js');
const voronka = require('./lib/voronka.js');
const tarqatma = require('./lib/tarqatma.js');
const natijaTahlil = require('./lib/natija.js');
const { OQLAR, BELGILAR, RANG_NOMLARI, SHAKL_NOMLARI } = require('./shared/defaults.js');
const { DAVLATLAR, UZ_OPERATORLAR, davlatTop } = require('./shared/davlatlar.js');

// ---------------------------------------------------------------- sozlamalar
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '';
const SHEETS_URL = process.env.SHEETS_URL || '';
const SHEETS_SECRET = process.env.SHEETS_SECRET || '';
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const SAYT_URL = process.env.SAYT_URL || '';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Bot obunachilari, voronka, ommaviy xabarlar va media — data/bot.db (SQLite)
db.ochish();
media.foydalanishTekshiruvchi((id) => (store.configOl().videolar || [])
  .filter((v) => v.poster === id).map((v) => 'video posteri: ' + String(v.id).toUpperCase()));
media.foydalanishTekshiruvchi(voronka.mediaFoydalanish);
media.foydalanishTekshiruvchi(tarqatma.mediaFoydalanish);

// Birinchi ishga tushirishda bosh adminni yaratamiz
auth.boshAdminYarat(process.env.BOSH_ADMIN_LOGIN || 'admin', process.env.ADMIN_PAROL || '');
if (!store.usersOl().length) {
  console.warn('⚠️  Admin yo\'q. .env ga ADMIN_PAROL yozing va serverni qayta ishga tushiring.');
}
if (!SHEETS_URL) console.warn('⚠️  SHEETS_URL yo\'q — natijalar faqat lokal faylga yoziladi.');

/* ==========================================================================
 * SAYT HTML — sozlamalar va dizayn to'g'ridan-to'g'ri sahifaga joylanadi
 * ========================================================================== */
/** Bitta mavzuning ranglarini CSS o'zgaruvchilariga aylantiradi */
function mavzuVars(p) {
  return Object.keys(p).map((k) => `--${k.replace(/_/g, '-')}:${p[k]};`).join(' ');
}

function dizaynCss(d) {
  const shakl = mavzuVars(d.shakl);
  const qorongi = mavzuVars(d.qorongi);
  const yorug = mavzuVars(d.yorug);

  return [
    // Standart — qorong'i
    `:root{ ${shakl} ${qorongi} }`,
    // Tizim yorug' rejimda bo'lsa (foydalanuvchi qorong'ini tanlamagan bo'lsa)
    `@media (prefers-color-scheme: light){ :root:not([data-mavzu="qorongi"]){ ${yorug} } }`,
    // Foydalanuvchi o'zi tanlagan bo'lsa
    `:root[data-mavzu="yorug"]{ ${yorug} }`,
    `:root[data-mavzu="qorongi"]{ ${qorongi} }`
  ].join('\n');
}

function saytHtml() {
  const config = store.configOl();
  const shablon = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

  const sozlamalar = {
    savollar: quiz.ommaviySavollar(config),
    matnlar: config.matnlar,
    davlatlar: DAVLATLAR,
    fon: { qorongi: config.dizayn.qorongi.fon_2, yorug: config.dizayn.yorug.fon_2 }
  };

  return shablon
    .replace('/*DIZAYN*/', dizaynCss(config.dizayn))
    .replace('/*SOZLAMALAR*/', 'window.__SOZLAMALAR__=' + JSON.stringify(sozlamalar) + ';')
    .replace(/\{\{sayt_nomi\}\}/g, esc(config.matnlar.sayt_nomi))
    .replace(/\{\{sayt_tavsif\}\}/g, esc(config.matnlar.sayt_tavsif));
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ==========================================================================
 * LEAD TEKSHIRUVI
 * ========================================================================== */
function ismTekshir(ism) {
  const t = String(ism || '').trim().replace(/\s+/g, ' ');
  if (t.length < 2) return { xato: 'Ismingizni kiriting' };
  if (t.length > 60) return { xato: 'Ism juda uzun' };
  return { ism: t };
}

/**
 * Xalqaro telefon raqamni tekshiradi.
 * Kutiladi: to'liq raqam kod bilan, masalan +998901234567 yoki +14155550123
 */
function telefonTekshir(tel, davlatKodi) {
  const hammasi = String(tel || '').replace(/\D/g, '');
  if (!hammasi) return { xato: 'Telefon raqamingizni kiriting' };
  if (hammasi.length < 7 || hammasi.length > 15) {
    return { xato: 'Telefon raqam noto\'g\'ri' };
  }

  const davlat = davlatTop(String(davlatKodi || '').toUpperCase());

  // Davlat tanlangan bo'lsa — uning uzunligiga qarab tekshiramiz
  if (davlat && davlat.dial) {
    if (!hammasi.startsWith(davlat.dial)) {
      return { xato: 'Raqam tanlangan davlat kodiga mos emas' };
    }
    const milliy = hammasi.slice(davlat.dial.length);
    const [eng_kam, eng_kop] = davlat.uzunlik;
    if (milliy.length < eng_kam || milliy.length > eng_kop) {
      return { xato: 'Telefon raqam to\'liq emas' };
    }
    if (davlat.kod === 'UZ' && !UZ_OPERATORLAR.test(milliy)) {
      return { xato: 'Telefon raqam noto\'g\'ri' };
    }
    return { telefon: '+' + hammasi, davlat: davlat.kod };
  }

  // Davlat tanlanmagan yoki "boshqa" — faqat umumiy uzunlik
  return { telefon: '+' + hammasi, davlat: davlat ? davlat.kod : '' };
}

/* ==========================================================================
 * NATIJANI SAQLASH
 * ========================================================================== */
async function sheetsGaYubor(qator) {
  if (!SHEETS_URL) return;
  try {
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ secret: SHEETS_SECRET }, qator))
    });
    if (!res.ok) console.error('[sheets]', res.status);
  } catch (e) {
    console.error('[sheets]', e.message);
  }
}

function natijaQatori(config, lead, javoblar, natija, qoshimcha) {
  const j = {};
  config.savollar.forEach((savol, i) => {
    const key = javoblar[savol.id];
    const variant = savol.variantlar.find((v) => v.key === key);
    j['q' + (i + 1)] = key;
    j['q' + (i + 1) + '_matn'] = variant ? variant.matn : '';
  });

  return Object.assign({
    vaqt: new Date().toISOString(),
    ism: lead.ism,
    telefon: lead.telefon,
    davlat: lead.davlat || '',
    video_id: natija.videoId,
    video_nomi: natija.video ? natija.video.nom : '',
    havola: natija.havola,
    yonalish: natija.golibOq,
    sabab: natija.sabab,
    daraja: natija.daraja,
    daraja_foiz: natija.darajaFoiz,
    ball_xotira: natija.foiz.xotira,
    ball_diqqat: natija.foiz.diqqat,
    ball_til: natija.foiz.til,
    manba: qoshimcha.manba || '',
    utm: qoshimcha.utm || '',
    kanal: qoshimcha.kanal || 'sayt',
    tg_id: qoshimcha.tg_id || '',
    tg_username: qoshimcha.tg_username || ''
  }, j);
}

/* ==========================================================================
 * STATISTIKA
 * ========================================================================== */
const HODISA_NOMLARI = ['ochildi', 'boshladi', 'formaga_yetdi', 'video_bosdi'];

/* Mini app ichidagi hodisa → obunachi bosqichi va voronka */
const SAYT_BOT_HODISA = { ochildi: 'miniapp_ochdi', boshladi: 'test_boshladi', formaga_yetdi: 'formaga_yetdi', video_bosdi: 'video_bosdi' };

function botHodisasi(tgUser, hodisa, qoshimcha) {
  const tur = SAYT_BOT_HODISA[hodisa] || hodisa;
  try {
    obunachilar.upsert(tgUser);
    obunachilar.hodisaQayd(tgUser.id, tur, qoshimcha);
    voronka.hodisa(tgUser.id, tur);
  } catch (e) {
    console.error('[obunachi]', e.message);
  }
}

/* Taqqoslash uchun oldingi natijalarning daraja foizlari (xotirada) */
let FOIZLAR = null;
function oldingiFoizlar() {
  if (!FOIZLAR) FOIZLAR = store.natijalarOl().map((r) => Number(r.daraja_foiz)).filter(Number.isFinite);
  return FOIZLAR;
}

function posterUrl(id) {
  const m = id ? media.olish(id) : null;
  return m ? m.url : null;
}

/** Bir sessiya bitta hodisani ikki marta yozmasin (xotirada) */
const korilganHodisalar = new Map();

function hodisaYangimi(sessiya, hodisa) {
  const kalit = sessiya + '|' + hodisa;
  if (korilganHodisalar.has(kalit)) return false;
  korilganHodisalar.set(kalit, Date.now());
  // Xotira to'lib ketmasin — eski yozuvlarni tozalab turamiz
  if (korilganHodisalar.size > 20000) {
    const chegara = Date.now() - 6 * 3600 * 1000;
    for (const [k, vaqt] of korilganHodisalar) if (vaqt < chegara) korilganHodisalar.delete(k);
  }
  return true;
}

function statistika() {
  const config = store.configOl();
  const qatorlar = store.natijalarOl();
  const hodisalar = store.hodisalarOl();

  const bugun = new Date().toISOString().slice(0, 10);
  const hafta = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  const videolar = {};
  config.videolar.forEach((v) => { videolar[v.id] = { nom: v.nom, son: 0 }; });
  const darajalar = {};

  qatorlar.forEach((r) => {
    if (videolar[r.video_id]) videolar[r.video_id].son++;
    if (r.daraja) darajalar[r.daraja] = (darajalar[r.daraja] || 0) + 1;
  });

  /* --- Voronka: har bosqichda nechta har xil odam bo'lgan --- */
  function voronka(danSana) {
    const son = {};
    HODISA_NOMLARI.forEach((h) => { son[h] = new Set(); });

    hodisalar.forEach((e) => {
      if (danSana && (e.vaqt || '').slice(0, 10) < danSana) return;
      if (son[e.hodisa]) son[e.hodisa].add(e.sessiya || Math.random());
    });

    const natijalar = qatorlar.filter((r) => !danSana || (r.vaqt || '').slice(0, 10) >= danSana);

    return {
      ochildi: son.ochildi.size,
      boshladi: son.boshladi.size,
      formaga_yetdi: son.formaga_yetdi.size,
      tugatdi: natijalar.length,
      video_bosdi: son.video_bosdi.size
    };
  }

  return {
    amo: amo.holat(),
    jami: qatorlar.length,
    bugun: qatorlar.filter((r) => (r.vaqt || '').slice(0, 10) === bugun).length,
    hafta: qatorlar.filter((r) => (r.vaqt || '').slice(0, 10) >= hafta).length,
    voronka: {
      hammasi: voronka(null),
      bugun: voronka(bugun),
      hafta: voronka(hafta)
    },
    videolar,
    darajalar,
    kanallar: {
      sayt: qatorlar.filter((r) => r.kanal !== 'telegram').length,
      telegram: qatorlar.filter((r) => r.kanal === 'telegram').length
    },
    bot: telegram.holat(),
    oxirgilar: qatorlar.slice(-30).reverse().map((r) => ({
      vaqt: r.vaqt, ism: r.ism, telefon: r.telefon, video_id: r.video_id, daraja: r.daraja,
      kanal: r.kanal || 'sayt', tg_username: r.tg_username || ''
    }))
  };
}

function csvYarat() {
  const config = store.configOl();
  const qatorlar = store.natijalarOl();
  if (!qatorlar.length) return '﻿Natijalar yo\'q\n';

  const ustunlar = ['vaqt', 'ism', 'telefon', 'davlat', 'kanal', 'tg_username', 'video_id', 'video_nomi', 'havola',
    'daraja', 'daraja_foiz', 'yonalish', 'ball_xotira', 'ball_diqqat', 'ball_til', 'manba', 'utm'];
  config.savollar.forEach((s, i) => ustunlar.push('q' + (i + 1) + '_matn'));

  const q = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  /* Excel "+998..." ni formula deb o'ylab raqamga aylantirib yuboradi
     (9,98933E+11 bo'lib ketadi). ="..." shakli uni matn sifatida ushlab turadi. */
  const matnQil = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    if (!s) return '';
    return '="' + s.replace(/"/g, '""') + '"';
  };

  const MATN_USTUNLAR = new Set(['telefon']);

  const satrlar = [ustunlar.join(';')];
  qatorlar.forEach((r) => {
    satrlar.push(ustunlar.map((u) => (MATN_USTUNLAR.has(u) ? matnQil(r[u]) : q(r[u]))).join(';'));
  });
  return '﻿' + satrlar.join('\n');
}

/* ==========================================================================
 * CONFIG TEKSHIRUVI (admin yuborgan ma'lumot)
 * ========================================================================== */
const HARFLAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function configTekshir(xom, eski) {
  const yangi = JSON.parse(JSON.stringify(eski));

  // ---- savollar ----
  if (Array.isArray(xom.savollar)) {
    if (!xom.savollar.length) return { xato: 'Kamida bitta savol bo\'lishi kerak' };
    if (xom.savollar.length > 40) return { xato: 'Savollar soni 40 tadan oshmasin' };

    const idlar = new Set();
    const savollar = [];

    for (const s of xom.savollar) {
      const matn = String(s.matn || '').trim();
      if (!matn) return { xato: 'Savol matni bo\'sh qolmasin' };
      if (!Array.isArray(s.variantlar) || s.variantlar.length < 2) {
        return { xato: `"${matn.slice(0, 30)}" savolida kamida 2 ta variant bo'lishi kerak` };
      }
      if (s.variantlar.length > 26) return { xato: 'Bitta savolda 26 tadan ko\'p variant bo\'lmaydi' };

      let id = String(s.id || '').trim();
      if (!id || idlar.has(id)) id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      idlar.add(id);

      const variantlar = s.variantlar.map((v, i) => {
        const vm = String(v.matn || '').trim();
        if (!vm) throw new Error(`"${matn.slice(0, 30)}" savolida bo'sh variant bor`);
        const chiqish = {
          key: HARFLAR[i],                     // kalitlar tartib bo'yicha qayta beriladi
          matn: vm.slice(0, 300),
          ball: sonlar(v.ball, quiz.OQ_KODLAR),
          belgi: sonlar(v.belgi, quiz.BELGI_KODLAR),
          daraja: son(v.daraja)
        };
        if (v.yoshGuruh === 'yosh' || v.yoshGuruh === 'katta') chiqish.yoshGuruh = v.yoshGuruh;
        for (const iz of ['muammo', 'kuchli', 'reja']) {
          const t = String(v[iz] || '').trim().slice(0, 300);
          if (t) chiqish[iz] = t;
        }
        if (v.katta && (v.katta.ball || v.katta.belgi)) {
          chiqish.katta = {
            ball: sonlar(v.katta.ball, quiz.OQ_KODLAR),
            belgi: sonlar(v.katta.belgi, quiz.BELGI_KODLAR)
          };
        }
        return chiqish;
      });

      const chiqSavol = { id, matn: matn.slice(0, 400), variantlar };
      if (s.yashirin) chiqSavol.yashirin = true;   // SAQLASH da yashirin belgisi yo'qolmasin
      savollar.push(chiqSavol);
    }
    if (!savollar.some((s) => !s.yashirin)) return { xato: 'Kamida bitta savol ko\'rinib turishi kerak' };
    yangi.savollar = savollar;

    if (xom.yoshSavoli && idlar.has(String(xom.yoshSavoli))) yangi.yoshSavoli = String(xom.yoshSavoli);
    else if (!idlar.has(yangi.yoshSavoli)) yangi.yoshSavoli = savollar[0].id;
  }

  // ---- videolar ----
  if (Array.isArray(xom.videolar)) {
    if (!xom.videolar.length) return { xato: 'Kamida bitta video bo\'lishi kerak' };

    const idlar = new Set();
    const videolar = [];

    for (const v of xom.videolar) {
      const nom = String(v.nom || '').trim();
      if (!nom) return { xato: 'Video nomi bo\'sh qolmasin' };

      const havola = String(v.havola || '').trim();
      if (!havola) return { xato: `"${nom.slice(0, 30)}" videosining havolasi bo'sh` };
      if (!/^https?:\/\//i.test(havola)) {
        return { xato: `"${nom.slice(0, 30)}" havolasi https:// bilan boshlanishi kerak` };
      }

      let id = String(v.id || '').trim();
      if (!id || idlar.has(id)) id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      idlar.add(id);

      const yonalish = ['xotira', 'diqqat', 'til', 'istalgan'].includes(v.yonalish) ? v.yonalish : 'xotira';

      const shartlar = (Array.isArray(v.shartlar) ? v.shartlar : [])
        .filter((s) => quiz.BELGI_KODLAR.includes(s.belgi))
        .map((s) => ({ belgi: s.belgi, min: son(s.min) }))
        .slice(0, 4);

      videolar.push({
        id,
        nom: nom.slice(0, 200),
        kimga: String(v.kimga || '').trim().slice(0, 200),
        havola: havola.slice(0, 500),
        matn: String(v.matn || '').trim().slice(0, 1500),
        yonalish,
        shartlar,
        ustunlik: son(v.ustunlik),
        zaxira: !!v.zaxira,
        poster: posterTekshir(v.poster),
        foydalar: String(v.foydalar || '').trim().slice(0, 1000)
      });
    }

    if (!videolar.some((v) => v.zaxira)) videolar[0].zaxira = true;
    yangi.videolar = videolar;
  }

  // ---- darajalar ----
  if (Array.isArray(xom.darajalar)) {
    if (!xom.darajalar.length) return { xato: 'Kamida bitta daraja bo\'lishi kerak' };
    const darajalar = xom.darajalar.map((d, i) => ({
      kod: String(d.kod || 'd' + i).trim().slice(0, 40),
      nom: String(d.nom || '').trim().slice(0, 60) || 'Daraja ' + (i + 1),
      max: Math.max(0, Math.min(100, son(d.max))),
      matn: String(d.matn || '').trim().slice(0, 1500)
    })).sort((a, b) => a.max - b.max);
    darajalar[darajalar.length - 1].max = 100;   // oxirgisi doim 100%
    yangi.darajalar = darajalar;
  }

  // ---- matnlar ----
  if (xom.matnlar && typeof xom.matnlar === 'object') {
    for (const k of Object.keys(yangi.matnlar)) {
      if (typeof xom.matnlar[k] === 'string') yangi.matnlar[k] = xom.matnlar[k].slice(0, 1000);
    }
  }

  // ---- dizayn ----
  if (xom.dizayn && typeof xom.dizayn === 'object') {
    for (const bolim of ['qorongi', 'yorug', 'shakl']) {
      const manba = xom.dizayn[bolim];
      if (!manba || typeof manba !== 'object') continue;
      for (const k of Object.keys(yangi.dizayn[bolim])) {
        const q = manba[k];
        if (typeof q !== 'string') continue;
        const t = q.trim().slice(0, 40);
        if (/[<>{};()]/.test(t)) continue;        // CSS ichiga begona narsa kirmasin
        if (t) yangi.dizayn[bolim][k] = t;
      }
    }
  }

  return { config: yangi };
}

function son(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function sonlar(obj, kalitlar) {
  const o = {};
  if (!obj) return o;
  for (const k of kalitlar) {
    const n = son(obj[k]);
    if (n) o[k] = n;
  }
  return o;
}

/* ==========================================================================
 * HTTP YORDAMCHILARI
 * ========================================================================== */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

function faylBer(filePath, res) {
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Sahifa topilmadi');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}

function tanaOqi(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) { reject(new Error('Juda katta')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Video posteri — faqat bazada bor rasm bo'lsa qabul qilinadi */
function posterTekshir(id) {
  const m = id ? media.olish(String(id)) : null;
  return m && m.tur === 'rasm' ? m.id : null;
}

/** Ikkilik tana (fayl bo'laklari uchun) */
function tanaBuf(req, limit) {
  return new Promise((resolve, reject) => {
    const qismlar = [];
    let hajm = 0;
    req.on('data', (c) => {
      hajm += c.length;
      if (hajm > limit) { reject(new Error('Juda katta')); req.destroy(); return; }
      qismlar.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(qismlar)));
    req.on('error', reject);
  });
}

/** Rasm / videoni berish (video uchun Range qo'llab-quvvatlanadi) */
function mediaUzat(req, res, faylYoli, mime) {
  fs.stat(faylYoli, (err, st) => {
    if (err) { res.writeHead(404); return res.end(); }
    const sarlavha = {
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    };
    const r = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    if (r && (r[1] || r[2])) {
      let bosh = r[1] ? Number(r[1]) : Math.max(0, st.size - Number(r[2]));
      const oxir = r[1] && r[2] ? Math.min(Number(r[2]), st.size - 1) : st.size - 1;
      if (bosh > oxir || bosh >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      bosh = Math.max(0, bosh);
      res.writeHead(206, Object.assign(sarlavha, { 'Content-Range': `bytes ${bosh}-${oxir}/${st.size}`, 'Content-Length': oxir - bosh + 1 }));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(faylYoli, { start: bosh, end: oxir }).pipe(res);
    }
    res.writeHead(200, Object.assign(sarlavha, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(faylYoli).pipe(res);
  });
}

function hajmMatn(bayt) {
  const n = Number(bayt || 0);
  return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}

function toshkentVaqt(ms) {
  return new Date(Number(ms) + 5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
}

function json(res, code, obj, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(JSON.stringify(obj));
}

/**
 * Mijozning haqiqiy IP manzili.
 * X-Real-IP — bizning Nginx qo'yadi (Cloudflare IP'larini tekshirib bo'lgach),
 * shuning uchun unga ishonsa bo'ladi. X-Forwarded-For ni mijoz o'zi soxtalashtira oladi.
 */
function ipOl(req) {
  return String(req.headers['x-real-ip'] || '').trim()
    || String(req.headers['cf-connecting-ip'] || '').trim()
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress || '';
}

function httpsMi(req) {
  return (req.headers['x-forwarded-proto'] || '').includes('https');
}

/* ==========================================================================
 * SERVER
 * ========================================================================== */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const yol = url.pathname;

  try {
    if (yol === '/health') return json(res, 200, { ok: true, uptime: process.uptime() });

    /* ------------------------------------------------------ TEST NATIJASI */
    if (req.method === 'POST' && yol === '/api/result') {
      const body = JSON.parse((await tanaOqi(req)) || '{}');
      const config = store.configOl();

      const ismR = ismTekshir(body.ism);
      if (ismR.xato) return json(res, 400, { ok: false, error: ismR.xato });

      const telR = telefonTekshir(body.telefon, body.davlat);
      if (telR.xato) return json(res, 400, { ok: false, error: telR.xato });

      const tekshir = quiz.javoblarniTekshir(quiz.faolSavollar(config), body.javoblar);
      if (tekshir.xato) return json(res, 400, { ok: false, error: tekshir.xato });

      const natija = quiz.hisobla(config, tekshir.javoblar);
      if (!natija.video) return json(res, 500, { ok: false, error: 'Video sozlanmagan' });

      // Telegram ichidan kelgan bo'lsa — imzoni tekshiramiz (soxtalashtirib bo'lmaydi)
      const tgUser = body.initData ? telegram.initDataTekshir(body.initData, BOT_TOKEN) : null;

      const qator = natijaQatori(config, { ism: ismR.ism, telefon: telR.telefon, davlat: telR.davlat }, tekshir.javoblar, natija, {
        manba: String(body.manba || '').slice(0, 200),
        utm: String(body.utm || '').slice(0, 300),
        kanal: tgUser ? 'telegram' : 'sayt',
        tg_id: tgUser ? tgUser.id : '',
        tg_username: tgUser && tgUser.username ? '@' + tgUser.username : ''
      });

      // Batafsil tahlil: xotira kuchi, yo'nalishlar, muammolar, reja, poster
      const tahlil = natijaTahlil.tahlil(config, tekshir.javoblar, natija, {
        ism: ismR.ism,
        oldingiFoizlar: oldingiFoizlar(),
        posterUrl
      });

      store.natijaYoz(qator);
      oldingiFoizlar().push(Number(qator.daraja_foiz));
      sheetsGaYubor(qator);
      amo.yubor(qator);   // xato bo'lsa navbatga tushadi, natijaga ta'sir qilmaydi
      if (tgUser) {
        botHodisasi(tgUser, 'test_tugatdi', { video_id: natija.videoId, daraja_kod: natija.darajaKod, telefon: telR.telefon });
        telegram.natijaYubor(tgUser.id, tahlil, config.matnlar, natija.havola);
      }

      return json(res, 200, {
        ok: true,
        ism: ismR.ism,
        havola: natija.havola,
        videoMatn: natija.videoMatn,
        darajaMatn: natija.darajaMatn,
        daraja: natija.daraja,
        tahlil
      });
    }

    /* ------------------------------------------- VORONKA HODISALARI (sayt) */
    if (req.method === 'POST' && yol === '/api/hodisa') {
      try {
        const body = JSON.parse((await tanaOqi(req, 8192)) || '{}');
        const hodisa = String(body.hodisa || '');
        const sessiya = String(body.sessiya || '').slice(0, 40);

        if (HODISA_NOMLARI.includes(hodisa) && sessiya && hodisaYangimi(sessiya, hodisa)) {
          store.hodisaYoz({
            vaqt: new Date().toISOString(),
            sessiya,
            hodisa,
            kanal: body.kanal === 'telegram' ? 'telegram' : 'sayt',
            manba: String(body.manba || '').slice(0, 200),
            utm: String(body.utm || '').slice(0, 300)
          });
          // Telegram ichida — obunachi bosqichini yangilaymiz (imzo tekshiriladi)
          const tgUser = body.initData && BOT_TOKEN ? telegram.initDataTekshir(body.initData, BOT_TOKEN) : null;
          if (tgUser && tgUser.id) botHodisasi(tgUser, hodisa);
        }
      } catch (_) { /* voronka yozuvi muhim emas — xato bo'lsa jim o'tamiz */ }

      res.writeHead(204);
      return res.end();
    }

    /* --------------------------------- BOT XABARIDAGI TUGMA (bosilishi sanaladi) */
    if (req.method === 'GET' && /^\/r\/[A-Za-z0-9_-]{6,20}$/.test(yol)) {
      const r = yuboruvchi.kodBosildi(yol.slice(3));
      if (!r || !r.manzil || !/^https?:\/\//i.test(r.manzil)) {
        res.writeHead(302, { Location: '/' });
        return res.end();
      }
      if (r.videomi && r.tg_id) botHodisasi({ id: r.tg_id }, 'video_bosdi');
      res.writeHead(302, { Location: r.manzil, 'Cache-Control': 'no-store' });
      return res.end();
    }

    /* -------------------------------------------------- YUKLANGAN RASM / VIDEO */
    if ((req.method === 'GET' || req.method === 'HEAD') && yol.startsWith('/media/')) {
      const f = media.faylTop(yol.slice(7));
      if (!f) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Topilmadi');
      }
      return mediaUzat(req, res, f.yol, f.mime);
    }

    /* -------------------------------------------------------- ADMIN KIRISH */
    if (req.method === 'POST' && yol === '/api/admin/login') {
      const ip = ipOl(req);
      if (!auth.urinishMumkinmi(ip)) {
        return json(res, 429, { ok: false, error: 'Juda ko\'p urinish. 10 daqiqadan keyin qayta urining.' });
      }

      const body = JSON.parse((await tanaOqi(req)) || '{}');
      const user = auth.userTop(body.login);
      const mos = user && auth.parolTogrimi(body.parol, user.parol);

      auth.urinishQayd(ip, !!mos);
      if (!mos) {
        store.tarixYoz({ login: String(body.login || '').slice(0, 40), rol: '-', amal: 'Kirishda xato parol', tafsilot: [], ip });
        return json(res, 401, { ok: false, error: 'Login yoki parol noto\'g\'ri' });
      }

      const users = store.usersOl();
      const u = users.find((x) => x.id === user.id);
      u.oxirgiKirish = new Date().toISOString();
      store.usersSaqla(users);

      store.tarixYoz({ login: user.login, rol: user.rol, amal: 'Tizimga kirdi', tafsilot: [], ip });

      return json(res, 200, { ok: true, user: { login: user.login, rol: user.rol } },
        { 'Set-Cookie': auth.cookieMatn(auth.tokenYarat(user.id), httpsMi(req)) });
    }

    if (req.method === 'POST' && yol === '/api/admin/logout') {
      const user = auth.joriyUser(req);
      if (user) store.tarixYoz({ login: user.login, rol: user.rol, amal: 'Tizimdan chiqdi', tafsilot: [], ip: ipOl(req) });
      return json(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieOchir });
    }

    /* --------------------------------------------- HIMOYALANGAN ADMIN API */
    if (yol.startsWith('/api/admin/')) {
      const user = auth.joriyUser(req);
      if (!user) return json(res, 401, { ok: false, error: 'Avval tizimga kiring' });
      const ip = ipOl(req);

      // --- joriy foydalanuvchi + hamma ma'lumot ---
      if (req.method === 'GET' && yol === '/api/admin/config') {
        return json(res, 200, {
          ok: true,
          user: { login: user.login, rol: user.rol },
          config: store.configOl(),
          oqlar: OQLAR,
          belgilar: BELGILAR,
          rangNomlari: RANG_NOMLARI,
          shaklNomlari: SHAKL_NOMLARI,
          maksimum: quiz.maksimum(quiz.faolSavollar(store.configOl())),
          posterlar: Object.fromEntries(store.configOl().videolar
            .filter((v) => v.poster).map((v) => [v.poster, posterUrl(v.poster)]).filter((x) => x[1]))
        });
      }

      // --- config saqlash ---
      if (req.method === 'POST' && yol === '/api/admin/config') {
        const xom = JSON.parse((await tanaOqi(req)) || '{}');
        const eski = store.configOl();

        let natija;
        try {
          natija = configTekshir(xom, eski);
        } catch (e) {
          return json(res, 400, { ok: false, error: e.message });
        }
        if (natija.xato) return json(res, 400, { ok: false, error: natija.xato });

        const farqlar = store.farqla(eski, natija.config);
        if (!farqlar.length) {
          return json(res, 200, { ok: true, config: eski, xabar: 'O\'zgarish yo\'q' });
        }

        store.configSaqla(natija.config);
        store.tarixYoz({
          login: user.login, rol: user.rol,
          amal: xom.bolim ? bolimNomi(xom.bolim) : 'Sozlamalarni o\'zgartirdi',
          tafsilot: farqlar, ip
        });

        return json(res, 200, { ok: true, config: natija.config, ozgarishlar: farqlar.length });
      }

      // --- savolni yashirish / ko'rsatish (bitta tugma) ---
      // Faqat shu savolning belgisi o'zgaradi — boshqa saqlanmagan tahrirlarga tegilmaydi
      if (req.method === 'POST' && yol === '/api/admin/savol-korinish') {
        const body = JSON.parse((await tanaOqi(req)) || '{}');
        const eski = store.configOl();
        const yangi = JSON.parse(JSON.stringify(eski));
        const savol = yangi.savollar.find((s) => s.id === String(body.id || ''));
        if (!savol) return json(res, 404, { ok: false, error: 'Savol topilmadi — avval SAQLASH ni bosing' });

        const yashir = !!body.yashirin;
        if (yashir && !yangi.savollar.some((s) => s.id !== savol.id && !s.yashirin)) {
          return json(res, 400, { ok: false, error: 'Kamida bitta savol ko\'rinib turishi kerak' });
        }
        if (yashir) savol.yashirin = true; else delete savol.yashirin;

        const farqlar = store.farqla(eski, yangi);
        if (!farqlar.length) return json(res, 200, { ok: true, yashirin: yashir });

        store.configSaqla(yangi);
        store.tarixYoz({
          login: user.login, rol: user.rol,
          amal: yashir ? 'Savolni yashirdi' : 'Savolni qayta ko\'rsatdi',
          tafsilot: farqlar, ip
        });
        return json(res, 200, {
          ok: true, yashirin: yashir,
          korinadigan: yangi.savollar.filter((s) => !s.yashirin).length,
          jami: yangi.savollar.length
        });
      }

      // --- amoCRM ulanishini tekshirish ---
      if (req.method === 'GET' && yol === '/api/admin/amo-tekshir') {
        const natija = await amo.tekshir();
        return json(res, 200, { ok: true, natija, holat: amo.holat() });
      }

      // --- amoCRM navbatini hoziroq yuborish ---
      if (req.method === 'POST' && yol === '/api/admin/amo-navbat') {
        await amo.navbatniYubor();
        return json(res, 200, { ok: true, holat: amo.holat() });
      }

      // --- standart dizayn (tiklash uchun) ---
      if (req.method === 'GET' && yol === '/api/admin/standart-dizayn') {
        return json(res, 200, { ok: true, dizayn: require('./shared/defaults.js').boshlangichConfig().dizayn });
      }

      // --- statistika ---
      if (req.method === 'GET' && yol === '/api/admin/stats') {
        return json(res, 200, { ok: true, stats: statistika() });
      }

      if (req.method === 'GET' && yol === '/api/admin/csv') {
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="xotira-testi-natijalar.csv"'
        });
        return res.end(csvYarat());
      }

      // --- amallar tarixi ---
      if (req.method === 'GET' && yol === '/api/admin/tarix') {
        return json(res, 200, { ok: true, tarix: store.tarixOl(300) });
      }

      // --- adminlar ro'yxati ---
      if (req.method === 'GET' && yol === '/api/admin/users') {
        const users = store.usersOl().map((u) => ({
          id: u.id, login: u.login, rol: u.rol, yaratilgan: u.yaratilgan, oxirgiKirish: u.oxirgiKirish
        }));
        return json(res, 200, { ok: true, users, men: user.id });
      }

      // --- o'z parolini o'zgartirish ---
      if (req.method === 'POST' && yol === '/api/admin/parol') {
        const body = JSON.parse((await tanaOqi(req)) || '{}');
        const users = store.usersOl();
        const u = users.find((x) => x.id === user.id);

        if (!auth.parolTogrimi(body.eski, u.parol)) {
          return json(res, 400, { ok: false, error: 'Joriy parol noto\'g\'ri' });
        }
        const xato = auth.parolYetarlimi(body.yangi);
        if (xato) return json(res, 400, { ok: false, error: xato });

        u.parol = auth.parolHash(body.yangi);
        store.usersSaqla(users);
        store.tarixYoz({ login: user.login, rol: user.rol, amal: 'O\'z parolini o\'zgartirdi', tafsilot: [], ip });
        return json(res, 200, { ok: true });
      }

      /* ==================== BOT: media, obunachilar, voronka, ommaviy xabar */
      const BOSH_YOLLAR = [
        '/api/admin/avtomat', '/api/admin/avtomat/holat', '/api/admin/avtomat/ochir', '/api/admin/avtomat/qolda',
        '/api/admin/voronka-sozlama', '/api/admin/tarqatma', '/api/admin/tarqatma/amal'
      ];
      if (req.method === 'POST' && BOSH_YOLLAR.includes(yol) && user.rol !== 'bosh') {
        return json(res, 403, { ok: false, error: 'Bu amal faqat bosh admin uchun' });
      }
      const tana = async () => JSON.parse((await tanaOqi(req)) || '{}');
      const xato400 = (matn) => json(res, 400, { ok: false, error: matn });
      const tarix = (amal, tafsilot) => store.tarixYoz({ login: user.login, rol: user.rol, amal, tafsilot: tafsilot || [], ip });

      if (req.method === 'GET' && yol === '/api/admin/bot-malumot') {
        const cfg = store.configOl();
        return json(res, 200, {
          ok: true,
          triggerlar: voronka.TRIGGERLAR,
          toxtatishHodisalari: voronka.TOXTATISH_HODISALARI,
          bosqichlar: obunachilar.BOSQICHLAR,
          shartTurlari: obunachilar.SHART_TURLARI,
          teglar: obunachilar.barchaTeglar(),
          videolar: cfg.videolar.map((v) => ({ id: v.id, nom: v.nom })),
          darajalar: cfg.darajalar.map((d) => ({ kod: d.kod, nom: d.nom })),
          sozlama: voronka.sozlama(),
          sinovId: db.sozlamaOl('sinov_tg:' + user.login, null),
          bot: telegram.holat(),
          botSozlangan: !!BOT_TOKEN,
          mediaChegara: media.CHEGARA,
          qismHajmi: media.QISM_HAJMI
        });
      }

      // --- media ---
      if (req.method === 'GET' && yol === '/api/admin/media') {
        return json(res, 200, { ok: true, media: media.royxat() });
      }
      if (req.method === 'POST' && yol === '/api/admin/media/boshla') {
        const r = media.boshla(await tana(), user.login);
        return r.xato ? xato400(r.xato) : json(res, 200, Object.assign({ ok: true }, r));
      }
      if (req.method === 'POST' && yol === '/api/admin/media/qism') {
        const r = media.qismYoz(url.searchParams.get('id'), url.searchParams.get('tartib'), await tanaBuf(req, 1024 * 1024));
        return r.xato ? xato400(r.xato) : json(res, 200, Object.assign({ ok: true }, r));
      }
      if (req.method === 'POST' && yol === '/api/admin/media/tugat') {
        const r = media.tugat((await tana()).id);
        if (r.xato) return xato400(r.xato);
        tarix('Fayl yukladi', [`${r.media.nom || r.media.fayl} (${r.media.tur}, ${hajmMatn(r.media.hajm)})`]);
        return json(res, 200, { ok: true, media: r.media });
      }
      if (req.method === 'POST' && yol === '/api/admin/media/ochir') {
        const r = media.ochir((await tana()).id);
        if (r.xato) return xato400(r.xato);
        tarix('Faylni o\'chirdi', [r.media.nom || r.media.fayl]);
        return json(res, 200, { ok: true });
      }

      // --- obunachilar va segmentlar ---
      if (req.method === 'GET' && yol === '/api/admin/obunachilar') {
        const r = obunachilar.royxat({ q: url.searchParams.get('q') || '', sahifa: url.searchParams.get('sahifa') || 1, hajm: 50 });
        return json(res, 200, { ok: true, jami: r.jami, qatorlar: r.qatorlar, stat: obunachilar.statistika() });
      }
      if (req.method === 'POST' && yol === '/api/admin/segment') {
        const s = obunachilar.shartlarniTozala((await tana()).shartlar);
        if (s.xato) return xato400(s.xato);
        return json(res, 200, { ok: true, soni: obunachilar.soni(s.shartlar) });
      }

      // --- voronka ---
      if (req.method === 'GET' && yol === '/api/admin/avtomatlar') {
        return json(res, 200, { ok: true, avtomatlar: voronka.royxat(), sozlama: voronka.sozlama() });
      }
      if (req.method === 'POST' && yol === '/api/admin/avtomat') {
        const r = voronka.saqla(await tana());
        if (r.xato) return xato400(r.xato);
        tarix(r.yangi ? 'Voronka avtomatini yaratdi' : 'Voronka avtomatini o\'zgartirdi',
          [`${r.avtomat.nom} — ${r.avtomat.qadamlar.length} ta qadam`]);
        return json(res, 200, { ok: true, avtomat: Object.assign(r.avtomat, { stat: voronka.statistika(r.avtomat.id) }) });
      }
      if (req.method === 'POST' && yol === '/api/admin/avtomat/holat') {
        const body = await tana();
        const r = voronka.holatQoy(body.id, !!body.faol);
        if (r.xato) return xato400(r.xato);
        tarix(body.faol ? 'Voronka avtomatini yoqdi' : 'Voronka avtomatini o\'chirdi', [r.avtomat.nom]);
        return json(res, 200, { ok: true, avtomat: r.avtomat });
      }
      if (req.method === 'POST' && yol === '/api/admin/avtomat/ochir') {
        const r = voronka.ochir((await tana()).id);
        if (r.xato) return xato400(r.xato);
        tarix('Voronka avtomatini o\'chirib tashladi', [r.avtomat.nom]);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && yol === '/api/admin/avtomat/qolda') {
        const id = (await tana()).id;
        const r = voronka.qoldaIshgaTushir(id);
        if (r.xato) return xato400(r.xato);
        tarix('Voronka avtomatini qo\'lda ishga tushirdi', [`${voronka.avtomatOl(id).nom} — ${r.soni} ta odam`]);
        return json(res, 200, { ok: true, soni: r.soni, jami: r.jami });
      }
      if (req.method === 'POST' && yol === '/api/admin/voronka-sozlama') {
        const r = voronka.sozlamaSaqla(await tana());
        if (r.xato) return xato400(r.xato);
        const t = r.sozlama.tinch;
        tarix('Voronka tinch vaqtini o\'zgartirdi', [t.yoqilgan ? `Xabarlar faqat ${t.dan}–${t.gacha} oralig'ida` : 'Tinch vaqt o\'chirildi — xabarlar istalgan vaqtda']);
        return json(res, 200, { ok: true, sozlama: r.sozlama });
      }

      // --- ommaviy xabar ---
      if (req.method === 'GET' && yol === '/api/admin/tarqatmalar') {
        return json(res, 200, { ok: true, tarqatmalar: tarqatma.royxat() });
      }
      if (req.method === 'POST' && yol === '/api/admin/tarqatma') {
        const r = tarqatma.saqla(await tana(), user.login, voronka.avtomatBormi);
        if (r.xato) return xato400(r.xato);
        tarix(r.yangi ? 'Ommaviy xabar qoralamasini yaratdi' : 'Ommaviy xabarni tahrirladi', [r.tarqatma.nom]);
        return json(res, 200, { ok: true, tarqatma: r.tarqatma });
      }
      if (req.method === 'POST' && yol === '/api/admin/tarqatma/amal') {
        const body = await tana();
        const amallar = {
          boshla: () => (BOT_TOKEN ? tarqatma.boshla(body.id, { rejaVaqt: Number(body.rejaVaqt) || 0 }) : { xato: 'Bot tokeni sozlanmagan' }),
          pauza: () => tarqatma.pauza(body.id),
          davom: () => tarqatma.davom(body.id),
          bekor: () => tarqatma.bekor(body.id),
          'reja-olib': () => tarqatma.rejaniOlibTashla(body.id),
          ochir: () => tarqatma.ochir(body.id)
        };
        if (!amallar[body.amal]) return xato400('Noma\'lum amal');
        const r = amallar[body.amal]();
        if (r.xato) return xato400(r.xato);
        const t = r.tarqatma;
        const nom = {
          boshla: t.holat === 'rejalashtirilgan' ? 'Ommaviy xabarni rejalashtirdi' : 'Ommaviy xabarni yuborishni boshladi',
          pauza: 'Ommaviy xabarni to\'xtatib turdi',
          davom: 'Ommaviy xabarni davom ettirdi',
          bekor: 'Ommaviy xabarni bekor qildi',
          'reja-olib': 'Ommaviy xabar rejasini bekor qildi',
          ochir: 'Ommaviy xabarni o\'chirdi'
        }[body.amal];
        const izoh = body.amal === 'boshla'
          ? (t.holat === 'rejalashtirilgan' ? ` — ${toshkentVaqt(t.reja_vaqt)} (Toshkent)` : ` — ${t.jami} ta odamga`)
          : '';
        tarix(nom, [t.nom + izoh]);
        return json(res, 200, { ok: true, tarqatma: body.amal === 'ochir' ? null : tarqatma.olish(t.id) });
      }

      // --- sinov xabari (o'ziga) ---
      if (req.method === 'POST' && yol === '/api/admin/sinov-id') {
        const id = String((await tana()).tgId || '').trim();
        if (id && !/^\d{5,15}$/.test(id)) return xato400('Telegram ID faqat raqamlardan iborat bo\'ladi');
        db.sozlamaQoy('sinov_tg:' + user.login, id || null);
        return json(res, 200, { ok: true, sinovId: id || null });
      }
      if (req.method === 'POST' && yol === '/api/admin/sinov-yubor') {
        if (!BOT_TOKEN) return xato400('Bot tokeni sozlanmagan');
        const tgId = db.sozlamaOl('sinov_tg:' + user.login, null);
        if (!tgId) return xato400('Avval "Sinov uchun Telegram ID" maydonini to\'ldiring');
        if (!obunachilar.olish(tgId)) return xato400('Bu ID botda topilmadi. Avval botga /start yozing');
        const t = yuboruvchi.tekshirXabar((await tana()).xabar, { avtomatBormi: voronka.avtomatBormi });
        if (t.xato) return xato400(t.xato);
        const n = await yuboruvchi.yubor(tgId, t.xabar, { manba: 'sinov' });
        if (!n.ok) return xato400(n.bloklagan ? 'Botni bloklagansiz — botga qayta /start yozing' : 'Yuborilmadi: ' + n.xato);
        return json(res, 200, { ok: true });
      }

      /* ---- faqat BOSH ADMIN uchun ---- */
      if (yol === '/api/admin/users' || yol === '/api/admin/users/delete' || yol === '/api/admin/users/parol') {
        if (user.rol !== 'bosh') {
          return json(res, 403, { ok: false, error: 'Bu amal faqat bosh admin uchun' });
        }
      }

      // --- yangi admin qo'shish ---
      if (req.method === 'POST' && yol === '/api/admin/users') {
        const body = JSON.parse((await tanaOqi(req)) || '{}');

        const loginXato = auth.loginTogrimi(body.login);
        if (loginXato) return json(res, 400, { ok: false, error: loginXato });

        const parolXato = auth.parolYetarlimi(body.parol);
        if (parolXato) return json(res, 400, { ok: false, error: parolXato });

        if (auth.userTop(body.login)) return json(res, 400, { ok: false, error: 'Bunday login allaqachon bor' });

        const users = store.usersOl();
        const yangi = {
          id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          login: String(body.login).toLowerCase().trim(),
          parol: auth.parolHash(body.parol),
          rol: body.rol === 'bosh' ? 'bosh' : 'admin',
          yaratilgan: new Date().toISOString(),
          oxirgiKirish: null
        };
        users.push(yangi);
        store.usersSaqla(users);

        store.tarixYoz({
          login: user.login, rol: user.rol, amal: 'Yangi admin qo\'shdi',
          tafsilot: [`${yangi.login} (${yangi.rol === 'bosh' ? 'bosh admin' : 'admin'})`], ip
        });
        return json(res, 200, { ok: true });
      }

      // --- adminni o'chirish ---
      if (req.method === 'POST' && yol === '/api/admin/users/delete') {
        const body = JSON.parse((await tanaOqi(req)) || '{}');
        const users = store.usersOl();
        const nishon = users.find((x) => x.id === body.id);

        if (!nishon) return json(res, 404, { ok: false, error: 'Admin topilmadi' });
        if (nishon.id === user.id) return json(res, 400, { ok: false, error: 'O\'zingizni o\'chira olmaysiz' });
        if (nishon.rol === 'bosh' && users.filter((x) => x.rol === 'bosh').length <= 1) {
          return json(res, 400, { ok: false, error: 'Oxirgi bosh adminni o\'chirib bo\'lmaydi' });
        }

        store.usersSaqla(users.filter((x) => x.id !== body.id));
        store.tarixYoz({ login: user.login, rol: user.rol, amal: 'Adminni o\'chirdi', tafsilot: [nishon.login], ip });
        return json(res, 200, { ok: true });
      }

      // --- boshqa adminning parolini almashtirish ---
      if (req.method === 'POST' && yol === '/api/admin/users/parol') {
        const body = JSON.parse((await tanaOqi(req)) || '{}');
        const xato = auth.parolYetarlimi(body.parol);
        if (xato) return json(res, 400, { ok: false, error: xato });

        const users = store.usersOl();
        const nishon = users.find((x) => x.id === body.id);
        if (!nishon) return json(res, 404, { ok: false, error: 'Admin topilmadi' });

        nishon.parol = auth.parolHash(body.parol);
        store.usersSaqla(users);
        store.tarixYoz({ login: user.login, rol: user.rol, amal: 'Admin parolini almashtirdi', tafsilot: [nishon.login], ip });
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { ok: false, error: 'Topilmadi' });
    }

    /* -------------------------------------------------------------- SAHIFA */
    if (yol === '/admin' || yol === '/admin/') {
      return faylBer(path.join(PUBLIC_DIR, 'admin.html'), res);
    }

    if (yol === '/' || yol === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(saytHtml());
    }

    const fayl = path.join(PUBLIC_DIR, path.normalize(yol).replace(/^([/\\])+/, ''));
    if (!fayl.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Taqiqlangan');
    }
    return faylBer(fayl, res);

  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { ok: false, error: 'Server xatosi' });
  }
});

function bolimNomi(bolim) {
  return ({
    savollar: 'Savollarni o\'zgartirdi',
    videolar: 'Videolarni o\'zgartirdi',
    matnlar: 'Sayt matnlarini o\'zgartirdi',
    dizayn: 'Dizaynni o\'zgartirdi',
    darajalar: 'Daraja matnlarini o\'zgartirdi'
  })[bolim] || 'Sozlamalarni o\'zgartirdi';
}

// HOST=127.0.0.1 — faqat server ichidan (Nginx orqali) ochiladi.
// Bo'sh qolsa barcha tarmoq interfeyslarida tinglaydi (kompyuterda sinash uchun).
amo.navbatniBoshla();

yuboruvchi.sozla({ sayt: SAYT_URL, config: () => store.configOl() });
if (BOT_TOKEN) tgapi.sozla(BOT_TOKEN);
eskiTelegramNatijalariniKochir();
voronka.boshlangichlarniQosh();
db.zaxiraBoshla();

if (BOT_TOKEN && SAYT_URL) {
  telegram.ishgaTushir({ token: BOT_TOKEN, sayt: SAYT_URL, matnlar: () => store.configOl().matnlar });
  voronka.ishgaTushir();
  tarqatma.ishgaTushir();
} else if (BOT_TOKEN) {
  console.warn('⚠️  BOT_TOKEN bor, lekin SAYT_URL yo\'q — bot ishga tushmadi (faqat initData tekshiruvi ishlaydi).');
}

const ishgaTushdi = () => {
  console.log(`🌐 Sayt:  http://${HOST || 'localhost'}:${PORT}`);
  console.log(`🔐 Admin: http://${HOST || 'localhost'}:${PORT}/admin`);
};
if (HOST) server.listen(PORT, HOST, ishgaTushdi);
else server.listen(PORT, ishgaTushdi);

/* -------------------------------------------------------------------------
 * Bot obunachilari ro'yxati keyinroq qo'shildi. Undan oldin testni Telegram
 * ichida tugatganlar results.jsonl da bor — ularni bir marta ko'chirib olamiz.
 * ------------------------------------------------------------------------- */
function eskiTelegramNatijalariniKochir() {
  try {
    if (db.sozlamaOl('natijalar_kochirildi', false)) return;
    const kodlar = {};
    (store.configOl().darajalar || []).forEach((d) => { kodlar[d.nom] = d.kod; });

    const qosh = db.db().prepare(`
      INSERT INTO obunachilar (tg_id, ism, username, holat, birinchi_vaqt, oxirgi_vaqt, boshladi_vaqt, tugatdi_vaqt, video_id, daraja_kod, telefon)
      VALUES (?, ?, ?, 'faol', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tg_id) DO UPDATE SET
        tugatdi_vaqt = COALESCE(obunachilar.tugatdi_vaqt, excluded.tugatdi_vaqt),
        video_id = COALESCE(obunachilar.video_id, excluded.video_id),
        daraja_kod = COALESCE(obunachilar.daraja_kod, excluded.daraja_kod),
        telefon = COALESCE(obunachilar.telefon, excluded.telefon)
    `);

    let soni = 0;
    db.tranzaksiya(() => {
      for (const r of store.natijalarOl()) {
        const id = Number(r.tg_id);
        if (!id || r.kanal !== 'telegram') continue;
        const vaqt = Date.parse(r.vaqt) || Date.now();
        qosh.run(id, String(r.ism || '').slice(0, 64) || null, String(r.tg_username || '').replace(/^@/, '').slice(0, 64) || null,
          vaqt, vaqt, vaqt, vaqt, r.video_id || null, kodlar[r.daraja] || null, r.telefon || null);
        soni++;
      }
    });
    db.sozlamaQoy('natijalar_kochirildi', true);
    if (soni) console.log(`👥 Testni Telegramda tugatgan ${soni} ta odam obunachilar ro'yxatiga ko'chirildi`);
  } catch (e) {
    console.error('[ko\'chirish]', e.message);
  }
}

/* --------------------------------------------------------------- .env o'qish */
function loadEnvFile() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}
