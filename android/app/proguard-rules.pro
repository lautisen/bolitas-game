# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor rules
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.NativePlugin class * { *; }
-keep @com.getcapacitor.CapacitorPlugin class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }

# Firebase & AdMob rules
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.firebase.ktx.Firebase

# WebView Bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Source code attributes for Crashlytics
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
