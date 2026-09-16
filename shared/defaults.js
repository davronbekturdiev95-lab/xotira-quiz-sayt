/* ============================================================================
 * BOSHLANG'ICH MA'LUMOTLAR
 * Bu fayl faqat BIRINCHI ISHGA TUSHIRISHDA ishlatiladi — undan keyin hamma narsa
 * data/config.json faylida saqlanadi va admin panel orqali tahrirlanadi.
 * ========================================================================== */
'use strict';

/* --------------------------------------------------------------- SAVOLLAR */
const SAVOLLAR = [
  {
    id: 'q1',
    matn: 'Yoshingiz nechida?',
    variantlar: [
      { key: 'A', matn: '18 - 24', ball: { diqqat: 2 }, belgi: { talaba: 2 }, daraja: 0, yoshGuruh: 'yosh' },
      { key: 'B', matn: '25 - 34', ball: { xotira: 1, diqqat: 1 }, belgi: { talaba: 1 }, daraja: 0, yoshGuruh: 'yosh' },
      { key: 'C', matn: '35 - 44', ball: { xotira: 2 }, belgi: {}, daraja: 0, yoshGuruh: 'katta' },
      { key: 'D', matn: '45 - 54', ball: { xotira: 3 }, belgi: {}, daraja: 0, yoshGuruh: 'katta' },
      { key: 'E', matn: '55 - 64', ball: { xotira: 3 }, belgi: { yangi: 1 }, daraja: 5, yoshGuruh: 'katta' },
      { key: 'F', matn: '65+', ball: { xotira: 3 }, belgi: { yangi: 1 }, daraja: 8, yoshGuruh: 'katta' }
    ]
  },
  {
    id: 'q2',
    matn: 'Nima uchun xotirangizni kuchaytirmoqchisiz?',
    variantlar: [
      { key: 'A', matn: 'Shaxsiy rivojlanish maqsadida', ball: { xotira: 2, diqqat: 1 }, belgi: { yangi: 1 }, daraja: 0 },
      { key: 'B', matn: 'Ishimda karyera uchun', ball: { xotira: 4, diqqat: 1 }, belgi: {}, daraja: 0 },
      { key: 'C', matn: 'Chet tilini tezroq o\'rganish uchun', ball: { til: 6 }, belgi: {}, daraja: 0 },
      { key: 'D', matn: 'Katta hajmdagi ma\'lumotlarni eslab qolish uchun', ball: { xotira: 4 }, belgi: { hajm: 3 }, daraja: 0 },
      { key: 'E', matn: 'Sog\'lig\'im uchun', ball: { xotira: 3 }, belgi: { yangi: 1 }, daraja: 5 }
    ]
  },
  {
    id: 'q3',
    matn: 'Muhim ma\'lumotlarni qanchalik tez unutib qo\'yasiz?',
    variantlar: [
      { key: 'A', matn: 'Kamdan-kam', ball: {}, belgi: {}, daraja: 0 },
      { key: 'B', matn: 'Ba\'zan', ball: {}, belgi: {}, daraja: 8 },
      { key: 'C', matn: 'Tez-tez', ball: {}, belgi: {}, daraja: 16 },
      { key: 'D', matn: 'Hech narsa esimda qolmaydi', ball: {}, belgi: {}, daraja: 24 }
    ]
  },
  {
    id: 'q4',
    matn: 'Nimani ko\'pincha unutib qo\'yasiz?',
    variantlar: [
      { key: 'A', matn: 'Yuz va ismlar', ball: { xotira: 6 }, belgi: { aniq: 3 }, daraja: 0 },
      { key: 'B', matn: 'Sanalar va tug\'ilgan kunlar', ball: { xotira: 6 }, belgi: { aniq: 3 }, daraja: 0 },
      { key: 'C', matn: 'Raqamlar va parollar', ball: { xotira: 6 }, belgi: { aniq: 3 }, daraja: 0 },
      { key: 'D', matn: 'Kundalik hayot va qilinishi kerak bo\'lgan ishlar', ball: { diqqat: 6 }, belgi: {}, daraja: 0 },
      { key: 'E', matn: 'O\'rganilgan bilimlar va faktlar', ball: { xotira: 6 }, belgi: { hajm: 3 }, daraja: 0 },
      { key: 'F', matn: 'Chet tili so\'zlari (yangi so\'zlar)', ball: { til: 6 }, belgi: {}, daraja: 0 }
    ]
  },
  {
    id: 'q5',
    matn: 'Tanishganingizdan so\'ng darhol ismlarni unutib qo\'yganmisiz?',
    variantlar: [
      { key: 'A', matn: 'Ko\'pincha darhol unutaman', ball: { xotira: 3 }, belgi: { aniq: 2 }, daraja: 10 },
      { key: 'B', matn: 'Ismlarni ba\'zan eslayman, ba\'zan yo\'q', ball: { xotira: 1 }, belgi: { aniq: 1 }, daraja: 5 },
      { key: 'C', matn: 'Odatda yaxshi eslab qolaman', ball: {}, belgi: {}, daraja: 0 }
    ]
  },
  {
    id: 'q6',
    matn: 'Yosh bilan bog\'liq xotira pasayishi sizni yoki yaqinlaringizni tashvishga soladimi?',
    variantlar: [
      { key: 'A', matn: 'Ha, bu jiddiy muammo', ball: {}, belgi: {}, daraja: 10 },
      { key: 'B', matn: 'Bu haqida ba\'zan o\'ylab turaman', ball: {}, belgi: {}, daraja: 5 },
      { key: 'C', matn: 'Yo\'q, hozircha bu tashvishlantirmaydi', ball: {}, belgi: {}, daraja: 0 }
    ]
  },
  {
    id: 'q7',
    matn: 'Ba\'zan o\'tmishdagi xotiralaringizni eslash sizga qiyinchilik tug\'diradimi?',
    variantlar: [
      { key: 'A', matn: 'Ha, eslashga qiynalaman', ball: {}, belgi: {}, daraja: 12 },
      { key: 'B', matn: 'Ba\'zan bu qiyin kechadi', ball: {}, belgi: {}, daraja: 6 },
      { key: 'C', matn: 'Yo\'q, o\'z-o\'zidan eslay olaman', ball: {}, belgi: {}, daraja: 0 }
    ]
  },
  {
    id: 'q8',
    matn: 'Asosan nimalarni eslab qolish uchun sizga kuchli xotira zarur?',
    variantlar: [
      { key: 'A', matn: 'Ismlar va yuzlarni eslab qolish', ball: { xotira: 5 }, belgi: { aniq: 2 }, daraja: 0 },
      { key: 'B', matn: 'Faktlar va kitobdagi ma\'lumotlar', ball: { xotira: 5 }, belgi: { hajm: 2 }, daraja: 0 },
      { key: 'C', matn: 'Parollar va kodlar', ball: { xotira: 5 }, belgi: { aniq: 2 }, daraja: 0 },
      { key: 'D', matn: 'Sanalar, vazifalar va kundalik turmush tarzi uchun', ball: { xotira: 1, diqqat: 5 }, belgi: {}, daraja: 0 },
      { key: 'E', matn: 'Chet tili so\'zlari (yangi so\'zlar)', ball: { til: 5 }, belgi: {}, daraja: 0 }
    ]
  },
  {
    id: 'q9',
    matn: 'Nechta tilda gaplasha olasiz?',
    variantlar: [
      { key: 'A', matn: '1', ball: {}, belgi: {}, daraja: 0 },
      { key: 'B', matn: '2', ball: { til: 1 }, belgi: {}, daraja: 0 },
      { key: 'C', matn: '3', ball: { til: 2 }, belgi: {}, daraja: 0 },
      { key: 'D', matn: '4+', ball: { til: 2 }, belgi: {}, daraja: 0 }
    ]
  },
  {
    id: 'q10',
    matn: 'Kuchli xotira sizga karyerangizda yordam bergan bo\'larmidi?',
    variantlar: [
      { key: 'A', matn: 'Ha', ball: {}, belgi: {}, daraja: 0 },
      { key: 'B', matn: 'Ishonchim komil emas', ball: {}, belgi: { yangi: 1 }, daraja: 0 }
    ]
  },
  {
    id: 'q11',
    matn: 'Muntazam miya va xotira mashqlarini bajarishim boshqa ishlarimga ham ijobiy ta\'sir qiladi deb o\'ylaysizmi?',
    variantlar: [
      { key: 'A', matn: 'Ha', ball: {}, belgi: {}, daraja: 0 },
      { key: 'B', matn: 'Unchalik emas', ball: {}, belgi: { yangi: 1 }, daraja: 0 }
    ]
  },
  {
    id: 'q12',
    matn: 'Siz uchun nazorat juda ham muhimmi, aynan biror o\'qishda yoki mashg\'ulotda?',
    variantlar: [
      {
        key: 'A', matn: 'Ha, juda muhim!',
        ball: { diqqat: 2 }, belgi: { talaba: 1 }, daraja: 0,
        // 35+ yoshdagilar uchun boshqacha ball
        katta: { ball: { til: 2 }, belgi: {} }
      },
      { key: 'B', matn: 'Unchalik emas', ball: {}, belgi: {}, daraja: 0 }
    ]
  },
  {
    id: 'q13',
    matn: 'Lokatsiyalar usuli haqida eshitganmisiz?',
    variantlar: [
      { key: 'A', matn: 'Ha, albatta!', ball: {}, belgi: { hajm: 2 }, daraja: 0 },
      { key: 'B', matn: 'Eshitmagan ekanman', ball: {}, belgi: { yangi: 2 }, daraja: 0 }
    ]
  },
  {
    id: 'q14',
    matn: 'Xotirangizni kuchaytirishga tayyormisiz?',
    variantlar: [
      { key: 'A', matn: 'Albatta, tayyorman!', ball: {}, belgi: {}, daraja: 0 },
      { key: 'B', matn: 'Sinab ko\'rishga qiziqyapman', ball: {}, belgi: { yangi: 1 }, daraja: 0 }
    ]
  },
  {
    id: 'q15',
    matn: 'Xotirangizni kuchaytirish odatini shakllantirish uchun kuniga qancha shug\'ullana olasiz?',
    variantlar: [
      { key: 'A', matn: 'Kuniga 5 daqiqa - Asoslarni o\'rganish', ball: {}, belgi: { yangi: 2 }, daraja: 0 },
      { key: 'B', matn: 'Kuniga 10 daqiqa - Ko\'nikmalarni oshirish', ball: {}, belgi: {}, daraja: 0 },
      { key: 'C', matn: 'Kuniga 15 daqiqa - Bilimlarni kengaytirish', ball: {}, belgi: { talaba: 1, hajm: 1 }, daraja: 0 },
      { key: 'D', matn: 'Kuniga 20 daqiqa - Mukammal xotiraga egalik qilish', ball: { diqqat: 1 }, belgi: { talaba: 2, hajm: 1 }, daraja: 0 }
    ]
  }
];

