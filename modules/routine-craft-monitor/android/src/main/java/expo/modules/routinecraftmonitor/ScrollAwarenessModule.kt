package expo.modules.routinecraftmonitor

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScrollAwarenessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RoutineCraftMonitor")

    AsyncFunction("getState") {
      val context = requireNotNull(appContext.reactContext)
      mapOf(
        "supported" to true,
        "enabled" to ScrollAwarenessStorage.isEnabled(context),
        "floatingEnabled" to ScrollAwarenessStorage.isFloatingEnabled(context),
        "trackedPackages" to ScrollAwarenessStorage.trackedApps(context).toList(),
        "accessibilityEnabled" to ScrollAwarenessStorage.isAccessibilityEnabled(context),
        "overlayPermission" to Settings.canDrawOverlays(context),
        "notificationsEnabled" to NotificationManagerCompat.from(context).areNotificationsEnabled()
      )
    }

    AsyncFunction("setConfig") { enabled: Boolean, floatingEnabled: Boolean, trackedPackages: List<String> ->
      val context = requireNotNull(appContext.reactContext)
      ScrollAwarenessStorage.saveConfig(context, enabled, floatingEnabled, trackedPackages)
      ScrollAwarenessAccessibilityService.activeService?.refreshMonitorState()
    }

    AsyncFunction("getStats") { days: Int ->
      ScrollAwarenessStorage.getStats(requireNotNull(appContext.reactContext), days)
    }

    AsyncFunction("openAccessibilitySettings") {
      val context = requireNotNull(appContext.reactContext)
      context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("openOverlaySettings") {
      val context = requireNotNull(appContext.reactContext)
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("openNotificationSettings") {
      val context = requireNotNull(appContext.reactContext)
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}