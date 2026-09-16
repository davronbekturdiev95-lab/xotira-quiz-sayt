/* ============================================================================
 * TELEGRAM BOT API — past darajali so'rovlar
 *
 * Boshqa modullar (bot, voronka, ommaviy xabar) shu yerdan foydalanadi.
 * Sinovda haqiqiy Telegram o'rniga soxta funksiya ulash mumkin: sinovRejimi(fn)
 * ========================================================================== */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let TOKEN = '';
let SOXTA = null;

function sozla(token) { TOKEN = String(token || ''); }
function tayyormi() { return !!TOKEN || !!SOXTA; }
function tokenOl() { return TOKEN; }

/** Sinov uchun: (usul, tana) => natija (xato bo'lsa throw) */
function sinovRejimi(fn) { SOXTA = fn; }

function xatoYasa(usul, j, status) {
  const e = new Error(`${usul}: ${(j && j.description) || status}`);
  e.kod = (j && j.error_code) || status;
  e.qaytaSoniya = j && j.parameters && j.parameters.retry_after;
  e.tavsif = (j && j.description) || '';
  return e;
}

async function api(usul, tana, kutish = 20000) {
  if (SOXTA) return SOXTA(usul, tana || {});
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${usul}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tana || {}),
    signal: AbortSignal.timeout(kutish)
  });
  const j = await r.json().catch(() => ({ ok: false, description: 'javob JSON emas' }));
  if (!j.ok) throw xatoYasa(usul, j, r.status);
  return j.result;
}

/**
 * Fayl bilan so'rov (rasm/video yuklash).
 * fayl: { maydon: 'photo'|'video', yol, nom, mime }
 */
async function apiForm(usul, maydonlar, fayl, kutish = 180000) {
  if (SOXTA) {
    return SOXTA(usul, Object.assign({}, maydonlar, { [fayl.maydon]: { fayl: fayl.nom || path.basename(fayl.yol) } }));
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(maydonlar || {})) {
    if (v === undefined || v === null || v === '') continue;
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const blob = await fs.openAsBlob(fayl.yol, { type: fayl.mime || 'application/octet-stream' });
  form.append(fayl.maydon, blob, fayl.nom || path.basename(fayl.yol));

  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${usul}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(kutish)
  });
  const j = await r.json().catch(() => ({ ok: false, description: 'javob JSON emas' }));
  if (!j.ok) throw xatoYasa(usul, j, r.status);
  return j.result;
}

/* ============================================================================
 * initData tekshiruvi — mini app'dan kelgan foydalanuvchi haqiqatan Telegram
 * tomonidan imzolanganmi. Soxtalashtirib bo'lmaydi (bot tokeni kerak).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * ========================================================================== */
function initDataTekshir(initData, token = TOKEN, maxSoniya = 24 * 3600) {
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

module.exports = { sozla, tayyormi, tokenOl, sinovRejimi, api, apiForm, initDataTekshir };