/* ----------------------------------------------------- NATIJA IZOHLARI
 * Tanlangan javobga qarab natijada chiqadigan matnlar:
 *   muammo — "Asosiy muammolaringiz" ro'yxatiga
 *   kuchli — "Kuchli tomonlaringiz" ro'yxatiga
 *   reja   — "Kunlik rejangiz" bo'limiga
 * Admin panelda har bir savol ichidan tahrirlanadi.
 * ------------------------------------------------------------------------ */
const IZOHLAR = {
  q3: {
    A: { kuchli: 'Muhim ma\'lumotlarni kamdan-kam unutasiz' },
    B: { muammo: 'Muhim ma\'lumotlar ba\'zan yodingizdan chiqib ketadi' },
    C: { muammo: 'Muhim ma\'lumotlarni tez-tez unutib qo\'yasiz' },
    D: { muammo: 'Yangi ma\'lumot deyarli yodda qolmaydi — uni saqlaydigan tizim yo\'q' }
  },
  q4: {
    A: { muammo: 'Yuz va ismlarni eslab qolish qiyin kechadi' },
    B: { muammo: 'Sanalar va tug\'ilgan kunlar esdan chiqadi' },
    C: { muammo: 'Raqamlar va parollarni unutib qo\'yasiz' },
    D: { muammo: 'Kundalik ishlar va rejalar yodingizdan chiqadi — diqqat tarqoq' },
    E: { muammo: 'O\'rganilgan bilim va faktlar tez o\'chib ketadi' },
    F: { muammo: 'Yangi chet tili so\'zlari yodda qolmaydi' }
  },
  q5: {
    A: { muammo: 'Tanishganingizdan keyin ismlarni darhol unutasiz' },
    B: { muammo: 'Yangi tanishlaringiz ismini ba\'zan eslay olmaysiz' },
    C: { kuchli: 'Ismlarni yaxshi eslab qolasiz' }
  },
  q6: {
    A: { muammo: 'Yosh bilan bog\'liq xotira pasayishi sizni jiddiy tashvishlantiradi' },
    B: { muammo: 'Xotira pasayishi haqida vaqti-vaqti bilan xavotirlanasiz' }
  },
  q7: {
    A: { muammo: 'O\'tmishdagi voqealarni eslash qiyin kechadi' },
    B: { muammo: 'Ba\'zan o\'tmishdagi voqealarni eslashga qiynalasiz' },
    C: { kuchli: 'Uzoq muddatli xotirangiz yaxshi ishlaydi' }
  },
  q9: {
    B: { kuchli: 'Ikki tilda gaplashasiz — bu miya uchun doimiy mashq' },
    C: { kuchli: 'Bir necha tilda gaplashasiz — miyangiz yangi ma\'lumotga yaxshi moslashadi' },
    D: { kuchli: 'Bir necha tilda gaplashasiz — miyangiz yangi ma\'lumotga yaxshi moslashadi' }
  },
  q13: {
    A: { kuchli: 'Lokatsiyalar usulidan xabardorsiz — texnikalarni tez o\'zlashtirasiz' }
  },
  q14: {
    A: { kuchli: 'O\'zgarishga tayyorsiz — bu natijaning yarmi' },
    B: { kuchli: 'Yangi usullarni sinab ko\'rishga ochiqsiz' }
  },
  q15: {
    A: { reja: 'Kuniga 5 daqiqa — asosiy eslab qolish texnikalarini o\'rganish uchun yetarli. Eng muhimi, har kuni bajarish.' },
    B: { reja: 'Kuniga 10 daqiqa: 5 daqiqa yangi texnika va 5 daqiqa takrorlash. Shu tartib ko\'nikmani mustahkamlaydi.' },
    C: { reja: 'Kuniga 15 daqiqa: yangi texnika, takrorlash va o\'rganganingizni kundalik hayotda qo\'llash.' },
    D: { reja: 'Kuniga 20 daqiqa: to\'liq mashg\'ulot — yangi texnika, takrorlash va diqqatni jamlash mashqlari.' }
  }
};

