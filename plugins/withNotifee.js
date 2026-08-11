// Adds the Notifee foreground service declarations to AndroidManifest.xml.
// @notifee/react-native v9 does not ship its own valid Expo config plugin,
// so we manually inject the required <service> entries here.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNotifee(config) {
	return withAndroidManifest(config, (config) => {
		const manifest = config.modResults.manifest;
		const application = manifest.application[0];

		if (!application.service) {
			application.service = [];
		}

		const foregroundService = {
			$: {
				'android:name': 'app.notifee.core.ForegroundService',
				'android:exported': 'false',
				'android:foregroundServiceType': 'mediaPlayback|microphone',
			},
			'intent-filter': [{ action: [{ $: { 'android:name': 'app.notifee.core.ForegroundService' } }] }],
		};

		// Only add if not already present
		const alreadyAdded = application.service.some(
			(s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService'
		);
		if (!alreadyAdded) {
			application.service.push(foregroundService);
		}

		return config;
	});
};
