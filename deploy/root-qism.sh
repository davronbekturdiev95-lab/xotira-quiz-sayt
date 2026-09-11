#!/usr/bin/env bash
# ============================================================================
# FAQAT ROOT TALAB QILADIGAN QISM — server egasi BIR MARTA ishga tushiradi
#
# Ilovaning o'zi allaqachon oddiy foydalanuvchi ostida 127.0.0.1:3000 da
# ishlab turibdi. Bu skript faqat Nginx'ni o'rnatib, domenni ilovaga ulaydi.
# Ilova fayllariga, foydalanuvchilarga va boshqa sozlamalarga tegmaydi.
#
# ISHLATISH:
#   sudo bash root-qism.sh quiz.supermiyateam.com
#
# Ixtiyoriy — Let's Encrypt sertifikati bilan (Cloudflare "Full (strict)" uchun):
#   sudo bash root-qism.sh quiz.supermiyateam.com pochta@domen.uz
# ============================================================================
set -euo pipefail

DOMEN="${1:-}"
POCHTA="${2:-}"
ILOVA_PORT="${ILOVA_PORT:-3000}"
NOM="xotira-quiz"

qizil()  { echo -e "\033[31m$*\033[0m"; }
yashil() { echo -e "\033[32m$*\033[0m"; }
kok()    { echo -e "\033[1;36m\n$*\033[0m"; }

if [[ -z "$DOMEN" ]]; then
  qizil "Ishlatish: sudo bash root-qism.sh <domen> [pochta]"
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  qizil "Root sifatida ishga tushiring: sudo bash root-qism.sh $DOMEN"
  exit 1
fi

# ------------------------------------------------------------------ 1. Ilova
kok "1/5 · Ilova ishlayaptimi (127.0.0.1:$ILOVA_PORT)"
if curl -fsS --max-time 5 "http://127.0.0.1:$ILOVA_PORT/health" > /dev/null; then
  yashil "Ilova javob beryapti"
else
  qizil "Ilova 127.0.0.1:$ILOVA_PORT da javob bermayapti."
  qizil "Avval ilovani ishga tushiring (foydalanuvchi ostida): bash deploy/ishga-tushir.sh start"
  exit 1
fi

# ------------------------------------------------------------------ 2. Nginx
kok "2/5 · Nginx"
if ! command -v nginx > /dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx
fi
yashil "Nginx: $(nginx -v 2>&1)"

# ------------------------------------------- 3. Cloudflare — haqiqiy mijoz IP
kok "3/5 · Cloudflare orqali kelgan mijozning haqiqiy IP manzili"
CF_CONF="/etc/nginx/conf.d/cloudflare-realip.conf"
{
  echo "# Cloudflare IP'lari — $(date '+%F') da yangilangan"
  for v in 4 6; do
    curl -fsS --max-time 15 "https://www.cloudflare.com/ips-v$v" | while read -r ip; do
      [[ -n "$ip" ]] && echo "set_real_ip_from $ip;"
    done
  done
  echo "real_ip_header CF-Connecting-IP;"
} > "$CF_CONF.tmp"

if grep -q "set_real_ip_from" "$CF_CONF.tmp"; then
  mv "$CF_CONF.tmp" "$CF_CONF"
  yashil "$(grep -c set_real_ip_from "$CF_CONF") ta Cloudflare tarmog'i qo'shildi"
else
  rm -f "$CF_CONF.tmp"
  qizil "Cloudflare IP ro'yxati yuklanmadi — bu qadam o'tkazib yuborildi (sayt baribir ishlaydi)"
fi

# ------------------------------------------------------------- 4. Sayt sozlamasi
kok "4/5 · $DOMEN → 127.0.0.1:$ILOVA_PORT"
cat > "/etc/nginx/sites-available/$NOM" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMEN;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:$ILOVA_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
        proxy_read_timeout 30s;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/$NOM" "/etc/nginx/sites-enabled/$NOM"
nginx -t
systemctl enable --now nginx > /dev/null 2>&1 || true
systemctl reload nginx

if curl -fsS --max-time 5 -H "Host: $DOMEN" "http://127.0.0.1/health" > /dev/null; then
  yashil "Nginx → ilova ulanishi ishlayapti"
else
  qizil "Nginx orqali ilovaga yetib bo'lmadi — tekshiring: journalctl -u nginx -n 30"
  exit 1
fi

# ------------------------------------------------------------ 5. SSL (ixtiyoriy)
kok "5/5 · SSL"
if [[ -n "$POCHTA" ]]; then
  command -v certbot > /dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx
  if certbot --nginx -d "$DOMEN" --non-interactive --agree-tos -m "$POCHTA" --redirect; then
    yashil "Let's Encrypt sertifikati o'rnatildi"
    SSL_REJIM="Full (strict)"
  else
    qizil "Sertifikat olinmadi (Cloudflare 'Always Use HTTPS' yoqilgan bo'lsa shunday bo'ladi)."
    SSL_REJIM="Flexible"
  fi
else
  echo "Pochta berilmadi — sertifikat o'rnatilmadi. HTTPS'ni Cloudflare beradi."
  SSL_REJIM="Flexible"
fi

echo ""
yashil "════════════════════════════════════════════════════════"
yashil "  TAYYOR"
yashil "════════════════════════════════════════════════════════"
echo ""
echo "  Cloudflare → SSL/TLS → Overview → rejim:  $SSL_REJIM"
echo ""
echo "  Sayt:   https://$DOMEN"
echo "  Panel:  https://$DOMEN/admin"
echo ""