for (const s of SAVOLLAR) {
  for (const v of s.variantlar) Object.assign(v, (IZOHLAR[s.id] || {})[v.key] || {});
}

/* --------------------------------------------------------------- VIDEOLAR */
const VIDEOLAR = [
  {
    id: 'v1',
    nom: 'Xotira va diqqatni 10 baravar kuchaytiradigan 3 ta sir',
    kimga: 'Umumiy / yangi boshlovchi',
    havola: 'https://t.me/davronturdiev_bot?start=bepuldarsminiapp',
    matn: 'Atigi bir haftada diqqatingiz va xotirangizni 10 baravar oshirishga yordam beradigan bepul videodarslik tayyorlaganman. Quyidagi "BEPUL VIDEONI KO\'RISH" tugmasini bosib, videodarsni ko\'ring.',
    yonalish: 'xotira',
    shartlar: [],
    ustunlik: 10,
    zaxira: true
  },
  {
    id: 'v2',
    nom: 'Qanday qilib istalgan xorijiy tilni tez va samarali o\'rganish mumkin?',
    kimga: 'Chet tili o\'rganuvchilar',
    havola: 'https://t.me/davronturdiev_bot?start=bepuldarsminiapp3',
    matn: 'Istalgan xorijiy tilni tez va samarali o\'rganish, yangi so\'zlarni bir necha barobar tez yodlash sirlarini ochib beradigan bepul videodarslik tayyorlaganman. Quyidagi "BEPUL VIDEONI KO\'RISH" tugmasini bosib, videodarsni ko\'ring.',
    yonalish: 'til',
    shartlar: [],
    ustunlik: 10,
    zaxira: false
  },
  {
    id: 'v3',
    nom: 'Xotirani 10 baravar kuchaytirish uchun amaliy texnikalar',
    kimga: 'Ismlar, yuzlar, raqamlar, parollar, sanalar',
    havola: 'https://t.me/davronturdiev_bot?start=bepuldars10',
    matn: 'Ismlar, yuzlar, raqamlar va sanalarni bir marotabada eslab qolish uchun amaliy texnikalarni ko\'rsatib beradigan bepul videodarslik tayyorlaganman. Quyidagi "BEPUL VIDEONI KO\'RISH" tugmasini bosib, videodarsni ko\'ring.',
    yonalish: 'xotira',
    shartlar: [{ belgi: 'aniq', min: 4 }],
    ustunlik: 20,
    zaxira: false
  },
  {
    id: 'v4',
    nom: 'Chalg\'ishni to\'xtatib qanday qilib xotira va diqqatni super darajaga olib chiqish mumkin?',
    kimga: 'Kundalik ishlarni unutadiganlar, chalg\'iydiganlar',
    havola: 'https://t.me/davronturdiev_bot?start=miniapp8',
    matn: 'Chalg\'ishni butunlay to\'xtatib, xotira va diqqatingizni super darajaga olib chiqish yo\'lini ko\'rsatadigan bepul videodarslik tayyorlaganman. Quyidagi "BEPUL VIDEONI KO\'RISH" tugmasini bosib, videodarsni ko\'ring.',
    yonalish: 'diqqat',
    shartlar: [],
    ustunlik: 10,
    zaxira: false
  },
  {
    id: 'v5',
    nom: 'Qanday qilib istalgan ma\'lumotlarni qiynalmasdan eslab qolish mumkin? Super xotiraga 7 qadam',
    kimga: 'Katta hajmdagi ma\'lumot, faktlar, kitoblar',
    havola: 'https://t.me/davronturdiev_bot?start=miniappclickvsl1',
    matn: 'Istalgan hajmdagi ma\'lumotni qiynalmasdan eslab qolish uchun "Super xotiraga 7 qadam" tizimini ochib beradigan bepul videodarslik tayyorlaganman. Quyidagi "BEPUL VIDEONI KO\'RISH" tugmasini bosib, videodarsni ko\'ring.',
    yonalish: 'xotira',
    shartlar: [{ belgi: 'hajm', min: 4 }],
    ustunlik: 20,
    zaxira: false
  },
  {
    id: 'v6',
    nom: 'Qanday qilib diqqatni 10 baravarga kuchaytirib, chalg\'imasdan soatlab dars qilish mumkin?',
    kimga: 'Talaba / o\'quvchi, uzoq o\'tirib dars qiladiganlar',
    havola: 'https://t.me/davronturdiev_bot?start=miniappclickvsl2',
    matn: 'Diqqatni 10 baravarga kuchaytirib, chalg\'imasdan soatlab dars qila olishingizga yordam beradigan bepul videodarslik tayyorlaganman. Quyidagi "BEPUL VIDEONI KO\'RISH" tugmasini bosib, videodarsni ko\'ring.',
    yonalish: 'diqqat',
    shartlar: [{ belgi: 'talaba', min: 3 }],
    ustunlik: 20,
    zaxira: false
  }
];

