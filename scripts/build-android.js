// Builds the signed Android APK (Trusted Web Activity) and publishes it to
// public/downloads/sartima.apk so the site's "Get the app" link serves it.
//
//   npm run android:build
//
// Needs: Android Studio (for its bundled JDK) + Android SDK, and
// android/keystore.properties + the keystore it points to (see android/README.md).
// Override paths with JAVA_HOME / ANDROID_HOME if they live somewhere else.

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = join(root, 'android')
const isWin = process.platform === 'win32'

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

const javaHome = process.env.JAVA_HOME
  || [
    'C:/Program Files/Android/Android Studio/jbr',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/opt/android-studio/jbr',
  ].find(existsSync)
if (!javaHome) fail('No JDK found. Install Android Studio or set JAVA_HOME (JDK 17+).')

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  || [join(process.env.LOCALAPPDATA || '', 'Android/Sdk'), join(process.env.HOME || '', 'Library/Android/sdk'), join(process.env.HOME || '', 'Android/Sdk')]
    .find(existsSync)
if (!sdk) fail('No Android SDK found. Install it via Android Studio or set ANDROID_HOME.')

if (!existsSync(join(androidDir, 'keystore.properties'))) {
  fail('android/keystore.properties is missing, so the APK would be unsigned. See android/README.md.')
}

const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk }

// .bat files need a shell on Windows, and the shell doesn't quote for us —
// this repo's path has spaces, so quote every piece.
function run(cmd, args, cwd) {
  if (!isWin) return execFileSync(cmd, args, { cwd, env, stdio: 'inherit' })
  const line = [cmd, ...args].map(s => `"${s}"`).join(' ')
  execFileSync(line, { cwd, env, stdio: 'inherit', shell: true })
}
const gradlew = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew')

console.log(`→ Building release APK (JDK: ${javaHome})`)
run(gradlew, ['assembleRelease', '--no-daemon'], androidDir)

const apk = join(androidDir, 'app/build/outputs/apk/release/app-release.apk')
if (!existsSync(apk)) fail(`Build finished but ${apk} was not produced (is signing configured?).`)

// Verify the signature with the newest installed build-tools' apksigner.
const btDir = join(sdk, 'build-tools')
const latestBt = readdirSync(btDir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop()
const apksigner = join(btDir, latestBt, isWin ? 'apksigner.bat' : 'apksigner')
run(apksigner, ['verify', apk], root)

const outDir = join(root, 'public/downloads')
mkdirSync(outDir, { recursive: true })
const out = join(outDir, 'sartima.apk')
copyFileSync(apk, out)
console.log(`✔ Signed APK → public/downloads/sartima.apk (${(statSync(out).size / 1024 / 1024).toFixed(2)} MB)`)
console.log('  Deploy the site to publish it. Bump versionCode in android/app/build.gradle for each new release.')
