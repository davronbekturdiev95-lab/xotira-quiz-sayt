/* ============================================================================
 * BALL HISOBLASH — hamma narsa config asosida ishlaydi
 * ========================================================================== */
'use strict';

const OQ_KODLAR = ['xotira', 'diqqat', 'til'];
const BELGI_KODLAR = ['aniq', 'hajm', 'talaba', 'yangi'];

/** Har bir o'q va daraja bo'yicha eng katta bo'lishi mumkin bo'lgan ball */
function maksimum(savollar) {
  const max = { xotira: 0, diqqat: 0, til: 0, daraja: 0 };

  for (const savol of savollar) {
    const eng = { xotira: 0, diqqat: 0, til: 0, daraja: 0 };

    for (const v of savol.variantlar) {
      for (const oq of OQ_KODLAR) {
        let qiymat = num(v.ball && v.ball[oq]);
        if (v.katta) {
          const q2 = num(v.katta.ball && v.katta.ball[oq]);
          if (q2 > qiymat) qiymat = q2;
        }
        if (qiymat > eng[oq]) eng[oq] = qiymat;
      }
      const d = num(v.daraja);
      if (d > eng.daraja) eng.daraja = d;
    }

    max.xotira += eng.xotira;
    max.diqqat += eng.diqqat;
    max.til += eng.til;
    max.daraja += eng.daraja;
  }
  return max;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Javoblarni tekshirish: har bir savolga to'g'ri variant berilganmi */
function javoblarniTekshir(savollar, xom) {
  const javoblar = {};
  for (const savol of savollar) {
    const qiymat = xom && xom[savol.id] != null ? String(xom[savol.id]) : '';
    const bormi = savol.variantlar.some((v) => v.key === qiymat);
    if (!bormi) {
      const raqam = savollar.indexOf(savol) + 1;
      return { xato: `${raqam}-savolga javob berilmagan` };
    }
    javoblar[savol.id] = qiymat;
  }
  return { javoblar };
}

/** Asosiy hisob */
function hisobla(config, javoblar) {
  const savollar = config.savollar || [];
  const oq = { xotira: 0, diqqat: 0, til: 0 };
  const belgi = { aniq: 0, hajm: 0, talaba: 0, yangi: 0 };
  let darajaBall = 0;

  // Yosh guruhini aniqlaymiz (ba'zi variantlar yoshga qarab boshqacha ball beradi)
  let yoshGuruh = 'katta';
  const yoshSavoli = savollar.find((s) => s.id === config.yoshSavoli);
  if (yoshSavoli) {
    const tanlangan = yoshSavoli.variantlar.find((v) => v.key === javoblar[yoshSavoli.id]);
    if (tanlangan && tanlangan.yoshGuruh) yoshGuruh = tanlangan.yoshGuruh;
  }

  for (const savol of savollar) {
    const variant = savol.variantlar.find((v) => v.key === javoblar[savol.id]);
    if (!variant) continue;

    let ball = variant.ball || {};
    let belgilar = variant.belgi || {};
    if (yoshGuruh === 'katta' && variant.katta) {
      ball = variant.katta.ball || {};
      belgilar = variant.katta.belgi || {};
    }

    for (const k of OQ_KODLAR) oq[k] += num(ball[k]);
    for (const k of BELGI_KODLAR) belgi[k] += num(belgilar[k]);
    darajaBall += num(variant.daraja);
  }

  const max = maksimum(savollar);

  const foiz = {
    xotira: max.xotira ? (oq.xotira / max.xotira) * 100 : 0,
    diqqat: max.diqqat ? (oq.diqqat / max.diqqat) * 100 : 0,
    til: max.til ? (oq.til / max.til) * 100 : 0
  };

  const tartib = OQ_KODLAR.slice().sort((a, b) => foiz[b] - foiz[a]);
  const golibOq = tartib[0];

  // ---- Videoni tanlash ----
  const videolar = config.videolar || [];
  const nomzodlar = videolar
    .filter((v) => (v.yonalish === 'istalgan' || v.yonalish === golibOq))
    .filter((v) => (v.shartlar || []).every((s) => num(belgi[s.belgi]) >= num(s.min)))
    .map((v) => ({
      video: v,
      ustunlik: num(v.ustunlik),
      // shartlar qanchalik "kuchli" bajarilgan — teng ustunlikda shu hal qiladi
      kuch: (v.shartlar || []).reduce((s, sh) => s + (num(belgi[sh.belgi]) - num(sh.min)), 0),
      shartSoni: (v.shartlar || []).length
    }))
    .sort((a, b) => {
      if (b.ustunlik !== a.ustunlik) return b.ustunlik - a.ustunlik;
      if (b.shartSoni !== a.shartSoni) return b.shartSoni - a.shartSoni;
      return b.kuch - a.kuch;
    });

  let video = nomzodlar.length ? nomzodlar[0].video : null;
  let sabab = video ? sababMatn(video, golibOq) : '';

  if (!video) {
    video = videolar.find((v) => v.zaxira) || videolar[0] || null;
    sabab = 'Zaxira video (mos qoida topilmadi)';
  }

  // ---- Daraja ----
  const darajaFoiz = max.daraja ? Math.round((darajaBall / max.daraja) * 100) : 0;
  const darajalar = (config.darajalar || []).slice().sort((a, b) => num(a.max) - num(b.max));
  let daraja = darajalar[darajalar.length - 1] || { nom: '', kod: '', matn: '' };
  for (const d of darajalar) {
    if (darajaFoiz <= num(d.max)) { daraja = d; break; }
  }

  return {
    video,
    videoId: video ? video.id : '',
    havola: video ? video.havola : '',
    videoMatn: video ? video.matn : '',
    golibOq,
    sabab,
    oq,
    belgi,
    foiz: {
      xotira: Math.round(foiz.xotira),
      diqqat: Math.round(foiz.diqqat),
      til: Math.round(foiz.til)
    },
    darajaBall,
    darajaFoiz,
    daraja: daraja.nom,
    darajaKod: daraja.kod,
    darajaMatn: daraja.matn,
    yoshGuruh
  };
}

function sababMatn(video, golibOq) {
  const shartlar = (video.shartlar || []).map((s) => `${s.belgi} ≥ ${s.min}`).join(', ');
  return shartlar ? `${golibOq} + ${shartlar}` : golibOq;
}

/** Saytga yuboriladigan savollar — ballarsiz */
function ommaviySavollar(config) {
  return (config.savollar || []).map((s) => ({
    id: s.id,
    matn: s.matn,
    variantlar: s.variantlar.map((v) => ({ key: v.key, matn: v.matn }))
  }));
}

module.exports = { hisobla, maksimum, javoblarniTekshir, ommaviySavollar, OQ_KODLAR, BELGI_KODLAR };
