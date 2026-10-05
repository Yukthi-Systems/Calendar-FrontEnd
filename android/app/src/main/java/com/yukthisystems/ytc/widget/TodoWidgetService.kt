package com.yukthisystems.ytc.widget

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.yukthisystems.ytc.R

class TodoWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = TodoFactory(applicationContext)
}

private class TodoFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
  private var tasks: List<Pair<String, String>> = emptyList()

  override fun onCreate() {}

  override fun onDataSetChanged() {
    val array = WidgetStore.tasks(context)
    tasks = (0 until array.length()).map {
      val task = array.getJSONObject(it)
      task.getString("id") to task.getString("title")
    }
  }

  override fun onDestroy() {}

  override fun getCount(): Int = tasks.size

  override fun getViewAt(position: Int): RemoteViews {
    val (id, title) = tasks[position]
    return RemoteViews(context.packageName, R.layout.widget_todo_item).apply {
      setTextViewText(R.id.title, title)
      setOnClickFillInIntent(
        R.id.check,
        Intent().putExtra(TodoWidgetProvider.EXTRA_TASK_ID, id),
      )
    }
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount(): Int = 1

  override fun getItemId(position: Int): Long = position.toLong()

  override fun hasStableIds(): Boolean = false
}
