/* ============================================================================
 * amoCRM ga lidlarni yuborish
 *
 * Sozlamalar (.env):
 *   AMO_DOMEN           supermiya.amocrm.ru   (yoki shunchaki: supermiya)
 *   AMO_TOKEN           uzoq muddatli token (Sozlamalar → Integratsiyalar →
 *                       "Yangi integratsiya" → uzoq muddatli token)
 *   AMO_PIPELINE_ID     ixtiyoriy — qaysi voronkaga
 *   AMO_STATUS_ID       ixtiyoriy — qaysi bosqichga
 *   AMO_RESPONSIBLE_ID  ixtiyoriy — kim mas'ul
 *   AMO_TEG             ixtiyoriy — teg nomi (standart: "Xotira testi")
 *
 * AMO_TOKEN bo'sh bo'lsa integratsiya butunlay o'chiq bo'ladi.
 *
 * Ishonchlilik: amoCRM javob bermasa lid YO'QOLMAYDI —
 * data/amo-navbat.jsonl ga tushadi va har 5 daqiqada qayta urinib ko'riladi.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NAVBAT = path.join(DATA_DIR, 'amo-navbat.jsonl');

const URINISHLAR = 3;          // darhol necha marta urinib ko'rish
const NAVBAT_ORALIQ = 5 * 60 * 1000;
const NAVBAT_MAX = 500;        // navbatda saqlanadigan eng ko'p lid

let oxirgiXato = null;
let yuborilgan = 0;

function sozlama() {
  const xomDomen = (process.env.AMO_DOMEN || '').trim();
  const domen = xomDomen.includes('.') ? xomDomen : (xomDomen ? xomDomen + '.amocrm.ru' : '');
  return {
    domen,
    token: (process.env.AMO_TOKEN || '').trim(),
    pipeline: Number(process.env.AMO_PIPELINE_ID || 0),
    status: Number(process.env.AMO_STATUS_ID || 0),
    masul: Number(process.env.AMO_RESPONSIBLE_ID || 0),
    teg: (process.env.AMO_TEG || 'Xotira testi').trim()
  };
}

function yoqilganmi() {
  const s = sozlama();
  return !!(s.domen && s.token);
}

/* ------------------------------------------------------------------ so'rov */
async function soro(yol, usul, tana) {
  const s = sozlama();
  const javob = await fetch(`https://${s.domen}${yol}`, {
    method: usul,
    headers: {
      'Authorization': 'Bearer ' + s.token,
      'Content-Type': 'application/json'
    },
    body: tana ? JSON.stringify(tana) : undefined,
    signal: AbortSignal.timeout(20000)
  });

  const matn = await javob.text();
  if (!javob.ok) {
    const e = new Error(`amoCRM ${javob.status}: ${matn.slice(0, 300)}`);
    e.status = javob.status;
    throw e;
  }
  try { return matn ? JSON.parse(matn) : null; } catch (_) { return null; }
}

/** Token ishlayaptimi — hisob ma'lumotini o'qiymiz */
async function tekshir() {
  if (!yoqilganmi()) return { ok: false, xato: 'AMO_DOMEN yoki AMO_TOKEN sozlanmagan' };
  try {
    const h = await soro('/api/v4/account', 'GET');
    return { ok: true, hisob: h && h.name, id: h && h.id };
  } catch (e) {
    return { ok: false, xato: e.message };
  }
}

/* --------------------------------------------------- lidni amo shakliga solish */
function lidYasa(qator) {
  const s = sozlama();
  const ism = qator.ism || 'Nomsiz';

  const lid = {
    name: `Xotira testi — ${ism}`,
    _embedded: {
      contacts: [{
        first_name: ism,
        custom_fields_values: [{
          field_code: 'PHONE',
          values: [{ enum_code: 'MOB', value: qator.telefon }]
        }]
      }]
    }
  };

  if (s.teg) lid._embedded.tags = [{ name: s.teg }];
  if (s.pipeline) lid.pipeline_id = s.pipeline;
  if (s.status) lid.status_id = s.status;
  if (s.masul) {
    lid.responsible_user_id = s.masul;
    lid._embedded.contacts[0].responsible_user_id = s.masul;
  }
  return lid;
}

