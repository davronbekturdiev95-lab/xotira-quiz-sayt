/* ============================================================================
 * XABAR YUBORUVCHI — voronka, ommaviy xabar va natija uchun umumiy
 *
 *  • Matn belgilash:  **qalin**  __kursiv__  ~~chizilgan~~  [matn](https://...)
 *  • O'zgaruvchilar:  {ism} — foydalanuvchi ismi,  {video} — unga tavsiya qilingan video nomi
 *  • Rasm / video: birinchi marta fayl yuklanadi, keyin Telegram file_id qayta ishlatiladi
 *  • Tugmalar: havola, mini app, tavsiya qilingan video, boshqa avtomatni ishga tushirish
 *  • Tezlik: sekundiga ~20 ta xabar (Telegram chegarasi 30)
 *  • Botni bloklaganlar avtomatik belgilanadi
 * ========================================================================== */
'use strict';

const crypto = require('crypto');
const tg = require('./tgapi.js');
const { db } = require('./db.js');
const media = require('./media.js');
const obunachilar = require('./obunachilar.js');

let SAYT = '';
let configOl = () => ({});

function sozla({ sayt, config } = {}) {
  SAYT = sayt ? String(sayt).replace(/\/+$/, '') + '/' : '';
  if (typeof config === 'function') configOl = config;
}

const TUGMA_TURLARI = ['havola', 'miniapp', 'video', 'avtomat'];
const ORALIQ_MS = 50;

const kut = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================================
 * MATN
 * ========================================================================== */
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** ozg: { ism, video } */
function matnHtml(matn, ozg) {
  const ism = (ozg && ozg.ism) || '';
  const video = (ozg && ozg.video) || '';
  let h = esc(matn);
  h = h.replace(/\{ism\}/g, esc(ism)).replace(/\{video\}/g, esc(video));
  if (!ism) h = h.replace(/,(\s*)!/g, '!').replace(/(^|\n)([^\S\n]*),\s*/g, '$1$2');
  h = h.replace(/\[([^\]\n]{1,100})\]\((https?:\/\/[^\s)]{1,500})\)/g,
    (_, t, u) => `<a href="${u.replace(/"/g, '&quot;')}">${t}</a>`);
  h = h.replace(/\*\*([^*\n](?:[^*]|\*(?!\*))*?)\*\*/g, '<b>$1</b>');
  h = h.replace(/__([^_\n](?:[^_]|_(?!_))*?)__/g, '<i>$1</i>');
  h = h.replace(/~~([^~\n](?:[^~]|~(?!~))*?)~~/g, '<s>$1</s>');
  return h;
}

