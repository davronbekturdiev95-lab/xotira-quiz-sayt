/* ============================================================================
 * BOT MODULLARI SINOVI — haqiqiy Telegram'ga hech narsa yuborilmaydi
 *   node scripts/test-bot.js
 *
 * Baza xotirada ochiladi (data/bot.db ga tegilmaydi).
 * ========================================================================== */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const db = require('../lib/db.js');
db.ochish(':memory:');

const tg = require('../lib/tgapi.js');
const obunachilar = require('../lib/obunachilar.js');
const yuboruvchi = require('../lib/yuboruvchi.js');
const voronka = require('../lib/voronka.js');
const tarqatma = require('../lib/tarqatma.js');
const media = require('../lib/media.js');
const natija = require('../lib/natija.js');
const quiz = require('../lib/quiz.js');
const { boshlangichConfig } = require('../shared/defaults.js');

const CONFIG = boshlangichConfig();
yuboruvchi.sozla({ sayt: 'https://quiz.example.uz', config: () => CONFIG });

/* ---- soxta Telegram ---- */
const yuborilgan = [];
const BLOKLAGAN = new Set([222]);
tg.sinovRejimi(async (usul, tana) => {
  if (BLOKLAGAN.has(Number(tana.chat_id))) {
    const e = new Error('Forbidden'); e.kod = 403; e.tavsif = 'Forbidden: bot was blocked by the user'; throw e;
  }
  yuborilgan.push({ usul, tana });
  if (usul === 'sendPhoto') return { photo: [{ file_id: 'kichik' }, { file_id: 'FILE_ID_1' }] };
  return { message_id: yuborilgan.length };
});

let otdi = 0;
async function sinov(nom, fn) {
  try {
    await fn();
    otdi++;
    console.log('  ✓', nom);
  } catch (e) {
    console.error('  ✗', nom, '\n   ', e.message);
    process.exitCode = 1;
  }
}

const oxirgi = () => yuborilgan[yuborilgan.length - 1];

