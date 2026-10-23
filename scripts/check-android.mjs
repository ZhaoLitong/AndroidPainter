import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
const output = (java.stderr || '') + (java.stdout || '');
const major = Number(output.match(/version "(\d+)/)?.[1]);
let failed = false;
function check(ok, message) {
  console.log(`${ok ? 'OK' : 'MISSING'}: ${message}`);
  failed ||= !ok;
}
check(major >= 21, `Java 21 or newer (found ${major || 'no usable Java'})`);
check(
  Boolean(sdk && existsSync(sdk)),
  'ANDROID_HOME or ANDROID_SDK_ROOT points to the Android SDK',
);
check(
  Boolean(sdk && existsSync(path.join(sdk, 'platforms', 'android-36'))),
  'Android SDK Platform 36',
);
if (failed) {
  console.log(
    '\nInstall the prerequisites described in README.md, then run npm run android:check again.',
  );
  process.exitCode = 1;
}