/* Natija sahifasida "Videoda nimalarni o'rganasiz" ro'yxati (har qator — bitta punkt) */
const VIDEO_FOYDALAR = {
  v1: 'Diqqat va xotirani kuchaytiradigan 3 ta asosiy sir\nHar kuni bajarsa bo\'ladigan oddiy mashqlar\nNatijani birinchi haftadanoq sezish uchun reja',
  v2: 'Yangi so\'zlarni tez yodlash usullari\nTil o\'rganishni tizimga solish\nO\'rganilgan so\'zlar yodda qolishi uchun takrorlash tartibi',
  v3: 'Ism va yuzlarni bir ko\'rishda eslab qolish\nRaqam, parol va sanalar uchun maxsus texnikalar\nKundalik hayotda qo\'llash uchun amaliy mashqlar',
  v4: 'Chalg\'ishning asosiy sabablari va ularni to\'xtatish\nKundalik ishlarni unutmaslik tizimi\nDiqqatni bir joyga jamlash mashqlari',
  v5: '"Super xotiraga 7 qadam" tizimi\nKatta hajmdagi ma\'lumotni tartib bilan eslab qolish\nKitob va faktlar uzoq yodda qolishi uchun usullar',
  v6: 'Soatlab chalg\'imasdan dars qilish usuli\nDiqqatni kuchaytiradigan amaliy mashqlar\nO\'qigan narsani yodda saqlab qolish tartibi'
};

