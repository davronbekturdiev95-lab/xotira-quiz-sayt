/**
 * GOOGLE SHEETS'GA NATIJALARNI YOZISH
 * ============================================================
 * O'RNATISH (5 daqiqa):
 *
 * 1. Google Sheets'da yangi jadval oching, nomini "Xotira testi" qo'ying.
 * 2. Yuqoridan:  Kengaytmalar (Extensions) → Apps Script
 * 3. Ochilgan oynadagi hamma kodni o'chirib, SHU FAYL mazmunini joylashtiring.
 * 4. Pastdagi MAXFIY_KALIT ni o'zgartiring (istalgan uzun matn).
 * 5. Yuqoridan:  Deploy → New deployment
 *      • Turi (Select type ⚙️) → Web app
 *      • Execute as:        Me
 *      • Who has access:    Anyone
 *      • Deploy → ruxsat bering (Authorize access)
 * 6. Chiqqan "Web app URL" ni nusxalang (https://script.google.com/macros/s/.../exec)
 * 7. Serverdagi .env fayliga qo'ying:
 *      SHEETS_URL=https://script.google.com/macros/s/.../exec
 *      SHEETS_SECRET=sizning-maxfiy-kalitingiz
 * ============================================================
 */

var MAXFIY_KALIT = 'buni-ozgartiring-uzun-maxfiy-kalit';
var VARAQ_NOMI = 'Natijalar';

/** Ustunlar tartibi (jadval sarlavhasi) */
var USTUNLAR = [
  ['vaqt_local', 'Vaqt'],
  ['ism', 'Ism'],
  ['telefon', 'Telefon'],
  ['davlat', 'Davlat'],
  ['video_id', 'Video'],
  ['video_nomi', 'Video nomi'],
  ['havola', 'Havola'],
  ['daraja', 'Daraja'],
  ['daraja_foiz', 'Daraja %'],
  ['yonalish', "Yo'nalish"],
  ['ball_xotira', 'Xotira %'],
  ['ball_diqqat', 'Diqqat %'],
  ['ball_til', 'Til %'],
  ['kuniga_daqiqa', 'Kuniga daqiqa'],
  ['manba', 'Manba'],
  ['utm', 'UTM'],
  ['q1_matn', '1. Yosh'],
  ['q2_matn', '2. Nima uchun'],
  ['q3_matn', '3. Tez unutish'],
  ['q4_matn', '4. Nimani unutadi'],
  ['q5_matn', '5. Ismlar'],
  ['q6_matn', '6. Yosh tashvishi'],
  ['q7_matn', "7. O'tmish xotiralar"],
  ['q8_matn', '8. Nima uchun kerak'],
  ['q9_matn', '9. Tillar soni'],
  ['q10_matn', '10. Karyera'],
  ['q11_matn', '11. Mashqlar'],
  ['q12_matn', '12. Nazorat'],
  ['q13_matn', '13. Lokatsiyalar usuli'],
  ['q14_matn', '14. Tayyorlik'],
  ['q15_matn', '15. Kuniga vaqt'],
  ['javob_kodlari', 'Javob kodlari']
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (MAXFIY_KALIT && data.secret !== MAXFIY_KALIT) {
      return javob({ ok: false, error: 'Kalit notogri' });
    }

    var varaq = varaqniOl();

    // Toshkent vaqti
    data.vaqt_local = Utilities.formatDate(
      data.vaqt ? new Date(data.vaqt) : new Date(),
      'Asia/Tashkent',
      'yyyy-MM-dd HH:mm:ss'
    );

    // Javob kodlarini bitta ustunga yig'amiz: 1A 2C 3B ...
    var kodlar = [];
    for (var i = 1; i <= 15; i++) {
      if (data['q' + i]) kodlar.push(i + data['q' + i]);
    }
    data.javob_kodlari = kodlar.join(' ');

    var qator = USTUNLAR.map(function (u) {
      var v = data[u[0]];
      return (v === undefined || v === null) ? '' : v;
    });

    varaq.appendRow(qator);
    return javob({ ok: true });
  } catch (err) {
    return javob({ ok: false, error: String(err) });
  }
}

function doGet() {
  return javob({ ok: true, xabar: 'Xotira testi — natijalar qabul qilinmoqda' });
}

function varaqniOl() {
  var jadval = SpreadsheetApp.getActiveSpreadsheet();
  var varaq = jadval.getSheetByName(VARAQ_NOMI);

  if (!varaq) {
    varaq = jadval.insertSheet(VARAQ_NOMI);
  }

  if (varaq.getLastRow() === 0) {
    var sarlavha = USTUNLAR.map(function (u) { return u[1]; });
    varaq.appendRow(sarlavha);
    varaq.getRange(1, 1, 1, sarlavha.length)
      .setFontWeight('bold')
      .setBackground('#1a1440')
      .setFontColor('#ffffff');
    varaq.setFrozenRows(1);
    varaq.setColumnWidth(1, 140);
  }

  // Telefon ustuni MATN bo'lishi shart — aks holda Google Sheets "+998..." ni
  // formula deb o'ylab, raqamga aylantirib yuboradi (9,98933E+11 bo'lib ketadi)
  for (var i = 0; i < USTUNLAR.length; i++) {
    if (USTUNLAR[i][0] === 'telefon') {
      varaq.getRange(1, i + 1, varaq.getMaxRows()).setNumberFormat('@');
      varaq.setColumnWidth(i + 1, 150);
      break;
    }
  }

  return varaq;
}

function javob(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
