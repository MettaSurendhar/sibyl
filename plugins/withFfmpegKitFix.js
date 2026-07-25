// The community ffmpeg-kit-react-native fork depends on com.arthenica:ffmpeg-kit-https,
// whose binaries are no longer resolvable from any live Maven repository (the original
// arthenica/ffmpeg-kit project was retired). io.github.maitrungduc1410 re-publishes working
// ffmpeg-kit binaries under a new Maven group specifically to keep projects like this one
// working - this plugin redirects the dependency there at the Gradle level, since our
// android/ folder is regenerated fresh by `expo prebuild` on every build (a manual edit to
// a checked-in gradle file wouldn't survive).
const { withProjectBuildGradle } = require('expo/config-plugins');

const REPLACEMENT_VERSION = '6.0.1';
const MARKER = 'io.github.maitrungduc1410:ffmpeg-kit-https';

const SUBSTITUTION_BLOCK = `
// --- withFfmpegKitFix: redirect dead com.arthenica ffmpeg-kit binaries to a maintained fork ---
allprojects {
    configurations.all {
        resolutionStrategy.dependencySubstitution {
            substitute(module('com.arthenica:ffmpeg-kit-https')).using(module('${MARKER}:${REPLACEMENT_VERSION}'))
        }
    }
}
// --- end withFfmpegKitFix ---
`;

module.exports = function withFfmpegKitFix(config) {
	return withProjectBuildGradle(config, (config) => {
		if (config.modResults.language === 'groovy') {
			if (!config.modResults.contents.includes(MARKER)) {
				config.modResults.contents += SUBSTITUTION_BLOCK;
			}
		} else {
			throw new Error(
				'withFfmpegKitFix expected a Groovy build.gradle, got Kotlin - update the plugin.',
			);
		}
		return config;
	});
};
