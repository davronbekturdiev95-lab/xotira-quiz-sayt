# Xotira testi — sayt + boshqaruv paneli

Test sayti: foydalanuvchi savollarga javob beradi, ball to'planadi, oxirida ism va telefon
so'raladi va **NATIJANGIZ** sahifasi chiqadi. "BEPUL VIDEONI KO'RISH" tugmasi javoblarga
qarab kerakli havolaga olib boradi.

**Hamma narsa admin paneldan boshqariladi** — savollar, variantlar, ballar, videolar,
havolalar, sayt matnlari va dizayn. Kodga tegish shart emas.

---

## 1. Ishga tushirish

Kerak bo'ladi: **Node.js 18+**, domen va SSL. Boshqa hech narsa — npm paketlari yo'q.

```bash
cp .env.example .env
```

`.env` ni to'ldiring:
```
BOSH_ADMIN_LOGIN=admin
ADMIN_PAROL=uzun-va-murakkab-parol
SHEETS_URL=
SHEETS_SECRET=uzun-maxfiy-kalit
PORT=3000
```

```bash
npm start
```

- Sayt: `http://localhost:3000`
- Panel: `http://localhost:3000/admin`

> `ADMIN_PAROL` faqat **birinchi ishga tushirishda** ishlatiladi — bosh admin hisobi shundan
> yaratiladi. Keyin parol panel orqali o'zgartiriladi va `.env` dagi qiymat e'tiborsiz qoladi.

### Serverda doimiy ishlashi (Ubuntu VPS)

Loyihani serverga ko'chiring va bitta buyruq bering:

```bash
sudo bash deploy/ornatish.sh test.sizningdomen.uz sizning@pochta.uz
```

Skript o'zi qiladi: Node.js o'rnatish, fayllarni joylash, `.env` yaratish (tasodifiy
admin parol bilan), systemd xizmati (server o'chib yonsa avtomatik ko'tariladi),
Nginx sozlash, bepul SSL sertifikat.

Qayta o'rnatganda `data/` papkasiga tegmaydi va oldin zaxira nusxa oladi.

**Foydali buyruqlar:**
```bash
systemctl status xotira      # holati
systemctl restart xotira     # qayta ishga tushirish
journalctl -u xotira -f      # jonli loglar
```

### Zaxira nusxa

```bash
sudo bash deploy/zaxira.sh
```
Har kuni avtomatik olish uchun `sudo crontab -e` ga qo'shing:
```
0 3 * * * bash /var/www/xotira-quiz-sayt/deploy/zaxira.sh
```

> `data/` papkasini o'chirmang — sozlamalar, adminlar, tarix va natijalar shu yerda.

---

## 2. Boshqaruv paneli — `/admin`

Login va parol bilan kiriladi. Sessiya 12 soat turadi.
Parol 8 marta xato terilsa IP 10 daqiqaga bloklanadi.

| Bo'lim | Nima qilinadi |
|---|---|
| **Savollar** | Savol qo'shish, o'chirish, tartibini o'zgartirish. Variant qo'shish/o'chirish. Har bir variant qanday ball berishini sozlash |
| **Videolar** | Video qo'shish, o'chirish, havola va matnini o'zgartirish. Video qaysi holatda chiqishini qoida bilan belgilash |
| **Matnlar** | Kirish sahifasi, savol ekrani, forma, natija sahifasi — barcha yozuvlar. Shu yerda daraja matnlari ham bor |
| **Dizayn** | **Ikkita palitra** — qorong'i va yorug' mavzu. Ranglar, tugma burchagi, sarlavha o'lchami |
| **Statistika** | Nechta odam tugatgan, qaysi video qancha chiqqan, oxirgi 30 ta lead, Excel yuklab olish |
| **Adminlar** | Yangi admin qo'shish, o'chirish, parol almashtirish (faqat bosh admin) |
| **Tarix** | Qaysi admin qachon nimani o'zgartirgani — eski va yangi qiymati bilan |

Har qanday o'zgarish **saqlangan zahoti** saytda kuchga kiradi — serverni qayta ishga
tushirish shart emas.

### Rollar

| Rol | Huquqlar |
|---|---|
| **Bosh admin** | Hamma narsa + adminlarni qo'shish/o'chirish, parollarini almashtirish |
| **Admin** | Savollar, videolar, matnlar, dizayn, statistika, tarix. Adminlarga tegolmaydi |

Oxirgi bosh adminni o'chirib bo'lmaydi. O'zini o'chira olmaydi.

---

## 3. Mavzular (light / dark)

Sayt ham, admin panel ham ikkita mavzuda ishlaydi:

