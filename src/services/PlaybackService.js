import TrackPlayer, { Event, State } from 'react-native-track-player';
import { MediaController } from './MediaController';

module.exports = async function() {

    // ─── Play / Pause from the notification ─────────────────────────────────
    TrackPlayer.addEventListener(Event.RemotePlay, async () => {
        // Check if we're at the end — if so, restart from the beginning
        const stateObj = await TrackPlayer.getPlaybackState().catch(() => null);
        if (stateObj?.state === State.Ended) {
            try { await TrackPlayer.skip(0); } catch {}
            await TrackPlayer.seekTo(0);
        }
        await TrackPlayer.play();
        // Notify the active UI (LibraryScreen / PlaybackScreen) so its play button syncs
        MediaController.onAction('play');
    });

    TrackPlayer.addEventListener(Event.RemotePause, async () => {
        await TrackPlayer.pause();
        MediaController.onAction('pause');
    });

    TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
    TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());

    TrackPlayer.addEventListener(Event.RemoteSeek, async ({ position }) => {
        const stateObj = await TrackPlayer.getPlaybackState().catch(() => null);
        if (stateObj?.state === State.Ended) {
            try { await TrackPlayer.skip(0); } catch {}
        }
        await TrackPlayer.seekTo(position);
    });

    TrackPlayer.addEventListener(Event.RemoteStop, async () => {
        await TrackPlayer.reset();
        MediaController.onAction('stop');
    });
};
