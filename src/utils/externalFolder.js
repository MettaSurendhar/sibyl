import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const SAF = FileSystem.StorageAccessFramework;

// Storage Access Framework is Android-only - there's no equivalent public-folder-write API on iOS
// without ejecting to native code. Every function here is a no-op / throws a clear error on iOS
// so callers can fall back to something else (e.g. the share sheet) instead of silently failing.
export function isExternalFolderSupported() {
	return Platform.OS === 'android';
}

// Opens Android's system folder picker (the user can navigate anywhere, including creating a new
// folder via the picker's own "New folder" button) and returns the granted directory's content://
// URI, or null if the user backed out. This permission is persisted by the OS across app
// restarts - callers should save the returned URI (see settingsStore) and only call this again if
// there's no saved URI yet, or the user explicitly wants to change the folder.
export async function pickFolder() {
	if (!isExternalFolderSupported()) return null;
	const result = await SAF.requestDirectoryPermissionsAsync();
	return result.granted ? result.directoryUri : null;
}

// Best-effort human-readable label for a SAF directory URI, for display in Settings - e.g.
// "content://.../tree/primary%3ADownload" -> "Download". Falls back to the raw URI if it doesn't
// match the expected shape rather than throwing, since this is only ever used for display.
export function folderDisplayName(directoryUri) {
	if (!directoryUri) return '';
	try {
		const decoded = decodeURIComponent(directoryUri);
		const afterColon = decoded.split(':').pop();
		return afterColon || decoded;
	} catch (e) {
		return directoryUri;
	}
}

// Writes a UTF-8 text file into a previously-granted SAF directory. Returns the new file's URI.
export async function writeTextFileToFolder(directoryUri, filename, content) {
	if (!isExternalFolderSupported()) {
		throw new Error('Saving to a chosen folder is only available on Android.');
	}
	const fileUri = await SAF.createFileAsync(
		directoryUri,
		filename,
		'text/plain',
	);
	await FileSystem.writeAsStringAsync(fileUri, content, {
		encoding: FileSystem.EncodingType.UTF8,
	});
	return fileUri;
}

// Copies a local file (e.g. a just-finished recording living in app-internal storage) into a
// previously-granted SAF directory. Used for the "mirror a copy to my folder" backup behavior -
// the internal copy remains the one the app actually plays/edits; this is purely an extra,
// user-visible copy. Reads via base64 since SAF writes go through content:// URIs, not raw
// filesystem paths, so a direct file-to-file copy isn't available here.
export async function copyFileToFolder(
	directoryUri,
	sourceUri,
	filename,
	mimeType,
) {
	if (!isExternalFolderSupported()) return null;
	const base64 = await FileSystem.readAsStringAsync(sourceUri, {
		encoding: FileSystem.EncodingType.Base64,
	});
	const fileUri = await SAF.createFileAsync(
		directoryUri,
		filename,
		mimeType || 'application/octet-stream',
	);
	await FileSystem.writeAsStringAsync(fileUri, base64, {
		encoding: FileSystem.EncodingType.Base64,
	});
	return fileUri;
}
