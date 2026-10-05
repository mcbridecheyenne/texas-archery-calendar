#!/bin/zsh
# Build the iPhone app on this Mac and (optionally) upload it to App Store Connect.
# No Expo cloud involved: Xcode signs with the Apple ID signed in under
# Xcode > Settings > Accounts.
#
#   npm run ios:build     -> makes build/ios/ArcheryintheUSA.ipa
#   npm run ios:upload    -> same, then uploads it to App Store Connect (TestFlight)
#
# The build number is the current date and time (e.g. 202610051830), so every
# build is higher than the last one. The app version comes from app.json.
#
# On the Mac mini, run it from the ~/studio/archery-release clone (git pull first),
# not ~/studio/texas-archery-calendar: other Claude sessions switch branches and
# reinstall packages there, which breaks a build halfway through.
set -euo pipefail

TEAM_ID=75Y3S5CV88
SCHEME=ArcheryintheUSA
UPLOAD=0
[[ "${1:-}" == "--upload" ]] && UPLOAD=1

export PATH="/opt/homebrew/bin:$PATH"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export LANG=en_US.UTF-8 CI=1

cd "$(dirname "$0")/.."
OUT="$PWD/build/ios"
rm -rf "$OUT" && mkdir -p "$OUT"

echo "==> Installing packages"
npm ci --no-audit --no-fund

echo "==> Generating the Xcode project"
cp package.json "$OUT/package.json.bak"          # prebuild rewrites the npm scripts
npx expo prebuild --platform ios --clean
mv "$OUT/package.json.bak" package.json

BUILD_NUMBER=$(date +%Y%m%d%H%M)
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "ios/$SCHEME/Info.plist"
VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "ios/$SCHEME/Info.plist")
echo "==> Building version $VERSION ($BUILD_NUMBER)"

xcodebuild archive \
  -workspace "ios/$SCHEME.xcworkspace" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/$SCHEME.xcarchive" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=$TEAM_ID CODE_SIGN_STYLE=Automatic \
  | tee "$OUT/archive.log" | grep -E '^(\*\*|error:)|: error:' || true
[[ -d "$OUT/$SCHEME.xcarchive" ]] || { echo "Archive failed, see $OUT/archive.log"; exit 1; }

DEST=export
(( UPLOAD )) && DEST=upload
cat > "$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DEST</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
EOF

echo "==> Exporting ($DEST)"
xcodebuild -exportArchive -archivePath "$OUT/$SCHEME.xcarchive" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT" \
  -allowProvisioningUpdates | tee "$OUT/export.log" | grep -E '^(\*\*|error:)|: error:' || true
grep -q 'EXPORT SUCCEEDED' "$OUT/export.log" || { echo "Export failed, see $OUT/export.log"; exit 1; }

if (( UPLOAD )); then
  echo "==> Uploaded $VERSION ($BUILD_NUMBER). It shows up in TestFlight after Apple finishes processing."
else
  echo "==> Done: $OUT/$SCHEME.ipa"
fi
