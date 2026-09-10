/* ============================================================================
 * TELEFON RAQAM UCHUN DAVLATLAR
 *   dial     — xalqaro kod (+ belgisiz)
 *   uzunlik  — kod'dan keyingi raqamlar soni [eng kam, eng ko'p]
 *   namuna   — foydalanuvchiga ko'rsatiladigan namuna
 * ========================================================================== */
'use strict';

const DAVLATLAR = [
  { kod: 'UZ', nom: "O'zbekiston",     bayroq: '🇺🇿', dial: '998', uzunlik: [9, 9],   namuna: '90 123 45 67' },
  { kod: 'RU', nom: 'Rossiya',          bayroq: '🇷🇺', dial: '7',   uzunlik: [10, 10], namuna: '912 345 67 89' },
  { kod: 'KZ', nom: "Qozog'iston",      bayroq: '🇰🇿', dial: '7',   uzunlik: [10, 10], namuna: '701 234 56 78' },
  { kod: 'KG', nom: "Qirg'iziston",     bayroq: '🇰🇬', dial: '996', uzunlik: [9, 9],   namuna: '700 123 456' },
  { kod: 'TJ', nom: 'Tojikiston',       bayroq: '🇹🇯', dial: '992', uzunlik: [9, 9],   namuna: '900 12 34 56' },
  { kod: 'TM', nom: 'Turkmaniston',     bayroq: '🇹🇲', dial: '993', uzunlik: [8, 8],   namuna: '65 123456' },
  { kod: 'AZ', nom: 'Ozarbayjon',       bayroq: '🇦🇿', dial: '994', uzunlik: [9, 9],   namuna: '50 123 45 67' },
  { kod: 'TR', nom: 'Turkiya',          bayroq: '🇹🇷', dial: '90',  uzunlik: [10, 10], namuna: '532 123 45 67' },
  { kod: 'AE', nom: 'BAA',              bayroq: '🇦🇪', dial: '971', uzunlik: [8, 9],   namuna: '50 123 4567' },
  { kod: 'SA', nom: 'Saudiya Arabistoni', bayroq: '🇸🇦', dial: '966', uzunlik: [9, 9], namuna: '51 234 5678' },
  { kod: 'US', nom: 'AQSH',             bayroq: '🇺🇸', dial: '1',   uzunlik: [10, 10], namuna: '201 555 0123' },
  { kod: 'CA', nom: 'Kanada',           bayroq: '🇨🇦', dial: '1',   uzunlik: [10, 10], namuna: '416 555 0123' },
  { kod: 'GB', nom: 'Buyuk Britaniya',  bayroq: '🇬🇧', dial: '44',  uzunlik: [10, 10], namuna: '7400 123456' },
  { kod: 'DE', nom: 'Germaniya',        bayroq: '🇩🇪', dial: '49',  uzunlik: [10, 11], namuna: '1512 3456789' },
  { kod: 'FR', nom: 'Fransiya',         bayroq: '🇫🇷', dial: '33',  uzunlik: [9, 9],   namuna: '6 12 34 56 78' },
  { kod: 'IT', nom: 'Italiya',          bayroq: '🇮🇹', dial: '39',  uzunlik: [9, 10],  namuna: '312 345 6789' },
  { kod: 'ES', nom: 'Ispaniya',         bayroq: '🇪🇸', dial: '34',  uzunlik: [9, 9],   namuna: '612 345 678' },
  { kod: 'PL', nom: 'Polsha',           bayroq: '🇵🇱', dial: '48',  uzunlik: [9, 9],   namuna: '512 345 678' },
  { kod: 'UA', nom: 'Ukraina',          bayroq: '🇺🇦', dial: '380', uzunlik: [9, 9],   namuna: '50 123 4567' },
  { kod: 'BY', nom: 'Belarus',          bayroq: '🇧🇾', dial: '375', uzunlik: [9, 9],   namuna: '29 123 45 67' },
  { kod: 'GE', nom: 'Gruziya',          bayroq: '🇬🇪', dial: '995', uzunlik: [9, 9],   namuna: '555 12 34 56' },
  { kod: 'AM', nom: 'Armaniston',       bayroq: '🇦🇲', dial: '374', uzunlik: [8, 8],   namuna: '77 123456' },
  { kod: 'KR', nom: 'Janubiy Koreya',   bayroq: '🇰🇷', dial: '82',  uzunlik: [9, 10],  namuna: '10 1234 5678' },
  { kod: 'JP', nom: 'Yaponiya',         bayroq: '🇯🇵', dial: '81',  uzunlik: [10, 10], namuna: '90 1234 5678' },
  { kod: 'CN', nom: 'Xitoy',            bayroq: '🇨🇳', dial: '86',  uzunlik: [11, 11], namuna: '131 2345 6789' },
  { kod: 'IN', nom: 'Hindiston',        bayroq: '🇮🇳', dial: '91',  uzunlik: [10, 10], namuna: '98765 43210' },
  { kod: 'MY', nom: 'Malayziya',        bayroq: '🇲🇾', dial: '60',  uzunlik: [9, 10],  namuna: '12 345 6789' },
  { kod: 'EG', nom: 'Misr',             bayroq: '🇪🇬', dial: '20',  uzunlik: [10, 10], namuna: '100 123 4567' },
  { kod: 'AF', nom: "Afg'oniston",      bayroq: '🇦🇫', dial: '93',  uzunlik: [9, 9],   namuna: '70 123 4567' },
  { kod: 'PK', nom: 'Pokiston',         bayroq: '🇵🇰', dial: '92',  uzunlik: [10, 10], namuna: '301 2345678' },
  { kod: 'XX', nom: 'Boshqa davlat',    bayroq: '🌍', dial: '',    uzunlik: [6, 15],  namuna: 'kodi bilan yozing' }
];

/** O'zbekiston operator kodlari */
const UZ_OPERATORLAR = /^(9[0-9]|33|43|50|55|6[0-9]|7[0-9]|88)/;

function davlatTop(kod) {
  return DAVLATLAR.find((d) => d.kod === kod) || null;
}

module.exports = { DAVLATLAR, UZ_OPERATORLAR, davlatTop };