- Foydalanuvchi telefoni yoki brauzeri qaysi rejimda bo'lsa — sayt **o'zi shunga moslashadi**
- O'ng yuqoridagi tugma orqali **qo'lda ham** almashtiriladi
- Tanlov brauzerda saqlanadi va keyingi safar ham eslab qolinadi

Ikkala palitraning ranglari admin panelning **Dizayn** bo'limida alohida sozlanadi
(yuqoridagi "Qorong'i mavzu / Yorug' mavzu" tugmalari orqali almashtiriladi).

---

## 4. Telefon raqamlar

Formada davlat tanlagich bor — 30 ta davlat va "Boshqa davlat" varianti.
Har bir davlat uchun raqam uzunligi alohida tekshiriladi:

| Davlat | Format | Misol |
|---|---|---|
| O'zbekiston | 9 raqam + operator kodi tekshiriladi | +998 90 123 45 67 |
| Rossiya / Qozog'iston | 10 raqam | +7 912 345 6789 |
| Turkiya | 10 raqam | +90 532 123 4567 |
| AQSH / Kanada | 10 raqam | +1 201 555 0123 |
| Boshqa davlat | 7–15 raqam, erkin format | — |

Raqam bazaga xalqaro shaklda yoziladi: `+998901234567`.

### Bayroqlar haqida

