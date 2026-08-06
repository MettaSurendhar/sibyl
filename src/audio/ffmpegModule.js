// Real audio processing for Trim / Merge / Append, backed by ffmpeg-kit-react-native-community
// (native binaries redirected via plugins/withFfmpegKitFix.js to a maintained fork, since the
// original com.arthenica binaries are no longer resolvable from any live Maven repository).
//
// Both operations write their output into RECORDINGS_DIR alongside normal recordings and return
// { uri }. Callers already know the resulting duration from data they hold (start/end times for
// trim, summed segment durations for concat) - so we deliberately do NOT create a second
// expo-av Audio.Sound here just to re-measure it. Doing so was a plausible source of the
// "operation hangs" reports: creating a brand new Sound while another Sound (e.g. a Trim/Playback
// preview player) is still loaded competes for the same native audio session.
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native-community';
import * as FileSystem from 'expo-file-system';
import { RECORDINGS_DIR, ensureRecordingsDir } from './recorder';

const TIMEOUT_MS = 45000;
// Compression of long audio can take many minutes on slow phones — give it 15 min max.
const COMPRESS_TIMEOUT_MS = 15 * 60 * 1000;

function toFfmpegPath(uri) {
  // ffmpeg-kit wants plain filesystem paths, not the file:// URI scheme Expo uses.
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${TIMEOUT_MS / 1000}s - the ffmpeg operation never returned. This may indicate an issue with the underlying ffmpeg binary.`)),
      TIMEOUT_MS
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runFfmpeg(command, context) {
  const session = await withTimeout(FFmpegKit.execute(command), context);
  const returnCode = await withTimeout(session.getReturnCode(), `${context} (reading result)`);
  if (!ReturnCode.isSuccess(returnCode)) {
    const logs = await session.getAllLogsAsString().catch(() => '');
    throw new Error(`${context} failed. ${logs?.slice(-300) || 'No ffmpeg log available.'}`);
  }
}

// Cuts [startMs, endMs] out of a single audio file. Re-encodes (not stream-copy) for
// sample-accurate cut points - a little slower but avoids the occasional click you can get
// trimming AAC on a non-frame boundary with -c copy.
export async function trimFile(inputUri, startMs, endMs) {
  await ensureRecordingsDir();
  const outputUri = `${RECORDINGS_DIR}trim_${Date.now()}.m4a`;
  const startSec = (startMs / 1000).toFixed(3);
  const durationSec = ((endMs - startMs) / 1000).toFixed(3);
  const command = `-y -i "${toFfmpegPath(inputUri)}" -ss ${startSec} -t ${durationSec} -c:a aac -b:a 128k "${toFfmpegPath(outputUri)}"`;
  await runFfmpeg(command, 'Trim');
  return { uri: outputUri };
}

// Concatenates 2+ audio files, in the given order, into one new file.
export async function concatFiles(inputUris) {
  await ensureRecordingsDir();
  const listPath = `${FileSystem.cacheDirectory}concat_${Date.now()}.txt`;
  const listContent = inputUris.map((uri) => `file '${toFfmpegPath(uri)}'`).join('\n');
  await FileSystem.writeAsStringAsync(listPath, listContent);

  const outputUri = `${RECORDINGS_DIR}merged_${Date.now()}.m4a`;
  const command = `-y -f concat -safe 0 -i "${toFfmpegPath(listPath)}" -c:a aac -b:a 128k "${toFfmpegPath(outputUri)}"`;
  await runFfmpeg(command, 'Merge/append');
  await FileSystem.deleteAsync(listPath, { idempotent: true });

  return { uri: outputUri };
}

// Compresses an audio file to 16kHz mono 32kbps AAC (ideal for Whisper APIs) and splits it into
// 5-minute chunks. This drastically reduces file size and guarantees we never hit Groq's
// 25MB per-request upload limit or their strict duration-per-request limits on the free tier.
export async function compressAndSplitForTranscription(inputUri) {
  // Use a dedicated folder for these temporary chunks to easily clean them up
  const chunkDir = `${FileSystem.cacheDirectory}transcribe_chunks_${Date.now()}/`;
  await FileSystem.makeDirectoryAsync(chunkDir, { intermediates: true });
  
  // segment_time 300 splits into 5 minute chunks (safest for free tier APIs)
  const command = `-y -i "${toFfmpegPath(inputUri)}" -vn -ac 1 -ar 16000 -c:a aac -b:a 64k -f segment -segment_time 300 "${toFfmpegPath(chunkDir)}chunk_%03d.m4a"`;

  // Use a generous timeout: a 1-hour file at 60x speed takes ~60s; add buffer for slow devices.
  const session = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Compress and split timed out after ${COMPRESS_TIMEOUT_MS / 60000} minutes`)),
      COMPRESS_TIMEOUT_MS
    );
    FFmpegKit.execute(command).then((s) => { clearTimeout(timer); resolve(s); }).catch((e) => { clearTimeout(timer); reject(e); });
  });
  const returnCode = await session.getReturnCode();
  if (!ReturnCode.isSuccess(returnCode)) {
    const logs = await session.getAllLogsAsString().catch(() => '');
    throw new Error(`Compress and split failed. ${logs?.slice(-300) || 'No ffmpeg log available.'}`);
  }
  
  // ffmpeg creates chunk_000.m4a, chunk_001.m4a... Read the directory to get them all
  const files = await FileSystem.readDirectoryAsync(chunkDir);
  const chunkUris = files
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.m4a'))
    .sort() // ensure sequential order (000, 001, 002)
    .map((f) => chunkDir + f);
    
  if (chunkUris.length === 0) {
    throw new Error('FFmpeg failed to generate any transcription chunks.');
  }
  
  return { chunkUris, chunkDir };
}
