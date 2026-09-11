# Serverga o'rnatish — tizim administratori uchun

Bu — **Node.js** da yozilgan kichik veb-sayt (test + boshqaruv paneli).
Ma'lumotlar bazasi (MySQL, Postgres) **kerak emas** — hammasi fayllarda saqlanadi.
`npm install` ham kerak emas — tashqi paketlar ishlatilmagan.

---

## Sudo'siz foydalanuvchi bor bo'lsa (tavsiya etilgan yo'l)

Ilova oddiy foydalanuvchi ostida ishlaydi, root esa **faqat Nginx uchun bir marta** kerak.

**1. Foydalanuvchi (sudo kerak emas):**
```bash
git clone https://github.com/davronbekturdiev95-lab/xotira-quiz-sayt.git
cd xotira-quiz-sayt
cp .env.example .env        # ADMIN_PAROL yozing, HOST=127.0.0.1 qo'ying
bash deploy/ishga-tushir.sh start
bash deploy/ishga-tushir.sh cron     # server yoqilganda avtomatik ishga tushadi
```
Node.js tizimda bo'lmasa `~/.local/node` ga o'rnatiladi (skript o'sha joydan qidiradi).

**2. Server egasi (root, bir marta):**
```bash
sudo bash /home/<foydalanuvchi>/xotira-quiz-sayt/deploy/root-qism.sh quiz.domen.uz
```
Nginx o'rnatiladi va domen `127.0.0.1:3000` ga ulanadi. Ilova fayllariga tegilmaydi.
Cloudflare ishlatilsa: **SSL/TLS → Flexible** (yoki pochta berib Let's Encrypt oling → Full (strict)).

**Kundalik boshqaruv (sudo kerak emas):**
```bash
bash deploy/ishga-tushir.sh status     # holati
bash deploy/ishga-tushir.sh restart    # qayta ishga tushirish
bash deploy/ishga-tushir.sh log        # loglar
git pull && bash deploy/ishga-tushir.sh restart   # yangilash
```

---

## Talablar

| Nima | Versiya |
|---|---|
| Ubuntu | 22.04 yoki 24.04 |
| Node.js | 18 yoki undan yuqori (skript o'zi o'rnatadi) |
| Nginx | skript o'zi o'rnatadi |
| Domen | A-record server IP ga yo'naltirilgan bo'lishi kerak |
| Xotira | 512 MB RAM yetadi |
| Port | 3000 (faqat localhost, tashqariga Nginx chiqaradi) |

---

## O'rnatish (bitta buyruq)

```bash
cd /root
git clone <REPO-HAVOLASI> xotira-quiz-sayt
cd xotira-quiz-sayt
sudo bash deploy/ornatish.sh test.domen.uz admin@domen.uz
```

Birinchi parametr — **domen**, ikkinchisi — **pochta** (Let's Encrypt sertifikati uchun).

Skript quyidagilarni o'zi bajaradi:

1. Node.js 20 ni o'rnatadi (agar yo'q bo'lsa)
2. Fayllarni `/var/www/xotira-quiz-sayt` ga ko'chiradi
3. `.env` yaratadi va **tasodifiy admin parol** chiqaradi — uni yozib oling
4. `systemd` xizmatini yoqadi (`xotira`) — server o'chib yonsa avtomatik ko'tariladi
5. Nginx'ni sozlaydi (reverse proxy)
6. Let's Encrypt SSL sertifikatini oladi va avtomatik yangilanishini yoqadi

---

## Tekshirish

```bash
systemctl status xotira        # ishlab turibdimi
journalctl -u xotira -n 50     # oxirgi loglar
curl -s localhost:3000/health  # {"ok":true,...} qaytishi kerak
```

Sayt: `https://test.domen.uz`
Panel: `https://test.domen.uz/admin`

---

## ⚠️ Eng muhimi: `data/` papkasi

```
/var/www/xotira-quiz-sayt/data/
├── config.json        savollar, videolar, havolalar, matnlar, dizayn
├── users.json         adminlar (parollar scrypt bilan hash qilingan)
├── results.jsonl      mijozlar bazasi (ism, telefon)
├── hodisalar.jsonl    voronka statistikasi
├── audit.jsonl        amallar tarixi
└── .session-secret    sessiya kaliti
```

Bu papka **git'da yo'q** va bo'lmasligi ham kerak — ichida mijozlar bazasi bor.
**O'chirilmasin va zaxira nusxasi olinsin.**

Kunlik zaxira uchun:
```bash
sudo crontab -e
# quyidagi qatorni qo'shing:
0 3 * * * bash /var/www/xotira-quiz-sayt/deploy/zaxira.sh
```
Nusxalar `/root/xotira-zaxira/` ga tushadi, 30 kun saqlanadi.

---

## Yangilash (kod o'zgarganda)

```bash
cd /root/xotira-quiz-sayt
git pull
sudo bash deploy/ornatish.sh test.domen.uz admin@domen.uz
```

Skript `data/` papkasiga **tegmaydi** va o'zgartirishdan oldin zaxira nusxa oladi.
`.env` ham qayta yozilmaydi.

---

## Foydali buyruqlar

```bash
systemctl restart xotira       # qayta ishga tushirish
systemctl stop xotira          # to'xtatish
journalctl -u xotira -f        # jonli loglar
nginx -t && systemctl reload nginx
```

---

## Xavfsizlik

- Admin paneli `/admin` — login + parol, sessiya 12 soat
- Parol 8 marta xato terilsa IP 10 daqiqaga bloklanadi
- Parollar `scrypt` bilan hash qilinadi, ochiq saqlanmaydi
- `.env` fayl huquqi `600` (faqat egasi o'qiydi)
- Sayt faqat `127.0.0.1:3000` da tinglaydi, tashqariga Nginx orqali chiqadi

---

## Sayt egasiga qaytariladigan ma'lumot

1. Sayt manzili: `https://...`
2. Panel manzili: `https://.../admin`
3. Admin **login** va **parol** (skript chiqargan)
4. Zaxira nusxa yoqilganini tasdiq
