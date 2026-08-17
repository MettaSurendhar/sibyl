package com.mettasurendhar.sibyl

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class RecordingNotificationModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RecordingNotificationModule"

    // Required for React Native built-in NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter Calls.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built-in Event Emitter Calls.
    }

    @ReactMethod
    fun startNotification(isPlaying: Boolean, durationMs: Int) {
        val intent = Intent(reactContext, RecordingNotificationService::class.java).apply {
            action = RecordingNotificationService.ACTION_START
            putExtra(RecordingNotificationService.EXTRA_IS_PLAYING, isPlaying)
            putExtra(RecordingNotificationService.EXTRA_DURATION_MS, durationMs)
        }
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun stopNotification() {
        val intent = Intent(reactContext, RecordingNotificationService::class.java).apply {
            action = RecordingNotificationService.ACTION_STOP
        }
        try {
            reactContext.startService(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
