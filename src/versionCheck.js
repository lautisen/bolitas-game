import { App } from '@capacitor/app';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';
import { Capacitor } from '@capacitor/core';

// Helper function to compare semantic versions
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1; // v1 is greater
        if (p1 < p2) return -1; // v2 is greater
    }
    return 0; // they are equal
}

export async function checkAppVersion() {
    // Only run on native devices
    if (!Capacitor.isNativePlatform()) return;

    try {
        // 1. Fetch Remote Config
        await FirebaseRemoteConfig.fetchAndActivate();

        // 2. Get the minimum required version from Remote Config
        const { value } = await FirebaseRemoteConfig.getString({ key: 'minimum_version_required' });

        // If not set, we assume no restriction
        if (!value || value === '') return;

        // 3. Get the current app version
        const info = await App.getInfo();
        const currentVersion = info.version;

        // 4. Compare versions
        if (compareVersions(currentVersion, value) < 0) {
            // Current version is less than required minimum version
            showUpdateScreen();
        }
    } catch (error) {
        console.error("Error checking app version:", error);
    }
}

function showUpdateScreen() {
    const screen = document.getElementById('update-required-screen');
    if (screen) {
        screen.classList.remove('hidden');
    }

    const downloadBtn = document.getElementById('download-update-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            // Open the app's Play Store page
            window.open('market://details?id=com.dreaminraw.bolitas', '_system');
        });
    }
}
