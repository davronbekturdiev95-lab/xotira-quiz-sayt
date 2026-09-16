/* ============================================================
   BOSHQARUV PANELI — BOT BO'LIMLARI
   Media · Obunachilar · Voronka · Ommaviy xabar
   (admin.js dagi window.XT yordamchilaridan foydalanadi)
   ============================================================ */
(function () {
  'use strict';

  const XT = window.XT;
  if (!XT) return;
  const { h, api, $ } = XT;

  let MAL = null;            // /api/admin/bot-malumot
  let MEDIA = [];
  let AVTOMATLAR = [];

  const boshmi = () => (XT.user() || {}).rol === 'bosh';
  const kut = (ms) => new Promise((r) => setTimeout(r, ms));
  const TZ = 5 * 3600e3;     // Toshkent vaqti

  async function malumot(yangila) {
    if (!MAL || yangila) {
      const d = await api('/api/admin/bot-malumot');
      if (d.ok) MAL = d;
    }
    return MAL;
  }

  function post(yol, tana) {
    return api(yol, { method: 'POST', body: JSON.stringify(tana || {}) });
  }

  function yuklanmoqda() {
    return h('p', { class: 'muted', text: 'Yuklanmoqda...' });
  }

  function chip(nom, son, klass) {
    return h('span', { class: 'chip' + (klass ? ' ' + klass : '') }, h('b', { text: String(son || 0) }), ' ' + nom);
  }

  function hajm(n) {
    n = Number(n || 0);
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  function toshkentInput(ms) { return new Date(ms + TZ).toISOString().slice(0, 16); }
  function toshkentdanMs(q) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(q || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - TZ : 0;
  }
  function toshkentMatn(ms) {
    const s = new Date(Number(ms) + TZ).toISOString();
    return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) + ' ' + s.slice(11, 16);
  }

  /* ---------------- Bildirish (pastki o'ng burchak) ---------------- */
  function bildirish(matn, tur) {
    let idish = document.querySelector('.bildirishlar');
    if (!idish) { idish = h('div', { class: 'bildirishlar', role: 'status' }); document.body.appendChild(idish); }
    const b = h('div', { class: 'bildirish' + (tur ? ' bildirish--' + tur : ''), text: matn });
    idish.appendChild(b);
    setTimeout(() => { b.classList.add('bildirish--ket'); setTimeout(() => b.remove(), 350); }, tur === 'err' ? 7000 : 3500);
  }

  /* ---------------- Modal oyna ---------------- */
  function modal(sarlavha, ...ichi) {
    const obj = {};
    const esc = (e) => { if (e.key === 'Escape') yop(); };
    const oyna = h('div', { class: 'modal__oyna', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal__bosh' },
        h('h3', { text: sarlavha }),
        h('button', { class: 'mini', type: 'button', text: '✕', title: 'Yopish', onclick: () => yop() })),
      h('div', { class: 'modal__ich' }, ...ichi));
    const fon = h('div', { class: 'modal', onmousedown: (e) => { if (e.target === fon) yop(); } }, oyna);
    function yop() {
      if (!fon.isConnected) return;
      fon.remove();
      document.removeEventListener('keydown', esc);
      if (obj.onYop) obj.onYop();
    }
    document.body.appendChild(fon);
    document.addEventListener('keydown', esc);
    return Object.assign(obj, { yop, oyna });
  }

  function tasdiqla(sarlavha, matn, tugmaMatn, xavfli) {
    return new Promise((resolve) => {
      let javob = false;
      const m = modal(sarlavha,
        h('p', { class: 'tasdiq__matn', text: matn }),
        h('div', { class: 'modal__amallar' },
          h('button', { class: 'btn', type: 'button', text: 'Bekor qilish', onclick: () => m.yop() }),
          h('button', {
            class: 'btn ' + (xavfli ? 'btn--xavf-t' : 'btn--primary btn--avto'), type: 'button', text: tugmaMatn || 'Ha',
            onclick: () => { javob = true; m.yop(); }
          })));
      m.onYop = () => resolve(javob);
    });
  }

  /* ============================================================
     MEDIA
     ============================================================ */
  async function mediaYukla() {
    const d = await api('/api/admin/media');
    if (d.ok) MEDIA = d.media;
    return MEDIA;
  }

  function rasmOch(fayl) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fayl);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasmni o\'qib bo\'lmadi')); };
      img.src = url;
    });
  }

  /** Rasm 1920 px dan katta bo'lsa kichraytiriladi va JPEG ga siqiladi */
  async function rasmTayyorla(fayl) {
    const { img, url } = await rasmOch(fayl);
    try {
      const eni = img.naturalWidth;
      const boyi = img.naturalHeight;
      const k = Math.min(1, 1920 / Math.max(eni, boyi));
      const yEni = Math.round(eni * k);
      const yBoyi = Math.round(boyi * k);
      const c = document.createElement('canvas');
      c.width = yEni;
      c.height = yBoyi;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, yEni, yBoyi);
      ctx.drawImage(img, 0, 0, yEni, yBoyi);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
      const ruxsat = ['image/jpeg', 'image/png', 'image/webp'].includes(fayl.type);
      if (blob && (k < 1 || blob.size < fayl.size || !ruxsat)) {
        return { blob, mime: 'image/jpeg', eni: yEni, boyi: yBoyi, nom: fayl.name.replace(/\.[^.]+$/, '') + '.jpg' };
      }
      return { blob: fayl, mime: fayl.type, eni, boyi, nom: fayl.name };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function videoOlchami(fayl) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(fayl);
      const v = document.createElement('video');
      const tugat = (n) => { URL.revokeObjectURL(url); resolve(n); };
      v.preload = 'metadata';
      v.onloadedmetadata = () => tugat({ eni: v.videoWidth, boyi: v.videoHeight });
      v.onerror = () => tugat({});
      setTimeout(() => tugat({}), 4000);
      v.src = url;
    });
  }

  /** Faylni 700 KB lik bo'laklarda yuklaydi (serverdagi 1 MB cheklovidan o'tish uchun) */
  async function faylYukla(fayl, progress) {
    let tayyor;
    if (/^image\//.test(fayl.type)) {
      progress && progress(0, 'Siqilmoqda...');
      tayyor = await rasmTayyorla(fayl);
    } else if (fayl.type === 'video/mp4') {
      tayyor = Object.assign({ blob: fayl, mime: fayl.type, nom: fayl.name }, await videoOlchami(fayl));
    } else {
      throw new Error('Faqat JPG, PNG, WEBP rasm yoki MP4 video');
    }

    const b = await post('/api/admin/media/boshla', {
      nom: tayyor.nom, mime: tayyor.mime, hajm: tayyor.blob.size, eni: tayyor.eni, boyi: tayyor.boyi
    });
    if (!b.ok) throw new Error(b.error || 'Yuklab bo\'lmadi');

    const blob = tayyor.blob;
    for (let i = 0, tartib = 0; i < blob.size; i += b.qismHajmi, tartib++) {
      const qism = blob.slice(i, i + b.qismHajmi);
      for (let urinish = 1; ; urinish++) {
        try {
          const r = await fetch('/api/admin/media/qism?id=' + b.id + '&tartib=' + tartib, {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: qism
          });
          const j = await r.json().catch(() => ({ ok: false, error: 'Server javobi noto\'g\'ri (' + r.status + ')' }));
          if (!j.ok) throw new Error(j.error);
          break;
        } catch (e) {
          if (urinish >= 3) throw e;
          await kut(1000 * urinish);
        }
      }
      progress && progress(Math.min(1, (i + qism.size) / blob.size));
    }

    const t = await post('/api/admin/media/tugat', { id: b.id });
    if (!t.ok) throw new Error(t.error || 'Yuklash yakunlanmadi');
    MEDIA.unshift(Object.assign(t.media, { foydalanish: [] }));
    return t.media;
  }

  async function fayllarniYukla(fayllar, holatIdish) {
    const yuklandi = [];
    for (const f of fayllar) {
      const foiz = h('span', { class: 'yuklash__foiz', text: '0%' });
      const toldi = h('i');
      const qator = h('div', { class: 'yuklash' },
        h('span', { class: 'yuklash__nom', text: f.name }),
        h('span', { class: 'yuklash__chiziq' }, toldi),
        foiz);
      holatIdish.appendChild(qator);
      try {
        const m = await faylYukla(f, (p, izoh) => {
          toldi.style.width = Math.round(p * 100) + '%';
          foiz.textContent = izoh || Math.round(p * 100) + '%';
        });
        qator.classList.add('yuklash--ok');
        foiz.textContent = '✓ ' + hajm(m.hajm);
        yuklandi.push(m);
        setTimeout(() => qator.remove(), 3000);
      } catch (e) {
        qator.classList.add('yuklash--xato');
        foiz.textContent = e.message;
        setTimeout(() => qator.remove(), 12000);
      }
    }
    return yuklandi;
  }

  function nisbat(m) {
    if (!m.eni || !m.boyi) return '';
    return Math.abs(m.eni / m.boyi - 16 / 9) < 0.03 ? '16:9' : m.eni === m.boyi ? '1:1' : '';
  }

  function mediaKorinish(m, klass) {
    return m.tur === 'video'
      ? h('video', { class: klass || '', src: m.url + '#t=0.5', muted: '', preload: 'metadata', playsinline: '' })
      : h('img', { class: klass || '', src: m.url, alt: m.nom || '', loading: 'lazy' });
  }

  function mediaKarta(m, tanla) {
    const ishlatilgan = m.foydalanish || [];
    const izoh = [m.eni && m.boyi ? m.eni + '×' + m.boyi : '', nisbat(m), hajm(m.hajm)].filter(Boolean).join(' · ');
    return h('div', {
      class: 'media-karta' + (tanla ? ' media-karta--tanlash' : ''),
      onclick: tanla ? () => tanla(m) : null,
      tabindex: tanla ? '0' : null,
      onkeydown: tanla ? (e) => { if (e.key === 'Enter') tanla(m); } : null
    },
      h('div', { class: 'media-karta__rasm' },
        mediaKorinish(m),
        m.tur === 'video' ? h('span', { class: 'media-karta__tur', text: '▶ Video' }) : null),
      h('div', { class: 'media-karta__ich' },
        h('div', { class: 'media-karta__nom', text: m.nom || m.fayl, title: m.nom || '' }),
        h('div', { class: 'media-karta__izoh', text: izoh }),
        !tanla && ishlatilgan.length ? h('div', { class: 'media-karta__foyd', text: 'Ishlatilgan: ' + ishlatilgan.join('; ') }) : null,
        !tanla ? h('div', { class: 'media-karta__amallar' },
          h('a', { class: 'mini', href: m.url, target: '_blank', rel: 'noopener', text: 'Ochish ↗' }),
          h('button', {
            class: 'mini mini--qizil', type: 'button', text: 'O\'chirish',
            disabled: ishlatilgan.length ? true : null,
            title: ishlatilgan.length ? 'Avval ishlatilgan joydan olib tashlang' : 'Faylni o\'chirish',
            onclick: async () => {
              if (!(await tasdiqla('Faylni o\'chirish', '"' + (m.nom || m.fayl) + '" butunlay o\'chirilsinmi?', 'O\'chirish', true))) return;
              const d = await post('/api/admin/media/ochir', { id: m.id });
              if (!d.ok) return bildirish(d.error || 'O\'chirilmadi', 'err');
              MEDIA = MEDIA.filter((x) => x.id !== m.id);
              mediaChiz();
              bildirish('Fayl o\'chirildi', 'ok');
            }
          })) : null));
  }

  async function mediaSahifa() {
    const idish = $('media-royxat');
    idish.innerHTML = '';
    idish.appendChild(yuklanmoqda());
    await mediaYukla();
    mediaChiz();
  }

  function mediaChiz() {
    const idish = $('media-royxat');
    idish.innerHTML = '';
    if (!MEDIA.length) {
      idish.appendChild(h('div', { class: 'bosh-holat' },
        h('div', { class: 'bosh-holat__belgi', text: '🖼' }),
        h('p', { text: 'Hozircha fayl yo\'q. Yuqoridagi tugma orqali birinchi posterni yuklang.' })));
      return;
    }
    MEDIA.forEach((m) => idish.appendChild(mediaKarta(m)));
  }

  $('media-yukla-tugma').addEventListener('click', () => $('media-fayl').click());
  $('media-fayl').addEventListener('change', async () => {
    const fayllar = [...$('media-fayl').files];
    $('media-fayl').value = '';
    if (!fayllar.length) return;
    await fayllarniYukla(fayllar, $('media-holat'));
    await mediaYukla();
    mediaChiz();
  });

  /** Rasm / video tanlash oynasi. opts.tur: 'rasm' | 'video' | undefined */
  async function mediaTanla(opts, cb) {
    const tur = opts && opts.tur;
    const setka = h('div', { class: 'media-setka media-setka--modal' }, yuklanmoqda());
    const holatIdish = h('div', { class: 'yuklash-royxat' });
    const kirit = h('input', {
      type: 'file', hidden: true,
      accept: tur === 'rasm' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,video/mp4'
    });
    const m = modal(tur === 'rasm' ? 'Rasm tanlash' : 'Rasm yoki video tanlash',
      h('div', { class: 'modal__tepa' },
        h('button', { class: 'btn btn--primary btn--avto', type: 'button', text: '+ Kompyuterdan yuklash', onclick: () => kirit.click() }),
        h('span', { class: 'muted', text: tur === 'rasm' ? 'JPG, PNG yoki WEBP. Poster uchun 16:9 (1280×720).' : 'Rasm (JPG, PNG, WEBP) yoki MP4 video — 50 MB gacha.' })),
      kirit, holatIdish, setka);

    const chiz = () => {
      setka.innerHTML = '';
      const royxat = MEDIA.filter((x) => !tur || x.tur === tur);
      if (!royxat.length) setka.appendChild(h('p', { class: 'muted', text: 'Hali fayl yo\'q — yuqoridagi tugma orqali yuklang.' }));
      royxat.forEach((x) => setka.appendChild(mediaKarta(x, (tanlangan) => { m.yop(); cb(tanlangan); })));
    };

    kirit.addEventListener('change', async () => {
      const f = [...kirit.files];
      kirit.value = '';
      if (!f.length) return;
      const yuklandi = await fayllarniYukla(f, holatIdish);
      if (yuklandi.length) { m.yop(); cb(yuklandi[0]); return; }
      chiz();
    });

    await mediaYukla();
    chiz();
  }
  XT.mediaTanla = mediaTanla;

  /* ============================================================
     XABAR MUHARRIRI (voronka va ommaviy xabar uchun umumiy)
     ============================================================ */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Serverdagi yuboruvchi.matnHtml bilan bir xil */
  function matnHtml(matn, ozg) {
    let x = esc(matn);
    x = x.replace(/\{ism\}/g, esc(ozg.ism)).replace(/\{video\}/g, esc(ozg.video));
    x = x.replace(/\[([^\]\n]{1,100})\]\((https?:\/\/[^\s)]{1,500})\)/g, (_, t, u) => '<a href="' + u.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + t + '</a>');
    x = x.replace(/\*\*([^*\n](?:[^*]|\*(?!\*))*?)\*\*/g, '<b>$1</b>');
    x = x.replace(/__([^_\n](?:[^_]|_(?!_))*?)__/g, '<i>$1</i>');
    x = x.replace(/~~([^~\n](?:[^~]|~(?!~))*?)~~/g, '<s>$1</s>');
    return x;
  }

  const TUGMA_TUR_NOM = {
    havola: '🔗 Havola',
    miniapp: '🧠 Testni ochish (mini app)',
    video: '▶️ Unga tavsiya qilingan video',
    avtomat: '⚡ Avtomatni ishga tushirish'
  };

  async function sinovIdSora() {
    return new Promise((resolve) => {
      let saqlandi = false;
      const inp = h('input', { class: 'input', inputmode: 'numeric', placeholder: 'masalan: 123456789', value: (MAL && MAL.sinovId) || '' });
      const xato = h('p', { class: 'err' });
      const m = modal('Sinov uchun Telegram ID',
        h('p', { class: 'tasdiq__matn', text: 'Sinov xabari sizning Telegram\'ingizga keladi. ID raqamingizni bilish uchun botga /id deb yozing — bot raqamni yuboradi.' }),
        inp, xato,
        h('div', { class: 'modal__amallar' },
          h('button', { class: 'btn', type: 'button', text: 'Bekor qilish', onclick: () => m.yop() }),
          h('button', {
            class: 'btn btn--primary btn--avto', type: 'button', text: 'Saqlash',
            onclick: async () => {
              const d = await post('/api/admin/sinov-id', { tgId: inp.value });
              if (!d.ok) { xato.textContent = d.error; return; }
              MAL.sinovId = d.sinovId;
              saqlandi = !!d.sinovId;
              m.yop();
            }
          })));
      m.onYop = () => resolve(saqlandi);
      setTimeout(() => inp.focus(), 50);
    });
  }

  function xabarMuharriri(boshlangich, opts) {
    opts = opts || {};
    const fk = !!opts.faqatKorish;
    const dis = fk || null;
    const x = JSON.parse(JSON.stringify(boshlangich || {}));
    x.matn = x.matn || '';
    x.tugmalar = Array.isArray(x.tugmalar) ? x.tugmalar : [];
    let mediaObj = x.media && x.media.id ? (MEDIA.find((m) => m.id === x.media.id) || { id: x.media.id, nom: 'fayl topilmadi' }) : null;

    const matnMaydon = h('textarea', {
      class: 'input xm__matn', rows: '7', placeholder: 'Xabar matni...', text: x.matn, disabled: dis,
      oninput: () => yangila()
    });
    const hisob = h('span', { class: 'xm__hisob' });

    function orab(boshi, oxiri, namuna) {
      const s = matnMaydon.selectionStart;
      const e = matnMaydon.selectionEnd;
      const v = matnMaydon.value;
      const tanlangan = v.slice(s, e) || namuna || '';
      matnMaydon.value = v.slice(0, s) + boshi + tanlangan + oxiri + v.slice(e);
      matnMaydon.focus();
      matnMaydon.setSelectionRange(s + boshi.length, s + boshi.length + tanlangan.length);
      yangila();
    }
    const asbob = (yozuv, title, fn, klass) => h('button', { class: 'xm__a' + (klass ? ' ' + klass : ''), type: 'button', title, text: yozuv, onclick: fn });

    const asboblar = fk ? null : h('div', { class: 'xm__asboblar' },
      asbob('B', 'Qalin', () => orab('**', '**', 'qalin matn'), 'xm__a--b'),
      asbob('I', 'Kursiv', () => orab('__', '__', 'kursiv'), 'xm__a--i'),
      asbob('S', 'Chizilgan', () => orab('~~', '~~', 'matn'), 'xm__a--s'),
      asbob('🔗', 'Havola qo\'shish', () => {
        const u = prompt('Havola manzili:', 'https://');
        if (u && /^https?:\/\/\S{3,}$/.test(u.trim())) orab('[', '](' + u.trim() + ')', 'havola matni');
      }),
      asbob('{ism}', 'Foydalanuvchi ismi', () => orab('{ism}', '', '')),
      asbob('{video}', 'Unga tavsiya qilingan video nomi', () => orab('{video}', '', '')));

    /* --- rasm / video --- */
    const mediaIdish = h('div', { class: 'xm__media' });
    function tanlaM() { mediaTanla({}, (m) => { mediaObj = m; mediaChizM(); yangila(); }); }
    function mediaChizM() {
      mediaIdish.innerHTML = '';
      if (mediaObj) {
        mediaIdish.appendChild(h('div', { class: 'xm__media-qator' },
          mediaObj.url ? mediaKorinish(mediaObj, 'xm__media-kichik') : h('span', { class: 'xm__media-kichik' }),
          h('span', { class: 'xm__media-nom', text: (mediaObj.tur === 'video' ? '🎬 ' : '🖼 ') + (mediaObj.nom || 'fayl') }),
          fk ? null : h('button', { class: 'mini', type: 'button', text: 'Almashtirish', onclick: tanlaM }),
          fk ? null : h('button', { class: 'mini mini--qizil', type: 'button', text: '✕', title: 'Olib tashlash', onclick: () => { mediaObj = null; mediaChizM(); yangila(); } })));
      } else if (!fk) {
        mediaIdish.appendChild(h('button', { class: 'btn btn--qosh btn--kichik', type: 'button', text: '🖼 Rasm yoki video qo\'shish', onclick: tanlaM }));
      } else {
        mediaIdish.appendChild(h('span', { class: 'muted', text: 'Yo\'q' }));
      }
    }

    /* --- tugmalar --- */
    const tugmaIdish = h('div', { class: 'xm__tugmalar' });
    function tugmalarChiz() {
      tugmaIdish.innerHTML = '';
      x.tugmalar.forEach((t, i) => {
        let qiymatEl;
        if (t.tur === 'havola') {
          qiymatEl = h('input', { class: 'input', value: t.qiymat || '', placeholder: 'https://...', disabled: dis, oninput: (e) => { t.qiymat = e.target.value; yangila(); } });
        } else if (t.tur === 'avtomat') {
          qiymatEl = h('select', { class: 'input', disabled: dis, onchange: (e) => { t.qiymat = e.target.value; } },
            h('option', { value: '', text: '— avtomatni tanlang —' }),
            ...(opts.avtomatlar ? opts.avtomatlar() : []).map((a) => h('option', { value: a.id, text: a.nom, selected: a.id === t.qiymat })));
        } else {
          qiymatEl = h('span', { class: 'xm__tugma-izoh', text: t.tur === 'miniapp' ? 'Bot ichida testni ochadi' : 'Har kimga o\'ziga tavsiya qilingan video havolasi' });
        }
        tugmaIdish.appendChild(h('div', { class: 'xm__tugma' },
          h('input', { class: 'input', value: t.matn || '', placeholder: 'Tugma yozuvi', maxlength: '64', disabled: dis, oninput: (e) => { t.matn = e.target.value; yangila(); } }),
          h('select', { class: 'input', disabled: dis, onchange: (e) => { t.tur = e.target.value; t.qiymat = ''; tugmalarChiz(); yangila(); } },
            ...Object.keys(TUGMA_TUR_NOM).map((k) => h('option', { value: k, text: TUGMA_TUR_NOM[k], selected: t.tur === k }))),
          qiymatEl,
          fk ? h('span') : h('button', { class: 'mini mini--qizil', type: 'button', text: '✕', title: 'Tugmani o\'chirish', onclick: () => { x.tugmalar.splice(i, 1); tugmalarChiz(); yangila(); } })));
      });
      if (!fk && x.tugmalar.length < 8) {
        tugmaIdish.appendChild(h('button', {
          class: 'btn btn--qosh btn--kichik', type: 'button', text: '+ Tugma qo\'shish',
          onclick: () => { x.tugmalar.push({ matn: '', tur: 'havola', qiymat: '' }); tugmalarChiz(); yangila(); }
        }));
      }
      if (fk && !x.tugmalar.length) tugmaIdish.appendChild(h('span', { class: 'muted', text: 'Yo\'q' }));
    }

    /* --- Telegram ko'rinishi --- */
    const oldindan = h('div', { class: 'tg-oldindan' });
    function yangila() {
      x.matn = matnMaydon.value;
      const uz = x.matn.replace(/\*\*|__|~~/g, '').length;
      const chegara = mediaObj ? 1024 : 4000;
      hisob.textContent = uz + ' / ' + chegara + (mediaObj ? ' (rasm yozuvi)' : '');
      hisob.classList.toggle('xm__hisob--ogoh', uz > chegara);

      oldindan.innerHTML = '';
      const pufak = h('div', { class: 'tg-pufak' });
      if (mediaObj && mediaObj.url) pufak.appendChild(mediaKorinish(mediaObj, 'tg-pufak__media'));
      if (x.matn.trim()) {
        const matnEl = h('div', { class: 'tg-pufak__matn' });
        matnEl.innerHTML = matnHtml(x.matn, { ism: 'Aziz', video: (MAL && MAL.videolar[0] ? MAL.videolar[0].nom : 'Video nomi') }).replace(/\n/g, '<br>');
        pufak.appendChild(matnEl);
      } else if (!mediaObj) {
        pufak.appendChild(h('div', { class: 'tg-pufak__matn muted', text: 'Xabar matni shu yerda ko\'rinadi' }));
      }
      oldindan.appendChild(pufak);
      const tugmalar = x.tugmalar.filter((t) => t.matn);
      if (tugmalar.length) oldindan.appendChild(h('div', { class: 'tg-tugmalar' }, ...tugmalar.map((t) => h('div', { class: 'tg-tugma', text: t.matn }))));
      if (mediaObj && uz > 1024) oldindan.appendChild(h('p', { class: 'muted', text: 'Matn 1024 belgidan uzun — rasm va matn ikkita alohida xabar bo\'lib ketadi.' }));
    }

    function qiymat() {
      return {
        matn: matnMaydon.value,
        media: mediaObj ? { id: mediaObj.id } : null,
        tugmalar: x.tugmalar.map((t) => ({ matn: t.matn || '', tur: t.tur, qiymat: t.qiymat || '' }))
      };
    }

    const sinovTugma = fk ? null : h('button', {
      class: 'btn btn--kichik', type: 'button', text: '📨 O\'zimga sinov yuborish',
      onclick: async (e) => {
        const tugma = e.currentTarget;
        await malumot();
        if (!MAL.sinovId && !(await sinovIdSora())) return;
        tugma.disabled = true;
        tugma.textContent = 'Yuborilmoqda...';
        try {
          const d = await post('/api/admin/sinov-yubor', { xabar: qiymat() });
          if (d.ok) bildirish('✓ Sinov xabari Telegram\'ingizga yuborildi', 'ok');
          else bildirish(d.error || 'Yuborilmadi', 'err');
        } finally {
          tugma.disabled = false;
          tugma.textContent = '📨 O\'zimga sinov yuborish';
        }
      }
    });

    const el = h('div', { class: 'xm' },
      h('div', { class: 'xm__chap' },
        h('div', { class: 'qator__label', text: 'Rasm yoki video' }), mediaIdish,
        h('div', { class: 'xm__matn-bosh' }, h('span', { class: 'qator__label', text: 'Matn' }), hisob),
        asboblar, matnMaydon,
        fk ? null : h('p', { class: 'xm__yordam', text: '**qalin**   __kursiv__   ~~chizilgan~~   [matn](https://...)   {ism}   {video}' }),
        h('div', { class: 'qator__label', text: 'Tugmalar' }), tugmaIdish,
        sinovTugma ? h('div', { class: 'xm__pastki' }, sinovTugma) : null),
      h('div', { class: 'xm__ong' },
        h('div', { class: 'qator__label', text: 'Telegram\'da shunday ko\'rinadi' }),
        oldindan));

    mediaChizM();
    tugmalarChiz();
    yangila();
    return { el, qiymat };
  }

  /* ============================================================
     SHARTLAR (segment) MUHARRIRI
     ============================================================ */
  function shartlarMuharriri(boshlangich, opts) {
    opts = opts || {};
    const fk = !!opts.faqatKorish;
    const dis = fk || null;
    const shartlar = JSON.parse(JSON.stringify(boshlangich || []));
    const idish = h('div', { class: 'shartlar-m' });
    const soniEl = h('div', { class: 'segment-soni' });
    let taymer = null;
    let oxirgiSoni = 0;

    function qiymatBoshqaruv(sh) {
      const tanlov = (royxat, kalit, nomFn) => h('select', { class: 'input', disabled: dis, onchange: (e) => { sh.qiymat = e.target.value; ozgardi(); } },
        h('option', { value: '', text: '— tanlang —' }),
        ...royxat.map((r) => h('option', { value: r[kalit], text: nomFn(r), selected: r[kalit] === sh.qiymat })));
      if (sh.tur === 'bosqich') return tanlov(MAL.bosqichlar, 'kod', (r) => r.nom);
      if (sh.tur === 'video') return tanlov(MAL.videolar, 'id', (r) => r.id.toUpperCase() + ' — ' + r.nom);
      if (sh.tur === 'daraja') return tanlov(MAL.darajalar, 'kod', (r) => r.nom);

      const tegmi = sh.tur === 'teg_bor' || sh.tur === 'teg_yoq';
      const royxatId = 'dl-' + Math.random().toString(36).slice(2, 9);
      const inp = h('input', {
        class: 'input', value: sh.qiymat || '', disabled: dis, list: tegmi ? royxatId : null,
        placeholder: tegmi ? 'teg nomi' : 'masalan: reklama1',
        oninput: (e) => { sh.qiymat = e.target.value.trim(); ozgardi(); }
      });
      if (!tegmi) return inp;
      return h('span', { class: 'shart-m__teg' }, inp, h('datalist', { id: royxatId }, ...MAL.teglar.map((t) => h('option', { value: t.teg }))));
    }

    function chiz() {
      idish.innerHTML = '';
      if (!shartlar.length) idish.appendChild(h('p', { class: 'muted shartlar-m__bosh', text: opts.boshMatn || 'Shart yo\'q — botni bloklamagan barcha obunachilar' }));
      shartlar.forEach((sh, i) => {
        idish.appendChild(h('div', { class: 'shart-m' },
          h('span', { class: 'shart-m__va', text: i ? 'VA' : 'AGAR' }),
          h('select', { class: 'input', disabled: dis, onchange: (e) => { sh.tur = e.target.value; sh.qiymat = ''; chiz(); ozgardi(); } },
            ...MAL.shartTurlari.map((t) => h('option', { value: t.kod, text: t.nom, selected: t.kod === sh.tur }))),
          qiymatBoshqaruv(sh),
          fk ? h('span') : h('button', { class: 'mini mini--qizil', type: 'button', text: '✕', title: 'Shartni o\'chirish', onclick: () => { shartlar.splice(i, 1); chiz(); ozgardi(); } })));
      });
      if (!fk && shartlar.length < 10) {
        idish.appendChild(h('button', { class: 'btn btn--qosh btn--kichik', type: 'button', text: '+ Shart qo\'shish', onclick: () => { shartlar.push({ tur: 'bosqich', qiymat: '' }); chiz(); } }));
      }
      if (opts.soniKorsat) idish.appendChild(soniEl);
    }

    function ozgardi() {
      if (!opts.soniKorsat) return;
      clearTimeout(taymer);
      soniEl.textContent = '👥 hisoblanmoqda...';
      taymer = setTimeout(async () => {
        const d = await post('/api/admin/segment', { shartlar: qiymat() });
        oxirgiSoni = d.ok ? d.soni : 0;
        soniEl.textContent = d.ok ? '👥 Hozir ' + d.soni + ' ta odamga yetib boradi' : (d.error || '');
      }, 350);
    }

    function qiymat() { return shartlar.filter((s) => String(s.qiymat || '') !== ''); }

    chiz();
    ozgardi();
    return { el: idish, qiymat, soni: () => oxirgiSoni };
  }

  function botOgohlantirish() {
    if (MAL.bot && MAL.bot.yoqilgan) return null;
    return h('div', {
      class: 'eslatma eslatma--ogoh',
      text: MAL.botSozlangan
        ? 'Bot hozir bu serverda ishlamayapti (SAYT_URL sozlanmagan) — avtomatik xabarlar yuborilmaydi.'
        : 'Bot tokeni sozlanmagan — xabarlar yuborilmaydi.'
    });
  }

  /* ============================================================
     VORONKA
     ============================================================ */
  let VSOZ = null;
  let TAHRIR = null;

  const QADAM_NOM = {
    xabar: ['💬', 'Xabar'],
    kutish: ['⏱', 'Kutish'],
    shart: ['🔀', 'Shart'],
    teg: ['🏷', 'Teg'],
    avtomat: ['⚡', 'Boshqa avtomat']
  };
  const HODISA_NOM = {
    start: '/start bosdi',
    miniapp_ochdi: 'mini app\'ni ochdi',
    test_boshladi: 'testni boshladi',
    test_tugatdi: 'testni tugatdi',
    video_bosdi: '"Bepul videoni ko\'rish"ni bosdi'
  };

  async function voronkaSahifa() {
    if (TAHRIR) return;
    const ildiz = $('voronka-ildiz');
    ildiz.innerHTML = '';
    ildiz.appendChild(yuklanmoqda());
    await Promise.all([malumot(true), mediaYukla()]);
    const d = await api('/api/admin/avtomatlar');
    if (!d.ok) return;
    AVTOMATLAR = d.avtomatlar;
    VSOZ = d.sozlama;
    if (!TAHRIR) voronkaRoyxatChiz();
  }

  function voronkaRoyxatChiz() {
    const ildiz = $('voronka-ildiz');
    const bosh = boshmi();
    ildiz.innerHTML = '';

    ildiz.appendChild(h('div', { class: 'head' },
      h('div', null,
        h('h2', { text: 'Voronka — avtomatik xabarlar' }),
        h('p', { class: 'muted', text: 'Odam biror ish qilganda (/start bosdi, testni boshladi, tugatdi, videoni bosdi) avtomatik ishga tushadigan xabarlar zanjiri. ' +
          'Har bir avtomat — boshlanish sharti va ketma-ket qadamlar: xabar, kutish, shart, teg.' })),
      bosh ? h('button', { class: 'btn btn--primary btn--avto', type: 'button', text: '+ Yangi avtomat', onclick: () => tahrirOch(null) }) : null));

    const ogoh = botOgohlantirish();
    if (ogoh) ildiz.appendChild(ogoh);
    if (!bosh) ildiz.appendChild(h('div', { class: 'eslatma', text: 'Voronkani faqat bosh admin o\'zgartira oladi. Siz ko\'rishingiz mumkin.' }));

    ildiz.appendChild(tinchVaqtKarta());

    if (!AVTOMATLAR.length) {
      ildiz.appendChild(h('div', { class: 'bosh-holat' },
        h('div', { class: 'bosh-holat__belgi', text: '⚡' }),
        h('p', { text: 'Hali avtomat yo\'q.' })));
    }
    AVTOMATLAR.forEach((a) => ildiz.appendChild(avtomatKarta(a)));
  }

  function tinchVaqtKarta() {
    const t = VSOZ.tinch;
    const dis = !boshmi() || null;
    const yoq = h('input', { type: 'checkbox', checked: t.yoqilgan, disabled: dis });
    const dan = h('input', { class: 'input input--vaqt', type: 'time', value: t.dan, disabled: dis });
    const gacha = h('input', { class: 'input input--vaqt', type: 'time', value: t.gacha, disabled: dis });
    return h('div', { class: 'karta tinch' },
      h('div', { class: 'tinch__qator' },
        h('label', { class: 'checkbox' }, yoq, ' 🌙 Tinch vaqt — avtomatik xabarlar faqat shu oraliqda yuborilsin'),
        h('div', { class: 'tinch__vaqt' }, dan, h('span', { text: '—' }), gacha, h('span', { class: 'muted', text: 'Toshkent' }),
          dis ? null : h('button', {
            class: 'btn btn--kichik', type: 'button', text: 'Saqlash',
            onclick: async () => {
              const d = await post('/api/admin/voronka-sozlama', { tinch: { yoqilgan: yoq.checked, dan: dan.value, gacha: gacha.value } });
              if (!d.ok) return bildirish(d.error, 'err');
              VSOZ = d.sozlama;
              bildirish('✓ Tinch vaqt saqlandi', 'ok');
            }
          }))),
      h('p', { class: 'muted', text: 'Oraliqdan tashqarida vaqti kelgan xabarlar keyingi kuni boshlanish vaqtida yuboriladi. Ommaviy xabarlarga ta\'sir qilmaydi.' }));
  }

  function avtomatKarta(a) {
    const bosh = boshmi();
    const s = a.stat || { qadamlar: {} };
    const trig = (MAL.triggerlar.find((t) => t.kod === a.trigger.tur) || {}).nom || a.trigger.tur;
    const qStat = Object.values(s.qadamlar || {});
    const yuborildi = qStat.reduce((x, q) => x + (q.yuborildi || 0), 0);
    const bosildi = qStat.reduce((x, q) => x + (q.bosildi || 0), 0);
    const xabarSoni = a.qadamlar.filter((q) => q.tur === 'xabar').length;

    const kalit = h('label', { class: 'kalit', title: bosh ? (a.faol ? 'O\'chirish' : 'Yoqish') : '' },
      h('input', {
        type: 'checkbox', checked: a.faol, disabled: bosh ? null : true,
        onchange: async (e) => {
          const faol = e.target.checked;
          if (!faol && s.faol && !(await tasdiqla('Avtomatni o\'chirish', 'Hozir zanjirda ' + s.faol + ' ta odam bor. O\'chirilsa, ular uchun zanjir to\'xtaydi.', 'O\'chirish', true))) {
            e.target.checked = true;
            return;
          }
          const d = await post('/api/admin/avtomat/holat', { id: a.id, faol });
          if (!d.ok) { e.target.checked = !faol; return bildirish(d.error, 'err'); }
          bildirish(faol ? '✓ Avtomat yoqildi — endi ishlaydi' : 'Avtomat o\'chirildi', 'ok');
          voronkaSahifa();
        }
      }),
      h('span', { class: 'kalit__yol' }));

    return h('div', { class: 'karta avtomat' + (a.faol ? ' avtomat--faol' : '') },
      h('div', { class: 'avtomat__bosh' },
        kalit,
        h('div', { class: 'avtomat__nom' },
          h('b', { text: a.nom }),
          h('span', { class: 'avtomat__trig', text: '▶ ' + trig + (a.trigger.qiymat ? ': ' + a.trigger.qiymat : '') + '  ·  ' + a.qadamlar.length + ' qadam, ' + xabarSoni + ' xabar' })),
        h('span', { class: 'holat-nishon holat-nishon--' + (a.faol ? 'yashil' : 'kulrang'), text: a.faol ? 'Yoqilgan' : 'O\'chiq' })),
      h('div', { class: 'chiplar' },
        chip('kirgan', s.jami), chip('hozir zanjirda', s.faol, s.faol ? 'chip--kok' : ''), chip('oxirigacha yetgan', s.tugadi),
        chip('to\'xtatilgan', s.toxtatildi), chip('bloklagan', s.bloklagan),
        chip('xabar yuborilgan', yuborildi), chip('tugma bosilgan', bosildi)),
      h('div', { class: 'avtomat__amallar' },
        h('button', { class: 'btn btn--kichik', type: 'button', text: bosh ? '✏️ Tahrirlash' : '👁 Ko\'rish', onclick: () => tahrirOch(a) }),
        bosh ? h('button', { class: 'btn btn--kichik', type: 'button', text: '👥 Qo\'lda ishga tushirish', onclick: () => qoldaOch(a) }) : null,
        bosh ? h('button', {
          class: 'btn btn--kichik btn--xavf', type: 'button', text: 'O\'chirib tashlash',
          onclick: async () => {
            if (!(await tasdiqla('Avtomatni o\'chirib tashlash', '"' + a.nom + '" va uning butun statistikasi o\'chiriladi. Buni qaytarib bo\'lmaydi.', 'O\'chirib tashlash', true))) return;
            const d = await post('/api/admin/avtomat/ochir', { id: a.id });
            if (!d.ok) return bildirish(d.error, 'err');
            bildirish('Avtomat o\'chirildi', 'ok');
            voronkaSahifa();
          }
        }) : null));
  }

  async function qoldaOch(a) {
    if (!a.faol) return bildirish('Avval avtomatni yoqing', 'err');
    const d = await post('/api/admin/segment', { shartlar: a.shartlar });
    const soni = d.ok ? d.soni : 0;
    const matn = 'Kirish shartlariga mos ' + soni + ' ta obunachi uchun "' + a.nom + '" hozir boshlanadi.' +
      (a.qayta ? '' : ' Oldin shu zanjirga kirganlar o\'tkazib yuboriladi ("qayta kirish" o\'chiq).') +
      ' Zanjirdagi birinchi xabar kutishsiz bo\'lsa, darhol yuboriladi.';
    if (!(await tasdiqla('Qo\'lda ishga tushirish', matn, 'Ishga tushirish'))) return;
    const r = await post('/api/admin/avtomat/qolda', { id: a.id });
    if (!r.ok) return bildirish(r.error, 'err');
    bildirish('✓ ' + r.soni + ' ta odam zanjirga qo\'shildi', 'ok');
    voronkaSahifa();
  }

  function yangiQadam(tur) {
    const q = { tur };
    if (tur === 'xabar') q.xabar = { matn: '', tugmalar: [] };
    if (tur === 'kutish') Object.assign(q, { miqdor: 1, birlik: 'soat' });
    if (tur === 'shart') Object.assign(q, { shartlar: [{ tur: 'bosqich', qiymat: '' }], mos: 'davom', mosEmas: 'toxtat' });
    if (tur === 'teg') Object.assign(q, { amal: 'qosh', teg: '' });
    if (tur === 'avtomat') q.avtomatId = '';
    return q;
  }

  function tahrirOch(a) {
    TAHRIR = {
      a: a ? JSON.parse(JSON.stringify(a)) : {
        id: '', nom: '', faol: false, trigger: { tur: 'start', qiymat: '' }, shartlar: [], toxtatish: [], qayta: false,
        qadamlar: [yangiQadam('kutish'), yangiQadam('xabar')], stat: { qadamlar: {} }
      }
    };
    tahrirChiz();
    window.scrollTo(0, 0);
  }

  function tahrirYop() {
    TAHRIR = null;
    voronkaSahifa();
  }

  function qadamKomponent(q, i, a, fk, amal) {
    const dis = fk || null;
    const [belgi, nom] = QADAM_NOM[q.tur] || ['•', q.tur];
    const st = (a.stat && a.stat.qadamlar && a.stat.qadamlar[q.id]) || null;
    let ich;
    let qiymat;

    if (q.tur === 'xabar') {
      const m = xabarMuharriri(q.xabar, { faqatKorish: fk, avtomatlar: () => AVTOMATLAR });
      ich = m.el;
      qiymat = () => ({ id: q.id, tur: 'xabar', xabar: m.qiymat() });
    } else if (q.tur === 'kutish') {
      const miqdor = h('input', { class: 'input input--son', type: 'number', min: '1', max: '999', value: q.miqdor || 1, disabled: dis });
      const birlik = h('select', { class: 'input input--birlik', disabled: dis },
        ...[['daqiqa', 'daqiqa'], ['soat', 'soat'], ['kun', 'kun']].map(([k, n]) => h('option', { value: k, text: n, selected: q.birlik === k })));
      ich = h('div', { class: 'kutish' }, h('span', { text: 'Keyingi qadamgacha' }), miqdor, birlik, h('span', { text: 'kutiladi' }));
      qiymat = () => ({ id: q.id, tur: 'kutish', miqdor: Number(miqdor.value), birlik: birlik.value });
    } else if (q.tur === 'shart') {
      const sh = shartlarMuharriri(q.shartlar, { faqatKorish: fk, boshMatn: 'Kamida bitta shart qo\'shing' });
      const amalTanlov = (v) => h('select', { class: 'input', disabled: dis },
        h('option', { value: 'davom', text: 'keyingi qadamga o\'tsin', selected: v === 'davom' }),
        h('option', { value: 'toxtat', text: 'zanjir to\'xtasin', selected: v === 'toxtat' }));
      const mos = amalTanlov(q.mos || 'davom');
      const mosEmas = amalTanlov(q.mosEmas || 'toxtat');
      ich = h('div', null, sh.el,
        h('div', { class: 'qatorlar shart-natija' }, XT.qatorBlok('✅ Mos kelsa', mos), XT.qatorBlok('❌ Mos kelmasa', mosEmas)));
      qiymat = () => ({ id: q.id, tur: 'shart', shartlar: sh.qiymat(), mos: mos.value, mosEmas: mosEmas.value });
    } else if (q.tur === 'teg') {
      const amalEl = h('select', { class: 'input', disabled: dis },
        h('option', { value: 'qosh', text: 'Teg qo\'shish', selected: q.amal !== 'olib' }),
        h('option', { value: 'olib', text: 'Tegni olib tashlash', selected: q.amal === 'olib' }));
      const royxatId = 'dl-teg-' + i;
      const teg = h('input', { class: 'input', value: q.teg || '', placeholder: 'masalan: bot_start', maxlength: '40', disabled: dis, list: royxatId });
      ich = h('div', { class: 'qatorlar' }, XT.qatorBlok('Amal', amalEl),
        XT.qatorBlok('Teg nomi', h('span', null, teg, h('datalist', { id: royxatId }, ...MAL.teglar.map((t) => h('option', { value: t.teg }))))));
      qiymat = () => ({ id: q.id, tur: 'teg', amal: amalEl.value, teg: teg.value.trim() });
    } else {
      const sel = h('select', { class: 'input', disabled: dis },
        h('option', { value: '', text: '— avtomatni tanlang —' }),
        ...AVTOMATLAR.filter((x) => x.id !== a.id).map((x) => h('option', { value: x.id, text: x.nom, selected: x.id === q.avtomatId })));
      ich = h('div', null, XT.qatorBlok('Qaysi avtomat ishga tushsin', sel),
        h('p', { class: 'muted', text: 'Tanlangan avtomat shu odam uchun darhol boshlanadi, joriy zanjir esa keyingi qadamdan davom etadi.' }));
      qiymat = () => ({ id: q.id, tur: 'avtomat', avtomatId: sel.value });
    }

    let statEl = null;
    if (st && (st.kirdi || st.kutmoqda)) {
      const ctr = st.yuborildi ? ' (' + Math.round((st.bosildi / st.yuborildi) * 100) + '%)' : '';
      statEl = h('div', { class: 'tugun__stat' },
        chip('kirdi', st.kirdi),
        q.tur === 'xabar' ? chip('yuborildi', st.yuborildi) : null,
        q.tur === 'xabar' && st.xato ? chip('xato', st.xato, 'chip--qizil') : null,
        q.tur === 'xabar' ? chip('bosdi' + ctr, st.bosildi) : null,
        st.kutmoqda ? chip('hozir shu yerda', st.kutmoqda, 'chip--kok') : null);
    }

    const el = h('div', { class: 'tugun tugun--' + q.tur },
      h('div', { class: 'tugun__bosh' },
        h('span', { class: 'tugun__belgi', text: belgi }),
        h('b', { class: 'tugun__nom', text: (i + 1) + '. ' + nom }),
        statEl,
        fk ? null : h('div', { class: 'amallar tugun__amallar' },
          h('button', { class: 'mini', type: 'button', text: '↑', title: 'Yuqoriga', disabled: i === 0 || null, onclick: amal.yuqori }),
          h('button', { class: 'mini', type: 'button', text: '↓', title: 'Pastga', disabled: amal.oxirgi || null, onclick: amal.past }),
          h('button', { class: 'mini mini--qizil', type: 'button', text: '✕', title: 'Qadamni o\'chirish', onclick: amal.ochir }))),
      h('div', { class: 'tugun__ich' }, ich));
    return { el, qiymat };
  }

  function tahrirChiz() {
    const ildiz = $('voronka-ildiz');
    const a = TAHRIR.a;
    const bosh = boshmi();
    const fk = !bosh;
    const dis = fk || null;
    const skrol = window.scrollY;
    ildiz.innerHTML = '';
    const komponentlar = [];

    const nomEl = h('input', { class: 'input', value: a.nom, maxlength: '80', disabled: dis, placeholder: 'Masalan: Testni boshlamaganlar uchun eslatma' });
    const trigQiymatEl = h('input', { class: 'input', value: a.trigger.qiymat || '', placeholder: 'teg nomi', maxlength: '40', disabled: dis });
    const trigQiymatQator = XT.qatorBlok('Qaysi teg qo\'shilganda', trigQiymatEl);
    trigQiymatQator.hidden = a.trigger.tur !== 'teg_qoshildi';
    const trigEl = h('select', {
      class: 'input', disabled: dis,
      onchange: () => { trigQiymatQator.hidden = trigEl.value !== 'teg_qoshildi'; }
    }, ...MAL.triggerlar.map((t) => h('option', { value: t.kod, text: t.nom, selected: t.kod === a.trigger.tur })));
    const kirish = shartlarMuharriri(a.shartlar, { faqatKorish: fk, boshMatn: 'Shart yo\'q — boshlanish hodisasi yuz bergan har bir odam kiradi' });
    const qaytaEl = h('input', { type: 'checkbox', checked: a.qayta, disabled: dis });
    const toxtatishEl = h('div', { class: 'belgilar' },
      ...MAL.toxtatishHodisalari.map((k) => h('label', { class: 'checkbox' },
        h('input', { type: 'checkbox', value: k, checked: a.toxtatish.includes(k), disabled: dis }), ' ' + HODISA_NOM[k])));

    function yig() {
      a.nom = nomEl.value;
      a.trigger = { tur: trigEl.value, qiymat: trigQiymatEl.value.trim() };
      a.shartlar = kirish.qiymat();
      a.qayta = qaytaEl.checked;
      a.toxtatish = [...toxtatishEl.querySelectorAll('input:checked')].map((x) => x.value);
      a.qadamlar = komponentlar.map((k) => k.qiymat());
    }

    ildiz.appendChild(h('div', { class: 'head head--tahrir' },
      h('div', null,
        h('button', {
          class: 'orqaga-tugma', type: 'button', text: '← Barcha avtomatlar',
          onclick: async () => {
            if (bosh && !(await tasdiqla('Chiqish', 'Saqlanmagan o\'zgarishlar yo\'qoladi. Chiqasizmi?', 'Chiqish'))) return;
            tahrirYop();
          }
        }),
        h('h2', { text: a.id ? a.nom : 'Yangi avtomat' }),
        a.id ? h('p', { class: 'muted', text: a.faol ? '🟢 Yoqilgan — saqlangan o\'zgarishlar darrov kuchga kiradi' : '⚪ O\'chiq — ishlashi uchun ro\'yxatda yoqing' }) : null)));

    ildiz.appendChild(h('div', { class: 'karta' },
      h('div', { class: 'karta__sarlavha', text: 'Asosiy sozlamalar' }),
      XT.qatorBlok('Nomi (faqat panel uchun)', nomEl),
      h('div', { class: 'qatorlar' }, XT.qatorBlok('▶ Qachon boshlanadi', trigEl), trigQiymatQator),
      h('div', { class: 'qator' }, h('label', { class: 'qator__label', text: 'Kirish shartlari (ixtiyoriy) — faqat shu shartlarga mos odamlar kiradi' }), kirish.el),
      h('div', { class: 'qator' }, h('label', { class: 'qator__label', text: '⛔ Zanjir darhol to\'xtaydi, agar odam:' }), toxtatishEl),
      h('label', { class: 'checkbox' }, qaytaEl, ' Qayta kirishga ruxsat — hodisa takrorlansa (masalan yana /start bossa) zanjir yana boshlanadi')));

    const oqim = h('div', { class: 'oqim' });
    const trigNom = (MAL.triggerlar.find((t) => t.kod === a.trigger.tur) || {}).nom || '';
    oqim.appendChild(h('div', { class: 'tugun tugun--start' },
      h('div', { class: 'tugun__bosh' }, h('span', { class: 'tugun__belgi', text: '▶' }), h('b', { text: 'Boshlanish: ' + trigNom }))));

    const qoshMenyu = (indeks) => h('div', { class: 'oqim__ulagich' + (fk ? '' : ' oqim__ulagich--qosh') },
      fk ? null : h('div', { class: 'qosh-menyu' },
        h('span', { class: 'qosh-menyu__plus', text: '+' }),
        ...Object.keys(QADAM_NOM).map((tur) => h('button', {
          class: 'qosh-menyu__t', type: 'button', title: QADAM_NOM[tur][1] + ' qadamini shu yerga qo\'shish',
          text: QADAM_NOM[tur][0] + ' ' + QADAM_NOM[tur][1],
          onclick: () => { yig(); a.qadamlar.splice(indeks, 0, yangiQadam(tur)); tahrirChiz(); }
        }))));

    a.qadamlar.forEach((q, i) => {
      oqim.appendChild(qoshMenyu(i));
      const k = qadamKomponent(q, i, a, fk, {
        oxirgi: i === a.qadamlar.length - 1,
        yuqori: () => { yig(); if (i > 0) { const [x] = a.qadamlar.splice(i, 1); a.qadamlar.splice(i - 1, 0, x); } tahrirChiz(); },
        past: () => { yig(); if (i < a.qadamlar.length - 1) { const [x] = a.qadamlar.splice(i, 1); a.qadamlar.splice(i + 1, 0, x); } tahrirChiz(); },
        ochir: async () => {
          if (!(await tasdiqla('Qadamni o\'chirish', (i + 1) + '-qadam (' + QADAM_NOM[q.tur][1] + ') o\'chirilsinmi?', 'O\'chirish', true))) return;
          yig();
          a.qadamlar.splice(i, 1);
          tahrirChiz();
        }
      });
      komponentlar.push(k);
      oqim.appendChild(k.el);
    });
    oqim.appendChild(qoshMenyu(a.qadamlar.length));
    oqim.appendChild(h('div', { class: 'tugun tugun--oxir' },
      h('div', { class: 'tugun__bosh' }, h('span', { class: 'tugun__belgi', text: '■' }), h('b', { text: 'Zanjir tugadi' }))));

    ildiz.appendChild(h('h3', { class: 'bolim', text: 'Qadamlar' }));
    ildiz.appendChild(oqim);

    if (bosh) {
      const holatEl = h('span', { class: 'saqlash__holat' });
      ildiz.appendChild(h('div', { class: 'saqlash' },
        h('button', {
          class: 'btn btn--primary', type: 'button', text: 'SAQLASH',
          onclick: async (e) => {
            yig();
            const tugma = e.currentTarget;
            tugma.disabled = true;
            holatEl.className = 'saqlash__holat';
            holatEl.textContent = 'Saqlanmoqda...';
            try {
              const d = await post('/api/admin/avtomat', {
                id: a.id || undefined, nom: a.nom, trigger: a.trigger, shartlar: a.shartlar,
                toxtatish: a.toxtatish, qayta: a.qayta, qadamlar: a.qadamlar
              });
              if (!d.ok) {
                holatEl.className = 'saqlash__holat saqlash__holat--err';
                holatEl.textContent = d.error || 'Saqlanmadi';
                return;
              }
              const idx = AVTOMATLAR.findIndex((x) => x.id === d.avtomat.id);
              if (idx >= 0) AVTOMATLAR[idx] = d.avtomat; else AVTOMATLAR.push(d.avtomat);
              TAHRIR.a = d.avtomat;
              tahrirChiz();
              bildirish(d.avtomat.faol ? '✓ Saqlandi — o\'zgarishlar darrov kuchga kirdi' : '✓ Saqlandi. Ishlashi uchun ro\'yxatda avtomatni yoqing', 'ok');
            } finally {
              tugma.disabled = false;
            }
          }
        }),
        holatEl));
    }
    window.scrollTo(0, skrol);
  }

  /* ============================================================
     OMMAVIY XABAR
     ============================================================ */
  let TARQATMALAR = [];
  let TT = null;
  let yangilashTaymer = null;

  const HOLAT_NOM = {
    qoralama: ['Qoralama', 'kulrang'],
    rejalashtirilgan: ['Rejalashtirilgan', 'sariq'],
    yuborilmoqda: ['Yuborilmoqda', 'kok'],
    pauza: ['To\'xtatib turilgan', 'sariq'],
    tugadi: ['Yuborildi', 'yashil'],
    bekor: ['Bekor qilingan', 'qizil']
  };

  async function tarqatmaSahifa(jim) {
    if (TT) return;
    const ildiz = $('tarqatma-ildiz');
    if (!jim) {
      ildiz.innerHTML = '';
      ildiz.appendChild(yuklanmoqda());
      await Promise.all([malumot(true), mediaYukla()]);
      const av = await api('/api/admin/avtomatlar');
      if (av.ok) AVTOMATLAR = av.avtomatlar;
    }
    const d = await api('/api/admin/tarqatmalar');
    if (!d.ok || TT) return;
    TARQATMALAR = d.tarqatmalar;
    tarqatmaRoyxatChiz();

    clearTimeout(yangilashTaymer);
    if (TARQATMALAR.some((t) => t.holat === 'yuborilmoqda') && $('pane-tarqatma').classList.contains('tabpane--active')) {
      yangilashTaymer = setTimeout(() => tarqatmaSahifa(true), 3000);
    }
  }

  function sinovIdKarta() {
    const inp = h('input', { class: 'input', value: MAL.sinovId || '', placeholder: 'masalan: 123456789', inputmode: 'numeric' });
    return h('div', { class: 'karta sinov-id' },
      h('div', { class: 'sinov-id__qator' },
        h('label', { class: 'qator__label', text: '📨 Sinov uchun Telegram ID (sizniki)' }),
        h('div', { class: 'sinov-id__kirit' }, inp,
          h('button', {
            class: 'btn btn--kichik', type: 'button', text: 'Saqlash',
            onclick: async () => {
              const d = await post('/api/admin/sinov-id', { tgId: inp.value });
              if (!d.ok) return bildirish(d.error, 'err');
              MAL.sinovId = d.sinovId;
              bildirish('✓ Saqlandi', 'ok');
            }
          }))),
      h('p', { class: 'muted', text: 'Hammaga yuborishdan oldin xabarni o\'zingizga sinab ko\'rish uchun. ID raqamingizni bilish uchun botga /id deb yozing.' }));
  }

  function tarqatmaRoyxatChiz() {
    const ildiz = $('tarqatma-ildiz');
    const bosh = boshmi();
    ildiz.innerHTML = '';

    ildiz.appendChild(h('div', { class: 'head' },
      h('div', null,
        h('h2', { text: 'Ommaviy xabar' }),
        h('p', { class: 'muted', text: 'Bot obunachilariga bir martalik xabar: hoziroq yoki belgilangan vaqtda. Auditoriyani shartlar bilan tanlaysiz — ' +
          'masalan faqat testni tugatib, videoni ko\'rmaganlarga.' })),
      bosh ? h('button', { class: 'btn btn--primary btn--avto', type: 'button', text: '+ Yangi xabar', onclick: () => tarqatmaTahrir(null) }) : null));

    const ogoh = botOgohlantirish();
    if (ogoh) ildiz.appendChild(ogoh);
    if (!bosh) ildiz.appendChild(h('div', { class: 'eslatma', text: 'Ommaviy xabarni faqat bosh admin yubora oladi.' }));
    ildiz.appendChild(sinovIdKarta());

    if (!TARQATMALAR.length) {
      ildiz.appendChild(h('div', { class: 'bosh-holat' },
        h('div', { class: 'bosh-holat__belgi', text: '📣' }),
        h('p', { text: 'Hali ommaviy xabar yuborilmagan.' })));
    }
    TARQATMALAR.forEach((t) => ildiz.appendChild(tarqatmaKarta(t)));
  }

  function tarqatmaKarta(t) {
    const [hNom, hRang] = HOLAT_NOM[t.holat] || [t.holat, 'kulrang'];
    const bosh = boshmi();
    const otdi = t.yuborildi + t.xato + t.bloklagan;
    const foiz = t.jami ? Math.round((otdi / t.jami) * 100) : 0;
    const ctr = t.yuborildi ? Math.round((t.bosildi / t.yuborildi) * 100) : 0;
    const qisqa = (t.xabar.matn || '').replace(/\s+/g, ' ').trim();

    const tugma = (matn, fn, klass) => h('button', { class: 'btn btn--kichik' + (klass ? ' ' + klass : ''), type: 'button', text: matn, onclick: fn });
    const amal = async (nom, qoshimcha) => {
      const d = await post('/api/admin/tarqatma/amal', Object.assign({ id: t.id, amal: nom }, qoshimcha || {}));
      if (!d.ok) return bildirish(d.error, 'err');
      tarqatmaSahifa(true);
    };

    const amallar = [];
    if (bosh) {
      if (t.holat === 'qoralama' || t.holat === 'rejalashtirilgan') amallar.push(tugma('✏️ Tahrirlash / yuborish', () => tarqatmaTahrir(t)));
      if (t.holat === 'rejalashtirilgan') amallar.push(tugma('Rejani bekor qilish', () => amal('reja-olib')));
      if (t.holat === 'yuborilmoqda') amallar.push(tugma('⏸ To\'xtatib turish', () => amal('pauza')));
      if (t.holat === 'pauza') amallar.push(tugma('▶ Davom ettirish', () => amal('davom')));
      if (t.holat === 'yuborilmoqda' || t.holat === 'pauza') {
        amallar.push(tugma('Bekor qilish', async () => {
          if (await tasdiqla('Yuborishni bekor qilish', 'Qolgan ' + t.qolgan + ' ta odamga yuborilmaydi. Buni qaytarib bo\'lmaydi.', 'Bekor qilish', true)) amal('bekor');
        }, 'btn--xavf'));
      }
      if (t.holat === 'tugadi' || t.holat === 'bekor') {
        amallar.push(tugma('📄 Nusxa olish', () => tarqatmaTahrir({ nom: t.nom + ' (nusxa)', xabar: t.xabar, shartlar: t.shartlar })));
      }
      if (t.holat === 'qoralama' || t.holat === 'tugadi' || t.holat === 'bekor') {
        amallar.push(tugma('O\'chirish', async () => {
          if (await tasdiqla('O\'chirish', '"' + t.nom + '" ro\'yxatdan o\'chirilsinmi?', 'O\'chirish', true)) amal('ochir');
        }, 'btn--xavf'));
      }
    }

    return h('div', { class: 'karta tarqatma' },
      h('div', { class: 'avtomat__bosh' },
        h('div', { class: 'avtomat__nom' },
          h('b', { text: t.nom }),
          h('span', { class: 'avtomat__trig', text: (t.yaratgan ? t.yaratgan + ' · ' : '') + toshkentMatn(t.yaratilgan) })),
        h('span', { class: 'holat-nishon holat-nishon--' + hRang, text: hNom })),
      qisqa || t.xabar.media ? h('p', { class: 'tarqatma__matn', text: (t.xabar.media ? '🖼 ' : '') + qisqa.slice(0, 160) + (qisqa.length > 160 ? '…' : '') }) : null,
      t.holat === 'rejalashtirilgan' ? h('p', { class: 'tarqatma__reja', text: '🕒 ' + toshkentMatn(t.reja_vaqt) + ' (Toshkent) da yuboriladi · hozir ' + t.auditoriya + ' ta odamga yetib boradi' }) : null,
      t.holat === 'qoralama' ? h('p', { class: 'muted', text: '👥 Hozir ' + t.auditoriya + ' ta odamga yetib boradi' }) : null,
      t.jami ? h('div', { class: 'progress-a' },
        h('div', { class: 'progress-a__chiziq' }, h('i', { style: 'width:' + foiz + '%' })),
        h('span', { text: otdi + ' / ' + t.jami + ' (' + foiz + '%)' })) : null,
      t.boshlangan ? h('div', { class: 'chiplar' },
        chip('yuborildi', t.yuborildi, 'chip--yashil'), chip('xato', t.xato, t.xato ? 'chip--qizil' : ''),
        chip('botni bloklagan', t.bloklagan), chip('tugmani bosdi (' + ctr + '%)', t.bosildi)) : null,
      amallar.length ? h('div', { class: 'avtomat__amallar' }, ...amallar) : null);
  }

  function tarqatmaTahrir(t) {
    TT = t ? JSON.parse(JSON.stringify(t)) : {};
    clearTimeout(yangilashTaymer);
    const ildiz = $('tarqatma-ildiz');
    ildiz.innerHTML = '';
    window.scrollTo(0, 0);

    const nomEl = h('input', { class: 'input', value: TT.nom || '', maxlength: '80', placeholder: 'Masalan: Yangi videodars e\'loni' });
    const aud = shartlarMuharriri(TT.shartlar || [], { soniKorsat: true, boshMatn: 'Shart yo\'q — botni bloklamagan barcha obunachilarga' });
    const xm = xabarMuharriri(TT.xabar || { matn: '', tugmalar: [] }, { avtomatlar: () => AVTOMATLAR });

    const hozirR = h('input', { type: 'radio', name: 'tq-vaqt', checked: !TT.reja_vaqt });
    const rejaR = h('input', { type: 'radio', name: 'tq-vaqt', checked: !!TT.reja_vaqt });
    const vaqtEl = h('input', { class: 'input input--sana', type: 'datetime-local', value: toshkentInput(TT.reja_vaqt || Date.now() + 3600e3) });
    const yuborTugma = h('button', { class: 'btn btn--primary btn--avto', type: 'button' });
    const tugmaMatn = () => { yuborTugma.textContent = rejaR.checked ? '🕒 Rejalashtirish' : '📣 Hammaga yuborish'; vaqtEl.disabled = !rejaR.checked; };
    hozirR.addEventListener('change', tugmaMatn);
    rejaR.addEventListener('change', tugmaMatn);
    tugmaMatn();

    async function qoralamaSaqla() {
      const d = await post('/api/admin/tarqatma', { id: TT.id || undefined, nom: nomEl.value, xabar: xm.qiymat(), shartlar: aud.qiymat() });
      if (!d.ok) { bildirish(d.error || 'Saqlanmadi', 'err'); return null; }
      TT.id = d.tarqatma.id;
      return d.tarqatma;
    }

    const chiqish = async () => {
      if (!(await tasdiqla('Chiqish', 'Saqlanmagan o\'zgarishlar yo\'qoladi. Chiqasizmi?', 'Chiqish'))) return;
      TT = null;
      tarqatmaSahifa();
    };

    yuborTugma.addEventListener('click', async () => {
      yuborTugma.disabled = true;
      try {
        let rejaVaqt = 0;
        if (rejaR.checked) {
          rejaVaqt = toshkentdanMs(vaqtEl.value);
          if (!rejaVaqt || rejaVaqt < Date.now() + 60e3) return bildirish('Kamida 1 daqiqa keyingi vaqtni tanlang', 'err');
        }
        const saqlangan = await qoralamaSaqla();
        if (!saqlangan) return;
        const s = await post('/api/admin/segment', { shartlar: aud.qiymat() });
        const soni = s.ok ? s.soni : 0;
        if (!soni) return bildirish('Bu shartlarga mos obunachi yo\'q', 'err');

        const ok = await tasdiqla(
          rejaVaqt ? 'Rejalashtirish' : 'Hammaga yuborish',
          rejaVaqt
            ? '"' + saqlangan.nom + '" ' + toshkentMatn(rejaVaqt) + ' (Toshkent) da yuboriladi. Hozirgi hisob bo\'yicha ' + soni + ' ta odamga.'
            : '"' + saqlangan.nom + '" hozir ' + soni + ' ta odamga yuboriladi. Yuborilgan xabarni qaytarib bo\'lmaydi.\n\nAvval "O\'zimga sinov yuborish" bilan tekshirdingizmi?',
          rejaVaqt ? 'Rejalashtirish' : 'Ha, ' + soni + ' ta odamga yuborish');
        if (!ok) return;

        const d = await post('/api/admin/tarqatma/amal', { id: saqlangan.id, amal: 'boshla', rejaVaqt });
        if (!d.ok) return bildirish(d.error, 'err');
        bildirish(rejaVaqt ? '✓ Rejalashtirildi' : '✓ Yuborish boshlandi', 'ok');
        TT = null;
        tarqatmaSahifa();
      } finally {
        yuborTugma.disabled = false;
      }
    });

    ildiz.appendChild(h('div', { class: 'head head--tahrir' },
      h('div', null,
        h('button', { class: 'orqaga-tugma', type: 'button', text: '← Barcha xabarlar', onclick: chiqish }),
        h('h2', { text: TT.id ? 'Xabarni tahrirlash' : 'Yangi ommaviy xabar' }))));

    ildiz.appendChild(h('div', { class: 'karta' },
      h('div', { class: 'karta__sarlavha', text: '1. Nomi va auditoriya' }),
      XT.qatorBlok('Nomi (faqat panel uchun)', nomEl),
      h('div', { class: 'qator' }, h('label', { class: 'qator__label', text: 'Kimlarga yuboriladi' }), aud.el)));

    ildiz.appendChild(h('div', { class: 'karta' },
      h('div', { class: 'karta__sarlavha', text: '2. Xabar' }),
      xm.el));

    ildiz.appendChild(h('div', { class: 'karta' },
      h('div', { class: 'karta__sarlavha', text: '3. Qachon' }),
      h('div', { class: 'vaqt-tanlov' },
        h('label', { class: 'checkbox' }, hozirR, ' Hoziroq yuborish'),
        h('label', { class: 'checkbox' }, rejaR, ' Rejalashtirish:'),
        vaqtEl,
        h('span', { class: 'muted', text: 'Toshkent vaqti' }))));

    ildiz.appendChild(h('div', { class: 'saqlash' },
      yuborTugma,
      h('button', {
        class: 'btn', type: 'button', text: 'Qoralamani saqlash',
        onclick: async () => { if (await qoralamaSaqla()) bildirish('✓ Qoralama saqlandi', 'ok'); }
      })));
  }

  /* ============================================================
     OBUNACHILAR
     ============================================================ */
  const OB = { q: '', sahifa: 1, jami: 0 };
  let qidiruvTaymer = null;

  async function obunachilarSahifa() {
    await malumot();
    const d = await api('/api/admin/obunachilar?q=' + encodeURIComponent(OB.q) + '&sahifa=' + OB.sahifa);
    if (!d.ok) return;
    OB.jami = d.jami;

    const kartalar = $('obunachi-kartalar');
    kartalar.innerHTML = '';
    [['jami', 'Jami obunachi'], ['faol', 'Faol'], ['bloklagan', 'Botni bloklagan'], ['bugun', 'Oxirgi 24 soatda yangi'],
     ['start_boshlamagan', '/start bosib, testni boshlamagan'], ['boshlagan_tugatmagan', 'Boshlab, tugatmagan'],
     ['tugatgan', 'Testni tugatgan'], ['video_bosgan', 'Videoni bosgan']].forEach(([k, nom]) => {
      kartalar.appendChild(h('div', { class: 'stat' },
        h('div', { class: 'stat__son', text: String(d.stat[k] || 0) }),
        h('div', { class: 'stat__nom', text: nom })));
    });

    const darajaNom = {};
    (MAL.darajalar || []).forEach((x) => { darajaNom[x.kod] = x.nom; });

    const jadval = $('obunachi-jadval');
    jadval.innerHTML = '';
    if (!d.qatorlar.length) {
      jadval.appendChild(h('tr', null, h('td', { class: 'muted', text: OB.q ? 'Hech kim topilmadi' : 'Hozircha obunachi yo\'q — botga birinchi /start bosilgach shu yerda paydo bo\'ladi' })));
    } else {
      jadval.appendChild(h('tr', null, ...['Ism', 'Username', 'Telegram ID', 'Bosqich', 'Video', 'Daraja', 'Teglar', 'Holat', 'Qo\'shilgan', 'Oxirgi faollik']
        .map((x) => h('th', { text: x }))));
      d.qatorlar.forEach((o) => {
        jadval.appendChild(h('tr', { class: o.holat === 'bloklagan' ? 'qator--xira' : '' },
          h('td', { text: [o.ism, o.familiya].filter(Boolean).join(' ') || '—' }),
          h('td', null, o.username ? h('a', { class: 'link', href: 'https://t.me/' + o.username, target: '_blank', rel: 'noopener', text: '@' + o.username }) : '—'),
          h('td', { class: 'mono', text: String(o.tg_id) }),
          h('td', { text: o.bosqich }),
          h('td', { text: (o.video_id || '').toUpperCase() || '—' }),
          h('td', { text: darajaNom[o.daraja_kod] || o.daraja_kod || '—' }),
          h('td', { class: 'jadval__teglar', text: o.teglar || '—' }),
          h('td', null, h('span', { class: 'holat-nishon holat-nishon--' + (o.holat === 'faol' ? 'yashil' : 'qizil'), text: o.holat === 'faol' ? 'Faol' : 'Bloklagan' })),
          h('td', { text: toshkentMatn(o.birinchi_vaqt) }),
          h('td', { text: toshkentMatn(o.oxirgi_vaqt) })));
      });
    }

    const sahifalar = Math.max(1, Math.ceil(d.jami / 50));
    const sahifa = $('obunachi-sahifa');
    sahifa.innerHTML = '';
    if (sahifalar > 1) {
      sahifa.appendChild(h('button', { class: 'btn btn--kichik', type: 'button', text: '← Oldingi', disabled: OB.sahifa <= 1 || null, onclick: () => { OB.sahifa--; obunachilarSahifa(); } }));
      sahifa.appendChild(h('span', { class: 'muted', text: OB.sahifa + ' / ' + sahifalar + '  ·  ' + d.jami + ' ta' }));
      sahifa.appendChild(h('button', { class: 'btn btn--kichik', type: 'button', text: 'Keyingi →', disabled: OB.sahifa >= sahifalar || null, onclick: () => { OB.sahifa++; obunachilarSahifa(); } }));
    }
  }

  $('obunachi-q').addEventListener('input', (e) => {
    clearTimeout(qidiruvTaymer);
    qidiruvTaymer = setTimeout(() => { OB.q = e.target.value.trim(); OB.sahifa = 1; obunachilarSahifa(); }, 350);
  });
  $('obunachi-yangila').addEventListener('click', () => obunachilarSahifa());

  /* ============================================================
     TAB OCHILGANDA
     ============================================================ */
  XT.tabOchildi = function (tab) {
    const ish = { media: mediaSahifa, obunachilar: obunachilarSahifa, voronka: voronkaSahifa, tarqatma: tarqatmaSahifa }[tab];
    // Sessiya tugagan bo'lsa api() kirish oynasini o'zi ko'rsatadi — bu yerda jim o'tamiz
    if (ish) ish().catch(() => {});
  };
})();