/** Sotuvchi uchun izoh — test natijasi qisqacha */
function izohMatni(qator) {
  const satrlar = [
    'XOTIRA TESTI NATIJASI',
    '',
    `Daraja: ${qator.daraja} (${qator.daraja_foiz}%)`,
    `Yo'nalish: ${qator.yonalish}`,
    `Tavsiya etilgan video: ${qator.video_nomi}`,
    `Havola: ${qator.havola}`,
    '',
    `Ballar — xotira ${qator.ball_xotira}% · diqqat ${qator.ball_diqqat}% · til ${qator.ball_til}%`,
    ''
  ];

  const javoblar = Object.keys(qator)
    .filter((k) => /^q\d+_matn$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (javoblar.length) {
    satrlar.push('JAVOBLARI:');
    javoblar.forEach((k) => {
      const raqam = k.match(/\d+/)[0];
      if (qator[k]) satrlar.push(`${raqam}. ${qator[k]}`);
    });
  }

  if (qator.manba) satrlar.push('', 'Manba: ' + qator.manba);
  if (qator.utm) satrlar.push('UTM: ' + qator.utm);

  return satrlar.join('\n');
}

/* ---------------------------------------------------------------- yuborish */
async function bittaYubor(qator) {
  const javob = await soro('/api/v4/leads/complex', 'POST', [lidYasa(qator)]);
  const lidId = Array.isArray(javob) && javob[0] && javob[0].id;

  // Izohni alohida qo'shamiz — u yiqilsa ham lid saqlanib qoladi
  if (lidId) {
    try {
      await soro(`/api/v4/leads/${lidId}/notes`, 'POST', [{
        note_type: 'common',
        params: { text: izohMatni(qator) }
      }]);
    } catch (e) {
      console.error('[amo] izoh qo\'shilmadi (lid yaratilgan):', e.message);
    }
  }
  return lidId;
}

const kut = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Lidni yuborish. Xato bo'lsa navbatga tushadi va keyin qayta uriniladi.
 * Hech qachon xato tashlamaydi — foydalanuvchi natijasiga ta'sir qilmasin.
 */
async function yubor(qator) {
  if (!yoqilganmi()) return { ok: false, sabab: 'ochiq' };

  for (let i = 1; i <= URINISHLAR; i++) {
    try {
      const id = await bittaYubor(qator);
      yuborilgan++;
      oxirgiXato = null;
      console.log(`[amo] lid yaratildi: ${id} (${qator.ism})`);
      return { ok: true, id };
    } catch (e) {
      oxirgiXato = { vaqt: new Date().toISOString(), xabar: e.message };
      const qaytaUrinsa = !e.status || e.status >= 500 || e.status === 429;
      console.error(`[amo] urinish ${i}/${URINISHLAR} xato:`, e.message);
      if (!qaytaUrinsa || i === URINISHLAR) break;
      await kut(i * 2000);
    }
  }

  navbatgaQosh(qator);
  return { ok: false, sabab: 'navbatda' };
}

/* ------------------------------------------------------------------ navbat */
function navbatgaQosh(qator) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(NAVBAT, JSON.stringify(qator) + '\n');
    console.log('[amo] lid navbatga qo\'yildi — keyinroq qayta yuboriladi');
  } catch (e) {
    console.error('[amo] navbatga yozilmadi:', e.message);
  }
}

function navbatOqi() {
  if (!fs.existsSync(NAVBAT)) return [];
  return fs.readFileSync(NAVBAT, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter(Boolean);
}

function navbatYoz(qatorlar) {
  try {
    const oxirgilar = qatorlar.slice(-NAVBAT_MAX);
    if (!oxirgilar.length) { fs.rmSync(NAVBAT, { force: true }); return; }
    fs.writeFileSync(NAVBAT, oxirgilar.map((q) => JSON.stringify(q)).join('\n') + '\n');
  } catch (e) {
    console.error('[amo] navbat saqlanmadi:', e.message);
  }
}

async function navbatniYubor() {
  if (!yoqilganmi()) return;
  const navbat = navbatOqi();
  if (!navbat.length) return;

  console.log(`[amo] navbatda ${navbat.length} ta lid — qayta yuborilmoqda`);
  const qolgan = [];

  for (const qator of navbat) {
    try {
      const id = await bittaYubor(qator);
      yuborilgan++;
      console.log(`[amo] navbatdan yuborildi: ${id}`);
    } catch (e) {
      oxirgiXato = { vaqt: new Date().toISOString(), xabar: e.message };
      qolgan.push(qator);
    }
    await kut(300);   // amoCRM sekundiga 7 ta so'rovga ruxsat beradi
  }

  navbatYoz(qolgan);
}

function navbatniBoshla() {
  if (!yoqilganmi()) return;
  setTimeout(() => { navbatniYubor().catch(() => {}); }, 15000);
  const t = setInterval(() => { navbatniYubor().catch(() => {}); }, NAVBAT_ORALIQ);
  if (t.unref) t.unref();
}

function holat() {
  return {
    yoqilgan: yoqilganmi(),
    domen: sozlama().domen || '',
    yuborilgan,
    navbatda: navbatOqi().length,
    oxirgiXato
  };
}

module.exports = { yoqilganmi, yubor, tekshir, navbatniBoshla, navbatniYubor, holat, izohMatni, lidYasa };
