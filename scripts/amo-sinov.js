/* ============================================================
   amoCRM ULANISHINI SINASH

     node scripts/amo-sinov.js           — faqat ulanishni tekshiradi
     node scripts/amo-sinov.js --lid     — sinov lidini ham yaratadi

   Sinov lidi amoCRM'da "SINOV — o'chirib yuboring" nomi bilan chiqadi.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

// .env ni o'qiymiz
const envFayl = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFayl)) {
  for (const satr of fs.readFileSync(envFayl, 'utf8').split(/\r?\n/)) {
    const t = satr.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}

const amo = require('../lib/amo.js');

const yashil = (s) => '\x1b[32m' + s + '\x1b[0m';
const qizil = (s) => '\x1b[31m' + s + '\x1b[0m';
const kok = (s) => '\n\x1b[1m\x1b[36m' + s + '\x1b[0m';

(async () => {
  console.log(kok('SOZLAMALAR'));
  const h = amo.holat();
  console.log('Domen:      ' + (h.domen || qizil('kiritilmagan')));
  console.log('Token:      ' + (process.env.AMO_TOKEN ? yashil('bor (' + process.env.AMO_TOKEN.length + ' belgi)') : qizil('yo\'q')));
  console.log('Voronka:    ' + (process.env.AMO_PIPELINE_ID || 'standart'));
  console.log('Bosqich:    ' + (process.env.AMO_STATUS_ID || 'standart'));
  console.log('Mas\'ul:     ' + (process.env.AMO_RESPONSIBLE_ID || 'standart'));
  console.log('Teg:        ' + (process.env.AMO_TEG || 'Xotira testi'));
  console.log('Navbatda:   ' + h.navbatda + ' ta lid');

  if (!h.yoqilgan) {
    console.log(qizil('\nAMO_DOMEN va AMO_TOKEN to\'ldirilmagan — integratsiya o\'chiq.'));
    process.exit(1);
  }

  console.log(kok('ULANISH'));
  const t = await amo.tekshir();
  if (!t.ok) {
    console.log(qizil('✗ ' + t.xato));
    console.log('\nTekshiring: token to\'g\'ri ko\'chirilganmi, muddati o\'tmaganmi,');
    console.log('integratsiyaga "lidlar" va "kontaktlar" huquqi berilganmi.');
    process.exit(1);
  }
  console.log(yashil('✓ Ulanish ishlayapti'));
  console.log('  Hisob: ' + (t.hisob || '-') + ' (id ' + t.id + ')');

  if (!process.argv.includes('--lid')) {
    console.log('\nSinov lidini ham yaratish uchun: node scripts/amo-sinov.js --lid');
    return;
  }

  console.log(kok('SINOV LIDI'));
  const namuna = {
    vaqt: new Date().toISOString(),
    ism: 'SINOV — o\'chirib yuboring',
    telefon: '+998900000000',
    video_nomi: 'Sinov videosi',
    havola: 'https://example.com',
    yonalish: 'xotira',
    daraja: 'O\'rta',
    daraja_foiz: 50,
    ball_xotira: 60, ball_diqqat: 20, ball_til: 10,
    q1_matn: '25 - 34',
    q2_matn: 'Ishimda karyera uchun'
  };

  const n = await amo.yubor(namuna);
  if (n.ok) {
    console.log(yashil('✓ Lid yaratildi, id: ' + n.id));
    console.log('  amoCRM ga kirib tekshiring va sinov lidini o\'chirib yuboring.');
  } else {
    console.log(qizil('✗ Yuborilmadi (' + n.sabab + ')'));
    console.log('  Lid navbatda saqlandi, keyin qayta uriniladi.');
    process.exit(1);
  }
})();