Telefonlarda (Android, iPhone) va Mac'da davlat bayroqlari o'z-o'zidan chiqadi.
Windows'da esa bayroq emojilari umuman yo'q — brauzer ularni "UZ", "RU" harflari
bilan almashtiradi. Shuning uchun saytga bayroq shrifti qo'shilgan:
`public/fonts/bayroqlar.woff2` (Noto Color Emoji'dan kesib olingan, 580 KB).

Shrift **faqat kerak bo'lganda** yuklanadi: sahifa ochilganda brauzer bayroqni
chiza oladimi-yo'qmi tekshiriladi, chiza olsa shrift umuman yuklanmaydi.
Ya'ni telefondan kirgan foydalanuvchilarga qo'shimcha yuk tushmaydi.
Google Sheets va CSV'da alohida "Davlat" ustuni ham bo'ladi.

---

## 5. Savol ekrani

**OK tugmasi o'ng tomonda** turadi — ko'pchilik telefonni o'ng qo'lida ushlagani uchun
bosh barmoq bilan yetib borish qulay. "Orqaga" tugmasi chap tomonda.

---

## 6. Ball tizimi qanday ishlaydi

Ikkita mustaqil hisob bor:

| Hisob | Nimani hal qiladi |
|---|---|
| **Mavzu o'qlari** (Xotira / Diqqat / Til) | Qaysi video havolasi beriladi |
| **Daraja balli** (0–100%) | Natija sahifasidagi diagnostika matni |

### Videoni tanlash

1. Har bir o'q bo'yicha ball yig'iladi va **foizga** aylantiriladi
   (o'zining maksimumiga bo'linadi — shuning uchun taqqoslash adolatli)
2. Eng yuqori foizli o'q **g'olib** bo'ladi
3. Shu yo'nalishga tegishli videolardan **shartlari bajarilganlari** olinadi
4. Ular ichidan **ustunligi eng katta**si tanlanadi
5. Hech biri mos kelmasa — **zaxira** video beriladi

Standart sozlama:

| Video | Yo'nalish | Shart | Ustunlik |
|---|---|---|---|
| V1 · 3 ta sir | xotira | — | 10 · zaxira |
| V2 · Xorijiy til | til | — | 10 |
| V3 · Amaliy texnikalar | xotira | aniq ≥ 4 | 20 |
| V4 · Chalg'ishni to'xtatish | diqqat | — | 10 |
| V5 · 7 qadam | xotira | hajm ≥ 4 | 20 |
| V6 · Soatlab dars qilish | diqqat | talaba ≥ 3 | 20 |

### Belgilar

| Belgi | Ma'nosi |
|---|---|
| **aniq** | Ism, yuz, raqam, parol, sana |
| **hajm** | Kitob, faktlar, katta hajmdagi bilim |
| **talaba** | O'quvchi/talaba, dars qilish konteksti |
| **yangi** | Yangi boshlovchi, vaqti kam, tajribasiz |

### Yoshga bog'liq maxsus qoida

Bitta savol "yosh savoli" deb belgilanadi (panelda radio tugma). Uning har bir varianti
`18–34` yoki `35+` guruhiga tegishli bo'ladi.

Istalgan variantga `35+` tugmasi orqali **ikkinchi ball to'plami** berilishi mumkin —
u faqat 35+ yoshdagilarga qo'llanadi. Hozir 12-savolda shunday: "Nazorat muhim" javobi
yoshlarga `diqqat+2, talaba+1`, kattalarga esa `til+2` beradi.

### Daraja

3, 5, 6, 7-savollar (va yosh) unutuvchanlikni o'lchaydi → 0–100%:

| Foiz | Daraja |
|---|---|
| 0–25% | Yaxshi |
| 25–50% | O'rta |
| 50–75% | Past |
| 75–100% | Juda sust |

Chegaralar ham, matnlar ham paneldan o'zgartiriladi.

### Tekshirish

```bash
npm run test:score
```
Joriy sozlamalar bilan 200 000 ta tasodifiy javobni sinaydi va har bir video qancha
foizda chiqishini ko'rsatadi. Birorta video hech qachon chiqmasa — ogohlantiradi.
**Savol yoki qoida o'zgartirgandan keyin shuni ishga tushiring.**

---

## 7. Statistika va voronka

Panelning **Statistika** bo'limida ikki xil ma'lumot bor.

### Voronka — odamlar qayerda to'xtayapti

| Bosqich | Nima hisoblanadi |
|---|---|
| 1. Saytni ochdi | Sahifaga kirgan har bir tashrif |
| 2. Testni boshladi | Boshlash tugmasi bosildi |
| 3. Savollarni tugatdi | Barcha savollarga javob berib formaga yetdi |
| 4. Ma'lumot qoldirdi | Ism va telefon yozilib natija olindi |

Har bosqichda foiz va nechta odam shu yerda ketgani ko'rsatiladi. Davrni almashtirish
mumkin: hammasi / oxirgi 7 kun / bugun.

Bu ma'lumot  fayliga yoziladi. Shaxsiy ma'lumot saqlanmaydi —
faqat tasodifiy tashrif raqami va bosqich nomi.

> Eslatma: 1–3-bosqichlar brauzerdan yuboriladi. Reklama bloklovchi yoki juda eski
> brauzerda ba'zi tashrif hisoblanmay qolishi mumkin — 4-bosqich (lidlar) esa har doim
> aniq, chunki u serverda yoziladi.

---

## 7. Natijalar qayerda saqlanadi

1. **`data/results.jsonl`** — har doim, serverning o'zida
2. **Google Sheets** — `.env` da `SHEETS_URL` to'ldirilgan bo'lsa
3. **CSV** — admin paneldan yuklab olinadi (Excel ochadi)

### Google Sheets ulash
`google-sheets/Code.gs` ichida qadam-baqadam yo'riqnoma bor. Qisqacha:
1. Google Sheets → **Kengaytmalar → Apps Script**
2. `Code.gs` mazmunini joylashtiring, `MAXFIY_KALIT` ni o'zgartiring
3. **Deploy → New deployment → Web app** (Execute as: *Me*, Access: *Anyone*)
4. URL ni `.env` dagi `SHEETS_URL` ga, kalitni `SHEETS_SECRET` ga yozing

---

## 8. Reklama piksellari

`public/index.html` ning `<head>` qismida tayyor joy bor:
```html
<!-- ===== PIKSELLAR UCHUN JOY (Facebook / Yandex / Google) ===== -->
```

---

## 9. Fayllar

```
xotira-quiz-sayt/
├── server.js               HTTP server, sayt va admin API
├── lib/
│   ├── quiz.js             ball hisoblash
│   ├── store.js            config, foydalanuvchilar, tarix, natijalar
│   └── auth.js             parol, sessiya, rollar
├── shared/
│   ├── defaults.js         boshlang'ich savollar, videolar, ranglar
│   └── davlatlar.js        telefon uchun davlatlar
├── public/
│   ├── index.html          sayt (server matn va rangni ichiga joylaydi)
│   ├── style.css
│   ├── app.js
│   ├── admin.html          boshqaruv paneli
│   ├── fonts/bayroqlar.woff2  bayroq shrifti (Windows uchun)
│   ├── admin.css
│   └── admin.js
├── google-sheets/Code.gs   Google Sheets skripti
├── scripts/test-scoring.js ball tizimini sinash
└── data/                   ⚠️ zaxira nusxa oladigan papka
    ├── config.json         savollar, videolar, matnlar, dizayn
    ├── users.json          adminlar (parollar hash qilingan)
    ├── audit.jsonl         amallar tarixi
    ├── hodisalar.jsonl     voronka (kim qaysi bosqichgacha yetdi)
    ├── results.jsonl       test natijalari
    └── .session-secret     sessiya kaliti
```

Ball hisoblash faqat serverda bo'ladi — sahifa manbasida ballar ko'rinmaydi,
foydalanuvchi natijani "tanlab" ola olmaydi.
