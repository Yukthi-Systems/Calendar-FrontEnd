package com.yukthisystems.ytc.widget

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Bridge the JS app uses to publish today's tasks to the home-screen widget and
// to collect the checkboxes ticked in it since the last time it looked.
class YtcWidgetModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "YtcWidget"

  @ReactMethod
  fun setTasks(json: String) {
    WidgetStore.saveTasks(reactContext, json)
    TodoWidgetProvider.refreshAll(reactContext)
  }

  @ReactMethod
  fun takePending(promise: Promise) {
    promise.resolve(WidgetStore.takePending(reactContext))
  }
}
