// Adds the Notifee foreground service declarations to AndroidManifest.xml.
// @notifee/react-native v9 does not ship its own valid Expo config plugin,
// so we manually inject the required <service> entries here.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNotifee(config) {
	return withAndroidManifest(config, (config) => {
		const manifest = config.modResults.manifest;
		const application = manifest.application[0];

		// Ensure tools namespace exists
		if (!manifest.$['xmlns:tools']) {
			manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
		}

		if (!application.service) {
			application.service = [];
		}

		const existingServiceIndex = application.service.findIndex(
			(s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService'
		);

		const serviceDef = {
			$: {
				'android:name': 'app.notifee.core.ForegroundService',
				'android:exported': 'false',
				'android:foregroundServiceType': 'mediaPlayback|microphone',
				'tools:replace': 'android:foregroundServiceType',
			},
			'intent-filter': [{ action: [{ $: { 'android:name': 'app.notifee.core.ForegroundService' } }] }],
		};

		if (existingServiceIndex >= 0) {
			application.service[existingServiceIndex] = serviceDef;
		} else {
			application.service.push(serviceDef);
		}

		return config;
	});
};
