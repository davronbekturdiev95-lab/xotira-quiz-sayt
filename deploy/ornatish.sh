#!/usr/bin/env bash
# ============================================================================
# XOTIRA TESTI — VPS ga o'rnatish (Ubuntu 22.04 / 24.04)
#
# ISHLATISH:
#   1. Loyihani serverga ko'chiring (masalan /root/xotira-quiz-sayt papkasiga)
#   2. Shu buyruqni bering:
#
#        sudo bash deploy/ornatish.sh test.sizningdomen.uz sizning@pochta.uz
#
#   Skript hamma narsani o'zi qiladi: Node.js, xizmat, Nginx, bepul SSL.
# ============================================================================
set -euo pipefail

DOMEN="${1:-}"
POCHTA="${2:-}"
PAPKA="/var/www/xotira-quiz-sayt"
XIZMAT="xotira"
PORT="3000"

qizil()  { echo -e "\033[31m$*\033[0m"; }
yashil() { echo -e "\033[32m$*\033[0m"; }
kok()    { echo -e "\033[1;36m\n$*\033[0m"; }

if [[ -z "$DOMEN" || -z "$POCHTA" ]]; then
  qizil "Ishlatish:  sudo bash deploy/ornatish.sh <domen> <pochta>"
  qizil "Masalan:    sudo bash deploy/ornatish.sh test.davronturdiev.uz davron@mail.uz"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  qizil "Skriptni root sifatida ishga tushiring: sudo bash deploy/ornatish.sh ..."
  exit 1
fi

MANBA="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------- 1. Node.js
kok "1/7 · Node.js tekshirilmoqda"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 18 ]]; then
  echo "Node.js 20 o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
yashil "Node.js: $(node -v)"

# ------------------------------------------------------------ 2. Fayllar
kok "2/7 · Fayllar ko'chirilmoqda"
mkdir -p "$PAPKA"

# data/ papkasi bo'lsa — TEGMAYMIZ (sozlamalar, adminlar, lidlar shu yerda)
if [[ -d "$PAPKA/data" ]]; then
  yashil "Mavjud data/ papkasi saqlanadi (sozlamalar va lidlar yo'qolmaydi)"
  ZAXIRA="/root/xotira-data-zaxira-$(date +%Y%m%d-%H%M%S)"
  cp -r "$PAPKA/data" "$ZAXIRA"
  yashil "Zaxira nusxa: $ZAXIRA"
fi

for x in server.js package.json lib shared public google-sheets scripts; do
  [[ -e "$MANBA/$x" ]] && cp -r "$MANBA/$x" "$PAPKA/"
done
mkdir -p "$PAPKA/data"
yashil "Fayllar joyida: $PAPKA"

# ------------------------------------------------------------ 3. Sozlama
kok "3/7 · Sozlamalar"
if [[ -f "$PAPKA/.env" ]]; then
  yashil ".env allaqachon bor — tegilmadi"
else
  PAROL="$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)Aa1"
  cat > "$PAPKA/.env" <<EOF
BOSH_ADMIN_LOGIN=admin
ADMIN_PAROL=$PAROL
SHEETS_URL=
SHEETS_SECRET=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
PORT=$PORT
EOF
  chmod 600 "$PAPKA/.env"
  yashil ".env yaratildi"
  echo ""
  qizil "════════════════════════════════════════════════════"
  qizil "  ADMIN PAROLI:  $PAROL"
  qizil "  Buni yozib oling! Panelga kirgach o'zgartirasiz."
  qizil "════════════════════════════════════════════════════"
  echo ""
fi

chown -R www-data:www-data "$PAPKA"

# ------------------------------------------------------------ 4. Xizmat
kok "4/7 · Avtomatik ishga tushirish (systemd)"
cat > "/etc/systemd/system/$XIZMAT.service" <<EOF
[Unit]
Description=Xotira testi sayti
After=network.target

[Service]
Type=simple
WorkingDirectory=$PAPKA
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$XIZMAT" >/dev/null 2>&1
systemctl restart "$XIZMAT"
sleep 2

if systemctl is-active --quiet "$XIZMAT"; then
  yashil "Xizmat ishlayapti (server o'chib yonsa ham o'zi ko'tariladi)"
else
  qizil "Xizmat ishga tushmadi. Sababi:"
  journalctl -u "$XIZMAT" -n 30 --no-pager
  exit 1
fi

# ------------------------------------------------------------ 5. Nginx
kok "5/7 · Nginx"
command -v nginx >/dev/null 2>&1 || apt-get install -y nginx

cat > "/etc/nginx/sites-available/$XIZMAT" <<EOF
server {
    listen 80;
    server_name $DOMEN;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/$XIZMAT" "/etc/nginx/sites-enabled/$XIZMAT"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
yashil "Nginx sozlandi"

# ------------------------------------------------------------ 6. Devor
kok "6/7 · Xavfsizlik devori"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  yashil "Portlar ochildi (SSH, 80, 443)"
fi

# ------------------------------------------------------------ 7. SSL
kok "7/7 · SSL sertifikat (https)"
command -v certbot >/dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx

if certbot --nginx -d "$DOMEN" --non-interactive --agree-tos -m "$POCHTA" --redirect; then
  yashil "SSL o'rnatildi va avtomatik yangilanadi"
else
  qizil "SSL o'rnatilmadi. Sabab odatda: domen hali VPS IP'siga yo'naltirilmagan."
  qizil "DNS to'g'rilangach shu buyruqni bering:  certbot --nginx -d $DOMEN"
fi

# ------------------------------------------------------------ Yakun
echo ""
yashil "════════════════════════════════════════════════════"
yashil "  TAYYOR"
yashil "════════════════════════════════════════════════════"
echo "  Sayt:   https://$DOMEN"
echo "  Panel:  https://$DOMEN/admin"
echo ""
echo "  Foydali buyruqlar:"
echo "    systemctl status $XIZMAT      — holatini ko'rish"
echo "    systemctl restart $XIZMAT     — qayta ishga tushirish"
echo "    journalctl -u $XIZMAT -f      — jonli loglar"
echo ""
echo "  Muhim: $PAPKA/data papkasi — sozlamalar, adminlar va lidlar."
echo "         Zaxira nusxa olsangiz shuni saqlang."
echo ""
