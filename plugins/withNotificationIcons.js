// Creates small drawable XML icons for Notifee notification action buttons.
// These must be vector drawables placed in android/app/src/main/res/drawable/.
// Reference them in Notifee actions by the filename without extension.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Simple filled vector drawables sized for notification action icons (24dp)
const icons = {
	'notif_ic_play.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFF"
      android:pathData="M8,5v14l11,-7z"/>
</vector>`,

	'notif_ic_pause.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFF"
      android:pathData="M6,19h4V5H6v14zm8,-14v14h4V5h-4z"/>
</vector>`,

	'notif_ic_forward.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFF"
      android:pathData="M4,18l8.5,-6L4,6v12zm9,-12v12l8.5,-6L13,6z"/>
</vector>`,

	'notif_ic_backward.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFF"
      android:pathData="M11,18V6l-8.5,6L11,18zm0.5,-6l8.5,6V6l-8.5,6z"/>
</vector>`,

	'notif_ic_save.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFF"
      android:pathData="M17,3H5C3.89,3 3,3.9 3,5v14c0,1.1 0.89,2 2,2h14c1.1,0 2,-0.9 2,-2V7l-4,-4zm-5,16c-1.66,0 -3,-1.34 -3,-3s1.34,-3 3,-3 3,1.34 3,3 -1.34,3 -3,3zm3,-10H5V5h10v4z"/>
</vector>`,

	'notif_ic_discard.xml': `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFF"
      android:pathData="M6,19c0,1.1 0.9,2 2,2h8c1.1,0 2,-0.9 2,-2V7H6v12zM19,4h-3.5l-1,-1h-5l-1,1H5v2h14V4z"/>
</vector>`,
};

module.exports = function withNotificationIcons(config) {
	return withDangerousMod(config, [
		'android',
		async (config) => {
			const drawableDir = path.join(
				config.modRequest.platformProjectRoot,
				'app', 'src', 'main', 'res', 'drawable'
			);
			if (!fs.existsSync(drawableDir)) {
				fs.mkdirSync(drawableDir, { recursive: true });
			}
			for (const [filename, content] of Object.entries(icons)) {
				fs.writeFileSync(path.join(drawableDir, filename), content, 'utf8');
			}
			return config;
		},
	]);
};
