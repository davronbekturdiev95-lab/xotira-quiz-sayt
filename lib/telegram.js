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
 *   /id → foydalanuvchining Telegram ID raqami (sinov xabarlari uchun)
 *   Botga yozgan har bir odam obunachilar ro'yxatiga yoziladi (voronka uchun)
 *   Test Telegram ichida topshirilsa → poster, raqamlar va video havolasi chatga keladi
 * ========================================================================== */
'use strict';

const tg = require('./tgapi.js');
const obunachilar = require('./obunachilar.js');
const voronka = require('./voronka.js');
const yuboruvchi = require('./yuboruvchi.js');
const natija = require('./natija.js');

let SAYT = '';
let matnOl = () => ({});
let ishlayapti = false;
let offset = 0;
let botNomi = '';
let oxirgiXato = null;

/* ------------------------------------------------------------------ xabarlar */
function ochishTugmasi() {
  const m = matnOl();
  return { inline_keyboard: [[{ text: m.bot_tugma || '🧠 Testni boshlash', web_app: { url: SAYT } }]] };
}

async function xabargaJavob(msg) {
  const chat = msg.chat;
  if (!chat || chat.type !== 'private' || !msg.from || msg.from.is_bot) return;   // guruhlarda jim turamiz

  const matnXom = String(msg.text || '');
  const start = /^\/start(?:@\w+)?(?:\s+(\S{1,64}))?/.exec(matnXom);
  obunachilar.upsert(msg.from, { start_param: start && start[1] ? start[1] : null });

  if (/^\/id(?:@\w+)?\b/.test(matnXom)) {
    await tg.api('sendMessage', {
      chat_id: chat.id,
      parse_mode: 'HTML',
      text: `Sizning Telegram ID raqamingiz: <code>${msg.from.id}</code>\n\nUni admin paneldagi "Sinov uchun Telegram ID" maydoniga yozing.`
    });
    return;
  }

  if (start) {
    obunachilar.hodisaQayd(msg.from.id, 'start');
    voronka.hodisa(msg.from.id, 'start', start[1] || '');
  }

  const m = matnOl();
  const ism = msg.from.first_name || '';
  const matn = String(m.bot_salom || 'Testni boshlash uchun pastdagi tugmani bosing 👇')
    .replace(/\{ism\}/g, ism)
    .replace(/,\s*!/g, '!');                        // ism bo'lmasa "Salom, !" chiqmasin

  await tg.api('sendMessage', {
    chat_id: chat.id,
    text: matn.slice(0, 4000),
    reply_markup: ochishTugmasi()
  });
}

async function tugmagaJavob(cq) {
  const data = String(cq.data || '');
  if (data.startsWith('b:') && cq.from) {
    obunachilar.upsert(cq.from);
    const r = yuboruvchi.kodBosildi(data.slice(2));
    if (r && r.avtomatId) voronka.avtomatBoshla(r.avtomatId, cq.from.id, { majburiy: true });
  }
  await tg.api('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
}

function azolikOzgardi(u) {
  if (!u.chat || u.chat.type !== 'private' || !u.from) return;
  const holat = u.new_chat_member && u.new_chat_member.status;
  if (holat === 'kicked') obunachilar.bloklandi(u.from.id);
  else if (holat === 'member') obunachilar.upsert(u.from);
}

/**
 * Test Telegram ichida topshirilganda — poster + batafsil natija + video tugmasi
 * t: natija.tahlil() natijasi
 */
async function natijaYubor(chatId, t, M, havola) {
  if (!ishlayapti || !chatId || !t || !havola) return;
  try {
    const html = natija.telegramMatn(t, M || {});
    const url = yuboruvchi.kuzatiladiganUrl(chatId, { manba: 'natija', manbaId: t.video.id }, 'video:' + havola);
    const markup = { inline_keyboard: [[{ text: (M && M.natija_tugma) || 'BEPUL VIDEONI KO\'RISH', url }]] };
    const n = await yuboruvchi.yuborHtml(chatId, { html, mediaId: t.video.posterId, markup });
    if (!n.ok) console.error('[bot] natija chatga yuborilmadi:', n.xato);
  } catch (e) {
    // Foydalanuvchi botni bloklagan bo'lishi mumkin — natijaga ta'sir qilmaydi
    console.error('[bot] natija chatga yuborilmadi:', e.message);
  }
}

/* ------------------------------------------------------------ long polling */
const kut = (ms) => new Promise((r) => setTimeout(r, ms));

function xatoQayd(e, qayerda) {
  oxirgiXato = { vaqt: new Date().toISOString(), xabar: e.message };
  console.error(`[bot] ${qayerda}:`, e.message);
}

async function sikl() {
  while (ishlayapti) {
    try {
      const yangilar = await tg.api('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query', 'my_chat_member']
      }, 35000);

      for (const u of yangilar) {
        offset = u.update_id + 1;
        try {
          if (u.message) xabargaJavob(u.message).catch((e) => xatoQayd(e, 'javob yuborilmadi'));
          else if (u.callback_query) tugmagaJavob(u.callback_query).catch((e) => xatoQayd(e, 'tugma'));
          else if (u.my_chat_member) azolikOzgardi(u.my_chat_member);
        } catch (e) {
          xatoQayd(e, 'yangilanish');
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
  tg.sozla(token);
  SAYT = String(sayt).replace(/\/+$/, '') + '/';
  matnOl = matnlar || (() => ({}));
  ishlayapti = true;

  try {
    const men = await tg.api('getMe');
    botNomi = men.username || '';
    await tg.api('setChatMenuButton', {
      menu_button: { type: 'web_app', text: 'Testni boshlash', web_app: { url: SAYT } }
    });
    await tg.api('setMyCommands', {
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

module.exports = { ishgaTushir, natijaYubor, holat, initDataTekshir: tg.initDataTekshir };
