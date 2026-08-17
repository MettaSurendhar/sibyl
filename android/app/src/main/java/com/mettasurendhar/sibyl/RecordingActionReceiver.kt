package com.mettasurendhar.sibyl

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule

class RecordingActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        
        // Forward the action to the React Native JS side
        val reactContext = (context.applicationContext as ReactApplication)
            .reactNativeHost
            .reactInstanceManager
            .currentReactContext

        if (reactContext != null) {
            val eventName = when (action) {
                "com.mettasurendhar.sibyl.RECORDING_TOGGLE" -> "onRecordingToggle"
                "com.mettasurendhar.sibyl.RECORDING_SAVE" -> "onRecordingSave"
                "com.mettasurendhar.sibyl.RECORDING_DISCARD" -> "onRecordingDiscard"
                else -> null
            }
            
            eventName?.let {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(it, null)
            }
        }
    }
}
