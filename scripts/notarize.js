const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (process.env.NOTARIZE !== 'true') {
    console.log('Skipping notarization (NOTARIZE env not set)');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('Skipping notarization: missing APPLE_ID, APPLE_ID_PASSWORD, or APPLE_TEAM_ID');
    return;
  }

  console.log(`Notarizing ${appName}...`);

  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
    tool: 'notarytool',
  });

  console.log('Notarization complete');
};
