#!/bin/zsh
# Build the Android app (.aab for Google Play) on this Mac. No Expo cloud involved.
#
#   npm run android:build   -> makes build/android/ArcheryintheUSA.aab
#
# Signing uses the Google Play upload key in ~/.archery-keys (kept out of git):
#   upload.jks          the keystore
#   upload.properties   storePassword=..., keyAlias=..., keyPassword=...
# The versionCode is the number of minutes since 2020, so every build is higher
# than the last one. The app version comes from app.json.
# Run it from the ~/studio/archery-release clone, like the iPhone build.
set -euo pipefail

export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export LANG=en_US.UTF-8 CI=1
KEYS="${ARCHERY_KEYS:-$HOME/.archery-keys}"

cd "$(dirname "$0")/.."
OUT="$PWD/build/android"
rm -rf "$OUT" && mkdir -p "$OUT"

[[ -f "$KEYS/upload.jks" && -f "$KEYS/upload.properties" ]] || {
  echo "Missing the Play upload key in $KEYS (upload.jks + upload.properties)"; exit 1; }
prop() { sed -n "s/^$1=//p" "$KEYS/upload.properties"; }

echo "==> Installing packages"
npm ci --no-audit --no-fund

echo "==> Generating the Android project"
cp package.json "$OUT/package.json.bak"          # prebuild rewrites the npm scripts
npx expo prebuild --platform android --clean --no-install
mv "$OUT/package.json.bak" package.json

# Play caps versionCode at 2100000000, so count minutes since 2020 instead of a date stamp.
VERSION_CODE=$(( ($(date +%s) - 1577836800) / 60 ))
sed -i '' -E "s/versionCode [0-9]+/versionCode $VERSION_CODE/" android/app/build.gradle
# The default 512 MB metaspace runs out on the release build.
sed -i '' -E 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g/' android/gradle.properties
echo "==> Building versionCode $VERSION_CODE"

cd android
./gradlew --no-daemon --no-watch-fs -q bundleRelease \
  -Pandroid.injected.signing.store.file="$KEYS/upload.jks" \
  -Pandroid.injected.signing.store.password="$(prop storePassword)" \
  -Pandroid.injected.signing.key.alias="$(prop keyAlias)" \
  -Pandroid.injected.signing.key.password="$(prop keyPassword)"
cd ..

cp android/app/build/outputs/bundle/release/app-release.aab "$OUT/ArcheryintheUSA.aab"
echo "==> Done: $OUT/ArcheryintheUSA.aab"
