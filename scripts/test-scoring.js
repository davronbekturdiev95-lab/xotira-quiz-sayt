/* ============================================================
   BALL TIZIMINI SINASH — joriy sozlamalar asosida
   Ishga tushirish:  npm run test:score
   ============================================================ */
'use strict';

const store = require('../lib/store.js');
const quiz = require('../lib/quiz.js');

const rang = {
  bosh: (s) => '\n\x1b[1m\x1b[36m' + s + '\x1b[0m',
  ok: (s) => '\x1b[32m' + s + '\x1b[0m',
  xato: (s) => '\x1b[31m' + s + '\x1b[0m',
  kul: (s) => '\x1b[90m' + s + '\x1b[0m'
};

const config = store.configOl();
const faol = quiz.faolSavollar(config);   // saytda ko'rinadigan savollar
let xatolar = 0;

console.log(rang.bosh('SOZLAMALAR'));
console.log(`Savollar: ${config.savollar.length} ta (saytda ko'rinadi: ${faol.length})`);
console.log(`Videolar: ${config.videolar.length} ta`);
console.log('Maksimal ballar:', quiz.maksimum(faol));

/* ---------------- Qoidalarni tekshirish ---------------- */
console.log(rang.bosh('VIDEO QOIDALARI'));
for (const v of config.videolar) {
  const shartlar = (v.shartlar || []).map((s) => `${s.belgi} ≥ ${s.min}`).join(', ') || '—';
  console.log(`${v.id.toUpperCase().padEnd(6)} yo'nalish: ${String(v.yonalish).padEnd(9)} ustunlik: ${String(v.ustunlik).padEnd(4)} shart: ${shartlar}${v.zaxira ? rang.kul('  [zaxira]') : ''}`);
}
if (!config.videolar.some((v) => v.zaxira)) {
  console.log(rang.xato('✗ Zaxira video belgilanmagan'));
  xatolar++;
}

/* ---------------- Tasodifiy taqsimot ---------------- */
const N = 200000;
console.log(rang.bosh(`TASODIFIY ${N.toLocaleString('ru-RU')} TA JAVOB`));

const sanoq = {};
const darajaSanoq = {};
config.videolar.forEach((v) => { sanoq[v.id] = 0; });

for (let i = 0; i < N; i++) {
  const javoblar = {};
  for (const savol of faol) {
    javoblar[savol.id] = savol.variantlar[Math.floor(Math.random() * savol.variantlar.length)].key;
  }
  const natija = quiz.hisobla(config, javoblar);
  if (natija.videoId) sanoq[natija.videoId] = (sanoq[natija.videoId] || 0) + 1;
  darajaSanoq[natija.daraja] = (darajaSanoq[natija.daraja] || 0) + 1;
}

for (const v of config.videolar) {
  const son = sanoq[v.id] || 0;
  const foiz = (son / N) * 100;
  const chiziq = '█'.repeat(Math.max(1, Math.round(foiz / 2)));
  const belgi = son === 0 ? rang.xato('✗ HECH QACHON CHIQMAYDI') : rang.ok('✓');
  console.log(`${belgi} ${v.id.toUpperCase().padEnd(6)} ${foiz.toFixed(1).padStart(5)}%  ${chiziq}  ${rang.kul(v.kimga || v.nom.slice(0, 40))}`);
  if (son === 0) xatolar++;
}

console.log(rang.bosh('DARAJALAR'));
for (const d of config.darajalar) {
  const son = darajaSanoq[d.nom] || 0;
  console.log(`${String(d.nom).padEnd(12)} ${((son / N) * 100).toFixed(1).padStart(5)}%   ${rang.kul('0–' + d.max + '%')}`);
}

/* ---------------- Javob tekshiruvi ---------------- */
console.log(rang.bosh('JAVOBLARNI TEKSHIRISH'));
const toliqsiz = quiz.javoblarniTekshir(faol, { [faol[0].id]: 'A' });
console.log(toliqsiz.xato ? rang.ok('✓ To\'liqsiz javob rad etildi: ' + toliqsiz.xato) : rang.xato('✗ To\'liqsiz javob o\'tib ketdi'));
if (!toliqsiz.xato) xatolar++;

const notogri = {};
faol.forEach((s) => { notogri[s.id] = 'Z'; });
const notogriNatija = quiz.javoblarniTekshir(faol, notogri);
console.log(notogriNatija.xato ? rang.ok('✓ Noto\'g\'ri variant rad etildi') : rang.xato('✗ Noto\'g\'ri variant o\'tib ketdi'));
if (!notogriNatija.xato) xatolar++;

console.log('');
if (xatolar) {
  console.log(rang.xato(`${xatolar} ta muammo topildi.`));
  process.exit(1);
} else {
  console.log(rang.ok('Hammasi joyida.'));
}
