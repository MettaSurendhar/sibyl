package com.mettasurendhar.sibyl

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.BitmapFactory
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class RecordingNotificationService : Service() {

    companion object {
        const val CHANNEL_ID = "recording_channel_v4"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"

        const val EXTRA_IS_PLAYING = "EXTRA_IS_PLAYING"
        const val EXTRA_DURATION_MS = "EXTRA_DURATION_MS"

        // Each button MUST have its own unique requestCode or Android merges PendingIntents
        private const val RC_TOGGLE  = 1
        private const val RC_SAVE    = 2
        private const val RC_DISCARD = 3
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                val durationMs = intent.getIntExtra(EXTRA_DURATION_MS, 0)
                startForegroundNotification(isPlaying, durationMs)
            }
            ACTION_STOP -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification(isPlaying: Boolean, durationMs: Int) {
        createNotificationChannel()

        val toggleAction = createAction(
            "com.mettasurendhar.sibyl.RECORDING_TOGGLE",
            if (isPlaying) "\u23f8 Pause" else "\u25b6 Resume",
            android.R.drawable.ic_media_pause,
            RC_TOGGLE
        )
        val saveAction = createAction(
            "com.mettasurendhar.sibyl.RECORDING_SAVE",
            "\u2713 Save",
            android.R.drawable.ic_menu_save,
            RC_SAVE
        )
        val discardAction = createAction(
            "com.mettasurendhar.sibyl.RECORDING_DISCARD",
            "\u2715 Discard",
            android.R.drawable.ic_menu_delete,
            RC_DISCARD
        )

        // Tapping the notification opens the app
        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentPi = PendingIntent.getActivity(
            this, 0, openAppIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(if (isPlaying) "\uD83D\uDD34 Recording\u2026" else "\u23F8 Recording paused")
            .setContentText(formatDuration(durationMs))
            .setSmallIcon(R.drawable.ic_notification)
            // Show the Sibyl app logo as the large icon
            .setLargeIcon(BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentPi)
            .addAction(toggleAction)
            .addAction(saveAction)
            .addAction(discardAction)
            .build()

        // Android 10+ (API 29) requires the foregroundServiceType in the startForeground() call too
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createAction(
        actionString: String,
        title: String,
        icon: Int,
        requestCode: Int          // MUST be unique per button
    ): NotificationCompat.Action {
        val intent = Intent(this, RecordingActionReceiver::class.java).apply {
            action = actionString
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_UPDATE_CURRENT

        val pendingIntent = PendingIntent.getBroadcast(this, requestCode, intent, flags)
        return NotificationCompat.Action.Builder(icon, title, pendingIntent).build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Voice Recording",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows recording controls on the lock screen"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun formatDuration(ms: Int): String {
        val totalSecs = maxOf(0, ms) / 1000
        val mins = totalSecs / 60
        val secs = totalSecs % 60
        return String.format("%d:%02d", mins, secs)
    }
}
