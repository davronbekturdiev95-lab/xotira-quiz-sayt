/* ============================================================
   TELEGRAM BOTNI TEKSHIRISH

     node scripts/bot-sinov.js                 — .env dagi BOT_TOKEN ni tekshiradi
     node scripts/bot-sinov.js <token>         — boshqa tokenni tekshiradi
     node scripts/bot-sinov.js --xabar <id>    — o'sha chat'ga sinov xabari yuboradi

   Hech narsa o'zgartirilmaydi: faqat get* so'rovlari yuboriladi
   (--xabar berilgan holdan tashqari).
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

// .env ni o'qiymiz
const envFayl = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFayl)) {
  for (const satr of fs.readFileSync(envFayl, 'utf8').split(/\r?\n/)) {
    const t = satr.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}

const tg = require('../lib/tgapi.js');

const yashil = (s) => '\x1b[32m' + s + '\x1b[0m';
const qizil = (s) => '\x1b[31m' + s + '\x1b[0m';
const sariq = (s) => '\x1b[33m' + s + '\x1b[0m';
const kok = (s) => '\n\x1b[1m\x1b[36m' + s + '\x1b[0m';

const argv = process.argv.slice(2);
const xabarIndex = argv.indexOf('--xabar');
const xabarChat = xabarIndex === -1 ? '' : (argv[xabarIndex + 1] || '');
const tokenArg = argv.find((a) => !a.startsWith('--') && a !== xabarChat) || '';

const TOKEN = tokenArg || process.env.BOT_TOKEN || '';
const SAYT = String(process.env.SAYT_URL || '').replace(/\/+$/, '');

/** Tokenni to'liq ko'rsatmaymiz — ekran yozuvi/skrinshot orqali sizib ketmasin */
function tokenNiqob(t) {
  const i = t.indexOf(':');
  if (i === -1) return t.slice(0, 4) + '…';
  return t.slice(0, i + 4) + '…' + t.slice(-3);
}

/** get* so'rovi: xato bo'lsa tashlamaydi, {xato} qaytaradi */
async function sora(usul, tana) {
  try {
    return { natija: await tg.api(usul, tana) };
  } catch (e) {
    return { xato: e.tavsif || e.message, kod: e.kod };
  }
}

