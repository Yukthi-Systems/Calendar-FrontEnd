package com.yukthisystems.ytc.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.yukthisystems.ytc.MainActivity
import com.yukthisystems.ytc.R

class TodoWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { updateWidget(context, manager, it) }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_COMPLETE -> {
        val id = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        WidgetStore.complete(context, id)
        refreshAll(context)
      }
      ACTION_REFRESH -> refreshAll(context)
    }
  }

  companion object {
    const val ACTION_COMPLETE = "com.yukthisystems.ytc.widget.COMPLETE"
    const val ACTION_REFRESH = "com.yukthisystems.ytc.widget.REFRESH"
    const val EXTRA_TASK_ID = "task_id"

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TodoWidgetProvider::class.java))
      manager.notifyAppWidgetViewDataChanged(ids, R.id.task_list)
      ids.forEach { updateWidget(context, manager, it) }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val views = RemoteViews(context.packageName, R.layout.widget_todo)

      val serviceIntent = Intent(context, TodoWidgetService::class.java).apply {
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        data = Uri.parse("ytc-widget://$widgetId")
      }
      views.setRemoteAdapter(R.id.task_list, serviceIntent)
      views.setEmptyView(R.id.task_list, R.id.empty)

      val completeTemplate = PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, TodoWidgetProvider::class.java).setAction(ACTION_COMPLETE),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      )
      views.setPendingIntentTemplate(R.id.task_list, completeTemplate)

      views.setOnClickPendingIntent(R.id.refresh, broadcast(context, 1, ACTION_REFRESH))
      views.setOnClickPendingIntent(R.id.settings, openApp(context, 2, "ytc://home"))
      views.setOnClickPendingIntent(R.id.capture, openApp(context, 3, "ytc://new"))
      views.setOnClickPendingIntent(R.id.add, openApp(context, 4, "ytc://new"))

      manager.updateAppWidget(widgetId, views)
    }

    private fun broadcast(context: Context, code: Int, action: String) = PendingIntent.getBroadcast(
      context,
      code,
      Intent(context, TodoWidgetProvider::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun openApp(context: Context, code: Int, link: String) = PendingIntent.getActivity(
      context,
      code,
      Intent(Intent.ACTION_VIEW, Uri.parse(link), context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
