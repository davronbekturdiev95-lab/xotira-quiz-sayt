/* ============================================================
   XOTIRA TESTI — sayt mantiqi
   Savollar, matnlar va dizayn serverdan keladi (window.__SOZLAMALAR__)
   ============================================================ */
(function () {
  'use strict';

  var S = window.__SOZLAMALAR__ || { savollar: [], matnlar: {} };
  var SAVOLLAR = S.savollar || [];
  var M = S.matnlar || {};

  var state = { index: 0, javoblar: {}, tanlangan: null, havola: null, yuborilmoqda: false };

  function id(x) { return document.getElementById(x); }

  var el = {
    bar: id('bar'),
    qNum: id('q-num'), qText: id('q-text'), options: id('options'), hint: id('q-hint'),
    btnOk: id('btn-ok'), btnBack: id('btn-back'), btnStart: id('btn-start'),
    btnVideo: id('btn-video'), btnRetry: id('btn-retry'), btnLead: id('btn-lead'),
    leadForm: id('lead-form'), inpIsm: id('inp-ism'), inpTel: id('inp-tel'),
    inpDavlat: id('inp-davlat'), mavzuTugma: id('mavzu-tugma'), mavzuBelgi: id('mavzu-belgi'),
    leadError: id('lead-error'),
    resDaraja: id('res-daraja'), resVideo: id('res-video'),
    errText: id('err-text'), loadingText: id('loading-text')
  };

  /* ---------------- Matnlarni joylashtirish ---------------- */
  function matnlarniQoy() {
    id('intro-belgi').textContent = M.kirish_belgi || '';
    id('intro-sarlavha').textContent = M.kirish_sarlavha || '';
    id('intro-matn').innerHTML = qatorlar(M.kirish_matn);
    el.btnStart.textContent = M.kirish_tugma || 'BOSHLASH';

    var stat = id('intro-stat');
    stat.innerHTML = '';
    ['kirish_stat1', 'kirish_stat2', 'kirish_stat3'].forEach(function (k) {
      var xom = M[k];
      if (!xom) return;
      var qism = String(xom).split('|');
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.textContent = qism[0] || '';
      li.appendChild(span);
      li.appendChild(document.createTextNode(qism[1] || ''));
      stat.appendChild(li);
    });
    if (!stat.children.length) stat.hidden = true;

    el.btnBack.textContent = M.savol_orqaga || '← Orqaga';

    id('lead-belgi').textContent = M.lead_belgi || '';
    id('lead-sarlavha').textContent = M.lead_sarlavha || '';
    id('lead-matn').textContent = M.lead_matn || '';
    id('lbl-ism').textContent = M.lead_ism_label || 'Ismingiz';
    id('lbl-tel').textContent = M.lead_tel_label || 'Telefon raqamingiz';
    el.inpIsm.placeholder = M.lead_ism_placeholder || '';
    el.btnLead.textContent = M.lead_tugma || 'NATIJANI KO\'RISH →';
    id('lead-izoh').textContent = M.lead_izoh || '';

    id('res-sarlavha').textContent = M.natija_sarlavha || 'NATIJANGIZ';
    el.btnVideo.textContent = M.natija_tugma || 'BEPUL VIDEONI KO\'RISH';

    id('err-sarlavha').textContent = M.xato_sarlavha || 'XATOLIK';
    el.btnRetry.textContent = M.xato_tugma || 'QAYTA URINISH';

    document.title = M.sayt_nomi || document.title;
  }

  function qatorlar(s) {
    return String(s || '').split('\n').map(function (q) {
      return q.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }).join('<br />');
  }

  /* ---------------- VORONKA HODISALARI ----------------
     Har bir tashrif uchun tasodifiy raqam beriladi (shaxsiy ma'lumot emas).
     Shu orqali panelda "nechta odam ochdi / boshladi / formaga yetdi"
     ko'rsatiladi. */
  var SESSIYA = (function () {
    try {
      var s = sessionStorage.getItem('xt-sessiya');
      if (!s) {
        s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('xt-sessiya', s);
      }
      return s;
    } catch (e) {
      return 'x' + Math.random().toString(36).slice(2, 10);
    }
  })();

  function hodisa(nom) {
    try {
      var kalit = 'xt-h-' + nom;
      if (sessionStorage.getItem(kalit)) return;   // bir tashrifda bir marta
      sessionStorage.setItem(kalit, '1');
    } catch (e) {}

    var malumot = JSON.stringify({
      sessiya: SESSIYA,
      hodisa: nom,
      manba: document.referrer || '',
      utm: window.location.search || ''
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/hodisa', new Blob([malumot], { type: 'application/json' }));
      } else {
        fetch('/api/hodisa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: malumot,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  /* ---------------- Ekranlar ---------------- */
  function ekran(x) {
    var hammasi = document.querySelectorAll('.screen');
    for (var i = 0; i < hammasi.length; i++) hammasi[i].classList.remove('screen--active');
    id(x).classList.add('screen--active');
    window.scrollTo(0, 0);
  }

  /* ---------------- Savol ---------------- */
  function chiz() {
    var savol = SAVOLLAR[state.index];
    state.tanlangan = state.javoblar[savol.id] || null;

    el.qNum.textContent = String(state.index + 1);
    el.qText.textContent = savol.matn;
    el.options.innerHTML = '';

    savol.variantlar.forEach(function (v) {
      var btn = document.createElement('button');
      btn.className = 'opt' + (state.tanlangan === v.key ? ' opt--selected' : '');
      btn.type = 'button';
      btn.setAttribute('data-key', v.key);

      var kalit = document.createElement('span');
      kalit.className = 'opt__key';
      kalit.textContent = v.key;

      var matn = document.createElement('span');
      matn.textContent = v.matn;

      btn.appendChild(kalit);
      btn.appendChild(matn);
      btn.addEventListener('click', function () { tanla(v.key); });
      el.options.appendChild(btn);
    });

    el.btnBack.hidden = state.index === 0;
    el.btnOk.disabled = !state.tanlangan;
    el.btnOk.textContent = (state.index === SAVOLLAR.length - 1)
      ? (M.savol_tugma_oxirgi || 'YAKUNLASH')
      : (M.savol_tugma || 'OK');

    yordam(state.tanlangan
      ? 'Savol ' + (state.index + 1) + ' / ' + SAVOLLAR.length
      : (M.savol_yordam || ''), false);

    progress();
  }

  function yordam(matn, ogoh) {
    el.hint.className = ogoh ? 'q__hint q__hint--warn' : 'q__hint';
    el.hint.textContent = matn;
  }

  function tanla(key) {
    var savol = SAVOLLAR[state.index];
    state.tanlangan = key;
    state.javoblar[savol.id] = key;

    var tugmalar = el.options.querySelectorAll('.opt');
    for (var i = 0; i < tugmalar.length; i++) {
      tugmalar[i].classList.toggle('opt--selected', tugmalar[i].getAttribute('data-key') === key);
    }
    el.btnOk.disabled = false;
    yordam('Savol ' + (state.index + 1) + ' / ' + SAVOLLAR.length, false);
  }

  function progress() {
    var bajarilgan = 0;
    SAVOLLAR.forEach(function (s) { if (state.javoblar[s.id]) bajarilgan++; });
    el.bar.style.width = Math.round((bajarilgan / (SAVOLLAR.length + 1)) * 100) + '%';
  }

  function keyingi() {
    if (!state.tanlangan) {
      yordam(M.savol_ogohlantirish || 'Iltimos, bitta variantni tanlang.', true);
      return;
    }
    if (state.index < SAVOLLAR.length - 1) {
      state.index++;
      chiz();
    } else {
      leadga();
    }
  }

  function orqaga() {
    if (state.index === 0) return;
    state.index--;
    chiz();
  }

  function leadga() {
    for (var i = 0; i < SAVOLLAR.length; i++) {
      if (!state.javoblar[SAVOLLAR[i].id]) {
        state.index = i;
        ekran('screen-question');
        chiz();
        yordam('Bu savol javobsiz qolgan.', true);
        return;
      }
    }
    el.bar.style.width = Math.round((SAVOLLAR.length / (SAVOLLAR.length + 1)) * 100) + '%';
    hodisa('formaga_yetdi');
    ekran('screen-lead');
    setTimeout(function () { el.inpIsm.focus(); }, 250);
  }

  /* ---------------- MAVZU (light / dark) ---------------- */
  var MAVZU_KALIT = 'xt-mavzu';

  function mavzuOl() {
    try { return localStorage.getItem(MAVZU_KALIT) || ''; } catch (e) { return ''; }
  }

  function tizimQorongimi() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function mavzuQoy(mavzu, saqla) {
    if (mavzu) document.documentElement.setAttribute('data-mavzu', mavzu);
    else document.documentElement.removeAttribute('data-mavzu');

    if (saqla) { try { localStorage.setItem(MAVZU_KALIT, mavzu); } catch (e) {} }

    var qorongimi = mavzu ? (mavzu === 'qorongi') : tizimQorongimi();
    el.mavzuBelgi.textContent = qorongimi ? '☀️' : '🌙';
    el.mavzuTugma.setAttribute('title', qorongimi ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish");

    var meta = document.getElementById('theme-color');
    var fon = (S.fon || {});
    if (meta) meta.setAttribute('content', qorongimi ? (fon.qorongi || '#0b1220') : (fon.yorug || '#ffffff'));
  }

  el.mavzuTugma.addEventListener('click', function () {
    var joriy = mavzuOl() || (tizimQorongimi() ? 'qorongi' : 'yorug');
    mavzuQoy(joriy === 'qorongi' ? 'yorug' : 'qorongi', true);
  });

  // Tizim rejimi o'zgarsa (foydalanuvchi o'zi tanlamagan bo'lsa) — ergashamiz
  if (window.matchMedia) {
    var kuzat = window.matchMedia('(prefers-color-scheme: dark)');
    var ozgarish = function () { if (!mavzuOl()) mavzuQoy('', false); };
    if (kuzat.addEventListener) kuzat.addEventListener('change', ozgarish);
    else if (kuzat.addListener) kuzat.addListener(ozgarish);
  }

  /* ---------------- BAYROQLAR ----------------
     Windows'da davlat bayroqlari emojisi yo'q — brauzer ularni "UZ", "RU"
     harflari qilib ko'rsatadi. Shunday holatda bayroq shriftini yuklaymiz.
     Telefonlarda bayroqlar allaqachon ishlagani uchun shrift yuklanmaydi. */
  function bayroqlarIshlaydimi() {
    try {
      var c = document.createElement('canvas');
      c.width = 24; c.height = 24;
      var ctx = c.getContext('2d');
      if (!ctx) return true;
      ctx.textBaseline = 'top';
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#000';
      ctx.fillText('🇺🇿', 0, 0);   // 🇺🇿

      var piks = ctx.getImageData(0, 0, 24, 24).data;
      for (var i = 0; i < piks.length; i += 4) {
        if (piks[i + 3] < 20) continue;                  // shaffof — o'tkazamiz
        // Rangli piksel bo'lsa — bayroq chizilgan
        if (Math.abs(piks[i] - piks[i + 1]) > 12 || Math.abs(piks[i + 1] - piks[i + 2]) > 12) return true;
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  function bayroqShriftiniUla() {
    if (bayroqlarIshlaydimi()) return;
    var uslub = document.createElement('style');
    uslub.textContent =
      "@font-face{font-family:'Bayroqlar';" +
      "src:url('/fonts/bayroqlar.woff2') format('woff2');" +
      "font-display:swap;unicode-range:U+1F1E6-1F1FF,U+1F30D;}";
    document.head.appendChild(uslub);

    // Testni yechayotgan paytda fonda yuklab qo'yamiz — formaga yetganda tayyor bo'ladi
    if (document.fonts && document.fonts.load) {
      setTimeout(function () {
        try { document.fonts.load("16px Bayroqlar", '🇺🇿'); } catch (e) {}
      }, 300);
    }
  }

  /* ---------------- TELEFON (xalqaro) ---------------- */
  var DAVLATLAR = S.davlatlar || [];
  var davlat = DAVLATLAR[0] || { kod: 'UZ', dial: '998', uzunlik: [9, 9], namuna: '', bayroq: '' };

  function davlatlarniChiz() {
    el.inpDavlat.innerHTML = '';
    DAVLATLAR.forEach(function (d) {
      var opt = document.createElement('option');
      opt.value = d.kod;
      opt.textContent = d.bayroq + ' ' + (d.dial ? '+' + d.dial : '···');
      opt.title = d.nom;
      el.inpDavlat.appendChild(opt);
    });
    el.inpDavlat.value = davlat.kod;
    namunaQoy();
  }

  function namunaQoy() {
    el.inpTel.placeholder = davlat.namuna || '';
    el.inpTel.setAttribute('maxlength', String((davlat.uzunlik[1] || 15) + 6));
  }

  el.inpDavlat.addEventListener('change', function () {
    var topildi = null;
    for (var i = 0; i < DAVLATLAR.length; i++) {
      if (DAVLATLAR[i].kod === el.inpDavlat.value) { topildi = DAVLATLAR[i]; break; }
    }
    davlat = topildi || davlat;
    el.inpTel.value = '';
    namunaQoy();
    el.inpTel.focus();
  });

  /** Raqamlarni chiroyli guruhlaydi */
  function guruhla(raqamlar) {
    if (davlat.kod === 'UZ') {
      var s = '';
      if (raqamlar.length) s += raqamlar.slice(0, 2);
      if (raqamlar.length > 2) s += ' ' + raqamlar.slice(2, 5);
      if (raqamlar.length > 5) s += ' ' + raqamlar.slice(5, 7);
      if (raqamlar.length > 7) s += ' ' + raqamlar.slice(7, 9);
      return s;
    }
    // Uchtalab bo'lamiz; oxirida bitta raqam qolib ketmasin
    var guruhlar = [];
    var qolgan = raqamlar;
    while (qolgan.length > 4) {
      guruhlar.push(qolgan.slice(0, 3));
      qolgan = qolgan.slice(3);
    }
    if (qolgan) guruhlar.push(qolgan);
    return guruhlar.join(' ');
  }

  el.inpTel.addEventListener('input', function () {
    var xom = el.inpTel.value.replace(/\D/g, '');
    // Foydalanuvchi kodni ham yozib yuborsa — olib tashlaymiz
    if (davlat.dial && xom.indexOf(davlat.dial) === 0 && xom.length > davlat.uzunlik[1]) {
      xom = xom.slice(davlat.dial.length);
    }
    xom = xom.slice(0, davlat.uzunlik[1] || 15);
    el.inpTel.value = guruhla(xom);
  });

  /** Formadagi to'liq raqam: +998901234567 */
  function toliqRaqam() {
    var milliy = el.inpTel.value.replace(/\D/g, '');
    if (davlat.dial) return '+' + davlat.dial + milliy;
    return '+' + milliy;
  }

  function raqamTogrimi() {
    var milliy = el.inpTel.value.replace(/\D/g, '');
    return milliy.length >= davlat.uzunlik[0] && milliy.length <= davlat.uzunlik[1];
  }

  /* ---------------- Yuborish ---------------- */
  function yubor(e) {
    if (e) e.preventDefault();
    if (state.yuborilmoqda) return;

    var ism = el.inpIsm.value.trim();

    el.inpIsm.classList.remove('field__input--err');
    el.inpTel.classList.remove('field__input--err');

    if (ism.length < 2) {
      el.leadError.textContent = 'Ismingizni kiriting';
      el.inpIsm.classList.add('field__input--err');
      el.inpIsm.focus();
      return;
    }
    if (!raqamTogrimi()) {
      el.leadError.textContent = davlat.kod === 'XX'
        ? 'Raqamni davlat kodi bilan to\'liq yozing'
        : 'Telefon raqamni to\'liq kiriting';
      el.inpTel.classList.add('field__input--err');
      el.inpTel.focus();
      return;
    }

    el.leadError.textContent = '';
    state.yuborilmoqda = true;
    ekran('screen-loading');
    yuklanish();

    fetch('/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ism: ism,
        telefon: toliqRaqam(),
        davlat: davlat.kod,
        javoblar: state.javoblar,
        sessiya: SESSIYA,
        manba: document.referrer || '',
        utm: window.location.search || ''
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.yuborilmoqda = false;
        if (!d.ok) throw new Error(d.error || 'Noma\'lum xato');
        natija(d);
      })
      .catch(function (err) {
        state.yuborilmoqda = false;
        clearInterval(taymer);
        el.errText.textContent = (err && err.message ? err.message : 'Xatolik') +
          '. Internet aloqangizni tekshirib, qayta urinib ko\'ring.';
        ekran('screen-error');
      });
  }

  var taymer = null;
  function yuklanish() {
    var qadamlar = [M.yuklanish_1, M.yuklanish_2, M.yuklanish_3].filter(Boolean);
    if (!qadamlar.length) qadamlar = ['Tahlil qilinmoqda...'];
    var i = 0;
    clearInterval(taymer);
    el.loadingText.textContent = qadamlar[0];
    taymer = setInterval(function () {
      i++;
      if (i >= qadamlar.length) { clearInterval(taymer); return; }
      el.loadingText.textContent = qadamlar[i];
    }, 600);
  }

  function natija(d) {
    clearInterval(taymer);
    state.havola = d.havola;
    el.resDaraja.textContent = d.darajaMatn;
    el.resVideo.textContent = d.videoMatn;
    el.btnVideo.setAttribute('href', d.havola);
    document.body.classList.add('is-result');
    el.bar.style.width = '100%';
    ekran('screen-result');
  }

  /* ---------------- Hodisalar ---------------- */
  el.btnStart.addEventListener('click', function () { hodisa('boshladi'); ekran('screen-question'); chiz(); });
  el.btnOk.addEventListener('click', keyingi);
  el.btnBack.addEventListener('click', orqaga);
  el.leadForm.addEventListener('submit', yubor);
  el.btnRetry.addEventListener('click', function () { ekran('screen-lead'); });

  document.addEventListener('keydown', function (e) {
    if (!id('screen-question').classList.contains('screen--active')) return;
    var k = (e.key || '').toUpperCase();
    if (/^[A-Z]$/.test(k)) {
      var savol = SAVOLLAR[state.index];
      for (var i = 0; i < savol.variantlar.length; i++) {
        if (savol.variantlar[i].key === k) { tanla(k); return; }
      }
    } else if (e.key === 'Enter') {
      keyingi();
    }
  });

  /* ---------------- Boshlash ---------------- */
  mavzuQoy(mavzuOl(), false);
  hodisa('ochildi');
  bayroqShriftiniUla();
  davlatlarniChiz();
  matnlarniQoy();
  if (!SAVOLLAR.length) {
    el.btnStart.disabled = true;
    id('intro-matn').textContent = 'Savollar hali sozlanmagan.';
  }
})();