for (const v of VIDEOLAR) {
  v.foydalar = VIDEO_FOYDALAR[v.id] || '';
  v.poster = null;
}

/* -------------------------------------------------------------- DARAJALAR */
const DARAJALAR = [
  {
    kod: 'yaxshi', nom: 'Yaxshi', max: 25,
    matn: 'Sizning xotirangiz yomon emas. Lekin siz uning imkoniyatlaridan atigi bir qismidan foydalanyapsiz — to\'g\'ri texnika bilan uni bir necha barobar kuchaytirish mumkin.'
  },
  {
    kod: 'orta', nom: 'O\'rta', max: 50,
    matn: 'Sizning xotirangiz o\'rtacha ishlayapti, lekin muhim narsalar tez-tez qo\'ldan chiqib ketyapti. Bu sizning vaqtingizni va imkoniyatlaringizni yeb qo\'yyapti.'
  },
  {
    kod: 'past', nom: 'Past', max: 75,
    matn: 'Sizning xotirangiz sezilarli darajada yuklangan. Sizda ma\'lumotni saqlaydigan tizim yo\'q — shuning uchun eslab qolgan narsangiz bir necha kunda o\'chib ketyapti va bu sizga katta natijalarga erishishga halaqit beryapti.'
  },
  {
    kod: 'juda-sust', nom: 'Juda sust', max: 100,
    matn: 'Sizning xotirangiz ham, diqqatingiz ham juda sust. Bu sizga katta natijalarga erishish va daromadingiz oshishiga halaqit beryapti. Lekin bu muammoni hal qilish mumkin.'
  }
];

