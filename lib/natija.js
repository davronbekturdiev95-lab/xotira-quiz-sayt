/* ============================================================================
 * INTERAKTIV NATIJA — foydalanuvchiga batafsil tahlil
 *
 *  • Xotira kuchi (0–100) va daraja
 *  • Muammo yo'nalishlari: xotira / diqqat / til (foizlarda)
 *  • Asosiy muammolar va kuchli tomonlar — tanlangan variantlarning izohlaridan
 *  • Kunlik reja — shug'ullanish vaqtiga qarab
 *  • Boshqalar bilan taqqoslash (yetarlicha natija to'planganda)
 *  • Tavsiya qilingan video: poster, nom, foydalari
 *
 * Bu modul faqat hisoblaydi — hech narsa saqlamaydi va yubormaydi.
 * ========================================================================== */
'use strict';

const OQ_TARTIBI = ['xotira', 'diqqat', 'til'];
const TAQQOS_MIN = 30;          // shuncha natija to'planmaguncha taqqoslash ko'rsatilmaydi
const MUAMMO_MAX = 4;
const KUCHLI_MAX = 3;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const toza = (s) => String(s === undefined || s === null ? '' : s).trim();

function qatorlargaBol(matn) {
  return toza(matn).split('\n').map((q) => q.replace(/^[\s•\-–*]+/, '').trim()).filter(Boolean);
}

/**
 * @param config    joriy sozlama
 * @param javoblar  { savolId: 'A', ... } — tekshirilgan
 * @param h         quiz.hisobla() natijasi
 * @param opts      { ism, oldingiFoizlar: [daraja_foiz, ...], posterUrl: (mediaId) => url }
 */
function tahlil(config, javoblar, h, opts = {}) {
  const M = config.matnlar || {};
  const savollar = (config.savollar || []).filter((s) => !s.yashirin);

  const muammolar = [];
  const kuchli = [];
  let reja = '';

  savollar.forEach((savol, tartib) => {
    const v = (savol.variantlar || []).find((x) => x.key === javoblar[savol.id]);
    if (!v) return;
    const ogirlik = num(v.daraja) + Object.values(v.ball || {}).reduce((s, x) => s + num(x), 0);
    if (toza(v.muammo)) muammolar.push({ matn: toza(v.muammo), ogirlik, tartib });
    if (toza(v.kuchli)) kuchli.push({ matn: toza(v.kuchli), tartib });
    if (toza(v.reja)) reja = toza(v.reja);
  });

  muammolar.sort((a, b) => (b.ogirlik - a.ogirlik) || (a.tartib - b.tartib));

  // ---- daraja ----
  const darajalar = (config.darajalar || []).slice().sort((a, b) => num(a.max) - num(b.max));
  const darajaIndeks = Math.max(0, darajalar.findIndex((d) => d.kod === h.darajaKod));

  // ---- taqqoslash ----
  let taqqoslash = null;
  const oldingi = (opts.oldingiFoizlar || []).map(Number).filter(Number.isFinite);
  if (oldingi.length >= TAQQOS_MIN) {
    const yomonroq = oldingi.filter((f) => f > h.darajaFoiz).length;
    const foiz = Math.round((yomonroq / oldingi.length) * 100);
    const yaxshi = foiz >= 50;
    const shablon = yaxshi
      ? (M.natija_taqqos_yaxshi || 'Testdan o\'tgan {soni} kishining {foiz}% idan yaxshiroq natija ko\'rsatdingiz')
      : (M.natija_taqqos_past || 'Testdan o\'tgan {soni} kishining {foiz}% i sizdan yaxshiroq natija ko\'rsatdi');
    const korsatFoiz = yaxshi ? foiz : 100 - foiz;
    taqqoslash = {
      foiz: korsatFoiz,
      soni: oldingi.length,
      yaxshi,
      matn: shablon.replace(/\{soni\}/g, String(oldingi.length)).replace(/\{foiz\}/g, String(korsatFoiz))
    };
  }

  // ---- video ----
  const v = h.video || {};
  const posterUrl = v.poster && typeof opts.posterUrl === 'function' ? opts.posterUrl(v.poster) : null;

  return {
    ism: toza(opts.ism),
    xotiraKuchi: Math.max(0, Math.min(100, 100 - num(h.darajaFoiz))),
    daraja: {
      kod: h.darajaKod || '',
      nom: h.daraja || '',
      matn: h.darajaMatn || '',
      tartib: darajaIndeks,
      jami: darajalar.length
    },
    yonalishlar: OQ_TARTIBI.map((kod) => ({
      kod,
      nom: M['natija_oq_' + kod] || kod,
      foiz: Math.max(0, Math.min(100, num(h.foiz && h.foiz[kod]))),
      golib: kod === h.golibOq
    })),
    muammolar: muammolar.slice(0, MUAMMO_MAX).map((m) => m.matn),
    kuchli: kuchli.slice(0, KUCHLI_MAX).map((k) => k.matn),
    reja,
    taqqoslash,
    video: {
      id: v.id || '',
      nom: v.nom || '',
      havola: v.havola || '',
      matn: v.matn || '',
      foydalar: qatorlargaBol(v.foydalar).slice(0, 6),
      posterId: v.poster || null,
      poster: posterUrl
    }
  };
}

