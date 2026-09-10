#!/usr/bin/env bash
# ============================================================================
# ZAXIRA NUSXA — sozlamalar, adminlar, tarix va lidlarni saqlab qo'yadi
#
# Qo'lda:      sudo bash /var/www/xotira-quiz-sayt/deploy/zaxira.sh
# Har kuni:    sudo crontab -e   va shu qatorni qo'shing:
#              0 3 * * * bash /var/www/xotira-quiz-sayt/deploy/zaxira.sh
# ============================================================================
set -euo pipefail

PAPKA="/var/www/xotira-quiz-sayt/data"
ZAXIRA_PAPKA="/root/xotira-zaxira"
SAQLASH_KUNI=30

mkdir -p "$ZAXIRA_PAPKA"

if [[ ! -d "$PAPKA" ]]; then
  echo "data papkasi topilmadi: $PAPKA"
  exit 1
fi

NOM="xotira-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$ZAXIRA_PAPKA/$NOM" -C "$(dirname "$PAPKA")" "$(basename "$PAPKA")"

# Eski nusxalarni o'chiramiz
find "$ZAXIRA_PAPKA" -name 'xotira-*.tar.gz' -mtime +$SAQLASH_KUNI -delete

echo "Zaxira tayyor: $ZAXIRA_PAPKA/$NOM"
ls -lh "$ZAXIRA_PAPKA" | tail -5