function htmlOddiy(html) {
  return String(html || '').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function matnUzunligi(html) {
  return htmlOddiy(html).length;
}

/** Obunachiga tavsiya qilingan video (test tugatmagan bo'lsa — zaxira video) */
function videoTop(obunachi) {
  const videolar = (configOl() || {}).videolar || [];
  return videolar.find((v) => obunachi && v.id === obunachi.video_id)
    || videolar.find((v) => v.zaxira) || videolar[0] || null;
}

/* ============================================================================
 * XABARNI TEKSHIRISH (saqlashdan oldin)
 * opts.avtomatBormi: (id) => boolean
 * ========================================================================== */
function tekshirXabar(xom, opts = {}) {
  xom = xom || {};
  const matn = typeof xom.matn === 'string' ? xom.matn.replace(/\r\n/g, '\n') : '';
  if (matn.length > 4000) return { xato: 'Matn 4000 belgidan oshmasin' };

  let mediaQ = null;
  if (xom.media && xom.media.id) {
    const m = media.olish(xom.media.id);
    if (!m) return { xato: 'Tanlangan rasm/video topilmadi (o\'chirilgan bo\'lishi mumkin)' };
    mediaQ = { id: m.id };
  }

  if (!matn.trim() && !mediaQ) return { xato: 'Xabarda matn yoki rasm/video bo\'lishi kerak' };

  const tugmalarXom = Array.isArray(xom.tugmalar) ? xom.tugmalar : [];
  if (tugmalarXom.length > 8) return { xato: '8 tadan ko\'p tugma bo\'lmaydi' };
  const tugmalar = [];
  for (const [i, t] of tugmalarXom.entries()) {
    const yozuv = String((t && t.matn) || '').trim();
    if (!yozuv) return { xato: `${i + 1}-tugma yozuvi bo'sh` };
    if (yozuv.length > 64) return { xato: `${i + 1}-tugma yozuvi 64 belgidan oshmasin` };
    const tur = TUGMA_TURLARI.includes(t.tur) ? t.tur : 'havola';
    const qiymat = String(t.qiymat || '').trim();
    if (tur === 'havola' && !/^https?:\/\/\S{3,}$/i.test(qiymat)) return { xato: `${i + 1}-tugma havolasi https:// bilan boshlansin` };
    if (tur === 'avtomat') {
      if (!qiymat) return { xato: `${i + 1}-tugma uchun avtomatni tanlang` };
      if (opts.avtomatBormi && !opts.avtomatBormi(qiymat)) return { xato: `${i + 1}-tugmadagi avtomat topilmadi` };
    }
    tugmalar.push({ matn: yozuv, tur, qiymat: tur === 'havola' || tur === 'avtomat' ? qiymat.slice(0, 500) : '' });
  }

  return { xabar: { matn, media: mediaQ, tugmalar } };
}

/* ============================================================================
 * TUGMA KODLARI (bosilishini kuzatish)
 * url: oddiy havola | 'video:<havola>' (tavsiya videosi) | 'avtomat:<id>'
 * ========================================================================== */
function kodSaqla(tgId, kontekst, url) {
  const kod = crypto.randomBytes(8).toString('base64url').slice(0, 11);
  db().prepare(`
    INSERT INTO havola_kodlar (kod, tg_id, manba, manba_id, qadam_id, url, yaratilgan)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(kod, Number(tgId) || null, kontekst.manba || null, kontekst.manbaId || null, kontekst.qadamId || null, url, Date.now());
  return kod;
}

function kuzatiladiganUrl(tgId, kontekst, url) {
  return SAYT ? SAYT + 'r/' + kodSaqla(tgId, kontekst, url) : url.replace(/^video:/, '');
}

function tugmalarYasa(tugmalar, tgId, kontekst, obunachi) {
  const qatorlar = [];
  for (const t of tugmalar || []) {
    if (t.tur === 'miniapp') {
      if (SAYT) qatorlar.push([{ text: t.matn, web_app: { url: SAYT } }]);
    } else if (t.tur === 'avtomat') {
      qatorlar.push([{ text: t.matn, callback_data: 'b:' + kodSaqla(tgId, kontekst, 'avtomat:' + t.qiymat) }]);
    } else if (t.tur === 'video') {
      const v = videoTop(obunachi);
      if (v && v.havola) qatorlar.push([{ text: t.matn, url: kuzatiladiganUrl(tgId, kontekst, 'video:' + v.havola) }]);
    } else if (t.qiymat) {
      qatorlar.push([{ text: t.matn, url: kuzatiladiganUrl(tgId, kontekst, t.qiymat) }]);
    }
  }
  return qatorlar.length ? { inline_keyboard: qatorlar } : undefined;
}

/**
 * Tugma bosildi — kodni topadi, statistikani yangilaydi.
 * Bir odam bitta xabardagi tugmani necha marta bossa ham statistikada 1 marta sanaladi.
 */
function kodBosildi(kod) {
  const r = db().prepare('SELECT * FROM havola_kodlar WHERE kod = ?').get(String(kod || ''));
  if (!r) return null;

  const oldinBosganmi = !!db().prepare(`
    SELECT 1 FROM havola_kodlar
    WHERE manba IS ? AND manba_id IS ? AND qadam_id IS ? AND tg_id IS ? AND bosildi > 0
  `).get(r.manba, r.manba_id, r.qadam_id, r.tg_id);

  db().prepare('UPDATE havola_kodlar SET bosildi = bosildi + 1 WHERE kod = ?').run(r.kod);

  if (!oldinBosganmi) {
    if (r.manba === 'avtomat') {
      db().prepare(`
        INSERT INTO qadam_stat (avtomat_id, qadam_id, bosildi) VALUES (?, ?, 1)
        ON CONFLICT(avtomat_id, qadam_id) DO UPDATE SET bosildi = bosildi + 1
      `).run(r.manba_id, r.qadam_id);
    } else if (r.manba === 'tarqatma') {
      db().prepare('UPDATE tarqatmalar SET bosildi = bosildi + 1 WHERE id = ?').run(r.manba_id);
    }
  }

  const videomi = r.url.startsWith('video:');
  const avtomatmi = r.url.startsWith('avtomat:');
  return Object.assign({}, r, {
    birinchi: !oldinBosganmi,
    videomi,
    avtomatId: avtomatmi ? r.url.slice(8) : null,
    manzil: avtomatmi ? null : r.url.replace(/^video:/, '')
  });
}

/* ============================================================================
 * YUBORISH
 * ========================================================================== */
let oxirgiYuborish = 0;
let zanjir = Promise.resolve();

/** Hamma yuborishlar ketma-ket, orasida kamida ORALIQ_MS */
function navbatda(fn) {
  const natija = zanjir.then(async () => {
    const qoldi = oxirgiYuborish + ORALIQ_MS - Date.now();
    if (qoldi > 0) await kut(qoldi);
    oxirgiYuborish = Date.now();
    return fn();
  });
  zanjir = natija.catch(() => {});
  return natija;
}

async function mediaYubor(tgId, m, caption, markup, parseMode) {
  const video = m.tur === 'video';
  const usul = video ? 'sendVideo' : 'sendPhoto';
  const maydon = video ? 'video' : 'photo';
  const asos = { chat_id: tgId };
  if (markup) asos.reply_markup = markup;
  if (caption) { asos.caption = caption; if (parseMode) asos.parse_mode = parseMode; }

  if (m.tg_file_id) {
    try {
      return await tg.api(usul, Object.assign({ [maydon]: m.tg_file_id }, asos));
    } catch (e) {
      // file_id eskirgan bo'lsa — faylni qaytadan yuklaymiz
      if (!(e.kod === 400 && /file|wrong|identifier/i.test(e.tavsif || ''))) throw e;
      media.fileIdSaqla(m.id, null);
    }
  }

  const qoshimcha = video ? { supports_streaming: true } : {};
  const n = await tg.apiForm(usul, Object.assign(qoshimcha, asos), {
    maydon, yol: media.faylYoli(m), nom: m.fayl, mime: m.mime
  });
  const fileId = video
    ? (n && n.video && n.video.file_id)
    : (n && Array.isArray(n.photo) && n.photo.length && n.photo[n.photo.length - 1].file_id);
  if (fileId) media.fileIdSaqla(m.id, fileId);
  return n;
}

async function bittaYubor(tgId, html, m, markup, oddiy) {
  const matn = oddiy ? htmlOddiy(html) : html;
  const parseMode = oddiy ? undefined : 'HTML';

  if (m) {
    // Rasm yozuvi 1024 belgigacha — uzunroq bo'lsa rasm alohida, matn alohida ketadi
    if (!matn || matnUzunligi(html) <= 1024) return mediaYubor(tgId, m, matn, markup, parseMode);
    await mediaYubor(tgId, m, '', undefined);
  }
  const tana = { chat_id: tgId, text: matn, link_preview_options: { is_disabled: true } };
  if (markup) tana.reply_markup = markup;
  if (parseMode) tana.parse_mode = parseMode;
  return tg.api('sendMessage', tana);
}

function bloklaganmi(e) {
  const t = (e && e.tavsif) || '';
  return !!e && (e.kod === 403 || (e.kod === 400 && /chat not found|user is deactivated|bot was blocked|PEER_ID_INVALID/i.test(t)));
}

/**
 * Tayyor HTML xabarni yuborish.
 * → { ok, bloklagan, xato }
 */
async function yuborHtml(tgId, { html, mediaId, markup }) {
  if (!tg.tayyormi()) return { ok: false, xato: 'Bot sozlanmagan' };
  const m = mediaId ? media.olish(mediaId) : null;

  return navbatda(async () => {
    let oddiy = false;
    for (let urinish = 0; urinish < 4; urinish++) {
      try {
        await bittaYubor(Number(tgId), html, m, markup, oddiy);
        return { ok: true };
      } catch (e) {
        if (e.kod === 429 && urinish < 3) { await kut(((e.qaytaSoniya || 2) * 1000) + 300); continue; }
        if (bloklaganmi(e)) {
          obunachilar.bloklandi(tgId);
          return { ok: false, bloklagan: true, xato: e.tavsif || e.message };
        }
        if (e.kod === 400 && /parse entities|can't parse/i.test(e.tavsif || '') && !oddiy) { oddiy = true; continue; }
        return { ok: false, xato: e.message };
      }
    }
    return { ok: false, xato: 'Ko\'p urinishdan keyin ham yuborilmadi' };
  });
}

/**
 * Panelda tuzilgan xabarni yuborish.
 * kontekst: { manba: 'avtomat'|'tarqatma'|'sinov', manbaId, qadamId, obunachi }
 */
async function yubor(tgId, xabar, kontekst = {}) {
  const obunachi = kontekst.obunachi || obunachilar.olish(tgId) || { tg_id: tgId };
  const v = videoTop(obunachi);
  const html = matnHtml(xabar.matn || '', { ism: obunachi.ism, video: v ? v.nom : '' });
  const markup = tugmalarYasa(xabar.tugmalar, tgId, kontekst, obunachi);
  return yuborHtml(tgId, { html, mediaId: xabar.media && xabar.media.id, markup });
}

module.exports = {
  sozla, TUGMA_TURLARI,
  esc, matnHtml, htmlOddiy, matnUzunligi, tekshirXabar, videoTop,
  kodSaqla, kuzatiladiganUrl, kodBosildi,
  yubor, yuborHtml
};
