// Xcode 27 refuses pods that target anything older than iOS 15, and several
// of ours (RevenueCat, SDWebImage, Google ads) still declare 9-13.
// Raise every pod to at least 15.1 after `pod install`.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withPodsDeploymentTarget';
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end`;

module.exports = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(file, 'utf8');
      if (!podfile.includes(MARKER)) {
        podfile = podfile.replace(/(post_install do \|installer\|\n)/, `$1${SNIPPET}\n`);
        fs.writeFileSync(file, podfile);
      }
      return cfg;
    },
  ]);
