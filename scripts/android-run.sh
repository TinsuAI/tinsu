#!/bin/bash
set -e

APK_DIR="src-tauri/gen/android/app/build/outputs/apk"
PACKAGE="com.tinsu.app"
ACTIVITY=".MainActivity"

echo "→ Building (frontend + Android)..."
npm run android:build

# Find the debug APK (universal preferred, then any arch)
APK=$(find "$APK_DIR" -name "*.apk" ! -name "*unsigned*" | grep -iE 'debug' | grep -i 'universal' | head -1)
if [ -z "$APK" ]; then
    APK=$(find "$APK_DIR" -name "*.apk" ! -name "*unsigned*" | grep -iE 'debug' | head -1)
fi

if [ -z "$APK" ]; then
    echo "✗ No APK found in $APK_DIR"
    exit 1
fi

echo "→ Found: $APK"

# Check for connected device
if ! command -v adb &>/dev/null; then
    echo "✗ adb not found. Install Android SDK platform-tools and add to PATH."
    exit 1
fi

DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')
if [ "$DEVICES" -eq 0 ]; then
    echo "✗ No Android device connected. Connect your device with USB debugging enabled."
    exit 1
fi

echo "→ Installing on device..."
adb install -r "$APK"

echo "→ Launching TinSu..."
adb shell am start -n "${PACKAGE}/${ACTIVITY}"

echo "✓ Done!"
