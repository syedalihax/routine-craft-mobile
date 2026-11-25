import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api';
import {
  getScrollMonitorState,
  isScrollMonitorAvailable,
  openScrollAccessibilitySettings,
  openScrollNotificationSettings,
  openScrollOverlaySettings,
  setScrollMonitorConfig,
} from '../../modules/routine-craft-monitor';
import Header from '../components/Header';

const SOCIAL_APPS = [
  { packageName: 'com.instagram.android', label: 'Instagram', icon: 'photo-camera' },
  { packageName: 'com.zhiliaoapp.musically', label: 'TikTok', icon: 'music-video' },
  { packageName: 'com.google.android.youtube', label: 'YouTube', icon: 'smart-display' },
  { packageName: 'com.facebook.katana', label: 'Facebook', icon: 'people' },
  { packageName: 'com.snapchat.android', label: 'Snapchat', icon: 'camera-alt' },
  { packageName: 'com.twitter.android', label: 'X', icon: 'tag' },
  { packageName: 'com.reddit.frontpage', label: 'Reddit', icon: 'forum' },
];

export default function SettingsScreen() {
  const { user, themeMode, updatePreferences, logout } = useAuth();
  const colors = Colors[themeMode === 'LIGHT' ? 'light' : 'dark'];

  const [remindersEnabled, setRemindersEnabled] = useState(
    user?.preferences?.remindersEnabled || false
  );
  const [reminderHour, setReminderHour] = useState(
    (user?.preferences?.reminderHour ?? 20).toString()
  );
  const [reminderMinute, setReminderMinute] = useState(
    (user?.preferences?.reminderMinute ?? 0).toString()
  );

  // Backend URL configuration
  const [backendUrl, setBackendUrl] = useState(getApiBaseUrl());
  const [savingUrl, setSavingUrl] = useState(false);
  const [monitorState, setMonitorState] = useState({
    supported: false,
    enabled: false,
    floatingEnabled: false,
    trackedPackages: [],
    accessibilityEnabled: false,
    overlayPermission: false,
    notificationsEnabled: false,
  });

  const refreshMonitorState = async () => {
    const state = await getScrollMonitorState();
    setMonitorState(state);
  };

  useEffect(() => {
    refreshMonitorState();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshMonitorState();
    });
    return () => subscription.remove();
  }, []);

  const saveMonitorState = async (nextState) => {
    setMonitorState(nextState);
    try {
      await setScrollMonitorConfig(
        nextState.enabled,
        nextState.floatingEnabled,
        nextState.trackedPackages
      );
      await refreshMonitorState();
    } catch (err) {
      Alert.alert('Error', 'Could not update scrolling awareness settings.');
    }
  };

  const handleMonitorToggle = async (enabled) => {
    const nextState = { ...monitorState, enabled };
    await saveMonitorState(nextState);
    if (!enabled) return;

    if (Number(Platform.Version) >= 33 && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    Alert.alert(
      'Allow scrolling awareness',
      'Android requires Accessibility access to detect selected-app sessions and scroll events. RoutineCraft does not read screen text or capture screenshots. Usage totals stay on this device. Turn on RoutineCraft Scroll Awareness in Android settings to continue.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: openScrollAccessibilitySettings },
      ]
    );
  };

  const handleFloatingToggle = async (floatingEnabled) => {
    const nextState = { ...monitorState, floatingEnabled };
    await saveMonitorState(nextState);
    if (floatingEnabled && !monitorState.overlayPermission) {
      Alert.alert(
        'Allow floating counter',
        'Android needs permission to show the small draggable counter over other apps.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: openScrollOverlaySettings },
        ]
      );
    }
  };

  const handleTrackedAppToggle = (packageName, selected) => {
    const trackedPackages = selected
      ? [...monitorState.trackedPackages, packageName]
      : monitorState.trackedPackages.filter((item) => item !== packageName);
    saveMonitorState({ ...monitorState, trackedPackages });
  };

  const handleThemeChange = async (mode) => {
    try {
      await updatePreferences({ themeMode: mode });
    } catch (err) {
      Alert.alert('Error', 'Failed to update theme mode');
    }
  };

  const handleReminderToggle = async (val) => {
    setRemindersEnabled(val);
    try {
      await updatePreferences({
        remindersEnabled: val,
        reminderHour: parseInt(reminderHour, 10) || 20,
        reminderMinute: parseInt(reminderMinute, 10) || 0,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to update reminders');
    }
  };

  const handleSaveBackendUrl = async () => {
    if (!backendUrl.trim()) return;
    setSavingUrl(true);
    try {
      await setApiBaseUrl(backendUrl.trim());
      Alert.alert('Updated', 'Backend API URL saved! Requests will now point to this address.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save API URL');
    } finally {
      setSavingUrl(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Settings" subtitle="Preferences & Configuration" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        {user && (
          <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
            </View>
          </View>
        )}

        {/* Section: Appearance */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { key: 'DARK', label: 'Dark Mode (Binance Style)', icon: 'dark-mode' },
            { key: 'LIGHT', label: 'Light Mode', icon: 'light-mode' },
            { key: 'SYSTEM', label: 'System Default', icon: 'settings-brightness' },
          ].map((item, index) => {
            const isSelected = themeMode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.optionRow,
                  index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                ]}
                onPress={() => handleThemeChange(item.key)}
              >
                <MaterialIcons name={item.icon} size={22} color={colors.textSecondary} />
                <Text style={[styles.optionLabel, { color: colors.text }]}>{item.label}</Text>
                {isSelected && <MaterialIcons name="check" size={22} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section: Daily Reminders */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Daily Reminders</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.optionRow}>
            <MaterialIcons name="notifications-none" size={22} color={colors.textSecondary} />
            <Text style={[styles.optionLabel, { color: colors.text }]}>Enable Reminders</Text>
            <Switch
              value={remindersEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {remindersEnabled && (
            <View style={[styles.timeRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Reminder Time</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  keyboardType="numeric"
                  maxLength={2}
                  value={reminderHour}
                  onChangeText={setReminderHour}
                  placeholder="20"
                />
                <Text style={[styles.timeColon, { color: colors.text }]}>:</Text>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  keyboardType="numeric"
                  maxLength={2}
                  value={reminderMinute}
                  onChangeText={setReminderMinute}
                  placeholder="00"
                />
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Scrolling Awareness</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {Platform.OS !== 'android' ? (
            <Text style={[styles.apiUrlHint, { color: colors.textSecondary }]}>
              App usage and floating scroll counters are available in the Android app only.
            </Text>
          ) : !isScrollMonitorAvailable() ? (
            <Text style={[styles.apiUrlHint, { color: colors.textSecondary }]}>
              A native Android build is required for scrolling awareness. This feature is not available in Expo Go.
            </Text>
          ) : (
            <>
              <View style={styles.optionRow}>
                <MaterialIcons name="query-stats" size={22} color={colors.textSecondary} />
                <View style={styles.awarenessOptionInfo}>
                  <Text style={[styles.optionLabel, styles.awarenessLabel, { color: colors.text }]}>Enable scroll counter</Text>
                  <Text style={[styles.awarenessHint, { color: colors.textSecondary }]}>Record selected-app time and scroll events</Text>
                </View>
                <Switch
                  value={monitorState.enabled}
                  onValueChange={handleMonitorToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <Text style={[styles.apiUrlHint, { color: colors.textSecondary, paddingTop: 0 }]}>
                Android Accessibility access is required. Only selected app names, session duration, and scroll-event totals are stored locally; screen content is not read.
              </Text>

              <TouchableOpacity
                style={[styles.permissionRow, { borderTopColor: colors.border }]}
                onPress={openScrollAccessibilitySettings}
                accessibilityRole="button"
              >
                <MaterialIcons
                  name={monitorState.accessibilityEnabled ? 'check-circle' : 'accessibility-new'}
                  size={20}
                  color={monitorState.accessibilityEnabled ? colors.primary : colors.accent}
                />
                <Text style={[styles.permissionText, { color: colors.text }]}>
                  {monitorState.accessibilityEnabled ? 'Accessibility access enabled' : 'Grant Accessibility access'}
                </Text>
                <MaterialIcons name="open-in-new" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {monitorState.enabled && (
                <>
                  {!monitorState.notificationsEnabled && (
                    <TouchableOpacity
                      style={[styles.permissionRow, { borderTopColor: colors.border }]}
                      onPress={openScrollNotificationSettings}
                    >
                      <MaterialIcons name="notifications-off" size={20} color={colors.accent} />
                      <Text style={[styles.permissionText, { color: colors.text }]}>Allow timer notifications</Text>
                      <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}

                  <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <MaterialIcons name="picture-in-picture-alt" size={22} color={colors.textSecondary} />
                    <View style={styles.awarenessOptionInfo}>
                      <Text style={[styles.optionLabel, styles.awarenessLabel, { color: colors.text }]}>Floating scroll counter</Text>
                      <Text style={[styles.awarenessHint, { color: colors.textSecondary }]}>Drag it anywhere while scrolling</Text>
                    </View>
                    <Switch
                      value={monitorState.floatingEnabled}
                      onValueChange={handleFloatingToggle}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  {monitorState.floatingEnabled && !monitorState.overlayPermission && (
                    <TouchableOpacity
                      style={[styles.permissionRow, { borderTopColor: colors.border }]}
                      onPress={openScrollOverlaySettings}
                    >
                      <MaterialIcons name="open-in-new" size={20} color={colors.accent} />
                      <Text style={[styles.permissionText, { color: colors.text }]}>Grant overlay permission</Text>
                      <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}

                  <Text style={[styles.appSelectTitle, { color: colors.textSecondary, borderTopColor: colors.border }]}>
                    APPS TO TRACK
                  </Text>
                  {SOCIAL_APPS.map((app) => (
                    <View key={app.packageName} style={[styles.appOptionRow, { borderTopColor: colors.border }]}>
                      <MaterialIcons name={app.icon} size={20} color={colors.textSecondary} />
                      <Text style={[styles.optionLabel, { color: colors.text }]}>{app.label}</Text>
                      <Switch
                        value={monitorState.trackedPackages.includes(app.packageName)}
                        onValueChange={(selected) => handleTrackedAppToggle(app.packageName, selected)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        {/* Section: Backend API Configuration (For mobile testing) */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Backend API Connection
        </Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.apiUrlHint, { color: colors.textSecondary }]}>
            Phone par test karte waqt laptop ka local Wi-Fi IP address enter karein (e.g. http://192.168.1.X:5000/api):
          </Text>
          <View style={styles.apiUrlRow}>
            <TextInput
              style={[styles.apiUrlInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={backendUrl}
              onChangeText={setBackendUrl}
              placeholder="http://192.168.1.15:5000/api"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.saveUrlBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveBackendUrl}
            >
              <Text style={styles.saveUrlBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={20} color={colors.danger} />
          <Text style={[styles.logoutBtnText, { color: colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  awarenessOptionInfo: {
    flex: 1,
  },
  awarenessLabel: {
    marginLeft: 12,
  },
  awarenessHint: {
    fontSize: 11,
    lineHeight: 15,
    marginLeft: 12,
    marginTop: 2,
  },
  permissionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  permissionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
  },
  appSelectTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  appOptionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  timeLabel: {
    fontSize: 14,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    width: 44,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  timeColon: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 4,
  },
  apiUrlHint: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  apiUrlRow: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 6,
    gap: 8,
  },
  apiUrlInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  saveUrlBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveUrlBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});