/* ---------------------------------------------------------------- MATNLAR */
const MATNLAR = {
  sayt_nomi: 'Xotira va diqqat testi',
  sayt_tavsif: '15 ta savoldan iborat xotira va diqqat testi. Natijangizga mos bepul videodarslik oling.',

  kirish_belgi: '🧠',
  kirish_sarlavha: 'Xotira va diqqat testi',
  kirish_matn: '15 ta qisqa savol — atigi 2 daqiqa.\nJavoblaringiz asosida sizga aynan mos keladigan bepul videodarslik tanlanadi.',
  kirish_stat1: '15|savol',
  kirish_stat2: '2|daqiqa',
  kirish_stat3: '1|shaxsiy natija',
  kirish_tugma: 'BOSHLASH',

  savol_yordam: 'Davom etish uchun bitta variantni tanlang',
  savol_ogohlantirish: 'Iltimos, bitta variantni tanlang — bu savol majburiy.',
  savol_tugma: 'OK',
  savol_tugma_oxirgi: 'YAKUNLASH',
  savol_orqaga: '← Orqaga',

  lead_belgi: '✓ Test yakunlandi',
  lead_sarlavha: 'Natijangiz tayyor!',
  lead_matn: 'Natijani ko\'rish va sizga mos bepul videodarslikni olish uchun ma\'lumotlaringizni kiriting.',
  lead_ism_label: 'Ismingiz',
  lead_ism_placeholder: 'Masalan: Davron',
  lead_tel_label: 'Telefon raqamingiz',
  lead_tugma: 'NATIJANI KO\'RISH →',
  lead_izoh: 'Ma\'lumotlaringiz uchinchi shaxslarga berilmaydi.',

  yuklanish_1: 'Javoblaringiz tahlil qilinmoqda...',
  yuklanish_2: 'Xotira profilingiz aniqlanmoqda...',
  yuklanish_3: 'Sizga mos videodarslik tanlanmoqda...',

  natija_sarlavha: 'NATIJANGIZ',
  natija_tugma: 'BEPUL VIDEONI KO\'RISH',
  natija_salom: '{ism}, natijangiz tayyor',
  natija_kuch_nom: 'Xotira kuchi',
  natija_diqqat_nom: 'Diqqatingiz',
  natija_yonalish_sarlavha: 'Muammo qaysi sohada',
  natija_yonalish_izoh: 'Foiz qancha yuqori bo\'lsa, shu sohada yordam shuncha zarur',
  natija_oq_xotira: 'Xotira: ism, raqam, faktlar',
  natija_oq_diqqat: 'Diqqat va chalg\'ish',
  natija_oq_til: 'Chet tili o\'rganish',
  natija_muammo_sarlavha: 'Asosiy muammolaringiz',
  natija_kuchli_sarlavha: 'Kuchli tomonlaringiz',
  natija_reja_sarlavha: 'Kunlik rejangiz',
  natija_taqqos_yaxshi: 'Testdan o\'tgan {soni} kishining {foiz}% idan yaxshiroq natija ko\'rsatdingiz',
  natija_taqqos_past: 'Testdan o\'tgan {soni} kishining {foiz}% i sizdan yaxshiroq natija ko\'rsatdi — xotirani mashq qilish vaqti keldi',
  natija_video_sarlavha: 'Sizga mos bepul videodars',
  natija_video_foyda: 'Videoda nimalarni o\'rganasiz:',
  tg_natija_sarlavha: '🧠 {ism}, test natijangiz',

  xato_sarlavha: 'XATOLIK',
  xato_tugma: 'QAYTA URINISH',

  bot_salom: 'Assalomu alaykum, {ism}! 👋\n\nBu — xotira va diqqat testi. 15 ta qisqa savol, atigi 2 daqiqa.\n\nJavoblaringiz asosida sizga aynan mos keladigan bepul videodarslik tanlanadi.\n\nBoshlash uchun pastdagi tugmani bosing 👇',
  bot_tugma: '🧠 Testni boshlash',
  tg_raqam_tugma: '📱 Telegramdagi raqamimni yuborish'
};

