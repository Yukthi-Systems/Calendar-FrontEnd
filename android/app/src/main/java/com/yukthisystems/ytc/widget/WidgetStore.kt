package com.yukthisystems.ytc.widget

import android.content.Context
import org.json.JSONArray

// Tasks are written by the app. A checkbox ticked in the widget is removed from
// the list straight away and queued in `pending`, because the app may not be
// running at that moment; the app drains the queue the next time it opens.
internal object WidgetStore {
  private const val PREFS = "ytc_widget"
  private const val KEY_TASKS = "tasks"
  private const val KEY_PENDING = "pending"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun tasks(ctx: Context): JSONArray = JSONArray(prefs(ctx).getString(KEY_TASKS, "[]"))

  fun saveTasks(ctx: Context, json: String) {
    prefs(ctx).edit().putString(KEY_TASKS, json).apply()
  }

  fun complete(ctx: Context, id: String) {
    val remaining = JSONArray()
    val list = tasks(ctx)
    for (i in 0 until list.length()) {
      val task = list.getJSONObject(i)
      if (task.getString("id") != id) remaining.put(task)
    }
    val pending = JSONArray(prefs(ctx).getString(KEY_PENDING, "[]"))
    pending.put(id)
    prefs(ctx).edit()
      .putString(KEY_TASKS, remaining.toString())
      .putString(KEY_PENDING, pending.toString())
      .apply()
  }

  fun takePending(ctx: Context): String {
    val value = prefs(ctx).getString(KEY_PENDING, "[]") ?: "[]"
    prefs(ctx).edit().putString(KEY_PENDING, "[]").apply()
    return value
  }
}
