/* ============================================================
   BOSHQARUV PANELI
   ============================================================ */
(function () {
  'use strict';

  let CONFIG = null;
  let USER = null;
  let OQLAR = [];
  let BELGILAR = [];
  let RANG_NOMLARI = [];
  let SHAKL_NOMLARI = [];

  const $ = (x) => document.getElementById(x);

  /* ---------------- DOM yordamchisi ---------------- */
  function h(tag, attrs, ...bolalar) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k === 'value') e.value = v;
        else if (k === 'checked') e.checked = !!v;
        else e.setAttribute(k, v);
      }
    }
    for (const b of bolalar.flat()) {
      if (b === null || b === undefined || b === false) continue;
      e.appendChild(typeof b === 'string' ? document.createTextNode(b) : b);
    }
    return e;
  }

  /* ---------------- API ---------------- */
  async function api(yol, opts) {
    const r = await fetch(yol, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
    if (r.status === 401) { loginKorsat(); throw new Error('Sessiya tugadi'); }
    return r.json();
  }

  function loginKorsat() {
    $('panel').hidden = true;
    $('login').style.display = 'flex';
  }
  function panelKorsat() {
    $('login').style.display = 'none';
    $('panel').hidden = false;
  }

  function holat(elId, matn, tur) {
    const e = $(elId);
    e.className = 'saqlash__holat' + (tur ? ' saqlash__holat--' + tur : '');
    e.textContent = matn;
    if (tur === 'ok') setTimeout(() => { if (e.textContent === matn) e.textContent = ''; }, 6000);
  }

  /* ================= KIRISH ================= */
  function loginXato(matn) {
    const e = $('login-err');
    e.textContent = matn;
    e.classList.add('err--korinsin');
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-err').textContent = '';
    $('login-err').classList.remove('err--korinsin');

    const login = $('login-name').value.trim();
    const parol = $('login-pass').value;

    if (!login || !parol) {
      loginXato(!login ? 'Loginni kiriting' : 'Parolni kiriting');
      (!login ? $('login-name') : $('login-pass')).focus();
      return;
    }

    const tugma = $('login-btn');
    const eskiMatn = tugma.textContent;
    tugma.disabled = true;
    tugma.textContent = 'TEKSHIRILMOQDA...';

    // Server javob bermay qolsa ham tugma abadiy o'chib qolmasin
    const uzgich = new AbortController();
    const taymer = setTimeout(() => uzgich.abort(), 12000);

    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, parol }),
        signal: uzgich.signal
      });

      let d;
      try {
        d = await r.json();
      } catch (_) {
        loginXato('Server tushunarsiz javob qaytardi (kod ' + r.status + ')');
        return;
      }

      if (!d.ok) {
        loginXato(d.error || 'Xatolik');
        $('login-pass').select();
        return;
      }

      // Kirish o'tdi — endi ma'lumotlarni yuklaymiz
      $('login-pass').value = '';
      try {
        await yukla();
      } catch (_) {
        loginXato('Kirdingiz, lekin ma\'lumot yuklanmadi. Sahifani yangilang (Ctrl+F5). ' +
                  'Takrorlansa — brauzerda cookie ruxsati o\'chiq bo\'lishi mumkin.');
        return;
      }
      panelKorsat();

    } catch (xato) {
      if (xato && xato.name === 'AbortError') {
        loginXato('Server javob bermadi. Internetni tekshirib, qayta urining.');
      } else {
        loginXato('Serverga ulanib bo\'lmadi. Sayt ishlab turibdimi?');
      }
    } finally {
      clearTimeout(taymer);
      tugma.disabled = false;                 // har qanday holatda ham tugma tirik qoladi
      tugma.textContent = eskiMatn;
    }
  });

  $('logout').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    loginKorsat();
  });

  /* ================= TABLAR ================= */
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('tab--active'));
      document.querySelectorAll('.tabpane').forEach((x) => x.classList.remove('tabpane--active'));
      t.classList.add('tab--active');
      $('pane-' + t.dataset.tab).classList.add('tabpane--active');
      if (t.dataset.tab === 'statistika') statYukla();
      if (t.dataset.tab === 'tarix') tarixYukla();
      if (t.dataset.tab === 'adminlar') adminlarYukla();
    });
  });

  /* ================= YUKLASH ================= */
  async function yukla() {
    const d = await api('/api/admin/config');
    if (!d.ok) throw new Error(d.error || 'Malumot yuklanmadi');
    CONFIG = d.config;
    USER = d.user;
    OQLAR = d.oqlar;
    BELGILAR = d.belgilar;
    RANG_NOMLARI = d.rangNomlari || [];
    SHAKL_NOMLARI = d.shaklNomlari || [];

    $('kim').textContent = USER.login + (USER.rol === 'bosh' ? ' · bosh admin' : ' · admin');
    $('admin-qosh-blok').hidden = USER.rol !== 'bosh';

    savollarChiz();
    videolarChiz();
    matnlarChiz();
    dizaynChiz();
  }

  /* ============================================================
     SAVOLLAR
     ============================================================ */
  function savollarChiz() {
    const idish = $('savollar');
    idish.innerHTML = '';
    CONFIG.savollar.forEach((savol, i) => idish.appendChild(savolKarta(savol, i)));
  }

  function savolKarta(savol, indeks) {
    const yoshSavolimi = CONFIG.yoshSavoli === savol.id;

    const variantlarIdish = h('div', { class: 'variantlar' });
    savol.variantlar.forEach((v, vi) => {
      variantlarIdish.appendChild(variantQator(v, vi, yoshSavolimi, variantlarIdish));
    });

    const karta = h('div', { class: 'karta savol', 'data-id': savol.id },
      h('div', { class: 'karta__bosh' },
        h('span', { class: 'karta__id', text: String(indeks + 1) }),
        h('input', { class: 'input savol-matn', value: savol.matn || '', placeholder: 'Savol matni' }),
        h('div', { class: 'amallar' },
          h('button', { class: 'mini', title: 'Yuqoriga', text: '↑', onclick: () => kochir(indeks, -1) }),
          h('button', { class: 'mini', title: 'Pastga', text: '↓', onclick: () => kochir(indeks, 1) }),
          h('button', {
            class: 'mini mini--qizil', title: 'Savolni o\'chirish', text: '✕',
            onclick: () => {
              if (CONFIG.savollar.length <= 1) return alert('Oxirgi savolni o\'chirib bo\'lmaydi');
              if (!confirm((indeks + 1) + '-savol o\'chirilsinmi?')) return;
              yigSavollar();
              CONFIG.savollar.splice(indeks, 1);
              savollarChiz();
            }
          })
        )
      ),

      h('label', { class: 'yosh-belgi' },
        h('input', {
          type: 'radio', name: 'yosh-savoli', checked: yoshSavolimi,
          onchange: () => { yigSavollar(); CONFIG.yoshSavoli = savol.id; savollarChiz(); }
        }),
        ' Bu — yosh savoli (yoshga bog\'liq qoidalar shu javobga qaraydi)'
      ),

      h('div', { class: 'variantlar__bosh' + (yoshSavolimi ? ' variantlar__bosh--yosh' : '') },
        h('span', { class: 'vb vb--matn', text: 'Variant matni' }),
        ...OQLAR.map((o) => h('span', { class: 'vb vb--son', text: o.nom, title: o.nom + ' o\'qiga ball' })),
        ...BELGILAR.map((b) => h('span', { class: 'vb vb--son', text: b.nom.split(' ')[0], title: b.nom + ' — ' + b.izoh })),
        h('span', { class: 'vb vb--son', text: 'Daraja', title: 'Unutuvchanlik og\'irligi' }),
        yoshSavolimi ? h('span', { class: 'vb vb--yosh', text: 'Guruh' }) : null,
        h('span', { class: 'vb vb--amal' })
      ),

      variantlarIdish,

      h('button', {
        class: 'btn btn--qosh btn--kichik', text: '+ Variant qo\'shish',
        onclick: () => {
          yigSavollar();
          const s = CONFIG.savollar[indeks];
          if (s.variantlar.length >= 26) return alert('26 tadan ko\'p variant bo\'lmaydi');
          s.variantlar.push({ key: '', matn: '', ball: {}, belgi: {}, daraja: 0 });
          savollarChiz();
        }
      })
    );

    return karta;
  }

  function variantQator(v, vi, yoshSavolimi, idish) {
    const kattaBor = !!v.katta;

    const qator = h('div', { class: 'variant' + (yoshSavolimi ? ' variant--yosh' : '') },
      h('span', { class: 'variant__key', text: HARF(vi) }),
      h('input', { class: 'input variant-matn', value: v.matn || '', placeholder: 'Variant matni' }),
      ...OQLAR.map((o) => sonInput('ball-' + o.kod, (v.ball || {})[o.kod], o.nom)),
      ...BELGILAR.map((b) => sonInput('belgi-' + b.kod, (v.belgi || {})[b.kod], b.nom.split(' ')[0])),
      sonInput('daraja', v.daraja, 'Daraja'),
      yoshSavolimi
        ? h('select', { class: 'input mini-select yosh-guruh' },
            h('option', { value: 'yosh', text: '18–34', selected: v.yoshGuruh === 'yosh' }),
            h('option', { value: 'katta', text: '35+', selected: v.yoshGuruh !== 'yosh' })
          )
        : null,
      h('div', { class: 'variant__amallar' },
        h('button', {
          class: 'mini' + (kattaBor ? ' mini--faol' : ''), text: '35+',
          title: '35+ yoshdagilar uchun boshqacha ball berish',
          onclick: (e) => {
            e.preventDefault();
            yigSavollar();
            const savolIndeks = [...idish.closest('#savollar').children].indexOf(idish.closest('.karta'));
            const target = CONFIG.savollar[savolIndeks].variantlar[vi];
            if (target.katta) delete target.katta;
            else target.katta = { ball: {}, belgi: {} };
            savollarChiz();
          }
        }),
        h('button', {
          class: 'mini mini--qizil', text: '✕', title: 'Variantni o\'chirish',
          onclick: (e) => {
            e.preventDefault();
            const savolIndeks = [...idish.closest('#savollar').children].indexOf(idish.closest('.karta'));
            if (CONFIG.savollar[savolIndeks].variantlar.length <= 2) {
              return alert('Kamida 2 ta variant bo\'lishi kerak');
            }
            yigSavollar();
            CONFIG.savollar[savolIndeks].variantlar.splice(vi, 1);
            savollarChiz();
          }
        })
      )
    );

    if (!kattaBor) return qator;

    const kattaQator = h('div', { class: 'variant variant--katta' + (yoshSavolimi ? ' variant--yosh' : '') },
      h('span', { class: 'variant__key', text: '35+' }),
      h('span', { class: 'variant__izoh', text: '35+ yoshdagilar uchun ball' }),
      ...OQLAR.map((o) => sonInput('kball-' + o.kod, ((v.katta || {}).ball || {})[o.kod], o.nom)),
      ...BELGILAR.map((b) => sonInput('kbelgi-' + b.kod, ((v.katta || {}).belgi || {})[b.kod], b.nom.split(' ')[0])),
      h('span', { class: 'variant__bosh-joy' }),
      yoshSavolimi ? h('span', { class: 'variant__bosh-joy' }) : null,
      h('span', { class: 'variant__bosh-joy' })
    );

    return h('div', { class: 'variant-guruh' }, qator, kattaQator);
  }

  function sonInput(nom, qiymat, label) {
    return h('label', { class: 'son-katak' },
      h('span', { class: 'son-katak__nom', text: label || '' }),
      h('input', {
        class: 'input son', type: 'number', min: '0', max: '99',
        'data-nom': nom, value: Number(qiymat || 0), title: label || ''
      })
    );
  }

  function HARF(i) { return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || '?'; }

  function kochir(indeks, yon) {
    const yangi = indeks + yon;
    if (yangi < 0 || yangi >= CONFIG.savollar.length) return;
    yigSavollar();
    const [s] = CONFIG.savollar.splice(indeks, 1);
    CONFIG.savollar.splice(yangi, 0, s);
    savollarChiz();
  }

  /** Ekrandagi qiymatlarni CONFIG ga yig'ib oladi */
  function yigSavollar() {
    const kartalar = [...$('savollar').children];
    CONFIG.savollar = kartalar.map((karta, i) => {
      const eski = CONFIG.savollar[i] || {};
      const variantlar = [...karta.querySelectorAll('.variant-guruh, .variant')]
        .filter((x) => x.classList.contains('variant-guruh') || !x.closest('.variant-guruh'))
        .map((blok) => {
          const asos = blok.classList.contains('variant-guruh') ? blok.firstChild : blok;
          const katta = blok.classList.contains('variant-guruh') ? blok.lastChild : null;

          const v = {
            matn: asos.querySelector('.variant-matn').value,
            ball: yigSonlar(asos, 'ball-'),
            belgi: yigSonlar(asos, 'belgi-'),
            daraja: Number(asos.querySelector('[data-nom="daraja"]').value || 0)
          };
          const guruh = asos.querySelector('.yosh-guruh');
          if (guruh) v.yoshGuruh = guruh.value;
          if (katta) v.katta = { ball: yigSonlar(katta, 'kball-'), belgi: yigSonlar(katta, 'kbelgi-') };
          return v;
        });

      return { id: eski.id, matn: karta.querySelector('.savol-matn').value, variantlar };
    });
  }

  function yigSonlar(idish, prefiks) {
    const o = {};
    idish.querySelectorAll('[data-nom]').forEach((inp) => {
      const nom = inp.dataset.nom;
      if (!nom.startsWith(prefiks)) return;
      const son = Number(inp.value || 0);
      if (son) o[nom.slice(prefiks.length)] = son;
    });
    return o;
  }

  $('savol-qosh').addEventListener('click', () => {
    yigSavollar();
    CONFIG.savollar.push({
      id: '',
      matn: '',
      variantlar: [
        { matn: '', ball: {}, belgi: {}, daraja: 0 },
        { matn: '', ball: {}, belgi: {}, daraja: 0 }
      ]
    });
    savollarChiz();
    window.scrollTo(0, document.body.scrollHeight);
  });

  $('save-savollar').addEventListener('click', async () => {
    yigSavollar();
    await saqla('savollar', { savollar: CONFIG.savollar, yoshSavoli: CONFIG.yoshSavoli }, 'holat-savollar');
  });

  /* ============================================================
     VIDEOLAR
     ============================================================ */
  function videolarChiz() {
    const idish = $('videolar');
    idish.innerHTML = '';
    CONFIG.videolar.forEach((v, i) => idish.appendChild(videoKarta(v, i)));
  }

  function videoKarta(v, indeks) {
    const shartlarIdish = h('div', { class: 'shartlar' });
    (v.shartlar || []).forEach((s, si) => shartlarIdish.appendChild(shartQator(s, indeks, si)));

    return h('div', { class: 'karta video', 'data-id': v.id || '' },
      h('div', { class: 'karta__bosh' },
        h('span', { class: 'karta__id', text: (v.id || 'yangi').toUpperCase() }),
        h('input', { class: 'input video-nom', value: v.nom || '', placeholder: 'Video nomi' }),
        h('div', { class: 'amallar' },
          h('button', {
            class: 'mini mini--qizil', text: '✕', title: 'Videoni o\'chirish',
            onclick: () => {
              if (CONFIG.videolar.length <= 1) return alert('Oxirgi videoni o\'chirib bo\'lmaydi');
              if (!confirm('"' + (v.nom || '') + '" videosi o\'chirilsinmi?')) return;
              yigVideolar();
              CONFIG.videolar.splice(indeks, 1);
              videolarChiz();
            }
          })
        )
      ),

      qatorBlok('Havola', h('input', { class: 'input video-havola', type: 'url', value: v.havola || '', placeholder: 'https://t.me/...' })),
      qatorBlok('Natija sahifasidagi matn', h('textarea', { class: 'input video-matn', text: v.matn || '' })),
      qatorBlok('Kim uchun (faqat panel uchun izoh)', h('input', { class: 'input video-kimga', value: v.kimga || '' })),

      h('div', { class: 'qoida' },
        h('div', { class: 'qoida__qism' },
          h('label', { class: 'qator__label', text: 'Yo\'nalish' }),
          h('select', { class: 'input video-yonalish' },
            ...OQLAR.map((o) => h('option', { value: o.kod, text: o.nom, selected: v.yonalish === o.kod })),
            h('option', { value: 'istalgan', text: 'Istalgan', selected: v.yonalish === 'istalgan' })
          )
        ),
        h('div', { class: 'qoida__qism' },
          h('label', { class: 'qator__label', text: 'Ustunlik' }),
          h('input', { class: 'input video-ustunlik', type: 'number', min: '0', max: '999', value: Number(v.ustunlik || 0) })
        ),
        h('div', { class: 'qoida__qism qoida__qism--keng' },
          h('label', { class: 'qator__label', text: 'Zaxira' }),
          h('label', { class: 'checkbox' },
            h('input', {
              type: 'radio', name: 'zaxira', class: 'video-zaxira', checked: !!v.zaxira
            }),
            ' Mos qoida topilmasa shu video berilsin'
          )
        )
      ),

      h('div', { class: 'qator' },
        h('label', { class: 'qator__label', text: 'Shartlar (hammasi bajarilishi kerak)' }),
        shartlarIdish,
        h('button', {
          class: 'btn btn--qosh btn--kichik', text: '+ Shart qo\'shish',
          onclick: () => {
            yigVideolar();
            CONFIG.videolar[indeks].shartlar = CONFIG.videolar[indeks].shartlar || [];
            if (CONFIG.videolar[indeks].shartlar.length >= 4) return alert('4 tadan ko\'p shart bo\'lmaydi');
            CONFIG.videolar[indeks].shartlar.push({ belgi: BELGILAR[0].kod, min: 4 });
            videolarChiz();
          }
        })
      )
    );
  }

  function shartQator(s, videoIndeks, shartIndeks) {
    return h('div', { class: 'shart' },
      h('select', { class: 'input shart-belgi' },
        ...BELGILAR.map((b) => h('option', { value: b.kod, text: b.nom + ' (' + b.izoh + ')', selected: s.belgi === b.kod }))
      ),
      h('span', { class: 'shart__belgi', text: '≥' }),
      h('input', { class: 'input son shart-min', type: 'number', min: '0', max: '99', value: Number(s.min || 0) }),
      h('button', {
        class: 'mini mini--qizil', text: '✕',
        onclick: (e) => {
          e.preventDefault();
          yigVideolar();
          CONFIG.videolar[videoIndeks].shartlar.splice(shartIndeks, 1);
          videolarChiz();
        }
      })
    );
  }

  function qatorBlok(label, input) {
    return h('div', { class: 'qator' }, h('label', { class: 'qator__label', text: label }), input);
  }

  function yigVideolar() {
    const kartalar = [...$('videolar').children];
    CONFIG.videolar = kartalar.map((karta, i) => {
      const eski = CONFIG.videolar[i] || {};
      return {
        id: eski.id || '',
        nom: karta.querySelector('.video-nom').value,
        kimga: karta.querySelector('.video-kimga').value,
        havola: karta.querySelector('.video-havola').value,
        matn: karta.querySelector('.video-matn').value,
        yonalish: karta.querySelector('.video-yonalish').value,
        ustunlik: Number(karta.querySelector('.video-ustunlik').value || 0),
        zaxira: karta.querySelector('.video-zaxira').checked,
        shartlar: [...karta.querySelectorAll('.shart')].map((sh) => ({
          belgi: sh.querySelector('.shart-belgi').value,
          min: Number(sh.querySelector('.shart-min').value || 0)
        }))
      };
    });
  }

  $('video-qosh').addEventListener('click', () => {
    yigVideolar();
    CONFIG.videolar.push({
      id: '', nom: '', kimga: '', havola: '', matn: '',
      yonalish: 'xotira', shartlar: [], ustunlik: 10, zaxira: false
    });
    videolarChiz();
    window.scrollTo(0, document.body.scrollHeight);
  });

  $('save-videolar').addEventListener('click', async () => {
    yigVideolar();
    await saqla('videolar', { videolar: CONFIG.videolar }, 'holat-videolar');
  });

  /* ============================================================
     MATNLAR
     ============================================================ */
  const MATN_NOMLARI = {
    sayt_nomi: ['Sayt nomi (brauzer sarlavhasi)', 'input'],
    sayt_tavsif: ['Sayt tavsifi (qidiruv va ulashish uchun)', 'area'],

    kirish_belgi: ['Kirish: emoji', 'input'],
    kirish_sarlavha: ['Kirish: sarlavha', 'input'],
    kirish_matn: ['Kirish: matn (yangi qator uchun Enter)', 'area'],
    kirish_stat1: ['Kirish: 1-katak (son|matn)', 'input'],
    kirish_stat2: ['Kirish: 2-katak (son|matn)', 'input'],
    kirish_stat3: ['Kirish: 3-katak (son|matn)', 'input'],
    kirish_tugma: ['Kirish: tugma yozuvi', 'input'],

    savol_yordam: ['Savol: pastdagi izoh', 'input'],
    savol_ogohlantirish: ['Savol: javob tanlanmaganda chiqadigan ogohlantirish', 'input'],
    savol_tugma: ['Savol: tugma yozuvi', 'input'],
    savol_tugma_oxirgi: ['Savol: oxirgi savoldagi tugma', 'input'],
    savol_orqaga: ['Savol: orqaga tugmasi', 'input'],

    lead_belgi: ['Forma: yuqoridagi belgi', 'input'],
    lead_sarlavha: ['Forma: sarlavha', 'input'],
    lead_matn: ['Forma: matn', 'area'],
    lead_ism_label: ['Forma: ism yozuvi', 'input'],
    lead_ism_placeholder: ['Forma: ism namunasi', 'input'],
    lead_tel_label: ['Forma: telefon yozuvi', 'input'],
    lead_tugma: ['Forma: tugma yozuvi', 'input'],
    lead_izoh: ['Forma: pastdagi kichik izoh', 'input'],

    yuklanish_1: ['Yuklanish: 1-matn', 'input'],
    yuklanish_2: ['Yuklanish: 2-matn', 'input'],
    yuklanish_3: ['Yuklanish: 3-matn', 'input'],

    natija_sarlavha: ['Natija: katta sarlavha', 'input'],
    natija_tugma: ['Natija: tugma yozuvi', 'input'],

    xato_sarlavha: ['Xatolik: sarlavha', 'input'],
    xato_tugma: ['Xatolik: tugma yozuvi', 'input'],

    bot_salom: ['Bot: /start bosganda chiqadigan xabar ({ism} — foydalanuvchi ismi bilan almashadi)', 'area'],
    bot_tugma: ['Bot: testni ochish tugmasi', 'input'],
    tg_raqam_tugma: ['Telegram ichida: raqamni ulashish tugmasi', 'input']
  };

  function matnlarChiz() {
    const idish = $('matnlar');
    idish.innerHTML = '';

    const guruhlar = {
      'Umumiy': ['sayt_nomi', 'sayt_tavsif'],
      'Kirish sahifasi': ['kirish_belgi', 'kirish_sarlavha', 'kirish_matn', 'kirish_stat1', 'kirish_stat2', 'kirish_stat3', 'kirish_tugma'],
      'Savol ekrani': ['savol_yordam', 'savol_ogohlantirish', 'savol_tugma', 'savol_tugma_oxirgi', 'savol_orqaga'],
      'Ism / telefon formasi': ['lead_belgi', 'lead_sarlavha', 'lead_matn', 'lead_ism_label', 'lead_ism_placeholder', 'lead_tel_label', 'lead_tugma', 'lead_izoh'],
      'Yuklanish ekrani': ['yuklanish_1', 'yuklanish_2', 'yuklanish_3'],
      'Natija sahifasi': ['natija_sarlavha', 'natija_tugma'],
      'Xatolik ekrani': ['xato_sarlavha', 'xato_tugma'],
      'Telegram bot': ['bot_salom', 'bot_tugma', 'tg_raqam_tugma']
    };

    for (const guruh of Object.keys(guruhlar)) {
      const karta = h('div', { class: 'karta' }, h('div', { class: 'karta__sarlavha', text: guruh }));
      for (const kalit of guruhlar[guruh]) {
        const [label, tur] = MATN_NOMLARI[kalit] || [kalit, 'input'];
        const qiymat = CONFIG.matnlar[kalit] || '';
        const input = tur === 'area'
          ? h('textarea', { class: 'input matn-maydon', 'data-kalit': kalit, text: qiymat })
          : h('input', { class: 'input matn-maydon', 'data-kalit': kalit, value: qiymat });
        karta.appendChild(qatorBlok(label, input));
      }
      idish.appendChild(karta);
    }

    // Darajalar
    const dIdish = $('darajalar');
    dIdish.innerHTML = '';
    CONFIG.darajalar.forEach((d) => {
      dIdish.appendChild(h('div', { class: 'karta daraja', 'data-kod': d.kod },
        h('div', { class: 'karta__bosh' },
          h('input', { class: 'input daraja-nom', value: d.nom || '', style: 'max-width:220px' }),
          h('span', { class: 'karta__kimga', text: 'Chegara (%)' }),
          h('input', { class: 'input son daraja-max', type: 'number', min: '0', max: '100', value: Number(d.max || 0) })
        ),
        h('textarea', { class: 'input daraja-matn', text: d.matn || '' })
      ));
    });
  }

  $('save-matnlar').addEventListener('click', async () => {
    const matnlar = {};
    document.querySelectorAll('.matn-maydon').forEach((inp) => { matnlar[inp.dataset.kalit] = inp.value; });

    const darajalar = [...$('darajalar').children].map((k) => ({
      kod: k.dataset.kod,
      nom: k.querySelector('.daraja-nom').value,
      max: Number(k.querySelector('.daraja-max').value || 0),
      matn: k.querySelector('.daraja-matn').value
    }));

    await saqla('matnlar', { matnlar, darajalar }, 'holat-matnlar');
  });

  /* ============================================================
     DIZAYN — ikkita palitra (qorong'i / yorug')
     ============================================================ */
  let JORIY_PALITRA = 'qorongi';

  function dizaynChiz() {
    const idish = $('dizayn');
    idish.innerHTML = '';

    const palitra = CONFIG.dizayn[JORIY_PALITRA] || {};
    const sarlavha = (JORIY_PALITRA === 'yorug' ? "Yorug'" : "Qorong'i") + ' mavzu ranglari';
    const ranglar = h('div', { class: 'karta' }, h('div', { class: 'karta__sarlavha', text: sarlavha }));

    RANG_NOMLARI.forEach(function (juft) {
      const kalit = juft[0], label = juft[1];
      const qiymat = palitra[kalit] || '';
      ranglar.appendChild(h('div', { class: 'rang' },
        h('input', {
          type: 'color', class: 'rang__tanlov', 'data-kalit': kalit, value: rangNormal(qiymat),
          oninput: (e) => {
            e.target.parentNode.querySelector('.rang__matn').value = e.target.value;
            CONFIG.dizayn[JORIY_PALITRA][kalit] = e.target.value;
          }
        }),
        h('input', {
          class: 'input rang__matn', 'data-kalit': kalit, value: qiymat,
          oninput: (e) => {
            const v = e.target.value.trim();
            CONFIG.dizayn[JORIY_PALITRA][kalit] = v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) e.target.parentNode.querySelector('.rang__tanlov').value = v;
          }
        }),
        h('span', { class: 'rang__nom', text: label })
      ));
    });

    const shakl = h('div', { class: 'karta' },
      h('div', { class: 'karta__sarlavha', text: "Shakl va o'lchamlar (ikkala mavzuda bir xil)" }));

    SHAKL_NOMLARI.forEach(function (juft) {
      const kalit = juft[0], label = juft[1];
      shakl.appendChild(qatorBlok(label, h('input', {
        class: 'input shakl-matn', 'data-kalit': kalit,
        value: CONFIG.dizayn.shakl[kalit] || '',
        oninput: (e) => { CONFIG.dizayn.shakl[kalit] = e.target.value.trim(); }
      })));
    });

    idish.appendChild(ranglar);
    idish.appendChild(shakl);
  }

  document.querySelectorAll('.mavzu-tanlov__tugma').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.mavzu-tanlov__tugma').forEach((x) => x.classList.remove('mavzu-tanlov__tugma--faol'));
      t.classList.add('mavzu-tanlov__tugma--faol');
      JORIY_PALITRA = t.dataset.palitra;
      dizaynChiz();
    });
  });

  function rangNormal(v) {
    return /^#[0-9a-fA-F]{6}$/.test(String(v || '').trim()) ? v.trim() : '#000000';
  }

  $('save-dizayn').addEventListener('click', async () => {
    await saqla('dizayn', { dizayn: CONFIG.dizayn }, 'holat-dizayn');
  });

  $('dizayn-tiklash').addEventListener('click', async () => {
    const nom = JORIY_PALITRA === 'yorug' ? "yorug'" : "qorong'i";
    if (!confirm(nom + " mavzu ranglari standart holatga qaytarilsinmi? (Saqlamaguningizcha o'zgarmaydi)")) return;
    const d = await api('/api/admin/standart-dizayn');
    if (!d.ok) return holat('holat-dizayn', d.error || 'Xatolik', 'err');
    CONFIG.dizayn[JORIY_PALITRA] = d.dizayn[JORIY_PALITRA];
    CONFIG.dizayn.shakl = d.dizayn.shakl;
    dizaynChiz();
    holat('holat-dizayn', "Standart ranglar qo'yildi — saqlashni unutmang", 'ok');
  });

  /* ---------------- Panel mavzusi (light / dark) ---------------- */
  const ADMIN_MAVZU = 'xt-admin-mavzu';

  function adminMavzuOl() {
    try { return localStorage.getItem(ADMIN_MAVZU) || ''; } catch (e) { return ''; }
  }

  function adminTizimQorongimi() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function adminMavzuQoy(mavzu, saqla) {
    if (mavzu) document.documentElement.setAttribute('data-mavzu', mavzu);
    else document.documentElement.removeAttribute('data-mavzu');
    if (saqla) { try { localStorage.setItem(ADMIN_MAVZU, mavzu); } catch (e) {} }
    const qorongimi = mavzu ? (mavzu === 'qorongi') : adminTizimQorongimi();
    $('mavzu-belgi').textContent = qorongimi ? '☀️' : '🌙';
  }

  $('mavzu-tugma').addEventListener('click', () => {
    const joriy = adminMavzuOl() || (adminTizimQorongimi() ? 'qorongi' : 'yorug');
    adminMavzuQoy(joriy === 'qorongi' ? 'yorug' : 'qorongi', true);
  });

  adminMavzuQoy(adminMavzuOl(), false);

  /* ============================================================
     SAQLASH (umumiy)
     ============================================================ */
  async function saqla(bolim, malumot, holatId) {
    holat(holatId, 'Saqlanmoqda...');
    try {
      const d = await api('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify(Object.assign({ bolim }, malumot))
      });
      if (!d.ok) { holat(holatId, d.error || 'Saqlanmadi', 'err'); return false; }
      CONFIG = d.config;
      if (bolim === 'savollar') savollarChiz();
      if (bolim === 'videolar') videolarChiz();
      holat(holatId, d.xabar === 'O\'zgarish yo\'q' ? 'O\'zgarish yo\'q' : '✓ Saqlandi — saytda darrov kuchga kirdi', 'ok');
      return true;
    } catch (e) {
      holat(holatId, 'Serverga ulanib bo\'lmadi', 'err');
      return false;
    }
  }

  /* ============================================================
     STATISTIKA
     ============================================================ */
  let STAT = null;
  let DAVR = 'hammasi';

  async function statYukla() {
    const d = await api('/api/admin/stats');
    if (!d.ok) return;
    const s = d.stats;
    STAT = s;

    voronkaChiz();

    $('kartalar').innerHTML = '';
    const kan = s.kanallar || { sayt: 0, telegram: 0 };
    [[s.jami, 'Jami tugatgan'], [s.bugun, 'Bugun'], [s.hafta, 'Oxirgi 7 kun'],
     [kan.sayt, 'Saytdan'], [kan.telegram, 'Telegram botdan']].forEach(([son, nom]) => {
      $('kartalar').appendChild(h('div', { class: 'stat' },
        h('div', { class: 'stat__son', text: String(son) }),
        h('div', { class: 'stat__nom', text: nom })
      ));
    });

    const vIdish = $('video-stat');
    vIdish.innerHTML = '';
    const idlar = Object.keys(s.videolar);
    if (!idlar.length) vIdish.appendChild(h('p', { class: 'muted', text: 'Ma\'lumot yo\'q' }));
    idlar.forEach((id) => {
      const v = s.videolar[id];
      const foiz = s.jami ? Math.round((v.son / s.jami) * 100) : 0;
      vIdish.appendChild(bar(id.toUpperCase(), foiz, v.son + ' ta · ' + foiz + '%', v.nom));
    });

    const dIdish = $('daraja-stat');
    dIdish.innerHTML = '';
    const darajalar = Object.keys(s.darajalar);
    if (!darajalar.length) dIdish.appendChild(h('p', { class: 'muted', text: 'Ma\'lumot yo\'q' }));
    darajalar.forEach((k) => {
      const son = s.darajalar[k];
      const foiz = s.jami ? Math.round((son / s.jami) * 100) : 0;
      dIdish.appendChild(bar(k, foiz, son + ' ta · ' + foiz + '%'));
    });

    amoChiz(s.amo);

    const jadval = $('oxirgilar');
    jadval.innerHTML = '';
    if (!s.oxirgilar.length) {
      jadval.appendChild(h('tr', null, h('td', { class: 'muted', text: 'Hozircha hech kim testni tugatmagan' })));
    } else {
      jadval.appendChild(h('tr', null,
        ...['Vaqt', 'Ism', 'Telefon', 'Kanal', 'Video', 'Daraja'].map((x) => h('th', { text: x }))));
      s.oxirgilar.forEach((r) => {
        jadval.appendChild(h('tr', null,
          h('td', { text: vaqt(r.vaqt) }),
          h('td', { text: r.ism || '' }),
          h('td', { text: r.telefon || '' }),
          h('td', { text: r.kanal === 'telegram' ? ('Telegram' + (r.tg_username ? ' ' + r.tg_username : '')) : 'Sayt' }),
          h('td', { text: (r.video_id || '').toUpperCase() }),
          h('td', { text: r.daraja || '' })
        ));
      });
    }
  }

  const VORONKA_QADAMLARI = [
    ['ochildi', 'Saytni ochdi', 'Sahifaga kirgan odamlar'],
    ['boshladi', 'Testni boshladi', '"Boshlash" tugmasini bosdi'],
    ['formaga_yetdi', 'Savollarni tugatdi', 'Barcha savollarga javob berib formaga yetdi'],
    ['tugatdi', "Ma'lumot qoldirdi", 'Ism va telefonni yozib natijani oldi']
  ];

  function voronkaChiz() {
    const idish = $('voronka');
    idish.innerHTML = '';
    if (!STAT || !STAT.voronka) return;

    const v = STAT.voronka[DAVR] || {};
    const eng = Math.max(v.ochildi || 0, 1);

    if (!v.ochildi && !v.tugatdi) {
      idish.appendChild(h('p', { class: 'muted' },
        "Hozircha ma'lumot yo'q. Saytga birinchi tashrifdan keyin shu yerda ko'rinadi."));
      return;
    }

    let oldingi = null;
    VORONKA_QADAMLARI.forEach(function (q, i) {
      const kod = q[0], nom = q[1], izoh = q[2];
      const son = v[kod] || 0;
      const foiz = Math.round((son / eng) * 100);
      const otish = oldingi === null || oldingi === 0 ? null : Math.round((son / oldingi) * 100);
      const yoqotish = oldingi !== null ? oldingi - son : 0;

      idish.appendChild(h('div', { class: 'qadam' },
        h('div', { class: 'qadam__bosh' },
          h('span', { class: 'qadam__raqam', text: String(i + 1) }),
          h('span', { class: 'qadam__nom', text: nom }),
          h('span', { class: 'qadam__son', text: son + ' ta' }),
          otish !== null
            ? h('span', { class: 'qadam__otish' + (otish < 50 ? ' qadam__otish--past' : ''), text: otish + '%' })
            : null
        ),
        h('div', { class: 'qadam__chiziq' },
          h('div', { class: 'qadam__toldirish', style: 'width:' + Math.max(foiz, 1) + '%' })),
        h('div', { class: 'qadam__izoh', text: izoh + (yoqotish > 0 ? '  ·  ' + yoqotish + ' ta shu bosqichda ketdi' : '') })
      ));

      oldingi = son;
    });

    const jami = v.ochildi ? Math.round(((v.tugatdi || 0) / v.ochildi) * 100) : 0;
    idish.appendChild(h('div', { class: 'qadam__xulosa' },
      'Umumiy konversiya: saytni ochgan ' + v.ochildi + ' ta odamdan ' +
      (v.tugatdi || 0) + ' tasi ma\'lumot qoldirdi — ' + jami + '%'));
  }

  document.querySelectorAll('.davr__tugma').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.davr__tugma').forEach((x) => x.classList.remove('davr__tugma--faol'));
      t.classList.add('davr__tugma--faol');
      DAVR = t.dataset.davr;
      voronkaChiz();
    });
  });

  $('stat-yangila').addEventListener('click', statYukla);

  function bar(nom, foiz, son, izoh) {
    return h('div', { class: 'bar', title: izoh || '' },
      h('span', { class: 'bar__nom', text: nom }),
      h('span', { class: 'bar__chiziq' }, h('span', { class: 'bar__toldirish', style: 'width:' + foiz + '%' })),
      h('span', { class: 'bar__son', text: son })
    );
  }

  $('csv').addEventListener('click', () => { window.location.href = '/api/admin/csv'; });

  /* ---------------- amoCRM ---------------- */
  function amoChiz(a) {
    const idish = $('amo-holat');
    idish.innerHTML = '';
    if (!a) return;

    if (!a.yoqilgan) {
      idish.appendChild(h('div', { class: 'muted' },
        "amoCRM ulanmagan. Ulash uchun serverdagi .env fayliga AMO_DOMEN va AMO_TOKEN yozilishi kerak."));
      return;
    }

    const qator = (nom, qiymat, klass) =>
      h('div', { class: 'amo-qator' },
        h('span', { class: 'amo-qator__nom', text: nom }),
        h('span', { class: klass || '', text: String(qiymat) }));

    idish.appendChild(qator('Hisob:', a.domen));
    idish.appendChild(qator('Yuborilgan (server yoqilgandan beri):', a.yuborilgan));
    idish.appendChild(qator('Navbatda kutayotgan:', a.navbatda,
      a.navbatda > 0 ? 'amo-ogoh' : ''));

    if (a.oxirgiXato) {
      idish.appendChild(h('div', { class: 'amo-xato' },
        h('b', { text: 'Oxirgi xato: ' }),
        h('span', { text: a.oxirgiXato.xabar.slice(0, 200) })));
    }
  }

  $('amo-tekshir').addEventListener('click', async () => {
    holat('holat-amo', 'Tekshirilmoqda...');
    const d = await api('/api/admin/amo-tekshir');
    if (!d.ok) return holat('holat-amo', 'Xatolik', 'err');
    if (d.natija.ok) {
      holat('holat-amo', '✓ Ulanish ishlayapti — hisob: ' + (d.natija.hisob || d.natija.id), 'ok');
    } else {
      holat('holat-amo', '✗ ' + d.natija.xato, 'err');
    }
    amoChiz(d.holat);
  });

  $('amo-navbat').addEventListener('click', async () => {
    holat('holat-amo', 'Yuborilmoqda...');
    const d = await api('/api/admin/amo-navbat', { method: 'POST' });
    if (!d.ok) return holat('holat-amo', 'Xatolik', 'err');
    amoChiz(d.holat);
    holat('holat-amo', d.holat.navbatda ? ('Navbatda yana ' + d.holat.navbatda + ' ta qoldi') : '✓ Navbat bo\'shadi', d.holat.navbatda ? 'err' : 'ok');
  });

  /* ============================================================
     ADMINLAR
     ============================================================ */
  async function adminlarYukla() {
    const d = await api('/api/admin/users');
    if (!d.ok) return;

    const jadval = $('adminlar');
    jadval.innerHTML = '';
    jadval.appendChild(h('tr', null,
      ...['Login', 'Rol', 'Yaratilgan', 'Oxirgi kirish', ''].map((x) => h('th', { text: x }))));

    d.users.forEach((u) => {
      const amallar = h('td');
      if (USER.rol === 'bosh') {
        amallar.appendChild(h('button', {
          class: 'mini', text: 'Parolni almashtirish',
          onclick: async () => {
            const yangi = prompt('"' + u.login + '" uchun yangi parol (kamida 8 belgi, harf va raqam):');
            if (!yangi) return;
            const r = await api('/api/admin/users/parol', {
              method: 'POST', body: JSON.stringify({ id: u.id, parol: yangi })
            });
            alert(r.ok ? 'Parol almashtirildi' : (r.error || 'Xatolik'));
          }
        }));
        if (u.id !== d.men) {
          amallar.appendChild(h('button', {
            class: 'mini mini--qizil', text: 'O\'chirish',
            onclick: async () => {
              if (!confirm('"' + u.login + '" o\'chirilsinmi?')) return;
              const r = await api('/api/admin/users/delete', {
                method: 'POST', body: JSON.stringify({ id: u.id })
              });
              if (!r.ok) return alert(r.error || 'Xatolik');
              adminlarYukla();
            }
          }));
        }
      }

      jadval.appendChild(h('tr', null,
        h('td', null, h('b', { text: u.login }), u.id === d.men ? h('span', { class: 'nishon', text: 'siz' }) : null),
        h('td', { text: u.rol === 'bosh' ? 'Bosh admin' : 'Admin' }),
        h('td', { text: vaqt(u.yaratilgan) }),
        h('td', { text: u.oxirgiKirish ? vaqt(u.oxirgiKirish) : '—' }),
        amallar
      ));
    });
  }

  $('admin-qosh').addEventListener('click', async () => {
    holat('holat-adminlar', 'Qo\'shilmoqda...');
    const d = await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        login: $('yangi-login').value,
        parol: $('yangi-parol').value,
        rol: $('yangi-rol').value
      })
    });
    if (!d.ok) return holat('holat-adminlar', d.error || 'Xatolik', 'err');
    $('yangi-login').value = '';
    $('yangi-parol').value = '';
    holat('holat-adminlar', '✓ Admin qo\'shildi', 'ok');
    adminlarYukla();
  });

  $('parol-ozgartir').addEventListener('click', async () => {
    holat('holat-parol', 'O\'zgartirilmoqda...');
    const d = await api('/api/admin/parol', {
      method: 'POST',
      body: JSON.stringify({ eski: $('eski-parol').value, yangi: $('yangi-parolim').value })
    });
    if (!d.ok) return holat('holat-parol', d.error || 'Xatolik', 'err');
    $('eski-parol').value = '';
    $('yangi-parolim').value = '';
    holat('holat-parol', '✓ Parol o\'zgartirildi', 'ok');
  });

  /* ============================================================
     TARIX
     ============================================================ */
  async function tarixYukla() {
    const d = await api('/api/admin/tarix');
    if (!d.ok) return;

    const idish = $('tarix');
    idish.innerHTML = '';
    if (!d.tarix.length) {
      idish.appendChild(h('p', { class: 'muted', text: 'Hozircha amallar yo\'q' }));
      return;
    }

    d.tarix.forEach((t) => {
      const tafsilot = Array.isArray(t.tafsilot) ? t.tafsilot : [];
      idish.appendChild(h('div', { class: 'amal' },
        h('div', { class: 'amal__bosh' },
          h('span', { class: 'amal__vaqt', text: toliqVaqt(t.vaqt) }),
          h('span', { class: 'amal__kim', text: t.login || '—' }),
          h('span', { class: 'amal__matn', text: t.amal || '' }),
          tafsilot.length ? h('span', { class: 'amal__son', text: tafsilot.length + ' ta o\'zgarish' }) : null
        ),
        tafsilot.length
          ? h('ul', { class: 'amal__royxat' }, ...tafsilot.map((x) => h('li', { text: x })))
          : null
      ));
    });
  }

  $('tarix-yangila').addEventListener('click', tarixYukla);

  /* ============================================================
     YORDAMCHILAR
     ============================================================ */
  function vaqt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function toliqVaqt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------------- Sahifa ochilganda ---------------- */
  (async function () {
    try {
      const r = await fetch('/api/admin/config');
      if (r.status !== 200) return loginKorsat();
      const d = await r.json();
      if (!d.ok) return loginKorsat();
      panelKorsat();
      CONFIG = d.config; USER = d.user; OQLAR = d.oqlar; BELGILAR = d.belgilar;
    RANG_NOMLARI = d.rangNomlari || [];
    SHAKL_NOMLARI = d.shaklNomlari || [];
      $('kim').textContent = USER.login + (USER.rol === 'bosh' ? ' · bosh admin' : ' · admin');
      $('admin-qosh-blok').hidden = USER.rol !== 'bosh';
      savollarChiz(); videolarChiz(); matnlarChiz(); dizaynChiz();
    } catch (_) {
      loginKorsat();
    }
  })();
})();