/* ----------------------------------------------------------------- DIZAYN */

/* Ikkala mavzuda ham bir xil bo'ladigan o'lchamlar */
const SHAKL = {
  burchak: '999px',
  sarlavha_olcham: '40px'
};

/* Qorong'i mavzu (standart) */
const QORONGI = {
  fon_1: '#0e1b33',
  fon_2: '#0b1220',
  fon_3: '#05080f',
  natija_fon_1: '#1a1440',
  natija_fon_2: '#0d0a22',
  natija_fon_3: '#05060f',

  matn_rang: '#eef4ff',
  xira_rang: '#9db0cc',
  natija_matn: '#dbe3f5',

  maydon_fon: '#16213a',
  maydon_chegara: '#2c3a55',

  variant_1: '#2b5f96',
  variant_2: '#22527f',
  variant_matn: '#eef4ff',
  variant_tanlangan_1: '#3d8ddb',
  variant_tanlangan_2: '#2f76bd',
  variant_tanlangan_matn: '#ffffff',

  raqam_fon: '#ffffff',
  raqam_matn: '#0e1b33',

  tugma_rang: '#3aa0ff',
  tugma_matn: '#ffffff',
  cta_rang: '#6b4cf6',
  cta_rang_2: '#7c5cff',
  cta_matn: '#ffffff'
};