/* ============================================================================
 * TELEGRAM XABARI (HTML)
 * ========================================================================== */
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shkala(foiz, uzunlik = 10) {
  const toldi = Math.max(0, Math.min(uzunlik, Math.round((num(foiz) / 100) * uzunlik)));
  return '▰'.repeat(toldi) + '▱'.repeat(uzunlik - toldi);
}

/**
 * Poster tagidagi yozuv. Telegram rasm yozuvini 1024 belgi bilan cheklaydi —
 * shuning uchun avval qisqa variant yig'iladi, joy qolsa qo'shimchalar qo'shiladi.
 */
function telegramMatn(t, M = {}) {
  const ism = t.ism ? esc(t.ism) : '';
  let bosh = esc(M.tg_natija_sarlavha || '🧠 {ism}, test natijangiz').replace(/\{ism\}/g, ism);
  if (!ism) bosh = bosh.replace(/^([^\p{L}]*?)\s*,\s*/u, '$1 ').replace(/\s+/g, ' ').trim();

  const asosiy = [
    `<b>${bosh}</b>`,
    '',
    `${esc(M.natija_kuch_nom || 'Xotira kuchi')}: <b>${t.xotiraKuchi}/100</b>${t.daraja.nom ? ' — ' + esc(t.daraja.nom) : ''}`,
    shkala(t.xotiraKuchi),
    '',
    `<b>${esc(M.natija_yonalish_sarlavha || 'Muammo qaysi sohada')}:</b>`,
    ...t.yonalishlar.map((y) => `${shkala(y.foiz)} ${y.foiz}% — ${esc(y.nom)}`)
  ];

  const qismlar = [];
  if (t.muammolar.length) {
    qismlar.push(['', `<b>⚠️ ${esc(M.natija_muammo_sarlavha || 'Asosiy muammolaringiz')}:</b>`, ...t.muammolar.map((m) => '• ' + esc(m))]);
  }
  if (t.kuchli.length) {
    qismlar.push(['', `<b>✅ ${esc(M.natija_kuchli_sarlavha || 'Kuchli tomonlaringiz')}:</b>`, ...t.kuchli.map((m) => '• ' + esc(m))]);
  }
  if (t.taqqoslash) qismlar.push(['', '📊 ' + esc(t.taqqoslash.matn)]);
  if (t.reja) qismlar.push(['', `<b>🗓 ${esc(M.natija_reja_sarlavha || 'Kunlik rejangiz')}:</b>`, esc(t.reja)]);

  const oxiri = t.video.nom
    ? ['', `👇 <b>${esc(M.natija_video_sarlavha || 'Sizga mos bepul videodars')}:</b>`, esc(t.video.nom)]
    : [];

  const uzunlik = (qatorlar) => qatorlar.join('\n').replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt);/g, '_').length;

  // Poster bor bo'lsa — 1024 ga sig'diramiz; sig'maydigan qo'shimchalar tushib qoladi
  const chegara = t.video.posterId ? 1024 : 4000;
  let qatorlar = asosiy.concat(oxiri);
  for (const q of qismlar) {
    const sinov = asosiy.concat(...qismlar.slice(0, qismlar.indexOf(q) + 1), oxiri);
    if (uzunlik(sinov) <= chegara) qatorlar = sinov;
    else break;
  }
  if (uzunlik(qatorlar) > chegara) qatorlar = asosiy.slice(0, 5).concat(oxiri);
  return qatorlar.join('\n').trim();
}

module.exports = { tahlil, telegramMatn, shkala, TAQQOS_MIN };
