package com.mettasurendhar.sibyl

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class RecordingNotificationService : Service() {

    companion object {
        const val CHANNEL_ID = "recording_channel_v3"
        const val NOTIFICATION_ID = 1001
        
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        
        const val EXTRA_IS_PLAYING = "EXTRA_IS_PLAYING"
        const val EXTRA_DURATION_MS = "EXTRA_DURATION_MS"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                val durationMs = intent.getIntExtra(EXTRA_DURATION_MS, 0)
                startForegroundService(isPlaying, durationMs)
            }
            ACTION_STOP -> {
                stopForeground(true)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundService(isPlaying: Boolean, durationMs: Int) {
        createNotificationChannel()

        val toggleAction = createAction(
            "com.mettasurendhar.sibyl.RECORDING_TOGGLE", 
            if (isPlaying) "Pause" else "Resume",
            // We reuse standard Android drawable resources for simplicity, 
            // or your custom ones if they exist. We'll use standard text for now
            // since we don't have guaranteed drawables available here easily
            // without bringing in R.drawable.
            android.R.drawable.ic_media_pause // Not strictly used for text buttons if we just use title
        )
        
        val saveAction = createAction(
            "com.mettasurendhar.sibyl.RECORDING_SAVE", 
            "Save",
            android.R.drawable.ic_menu_save
        )
        
        val discardAction = createAction(
            "com.mettasurendhar.sibyl.RECORDING_DISCARD", 
            "Discard",
            android.R.drawable.ic_menu_delete
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Recording...")
            .setContentText(formatDuration(durationMs))
            .setSmallIcon(android.R.drawable.ic_btn_speak_now) // Must be a drawable, not a mipmap!
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(toggleAction)
            .addAction(saveAction)
            .addAction(discardAction)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createAction(actionString: String, title: String, icon: Int): NotificationCompat.Action {
        val intent = Intent(this, RecordingActionReceiver::class.java).apply {
            action = actionString
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getBroadcast(this, 0, intent, flags)
        
        return NotificationCompat.Action.Builder(icon, title, pendingIntent).build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Voice Recording",
                NotificationManager.IMPORTANCE_LOW // Low = no sound/vibration
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun formatDuration(ms: Int): String {
        val totalSecs = Math.max(0, ms) / 1000
        val mins = totalSecs / 60
        val secs = totalSecs % 60
        return String.format("%d:%02d", mins, secs)
    }
}