/* Yorug' mavzu */
const YORUG = {
  fon_1: '#ffffff',
  fon_2: '#f2f6fc',
  fon_3: '#e6edf7',
  natija_fon_1: '#f8f5ff',
  natija_fon_2: '#f0ebff',
  natija_fon_3: '#e8e1fb',

  matn_rang: '#101a2b',
  xira_rang: '#5b6b85',
  natija_matn: '#23334d',

  maydon_fon: '#ffffff',
  maydon_chegara: '#d3dcea',

  variant_1: '#dfeaf9',
  variant_2: '#cfe0f5',
  variant_matn: '#12395f',
  variant_tanlangan_1: '#3d8ddb',
  variant_tanlangan_2: '#2f76bd',
  variant_tanlangan_matn: '#ffffff',

  raqam_fon: '#12395f',
  raqam_matn: '#ffffff',

  tugma_rang: '#2b86dd',
  tugma_matn: '#ffffff',
  cta_rang: '#6b4cf6',
  cta_rang_2: '#7c5cff',
  cta_matn: '#ffffff'
};

const DIZAYN = {
  shakl: Object.assign({}, SHAKL),
  qorongi: Object.assign({}, QORONGI),
  yorug: Object.assign({}, YORUG)
};

/* Admin panel dizayn bo'limi shu ro'yxatdan chizadi */
const RANG_NOMLARI = [
  ['fon_1', 'Fon — yuqori'],
  ['fon_2', "Fon — o'rta"],
  ['fon_3', 'Fon — past'],
  ['natija_fon_1', 'Natija foni — yuqori'],
  ['natija_fon_2', "Natija foni — o'rta"],
  ['natija_fon_3', 'Natija foni — past'],
  ['matn_rang', 'Asosiy matn'],
  ['xira_rang', 'Xira matn'],
  ['natija_matn', 'Natija sahifasi matni'],
  ['maydon_fon', 'Kiritish maydoni foni'],
  ['maydon_chegara', 'Kiritish maydoni chegarasi'],
  ['variant_1', 'Variant tugmasi — yuqori'],
  ['variant_2', 'Variant tugmasi — past'],
  ['variant_matn', 'Variant tugmasi matni'],
  ['variant_tanlangan_1', 'Tanlangan variant — yuqori'],
  ['variant_tanlangan_2', 'Tanlangan variant — past'],
  ['variant_tanlangan_matn', 'Tanlangan variant matni'],
  ['raqam_fon', 'Savol raqami foni'],
  ['raqam_matn', 'Savol raqami matni'],
  ['tugma_rang', 'OK tugmasi'],
  ['tugma_matn', 'OK tugmasi matni'],
  ['cta_rang', 'Katta tugma — asosiy'],
  ['cta_rang_2', "Katta tugma — yorug'"],
  ['cta_matn', 'Katta tugma matni']
];

const SHAKL_NOMLARI = [
  ['burchak', 'Tugmalar burchagi (999px — dumaloq, 14px — kvadratroq)'],
  ['sarlavha_olcham', "NATIJANGIZ sarlavhasi o'lchami (masalan 40px)"]
];

/* ---------------------------------------------------------------- SOZLAMA */
function boshlangichConfig() {
  return {
    savollar: JSON.parse(JSON.stringify(SAVOLLAR)),
    videolar: JSON.parse(JSON.stringify(VIDEOLAR)),
    darajalar: JSON.parse(JSON.stringify(DARAJALAR)),
    matnlar: Object.assign({}, MATNLAR),
    dizayn: JSON.parse(JSON.stringify(DIZAYN)),
    yoshSavoli: 'q1',
    izohVersiya: 1,
    yangilangan: null
  };
}

/* Ball beriladigan o'qlar va belgilar (admin panel shu ro'yxatdan chizadi) */
const OQLAR = [
  { kod: 'xotira', nom: 'Xotira' },
  { kod: 'diqqat', nom: 'Diqqat' },
  { kod: 'til', nom: 'Til' }
];

const BELGILAR = [
  { kod: 'aniq', nom: 'Aniq ma\'lumot', izoh: 'Ismlar, raqamlar, sanalar' },
  { kod: 'hajm', nom: 'Hajm', izoh: 'Kitob, faktlar, katta hajmdagi bilim' },
  { kod: 'talaba', nom: 'Talaba', izoh: 'O\'qish/dars konteksti' },
  { kod: 'yangi', nom: 'Yangi boshlovchi', izoh: 'Tajribasiz, vaqti kam' }
];

module.exports = { boshlangichConfig, OQLAR, BELGILAR, RANG_NOMLARI, SHAKL_NOMLARI, VIDEO_FOYDALAR };
