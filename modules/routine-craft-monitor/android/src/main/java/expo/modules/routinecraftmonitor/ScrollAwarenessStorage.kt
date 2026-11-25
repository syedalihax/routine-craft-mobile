package expo.modules.routinecraftmonitor

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

internal object ScrollAwarenessStorage {
  private const val PREFS_NAME = "routine_craft_scroll_awareness"
  private const val ENABLED_KEY = "monitor_enabled"
  private const val FLOATING_KEY = "floating_counter_enabled"
  private const val TRACKED_APPS_KEY = "tracked_apps"

  fun preferences(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun isEnabled(context: Context) = preferences(context).getBoolean(ENABLED_KEY, false)

  fun isFloatingEnabled(context: Context) = preferences(context).getBoolean(FLOATING_KEY, false)

  fun trackedApps(context: Context) = preferences(context).getStringSet(TRACKED_APPS_KEY, emptySet()) ?: emptySet()

  fun saveConfig(context: Context, enabled: Boolean, floating: Boolean, packages: List<String>) {
    preferences(context).edit()
      .putBoolean(ENABLED_KEY, enabled)
      .putBoolean(FLOATING_KEY, floating)
      .putStringSet(TRACKED_APPS_KEY, packages.toSet())
      .apply()
  }

  fun addTime(context: Context, packageName: String, milliseconds: Long) {
    if (milliseconds <= 0) return
    val key = "time:${todayKey()}:$packageName"
    val prefs = preferences(context)
    prefs.edit().putLong(key, prefs.getLong(key, 0L) + milliseconds).apply()
  }

  fun addScroll(context: Context, packageName: String) {
    val key = "scroll:${todayKey()}:$packageName"
    val prefs = preferences(context)
    prefs.edit().putLong(key, prefs.getLong(key, 0L) + 1L).apply()
  }

  fun todayTotals(context: Context): Pair<Long, Long> {
    val prefixTime = "time:${todayKey()}:"
    val prefixScroll = "scroll:${todayKey()}:"
    var milliseconds = 0L
    var scrolls = 0L
    preferences(context).all.forEach { (key, value) ->
      if (key.startsWith(prefixTime) && value is Long) milliseconds += value
      if (key.startsWith(prefixScroll) && value is Long) scrolls += value
    }
    return Pair(milliseconds, scrolls)
  }

  fun getStats(context: Context, requestedDays: Int): List<Map<String, Any>> {
    val days = requestedDays.coerceIn(1, 180)
    val totals = mutableMapOf<String, Pair<Long, Long>>()
    val values = preferences(context).all

    for (offset in days - 1 downTo 0) {
      val calendar = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -offset) }
      val day = dayKey(calendar.time)
      var milliseconds = 0L
      var scrolls = 0L
      values.forEach { (key, value) ->
        if (value !is Long) return@forEach
        if (key.startsWith("time:$day:")) milliseconds += value
        if (key.startsWith("scroll:$day:")) scrolls += value
      }
      totals[day] = Pair(milliseconds / 1000L, scrolls)
    }

    return totals.map { (date, valuesForDay) ->
      mapOf("date" to date, "seconds" to valuesForDay.first, "scrolls" to valuesForDay.second)
    }
  }

  fun isAccessibilityEnabled(context: Context): Boolean {
    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    val service = ComponentName(context, ScrollAwarenessAccessibilityService::class.java)
    return enabledServices.split(':').any { ComponentName.unflattenFromString(it) == service }
  }

  private fun todayKey() = dayKey(Date())

  private fun dayKey(date: Date) = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)
}