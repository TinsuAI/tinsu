# TinSu Mobile Build Setup

## Android

Android build targets are configured. To build:

```bash
npm run android:dev      # Launch in emulator/device (debug)
npm run android:build    # Build debug APK
npm run android:build:release  # Build release APK (requires signing config)
```

### Release Signing

Set these environment variables before building for release:

```
ANDROID_KEYSTORE_PATH=/path/to/tinsu.jks
ANDROID_KEY_ALIAS=tinsu
ANDROID_KEY_PASSWORD=<key-password>
ANDROID_STORE_PASSWORD=<store-password>
```

Generate a keystore:
```bash
keytool -genkey -v -keystore tinsu.jks -alias tinsu -keyalg RSA -keysize 2048 -validity 10000
```

## iOS

**iOS requires macOS with Xcode installed.** This project was developed on Linux; iOS targets have not been initialized.

To set up iOS builds (must run on macOS):

```bash
# Install Xcode from App Store, then:
xcode-select --install

# Add iOS targets to Rust:
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

# Initialize iOS project:
npm run tauri ios init

# This generates src-tauri/gen/apple/ — commit the generated files.
```

Then build:
```bash
npm run ios:dev    # Launch in iOS simulator
npm run ios:build  # Build IPA
```
