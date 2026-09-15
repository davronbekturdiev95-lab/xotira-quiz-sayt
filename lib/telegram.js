/* ============================================================================
 * TELEGRAM BOT + MINI APP
 *
 * Sozlamalar (.env):
 *   BOT_TOKEN   @BotFather bergan token
 *   SAYT_URL    https://quiz.supermiyateam.com  (mini app shu manzilni ochadi)
 *
 * Ikkalasi ham to'ldirilgan bo'lsa bot ishga tushadi (long polling — webhook,
 * ochiq port yoki root kerak emas). Bo'sh bo'lsa sayt oddiy sayt bo'lib qoladi.
 *
 * Bot nima qiladi:
 *   /start (va boshqa har qanday xabar) → salom + "Testni boshlash" tugmasi
 *   Chap pastdagi menyu tugmasi → testni ochadi
 *   Test Telegram ichida topshirilsa → natija va video havolasi chatga ham keladi
 * ========================================================================== */
'use strict';

const crypto = require('crypto');

let TOKEN = '';
let SAYT = '';
let matnOl = () => ({});
let ishlayapti = false;
let offset = 0;
let botNomi = '';
let oxirgiXato = null;

/* ------------------------------------------------------------------ so'rov */
async function api(usul, tana, kutish = 20000) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${usul}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tana || {}),
    signal: AbortSignal.timeout(kutish)
  });
  const j = await r.json().catch(() => ({ ok: false, description: 'javob JSON emas' }));
  if (!j.ok) {
    const e = new Error(`${usul}: ${j.description || r.status}`);
    e.kod = j.error_code || r.status;
    e.qaytaSoniya = j.parameters && j.parameters.retry_after;
    throw e;
  }
  return j.result;
}

/* ============================================================================
 * initData tekshiruvi — mini app'dan kelgan foydalanuvchi haqiqatan Telegram
 * tomonidan imzolanganmi. Soxtalashtirib bo'lmaydi (bot tokeni kerak).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * ========================================================================== */
function initDataTekshir(initData, token, maxSoniya = 24 * 3600) {
  if (!initData || !token) return null;
  const p = new URLSearchParams(String(initData));
  const hash = p.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  p.delete('hash');

  const tekshirQatori = [...p.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const kalit = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hisob = crypto.createHmac('sha256', kalit).update(tekshirQatori).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hisob, 'hex'), Buffer.from(hash, 'hex'))) return null;

  const vaqt = Number(p.get('auth_date') || 0);
  if (!vaqt || Date.now() / 1000 - vaqt > maxSoniya) return null;

  try { return JSON.parse(p.get('user') || 'null'); } catch (_) { return null; }
}

/* ------------------------------------------------------------------ xabarlar */
function ochishTugmasi() {
  const m = matnOl();
  return { inline_keyboard: [[{ text: m.bot_tugma || '🧠 Testni boshlash', web_app: { url: SAYT } }]] };
}

async function xabargaJavob(msg) {
  const chat = msg.chat;
  if (!chat || chat.type !== 'private') return;   // guruhlarda jim turamiz

  const m = matnOl();
  const ism = (msg.from && msg.from.first_name) || '';
  const matn = String(m.bot_salom || 'Testni boshlash uchun pastdagi tugmani bosing 👇')
    .replace(/\{ism\}/g, ism)
    .replace(/,\s*!/g, '!');                        // ism bo'lmasa "Salom, !" chiqmasin

  await api('sendMessage', {
    chat_id: chat.id,
    text: matn.slice(0, 4000),
    reply_markup: ochishTugmasi()
  });
}

/** Test Telegram ichida topshirilganda natijani chatga ham yuboramiz */
async function natijaYubor(chatId, d) {
  if (!ishlayapti || !chatId || !d || !d.havola) return;
  const m = matnOl();
  const matn = [m.natija_sarlavha || 'NATIJANGIZ', '', d.darajaMatn || '', '', d.videoMatn || '']
    .join('\n').trim().slice(0, 4000);
  try {
    await api('sendMessage', {
      chat_id: chatId,
      text: matn,
      reply_markup: { inline_keyboard: [[{ text: m.natija_tugma || 'BEPUL VIDEONI KO\'RISH', url: d.havola }]] }
    });
  } catch (e) {
    // Foydalanuvchi botni bloklagan bo'lishi mumkin — natijaga ta'sir qilmaydi
    console.error('[bot] natija chatga yuborilmadi:', e.message);
  }
}

/* ------------------------------------------------------------ long polling */
const kut = (ms) => new Promise((r) => setTimeout(r, ms));

async function sikl() {
  while (ishlayapti) {
    try {
      const yangilar = await api('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message']
      }, 35000);

      for (const u of yangilar) {
        offset = u.update_id + 1;
        if (u.message) {
          xabargaJavob(u.message).catch((e) => {
            oxirgiXato = { vaqt: new Date().toISOString(), xabar: e.message };
            console.error('[bot] javob yuborilmadi:', e.message);
          });
        }
      }
      oxirgiXato = null;
    } catch (e) {
      oxirgiXato = { vaqt: new Date().toISOString(), xabar: e.message };
      // 409 — shu token bilan boshqa joyda ham bot ishlab turibdi
      const ms = e.kod === 409 ? 30000 : e.qaytaSoniya ? e.qaytaSoniya * 1000 : 5000;
      console.error('[bot] getUpdates:', e.message, `— ${Math.round(ms / 1000)}s dan keyin qayta`);
      await kut(ms);
    }
  }
}

async function ishgaTushir({ token, sayt, matnlar }) {
  if (ishlayapti || !token || !sayt) return;
  TOKEN = token;
  SAYT = String(sayt).replace(/\/+$/, '') + '/';
  matnOl = matnlar || (() => ({}));
  ishlayapti = true;

  try {
    const men = await api('getMe');
    botNomi = men.username || '';
    await api('setChatMenuButton', {
      menu_button: { type: 'web_app', text: 'Testni boshlash', web_app: { url: SAYT } }
    });
    await api('setMyCommands', {
      commands: [{ command: 'start', description: 'Xotira testini boshlash' }]
    });
    console.log(`🤖 Bot: @${botNomi} → ${SAYT}`);
  } catch (e) {
    oxirgiXato = { vaqt: new Date().toISOString(), xabar: e.message };
    console.error('[bot] sozlashda xato (polling baribir boshlanadi):', e.message);
  }

  sikl();
}

function holat() {
  return { yoqilgan: ishlayapti, bot: botNomi ? '@' + botNomi : '', oxirgiXato };
}

module.exports = { ishgaTushir, initDataTekshir, natijaYubor, holat };
