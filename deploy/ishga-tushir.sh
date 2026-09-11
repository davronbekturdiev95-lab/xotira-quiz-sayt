#!/usr/bin/env bash
# ============================================================================
# ILOVANI SUDO'SIZ BOSHQARISH (oddiy foydalanuvchi huquqi yetadi)
#
#   bash deploy/ishga-tushir.sh start     — ishga tushirish
#   bash deploy/ishga-tushir.sh stop      — to'xtatish
#   bash deploy/ishga-tushir.sh restart   — qayta ishga tushirish
#   bash deploy/ishga-tushir.sh status    — holati
#   bash deploy/ishga-tushir.sh log       — oxirgi loglar
#
# Ilova yiqilsa 3 soniyada o'zi qayta ko'tariladi. Server qayta yoqilganda
# cron (@reboot) orqali avtomatik ishga tushadi — crontab'ga qo'shish:
#   bash deploy/ishga-tushir.sh cron
# ============================================================================
set -u

PAPKA="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKRIPT="$PAPKA/deploy/ishga-tushir.sh"
NODE="${NODE_BIN:-$HOME/.local/node/bin/node}"
[ -x "$NODE" ] || NODE="$(command -v node || true)"

DATA="$PAPKA/data"
LOG="$DATA/server.log"
PID="$DATA/server.pid"
LOG_MAX_BAYT=$((20 * 1024 * 1024))   # 20 MB dan oshsa log yangidan boshlanadi

ishlayaptimi() {
  [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null
}

port_ol() {
  local p
  p="$(grep -E '^PORT=' "$PAPKA/.env" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"'"'"' \r')"
  echo "${p:-3000}"
}

case "${1:-}" in

  _sikl)
    # Ichki buyruq: node yiqilsa qayta ko'taradi
    cd "$PAPKA" || exit 1
    while true; do
      "$NODE" server.js >> "$LOG" 2>&1
      echo "[$(date '+%F %T')] server to'xtadi — 3 soniyadan keyin qayta ishga tushadi" >> "$LOG"
      sleep 3
    done
    ;;

  start)
    if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
      echo "XATO: Node.js topilmadi (kutilgan joy: $HOME/.local/node/bin/node)"
      exit 1
    fi
    if ishlayaptimi; then
      echo "Allaqachon ishlayapti (PID $(cat "$PID"))"
      exit 0
    fi
    mkdir -p "$DATA"
    if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt "$LOG_MAX_BAYT" ]; then
      mv -f "$LOG" "$LOG.eski"
    fi
    # setsid — sikl va node bitta guruhda bo'ladi, "stop" ikkalasini birga to'xtatadi
    setsid bash "$SKRIPT" _sikl > /dev/null 2>&1 < /dev/null &
    echo $! > "$PID"
    sleep 2
    if ishlayaptimi; then
      echo "Ishga tushdi (PID $(cat "$PID"))"
    else
      echo "Ishga tushmadi — logga qarang: $LOG"
      exit 1
    fi
    ;;

  stop)
    if ishlayaptimi; then
      kill -- "-$(cat "$PID")" 2>/dev/null || kill "$(cat "$PID")" 2>/dev/null
      rm -f "$PID"
      echo "To'xtatildi"
    else
      rm -f "$PID"
      echo "Ishlamayotgan edi"
    fi
    ;;

  restart)
    bash "$SKRIPT" stop
    sleep 1
    bash "$SKRIPT" start
    ;;

  status)
    if ishlayaptimi; then
      echo "Holat:  ishlayapti (PID $(cat "$PID"))"
    else
      echo "Holat:  TO'XTAGAN"
    fi
    port="$(port_ol)"
    if curl -fsS --max-time 5 "http://127.0.0.1:$port/health" > /dev/null 2>&1; then
      echo "Javob:  127.0.0.1:$port — sog'lom"
    else
      echo "Javob:  127.0.0.1:$port — JAVOB YO'Q"
    fi
    ;;

  log)
    tail -n "${2:-40}" "$LOG" 2>/dev/null || echo "Log hali yo'q"
    ;;

  cron)
    # @reboot — server yoqilganda; */5 — har 5 daqiqada tekshiradi (ishlayotgan bo'lsa hech narsa qilmaydi)
    satr_reboot="@reboot /bin/bash $SKRIPT start > /dev/null 2>&1"
    satr_nazorat="*/5 * * * * /bin/bash $SKRIPT start > /dev/null 2>&1"
    ( crontab -l 2>/dev/null | grep -v "$SKRIPT" ; echo "$satr_reboot" ; echo "$satr_nazorat" ) | crontab -
    echo "Cron sozlandi:"
    crontab -l | grep "$SKRIPT"
    ;;

  *)
    echo "Ishlatish: bash deploy/ishga-tushir.sh {start|stop|restart|status|log|cron}"
    exit 1
    ;;
esac