(async () => {
  console.log(kok('TOKEN'));
  if (!TOKEN) {
    console.log(qizil('BOT_TOKEN topilmadi.') + ' .env ga yozing yoki: node scripts/bot-sinov.js <token>');
    process.exit(1);
  }
  if (!/^\d+:[\w-]{30,}$/.test(TOKEN)) {
    console.log(sariq('Diqqat: token ko\'rinishi odatdagidek emas (kutilgan shakl: 1234567890:AA...).'));
  }
  console.log('Token:      ' + tokenNiqob(TOKEN) + '  (' + TOKEN.length + ' belgi)');
  console.log('Bot ID:     ' + (TOKEN.split(':')[0] || '?'));
  console.log('SAYT_URL:   ' + (SAYT || qizil('kiritilmagan — bot ishga tushmaydi')));

  tg.sozla(TOKEN);

  console.log(kok('BOT'));
  const men = await sora('getMe');
  if (men.xato) {
    console.log(qizil('Ulanmadi: ') + men.xato + (men.kod ? ' (kod ' + men.kod + ')' : ''));
    if (men.kod === 401) {
      console.log('Token noto\'g\'ri yoki @BotFather orqali bekor qilingan. Yangisini oling: @BotFather → /mybots → API Token → Revoke.');
    }
    process.exit(1);
  }
  const bot = men.natija;
  console.log('Nom:        ' + yashil(bot.first_name || ''));
  console.log('Username:   ' + yashil('@' + (bot.username || '')));
  console.log('ID:         ' + bot.id);
  console.log('Havola:     https://t.me/' + (bot.username || ''));
  console.log('Guruhlar:   ' + (bot.can_join_groups ? 'qo\'shila oladi' : 'qo\'shila olmaydi'));
  console.log('Inline:     ' + (bot.supports_inline_queries ? 'yoqilgan' : 'o\'chiq'));
  console.log('Xabarlar:   ' + (bot.can_read_all_group_messages ? 'guruhdagi hammasini o\'qiydi' : 'faqat o\'ziga tegishlisini o\'qiydi'));

  console.log(kok('WEBHOOK / POLLING'));
  const wh = await sora('getWebhookInfo');
  if (wh.xato) {
    console.log(qizil('Olinmadi: ') + wh.xato);
  } else {
    const w = wh.natija;
    if (w.url) {
      console.log(qizil('Webhook o\'rnatilgan: ') + w.url);
      console.log(sariq('Bu sayt getUpdates (polling) bilan ishlaydi — webhook turgan bo\'lsa bot xabarlarni olmaydi (409 Conflict).'));
      console.log('Yechim: curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"');
    } else {
      console.log(yashil('Webhook yo\'q — polling uchun to\'g\'ri.'));
    }
    console.log('Navbatda:   ' + (w.pending_update_count || 0) + ' ta yangilanish');
    if (w.last_error_message) {
      console.log(sariq('Oxirgi xato: ') + w.last_error_message +
        (w.last_error_date ? ' (' + new Date(w.last_error_date * 1000).toISOString() + ')' : ''));
    }
  }

  console.log(kok('SOZLAMALAR'));
  const buyruqlar = await sora('getMyCommands');
  if (buyruqlar.xato) console.log('Buyruqlar:  ' + qizil(buyruqlar.xato));
  else if (!buyruqlar.natija.length) console.log('Buyruqlar:  ' + sariq('yo\'q — server ishga tushganda /start qo\'shiladi'));
  else console.log('Buyruqlar:  ' + buyruqlar.natija.map((c) => '/' + c.command).join(', '));

  const menyu = await sora('getChatMenuButton');
  if (menyu.xato) {
    console.log('Menyu:      ' + qizil(menyu.xato));
  } else {
    const m = menyu.natija;
    const url = m.web_app && m.web_app.url ? String(m.web_app.url).replace(/\/+$/, '') : '';
    console.log('Menyu:      ' + (m.type === 'web_app' ? 'mini app → ' + url : m.type));
    if (m.type !== 'web_app') {
      console.log(sariq('Mini app tugmasi qo\'yilmagan — server BOT_TOKEN va SAYT_URL bilan ishga tushganda o\'zi qo\'yadi.'));
    } else if (SAYT && url !== SAYT) {
      console.log(qizil('Menyu havolasi SAYT_URL ga mos emas: ') + url + ' ≠ ' + SAYT);
    }
  }

  const nom = await sora('getMyName');
  if (!nom.xato) console.log('Ko\'rsatiladigan nom: ' + (nom.natija.name || '—'));
  const qisqa = await sora('getMyShortDescription');
  if (!qisqa.xato) console.log('Qisqa tavsif: ' + (qisqa.natija.short_description || sariq('bo\'sh')));
  const tavsif = await sora('getMyDescription');
  if (!tavsif.xato) console.log('Tavsif:     ' + (tavsif.natija.description || sariq('bo\'sh — bot ochilganda "What can this bot do?" bo\'sh chiqadi')));

  if (xabarChat) {
    console.log(kok('SINOV XABARI'));
    const y = await sora('sendMessage', { chat_id: xabarChat, text: 'Sinov xabari — bot ishlayapti ✅' });
    if (y.xato) console.log(qizil('Yuborilmadi: ') + y.xato);
    else console.log(yashil('Yuborildi') + ' — message_id ' + y.natija.message_id);
  }

  console.log(kok('XULOSA'));
  const muammolar = [];
  if (!SAYT) muammolar.push('SAYT_URL kiritilmagan — server botni ishga tushirmaydi.');
  if (!wh.xato && wh.natija.url) muammolar.push('Webhook o\'chirilishi kerak (polling bilan to\'qnashadi).');
  if (!muammolar.length) console.log(yashil('Bot ishlashga tayyor.'));
  else muammolar.forEach((m) => console.log(qizil('• ') + m));
  console.log('');
})();
