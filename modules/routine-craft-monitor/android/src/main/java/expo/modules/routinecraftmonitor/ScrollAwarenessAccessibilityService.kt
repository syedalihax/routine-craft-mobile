package expo.modules.routinecraftmonitor

import android.accessibilityservice.AccessibilityService
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class ScrollAwarenessAccessibilityService : AccessibilityService() {
  private var activePackage: String? = null
  private var sessionStartedAt = 0L
  private var overlayView: TextView? = null
  private var windowManager: WindowManager? = null
  private var overlayParams: WindowManager.LayoutParams? = null
  private var lastTouchX = 0f
  private var lastTouchY = 0f

  override fun onServiceConnected() {
    super.onServiceConnected()
    activeService = this
    refreshMonitorState()
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    if (!ScrollAwarenessStorage.isEnabled(this)) {
      stopMonitoring()
      return
    }

    val packageName = event.packageName?.toString() ?: return
    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> handleWindowChanged(packageName)
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> handleScroll(packageName)
    }
  }

  override fun onInterrupt() {
    finishSession()
    removeOverlay()
    notificationManager().cancel(NOTIFICATION_ID)
  }

  override fun onDestroy() {
    finishSession()
    removeOverlay()
    notificationManager().cancel(NOTIFICATION_ID)
    if (activeService === this) activeService = null
    super.onDestroy()
  }

  internal fun refreshMonitorState() {
    if (!ScrollAwarenessStorage.isEnabled(this)) {
      stopMonitoring()
      return
    }
    if (activePackage != null && activePackage !in ScrollAwarenessStorage.trackedApps(this)) {
      finishSession()
      removeOverlay()
      notificationManager().cancel(NOTIFICATION_ID)
      return
    }
    if (activePackage != null) {
      updateNotification()
      updateOverlay()
    }
  }

  private fun handleWindowChanged(packageName: String) {
    val selectedApps = ScrollAwarenessStorage.trackedApps(this)
    val nextPackage = packageName.takeIf { it in selectedApps }
    if (nextPackage == activePackage) return

    finishSession()
    activePackage = nextPackage
    sessionStartedAt = if (nextPackage != null) SystemClock.elapsedRealtime() else 0L

    if (nextPackage == null) {
      removeOverlay()
      notificationManager().cancel(NOTIFICATION_ID)
    } else {
      updateNotification()
      updateOverlay()
    }
  }

  private fun handleScroll(packageName: String) {
    if (packageName != activePackage || packageName !in ScrollAwarenessStorage.trackedApps(this)) return
    ScrollAwarenessStorage.addScroll(this, packageName)
    updateOverlay()
  }

  private fun finishSession() {
    val packageName = activePackage ?: return
    val elapsed = SystemClock.elapsedRealtime() - sessionStartedAt
    ScrollAwarenessStorage.addTime(this, packageName, elapsed)
    activePackage = null
    sessionStartedAt = 0L
  }

  private fun stopMonitoring() {
    finishSession()
    removeOverlay()
    notificationManager().cancel(NOTIFICATION_ID)
  }

  private fun updateNotification() {
    val packageName = activePackage ?: return
    if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return
    val manager = notificationManager()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Scrolling awareness", NotificationManager.IMPORTANCE_LOW)
      )
    }

    val appName = try {
      packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0)).toString()
    } catch (_: Exception) {
      "Social app"
    }
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val startedAtWallClock = System.currentTimeMillis() - (SystemClock.elapsedRealtime() - sessionStartedAt)
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_recent_history)
      .setContentTitle("$appName session")
      .setContentText("Today's scrolling awareness timer")
      .setWhen(startedAtWallClock)
      .setUsesChronometer(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    manager.notify(NOTIFICATION_ID, notification)
  }

  private fun updateOverlay() {
    if (activePackage == null || !ScrollAwarenessStorage.isFloatingEnabled(this) || !Settings.canDrawOverlays(this)) {
      removeOverlay()
      return
    }

    val manager = windowManager ?: getSystemService(WINDOW_SERVICE) as WindowManager
    windowManager = manager
    val view = overlayView ?: createOverlayView().also { overlayView = it }
    val totals = ScrollAwarenessStorage.todayTotals(this)
    val liveMillis = SystemClock.elapsedRealtime() - sessionStartedAt
    val totalMinutes = (totals.first + liveMillis) / 60_000L
    view.text = "${totals.second} scrolls  ·  ${totalMinutes}m"

    if (view.parent == null) {
      val windowType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        WindowManager.LayoutParams.TYPE_PHONE
      }
      val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        windowType,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT
      ).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        y = (24 * resources.displayMetrics.density).toInt()
      }
      overlayParams = params
      manager.addView(view, params)
    } else {
      overlayParams?.let { manager.updateViewLayout(view, it) }
    }
  }

  private fun createOverlayView(): TextView {
    val density = resources.displayMetrics.density
    return TextView(this).apply {
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 12f
      setPadding((12 * density).toInt(), (7 * density).toInt(), (12 * density).toInt(), (7 * density).toInt())
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = 24 * density
        setColor(0xE61B222B.toInt())
        setStroke((1 * density).toInt(), 0xFF0ECB81.toInt())
      }
      setOnTouchListener { view, event ->
        when (event.action) {
          MotionEvent.ACTION_DOWN -> {
            lastTouchX = event.rawX
            lastTouchY = event.rawY
            true
          }
          MotionEvent.ACTION_MOVE -> {
            val params = overlayParams ?: return@setOnTouchListener false
            params.x += (event.rawX - lastTouchX).toInt()
            params.y += (event.rawY - lastTouchY).toInt()
            windowManager?.updateViewLayout(view, params)
            lastTouchX = event.rawX
            lastTouchY = event.rawY
            true
          }
          else -> true
        }
      }
    }
  }

  private fun removeOverlay() {
    val view = overlayView ?: return
    try {
      windowManager?.removeView(view)
    } catch (_: Exception) {
    }
    overlayView = null
    overlayParams = null
  }

  private fun notificationManager() = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  companion object {
    private const val CHANNEL_ID = "scroll-awareness"
    private const val NOTIFICATION_ID = 5842
    @Volatile internal var activeService: ScrollAwarenessAccessibilityService? = null
  }
}