(async () => {
  console.log('\nMatn va tugmalar');

  await sinov('**qalin**, __kursiv__, havola va {ism} almashadi', () => {
    const h = yuboruvchi.matnHtml('**Salom** {ism}! __bu__ [sayt](https://a.uz/?x=1&y=2) <script>', { ism: 'Ali<b>' });
    assert.ok(h.includes('<b>Salom</b>'));
    assert.ok(h.includes('Ali&lt;b&gt;'));
    assert.ok(h.includes('<i>bu</i>'));
    assert.ok(h.includes('<a href="https://a.uz/?x=1&amp;y=2">sayt</a>'));
    assert.ok(h.includes('&lt;script&gt;'));
  });

  await sinov('ism bo\'lmasa "Salom, !" chiqmaydi', () => {
    assert.strictEqual(yuboruvchi.matnHtml('Salom, {ism}!', {}), 'Salom!');
  });

  await sinov('xabar tekshiruvi: bo\'sh xabar va noto\'g\'ri havola rad etiladi', () => {
    assert.ok(yuboruvchi.tekshirXabar({ matn: '  ' }).xato);
    assert.ok(yuboruvchi.tekshirXabar({ matn: 'x', tugmalar: [{ matn: 'a', tur: 'havola', qiymat: 'javascript:1' }] }).xato);
    assert.ok(!yuboruvchi.tekshirXabar({ matn: 'x', tugmalar: [{ matn: 'a', tur: 'miniapp' }] }).xato);
  });

  console.log('\nObunachilar va segmentlar');

  obunachilar.upsert({ id: 111, first_name: 'Ali', username: 'ali' }, { start_param: 'reklama1' });
  obunachilar.upsert({ id: 222, first_name: 'Vali' });
  obunachilar.upsert({ id: 333, first_name: 'Guli' });
  obunachilar.upsert({ id: 444, first_name: 'Nodir' });
  obunachilar.hodisaQayd(333, 'test_boshladi');
  obunachilar.hodisaQayd(444, 'test_tugatdi', { video_id: 'v3', daraja_kod: 'past', telefon: '+998901234567' });

  await sinov('bosqichlar bo\'yicha to\'g\'ri sanaydi', () => {
    assert.strictEqual(obunachilar.soni([{ tur: 'bosqich', qiymat: 'start_boshlamagan' }]), 2);
    assert.strictEqual(obunachilar.soni([{ tur: 'bosqich', qiymat: 'boshlagan_tugatmagan' }]), 1);
    assert.strictEqual(obunachilar.soni([{ tur: 'bosqich', qiymat: 'tugatgan_video_bosmagan' }]), 1);
    assert.strictEqual(obunachilar.soni([{ tur: 'video', qiymat: 'v3' }, { tur: 'daraja', qiymat: 'past' }]), 1);
    assert.strictEqual(obunachilar.soni([{ tur: 'start_param', qiymat: 'reklama1' }]), 1);
  });

  await sinov('/start qayta bosilsa start parametri o\'zgarmaydi', () => {
    obunachilar.upsert({ id: 111, first_name: 'Ali' }, { start_param: 'boshqa' });
    assert.strictEqual(obunachilar.olish(111).start_param, 'reklama1');
  });

  await sinov('teglar va "tegi yo\'q" sharti', () => {
    assert.strictEqual(obunachilar.tegQosh(333, 'vip'), true);
    assert.strictEqual(obunachilar.tegQosh(333, 'vip'), false);
    assert.strictEqual(obunachilar.soni([{ tur: 'teg_bor', qiymat: 'vip' }]), 1);
    assert.strictEqual(obunachilar.soni([{ tur: 'teg_yoq', qiymat: 'vip' }]), 3);
  });

  await sinov('noma\'lum shart hech kimga mos kelmaydi (xavfsiz tomon)', () => {
    assert.strictEqual(obunachilar.soni([{ tur: 'boshqa', qiymat: 'x' }]), 0);
    assert.ok(obunachilar.shartlarniTozala([{ tur: 'boshqa', qiymat: 'x' }]).xato);
  });

  console.log('\nVoronka');

  voronka.sozlamaSaqla({ tinch: { yoqilgan: false, dan: '09:00', gacha: '21:00' } });
  voronka.boshlangichlarniQosh();
  const namunalar = voronka.avtomatlarOl();

  await sinov('3 ta tayyor namuna o\'chiq holda qo\'shiladi', () => {
    assert.strictEqual(namunalar.length, 3);
    assert.ok(namunalar.every((a) => !a.faol));
  });

  const eslatma = namunalar.find((a) => a.trigger.tur === 'start');
  voronka.holatQoy(eslatma.id, true);

  await sinov('/start → teg qo\'shiladi va 1 soat kutadi', async () => {
    assert.strictEqual(voronka.hodisa(111, 'start'), 1);
    await voronka.tick();
    assert.deepStrictEqual(obunachilar.teglar(111), ['bot_start']);
    const st = voronka.statistika(eslatma.id);
    assert.strictEqual(st.faol, 1);
    assert.strictEqual(st.qadamlar[eslatma.qadamlar[1].id].kutmoqda, 1);
  });

  await sinov('bir odam bir vaqtda ikki marta kirmaydi', () => {
    assert.strictEqual(voronka.hodisa(111, 'start'), 0);
  });

  await sinov('kutish tugagach mini app tugmali xabar ketadi', async () => {
    db.db().prepare('UPDATE yurishlar SET keyingi_vaqt = 0').run();
    const oldin = yuborilgan.length;
    await voronka.tick();
    assert.strictEqual(yuborilgan.length, oldin + 1);
    const x = oxirgi();
    assert.strictEqual(x.usul, 'sendMessage');
    assert.strictEqual(Number(x.tana.chat_id), 111);
    assert.ok(x.tana.text.startsWith('Ali, testni'));
    assert.strictEqual(x.tana.reply_markup.inline_keyboard[0][0].web_app.url, 'https://quiz.example.uz/');
    const st = voronka.statistika(eslatma.id).qadamlar[eslatma.qadamlar[2].id];
    assert.strictEqual(st.yuborildi, 1);
  });

  await sinov('testni boshlasa eslatmalar to\'xtaydi', async () => {
    obunachilar.hodisaQayd(111, 'test_boshladi');
    voronka.hodisa(111, 'test_boshladi');
    db.db().prepare('UPDATE yurishlar SET keyingi_vaqt = 0').run();
    const oldin = yuborilgan.length;
    await voronka.tick();
    assert.strictEqual(yuborilgan.length, oldin);
    assert.strictEqual(voronka.statistika(eslatma.id).toxtatildi, 1);
  });

  await sinov('botni bloklagan odam belgilanadi va zanjiri yopiladi', async () => {
    voronka.hodisa(222, 'start');
    await voronka.tick();
    db.db().prepare('UPDATE yurishlar SET keyingi_vaqt = 0 WHERE tg_id = 222').run();
    await voronka.tick();
    assert.strictEqual(obunachilar.olish(222).holat, 'bloklagan');
    assert.strictEqual(voronka.statistika(eslatma.id).bloklagan, 1);
  });

  await sinov('shart qadami: mos kelmasa to\'xtaydi', async () => {
    const r = voronka.saqla({
      nom: 'Shart sinovi', trigger: { tur: 'qolda' },
      qadamlar: [
        { tur: 'shart', shartlar: [{ tur: 'teg_bor', qiymat: 'vip' }], mos: 'davom', mosEmas: 'toxtat' },
        { tur: 'xabar', xabar: { matn: 'Faqat VIP uchun' } }
      ]
    });
    assert.ok(!r.xato, r.xato);
    voronka.holatQoy(r.avtomat.id, true);
    const q = voronka.qoldaIshgaTushir(r.avtomat.id);
    assert.strictEqual(q.jami, 3);                       // bloklagan hisobga kirmaydi
    const oldin = yuborilgan.length;
    await voronka.tick();
    assert.strictEqual(yuborilgan.length, oldin + 1);    // faqat 333 (vip)
    assert.strictEqual(Number(oxirgi().tana.chat_id), 333);
  });

  await sinov('Telegram havolasi to\'g\'ridan-to\'g\'ri, sayt havolasi esa sanaladigan qilib qo\'yiladi', () => {
    const tg1 = yuboruvchi.kuzatiladiganUrl(111, { manba: 'sinov' }, 'video:https://t.me/davronturdiev_bot?start=bepuldars10');
    assert.strictEqual(tg1, 'https://t.me/davronturdiev_bot?start=bepuldars10');
    assert.strictEqual(yuboruvchi.kuzatiladiganUrl(111, { manba: 'sinov' }, 'tg://resolve?domain=abc'), 'tg://resolve?domain=abc');
    assert.ok(yuboruvchi.kuzatiladiganUrl(111, { manba: 'sinov' }, 'https://supermiya.uz/kurs').startsWith('https://quiz.example.uz/r/'));
  });

  await sinov('video tugmasi tavsiya qilingan videoga to\'g\'ridan-to\'g\'ri olib boradi', async () => {
    const r = voronka.saqla({
      nom: 'Video sinovi', trigger: { tur: 'test_tugatdi' }, toxtatish: ['video_bosdi'],
      qadamlar: [{ tur: 'xabar', xabar: { matn: '{video}', tugmalar: [{ matn: 'Ko\'rish', tur: 'video' }] } }]
    });
    voronka.holatQoy(r.avtomat.id, true);
    voronka.hodisa(444, 'test_tugatdi');
    await voronka.tick();
    const x = oxirgi();
    assert.strictEqual(x.tana.text, CONFIG.videolar.find((v) => v.id === 'v3').nom.replace(/'/g, '\''));
    const url = x.tana.reply_markup.inline_keyboard[0][0].url;
    // Telegram havolasi — brauzerga chiqmasdan ochilishi uchun yo'naltirish yo'q
    assert.strictEqual(url, CONFIG.videolar.find((v) => v.id === 'v3').havola);
  });

  await sinov('avtomat o\'zini o\'zi ishga tushira olmaydi, bo\'sh nom rad etiladi', () => {
    const a = voronka.avtomatlarOl()[0];
    assert.ok(voronka.saqla({ id: a.id, nom: a.nom, trigger: a.trigger, qadamlar: [{ tur: 'avtomat', avtomatId: a.id }] }).xato);
    assert.ok(voronka.saqla({ nom: ' ', trigger: { tur: 'start' }, qadamlar: [{ tur: 'kutish', miqdor: 1, birlik: 'soat' }] }).xato);
  });

  await sinov('tinch vaqt: 22:00 dagi xabar ertalab 09:00 ga suriladi', () => {
    voronka.sozlamaSaqla({ tinch: { yoqilgan: true, dan: '09:00', gacha: '21:00' } });
    const kech = Date.UTC(2026, 8, 15, 17, 0);          // 22:00 Toshkent
    const ertalab = Date.UTC(2026, 8, 16, 4, 0);        // 09:00 Toshkent
    assert.strictEqual(voronka.keyingiRuxsat(kech), ertalab);
    const kunduz = Date.UTC(2026, 8, 15, 7, 0);         // 12:00 Toshkent
    assert.strictEqual(voronka.keyingiRuxsat(kunduz), kunduz);
    voronka.sozlamaSaqla({ tinch: { yoqilgan: false, dan: '09:00', gacha: '21:00' } });
  });

  console.log('\nBot xabarlari');

  await sinov('ulashilgan raqam saqlanadi, javob yozilmaydi va xabar o\'chiriladi', async () => {
    const telegram = require('../lib/telegram.js');
    const oldin = yuborilgan.length;
    await telegram.xabargaJavob({
      message_id: 55, chat: { id: 333, type: 'private' }, from: { id: 333, first_name: 'Guli' },
      contact: { user_id: 333, phone_number: '+998901112233' }
    });
    assert.strictEqual(obunachilar.olish(333).telefon, '+998901112233');
    const yangilar = yuborilgan.slice(oldin);
    assert.ok(!yangilar.some((x) => x.usul === 'sendMessage'), 'botdan javob xabari ketmasligi kerak');
    assert.ok(yangilar.some((x) => x.usul === 'deleteMessage' && x.tana.message_id === 55), 'raqam xabari o\'chirilishi kerak');
  });

  console.log('\nOmmaviy xabar');

  await sinov('qoralama → yuborish → statistika', async () => {
    const s = tarqatma.saqla({ nom: 'Aksiya', xabar: { matn: 'Salom {ism}', tugmalar: [{ matn: 'Sayt', tur: 'havola', qiymat: 'https://supermiya.uz' }] }, shartlar: [] }, 'bosh');
    assert.ok(!s.xato, s.xato);
    const b = tarqatma.boshla(s.tarqatma.id);
    assert.strictEqual(b.tarqatma.jami, 3);              // 222 bloklagan — kirmaydi
    await tarqatma.ishla();
    const t = tarqatma.olish(s.tarqatma.id);
    assert.strictEqual(t.holat, 'tugadi');
    assert.strictEqual(t.yuborildi, 3);
    const havola = oxirgi().tana.reply_markup.inline_keyboard[0][0].url;
    yuboruvchi.kodBosildi(havola.split('/r/')[1]);
    assert.strictEqual(tarqatma.olish(s.tarqatma.id).bosildi, 1);
  });

  await sinov('yuborilgan xabarni tahrirlab bo\'lmaydi, qayta boshlab bo\'lmaydi', () => {
    const t = tarqatma.royxat()[0];
    assert.ok(tarqatma.saqla({ id: t.id, xabar: { matn: 'x' } }).xato);
    assert.ok(tarqatma.boshla(t.id).xato);
  });

  await sinov('rejalashtirilgan xabar vaqti kelganda ketadi', async () => {
    const s = tarqatma.saqla({ nom: 'Keyin', xabar: { matn: 'Reja' }, shartlar: [{ tur: 'teg_bor', qiymat: 'vip' }] }, 'bosh');
    const b = tarqatma.boshla(s.tarqatma.id, { rejaVaqt: Date.now() + 3600e3 });
    assert.strictEqual(b.tarqatma.holat, 'rejalashtirilgan');
    db.db().prepare('UPDATE tarqatmalar SET reja_vaqt = 1 WHERE id = ?').run(s.tarqatma.id);
    await tarqatma.ishla();
    const t = tarqatma.olish(s.tarqatma.id);
    assert.strictEqual(t.holat, 'tugadi');
    assert.strictEqual(t.yuborildi, 1);
  });

  console.log('\nMedia');

  await sinov('bo\'laklab yuklash, noto\'g\'ri turdagi fayl rad etiladi', () => {
    const png = Buffer.from('89504E470D0A1A0A0000000D4948445200000001000000010806000000', 'hex');
    const b = media.boshla({ nom: 'poster.png', mime: 'image/png', hajm: png.length, eni: 1280, boyi: 720 }, 'sinov');
    assert.ok(b.id);
    assert.ok(media.qismYoz(b.id, 0, png.subarray(0, 10)).ok);
    assert.ok(media.qismYoz(b.id, 0, png.subarray(0, 10)).ok);   // qayta yuborilgan bo'lak — e'tiborsiz
    assert.ok(media.qismYoz(b.id, 1, png.subarray(10)).ok);
    const t = media.tugat(b.id);
    assert.ok(t.media && t.media.url.endsWith('.png'));
    assert.ok(media.faylTop(t.media.fayl));
    assert.ok(!media.faylTop('../../server.js'));

    const soxta = media.boshla({ nom: 'x.jpg', mime: 'image/jpeg', hajm: 4 });
    media.qismYoz(soxta.id, 0, Buffer.from('abcd'));
    assert.ok(media.tugat(soxta.id).xato);
    assert.ok(media.boshla({ mime: 'application/zip', hajm: 10 }).xato);

    assert.ok(media.ochir(t.media.id).ok);
    assert.ok(!fs.existsSync(path.join(__dirname, '..', 'data', 'media', t.media.fayl)));
  });

  await sinov('poster birinchi marta fayl bilan, keyin file_id bilan yuboriladi', async () => {
    const jpg = Buffer.from('FFD8FFE000104A464946', 'hex');
    const b = media.boshla({ nom: 'p.jpg', mime: 'image/jpeg', hajm: jpg.length });
    media.qismYoz(b.id, 0, jpg);
    const m = media.tugat(b.id).media;
    await yuboruvchi.yuborHtml(333, { html: 'a', mediaId: m.id });
    assert.strictEqual(oxirgi().tana.photo.fayl, m.fayl);
    await yuboruvchi.yuborHtml(333, { html: 'b', mediaId: m.id });
    assert.strictEqual(oxirgi().tana.photo, 'FILE_ID_1');
    media.ochir(m.id);
  });

  console.log('\nInteraktiv natija');

  const javoblar = { q1: 'D', q2: 'B', q3: 'C', q4: 'A', q5: 'A', q6: 'B', q7: 'B', q8: 'A', q9: 'A', q10: 'A', q11: 'A', q12: 'B', q13: 'B', q14: 'A', q15: 'B' };
  const h = quiz.hisobla(CONFIG, javoblar);
  const t = natija.tahlil(CONFIG, javoblar, h, { ism: 'Davron', oldingiFoizlar: Array.from({ length: 40 }, (_, i) => i * 2) });

  await sinov('xotira kuchi, yo\'nalishlar, muammolar, reja va video', () => {
    assert.strictEqual(t.xotiraKuchi, 100 - h.darajaFoiz);
    assert.strictEqual(t.yonalishlar.length, 3);
    assert.ok(t.yonalishlar.some((y) => y.golib && y.kod === h.golibOq));
    assert.ok(t.muammolar.length >= 3 && t.muammolar.length <= 4);
    assert.ok(t.kuchli.includes('O\'zgarishga tayyorsiz — bu natijaning yarmi'));
    assert.ok(t.reja.startsWith('Kuniga 10 daqiqa'));
    assert.strictEqual(t.video.id, 'v3');
    assert.strictEqual(t.video.foydalar.length, 3);
    assert.ok(t.taqqoslash && t.taqqoslash.soni === 40);
  });

  await sinov('30 tadan kam natija bo\'lsa taqqoslash chiqmaydi', () => {
    assert.strictEqual(natija.tahlil(CONFIG, javoblar, h, { oldingiFoizlar: [1, 2, 3] }).taqqoslash, null);
  });

  await sinov('Telegram yozuvi posterli bo\'lsa 1024 belgiga sig\'adi', () => {
    const posterli = Object.assign({}, t, { video: Object.assign({}, t.video, { posterId: 'abc' }) });
    const matn = natija.telegramMatn(posterli, CONFIG.matnlar);
    assert.ok(yuboruvchi.matnUzunligi(matn) <= 1024, 'uzunlik: ' + yuboruvchi.matnUzunligi(matn));
    assert.ok(matn.includes('Davron'));
    assert.ok(matn.includes('▰'));
    assert.ok(!/<(?!\/?b>)/.test(matn), 'faqat <b> tegi bo\'lishi kerak');
  });

  console.log(`\n${otdi} ta sinov o'tdi${process.exitCode ? ' — XATOLAR BOR' : ''}\n`);
})();
