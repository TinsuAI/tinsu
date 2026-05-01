#!/bin/bash
set -e

APP="src-tauri/gen/apple/build/Payload/TinSu.app"

echo "→ Building (frontend + iOS)..."
npm run ios:build

if [ ! -d "$APP" ]; then
    echo "✗ Build artifact not found at $APP"
    exit 1
fi

echo "→ Finding connected iPhone..."
xcrun devicectl list devices --json-output /tmp/tinsu_devices.json 2>/dev/null

DEVICE_ID=$(python3 - <<'EOF'
import json, sys
with open('/tmp/tinsu_devices.json') as f:
    data = json.load(f)
devices = data.get('result', {}).get('devices', [])
for d in devices:
    conn = d.get('connectionProperties', {})
    tunnel = conn.get('tunnelState', '').lower()
    pairing = conn.get('pairingState', '').lower()
    if 'connected' in tunnel or 'paired' in pairing:
        print(d['hardwareProperties']['udid'])
        sys.exit(0)
print('', end='')
EOF
)

if [ -z "$DEVICE_ID" ]; then
    echo "✗ No connected iPhone found. Connect via USB (or check Trust prompt on device)."
    exit 1
fi

echo "→ Installing on device $DEVICE_ID..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP"
echo "✓ Done! Open TinSu on your iPhone."
