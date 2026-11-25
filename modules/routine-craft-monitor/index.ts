import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

export type ScrollMonitorState = {
  supported: boolean;
  enabled: boolean;
  floatingEnabled: boolean;
  trackedPackages: string[];
  accessibilityEnabled: boolean;
  overlayPermission: boolean;
  notificationsEnabled: boolean;
};

export type ScrollAwarenessDay = {
  date: string;
  seconds: number;
  scrolls: number;
};

const unavailableState: ScrollMonitorState = {
  supported: false,
  enabled: false,
  floatingEnabled: false,
  trackedPackages: [],
  accessibilityEnabled: false,
  overlayPermission: false,
  notificationsEnabled: false,
};

let nativeModule: any = null;
if (Platform.OS === 'android') {
  try {
    nativeModule = requireNativeModule('RoutineCraftMonitor');
  } catch (_error) {
    nativeModule = null;
  }
}

export const isScrollMonitorAvailable = () => nativeModule !== null;

export const getScrollMonitorState = async (): Promise<ScrollMonitorState> =>
  nativeModule ? nativeModule.getState() : unavailableState;

export const setScrollMonitorConfig = async (
  enabled: boolean,
  floatingEnabled: boolean,
  trackedPackages: string[]
) => nativeModule?.setConfig(enabled, floatingEnabled, trackedPackages);

export const getScrollAwarenessStats = async (days = 180): Promise<ScrollAwarenessDay[]> =>
  nativeModule ? nativeModule.getStats(days) : [];

export const openScrollAccessibilitySettings = async () => nativeModule?.openAccessibilitySettings();

export const openScrollOverlaySettings = async () => nativeModule?.openOverlaySettings();

export const openScrollNotificationSettings = async () => nativeModule?.openNotificationSettings();