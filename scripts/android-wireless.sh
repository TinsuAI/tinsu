#!/usr/bin/env bash
set -euo pipefail

# Android wireless build script
# Pairs via ADB wireless, then builds with static or hot-reload frontend

COLOR_RESET='\033[0m'
COLOR_CYAN='\033[0;36m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'

info()    { echo -e "${COLOR_CYAN}[info]${COLOR_RESET} $*"; }
success() { echo -e "${COLOR_GREEN}[ok]${COLOR_RESET} $*"; }
warn()    { echo -e "${COLOR_YELLOW}[warn]${COLOR_RESET} $*"; }
die()     { echo -e "${COLOR_RED}[error]${COLOR_RESET} $*" >&2; exit 1; }

ADB="${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb"
[[ -x "$ADB" ]] || die "adb not found at $ADB — set ANDROID_HOME or install platform-tools"

# ── 1. Collect stable info (doesn't require pairing dialog open) ──────────────

echo ""
echo "=== Android Wireless Setup ==="
echo ""
echo "Step 1: From 'Wireless debugging' main page (stable, doesn't disappear)"
echo ""

read -rp "Device IP address: " DEVICE_IP
[[ -z "$DEVICE_IP" ]] && die "IP required"

read -rp "Connection port (main page, 5-digit): " CONN_PORT
[[ -z "$CONN_PORT" ]] && die "Connection port required"

echo ""
echo "Frontend mode:"
echo "  1) Static build (faster, no hot reload)"
echo "  2) Vite dev server (hot reload)"
read -rp "Choice [1/2]: " FRONTEND_MODE
[[ "$FRONTEND_MODE" != "1" && "$FRONTEND_MODE" != "2" ]] && die "Pick 1 or 2"

# ── 2. Pairing — time-sensitive, do last ─────────────────────────────────────

echo ""
echo -e "${COLOR_YELLOW}Step 2: Tap 'Pair device with pairing code' NOW, then come back fast.${COLOR_RESET}"
echo ""

read -rp "Pairing port (from dialog): " PAIR_PORT
[[ -z "$PAIR_PORT" ]] && die "Pairing port required"

read -rp "Pairing code (from dialog): " PAIR_CODE
[[ -z "$PAIR_CODE" ]] && die "Pairing code required"

info "Restarting adb server ..."
"$ADB" kill-server
"$ADB" start-server

info "Pairing with $DEVICE_IP:$PAIR_PORT ..."
PAIR_OUT=$("$ADB" pair "$DEVICE_IP:$PAIR_PORT" "$PAIR_CODE" 2>&1 || true)
echo "$PAIR_OUT"
# "protocol fault...Success" = paired OK but ack unreadable; proceed anyway
if echo "$PAIR_OUT" | grep -qiE "successfully paired|protocol fault.*Success"; then
  success "Paired (or already paired)"
else
  die "adb pair failed: $PAIR_OUT"
fi

info "Connecting to $DEVICE_IP:$CONN_PORT ..."
"$ADB" connect "$DEVICE_IP:$CONN_PORT" || die "adb connect failed"

# Verify device shows up
"$ADB" devices | grep "$DEVICE_IP" | grep -q "device" || die "Device not in 'adb devices' after connect"
success "Connected — device online"

# ── 3. Build / run ───────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ "$FRONTEND_MODE" == "1" ]]; then
  info "Building static frontend ..."
  npm run build

  info "Launching Tauri Android (static) ..."
  TAURI_DEV_HOST="$DEVICE_IP" npx tauri android dev --host "$DEVICE_IP"

else
  info "Launching Tauri Android with Vite hot reload ..."
  TAURI_DEV_HOST="$DEVICE_IP" npx tauri android dev --host "$DEVICE_IP"
fi
