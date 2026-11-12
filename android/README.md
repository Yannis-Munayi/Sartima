# Sartima for Android

The Android app is a **Trusted Web Activity (TWA)**: a small native shell that opens
`https://www.sartima.ca` full-screen in Chrome's engine. It is the same app as the site,
so it updates every time the site deploys. You don't need a new APK for web changes.
Google sign-in, Stripe Checkout, push notifications and the service worker all work
because the app runs in Chrome, not a WebView.

The project was generated with Google's Bubblewrap (`@bubblewrap/core`) and is a
normal Gradle project, so you can open this folder in Android Studio.

## Build

```bash
npm run android:build
```

This builds `app-release.apk`, signs it, verifies the signature, and copies it to
`public/downloads/sartima.apk`. Deploying the site publishes that file, and the
"Get the app → Android" link serves it.

Rebuild the APK only when something native changes: icon, name, colours, version,
or anything else in this folder.
For each release, bump `versionCode` (and `versionName`) in `app/build.gradle`.
Android won't install an update over an existing app with the same or lower `versionCode`.

## Signing key — back it up

| File | Committed? | What it is |
|------|------------|------------|
| `sartima-upload.keystore` | **No** (gitignored) | The release signing key |
| `keystore.properties` | **No** (gitignored) | Keystore path, alias and passwords used by Gradle |

**If the keystore is lost, existing installs can never be updated.** People would
have to uninstall and reinstall. Keep a copy of both files somewhere safe outside this repo,
such as a password manager.

The key's SHA-256 fingerprint is listed in `public/.well-known/assetlinks.json`.
Android uses that file to verify that the app and www.sartima.ca belong together.
When verification passes, the app opens with no browser address bar. If you ever re-key the app,
update the fingerprint there:

```bash
keytool -list -v -keystore sartima-upload.keystore -alias sartima
```

## Google Play (later)

The same project can produce a Play Store bundle with `./gradlew bundleRelease`.
Play App Signing re-signs uploads with Google's own key. After enrolling, add Google's
fingerprint from Play Console → App integrity to `assetlinks.json` next to the
current one.

Before submitting, check Play's payments policy. Selling digital subscriptions, such as Sartima
Pro and try-on packs, inside a Play-distributed app normally has to use Google Play
Billing, not Stripe. The sideloaded APK on the site isn't affected.
