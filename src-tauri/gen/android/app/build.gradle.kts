import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    signingConfigs {
        create("release") {
            // For CI/CD: set these environment variables
            // ANDROID_KEYSTORE_PATH, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, ANDROID_STORE_PASSWORD
            val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
                ?: project.findProperty("android.keystore.path")?.toString()
            val keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                ?: project.findProperty("android.key.alias")?.toString()
                ?: "tinsu"
            val keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
                ?: project.findProperty("android.key.password")?.toString()
            val storePassword = System.getenv("ANDROID_STORE_PASSWORD")
                ?: project.findProperty("android.store.password")?.toString()

            if (keystorePath != null && java.io.File(keystorePath).exists()) {
                storeFile = file(keystorePath)
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
                this.storePassword = storePassword
            }
            // If keystore not configured, release builds will use debug signing (dev only).
            // For Play Store: generate keystore with:
            // keytool -genkey -v -keystore tinsu.jks -alias tinsu -keyalg RSA -keysize 2048 -validity 10000
        }
    }
    compileSdk = 36
    namespace = "com.tinsu.app"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.tinsu.app"
        minSdk = 29
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

// Patch devUrl to localhost so ADB reverse tunnel works (Hyper-V host not reachable from phone)
tasks.register("patchTauriDevUrl") {
    doLast {
        val assetConf = file("src/main/assets/tauri.conf.json")
        if (assetConf.exists()) {
            val original = assetConf.readText()
            val patched = original.replace(
                Regex("\"devUrl\":\"http://[^\"]+\""),
                "\"devUrl\":\"http://localhost:5173/\""
            )
            if (patched != original) {
                assetConf.writeText(patched)
                println("Patched devUrl to localhost in tauri.conf.json")
            }
        }
    }
}

afterEvaluate {
    tasks.matching { it.name.startsWith("merge") && it.name.contains("Assets") }.configureEach {
        dependsOn("patchTauriDevUrl")
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")