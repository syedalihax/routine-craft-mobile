import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import {
  getScrollAwarenessStats,
  getScrollMonitorState,
} from '../../modules/routine-craft-monitor';

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const aggregateStats = (stats, timeframe) => {
  const byDate = new Map(stats.map((item) => [item.date, item]));
  const now = new Date();
  const points = [];

  if (timeframe === 'DAILY') {
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = getDateKey(date);
      const item = byDate.get(key);
      points.push({
        key,
        label: date.toLocaleDateString('en-US', { day: 'numeric' }),
        seconds: item?.seconds || 0,
        scrolls: item?.scrolls || 0,
      });
    }
    return points;
  }

  if (timeframe === 'WEEKLY') {
    const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
    for (let offset = 3; offset >= 0; offset -= 1) {
      const start = new Date(currentMonday);
      start.setDate(start.getDate() - offset * 7);
      const startKey = getDateKey(start);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      let seconds = 0;
      let scrolls = 0;
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const item = byDate.get(getDateKey(day));
        seconds += item?.seconds || 0;
        scrolls += item?.scrolls || 0;
      }
      points.push({
        key: startKey,
        label: start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        seconds,
        scrolls,
      });
    }
    return points;
  }

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    let seconds = 0;
    let scrolls = 0;
    for (let day = new Date(monthStart); day < nextMonth; day.setDate(day.getDate() + 1)) {
      const item = byDate.get(getDateKey(day));
      seconds += item?.seconds || 0;
      scrolls += item?.scrolls || 0;
    }
    points.push({
      key: getDateKey(monthStart),
      label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
      seconds,
      scrolls,
    });
  }
  return points;
};

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

export default function ScrollAwarenessCard({ timeframe, refreshing }) {
  const { themeMode } = useAuth();
  const colors = Colors[themeMode === 'LIGHT' ? 'light' : 'dark'];
  const [stats, setStats] = useState([]);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [metric, setMetric] = useState('TIME');

  useEffect(() => {
    let mounted = true;
    Promise.all([getScrollMonitorState(), getScrollAwarenessStats(180)])
      .then(([state, result]) => {
        if (!mounted) return;
        setSupported(state.supported);
        setEnabled(state.enabled);
        setStats(result);
      })
      .catch(() => {
        if (mounted) setSupported(false);
      });
    return () => {
      mounted = false;
    };
  }, [timeframe, refreshing]);

  const points = aggregateStats(stats, timeframe);
  const totalSeconds = points.reduce((sum, point) => sum + point.seconds, 0);
  const totalScrolls = points.reduce((sum, point) => sum + point.scrolls, 0);
  const maxValue = Math.max(1, ...points.map((point) => metric === 'TIME' ? point.seconds : point.scrolls));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <MaterialIcons name="swipe-vertical" size={19} color={colors.primary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Scrolling Awareness</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Selected social apps · this device</Text>
        </View>
      </View>

      {!supported ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Available in the Android app build.</Text>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryMetric}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatDuration(totalSeconds)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Scrolling time</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryMetric}>
              <Text style={[styles.summaryValue, { color: colors.accent }]}>{totalScrolls.toLocaleString()}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Scroll events</Text>
            </View>
          </View>

          {!enabled && totalSeconds === 0 && totalScrolls === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Enable Scroll Counter in Settings to begin.</Text>
          ) : (
            <>
              <View style={[styles.metricSwitch, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {[
                  { key: 'TIME', label: 'Time' },
                  { key: 'SCROLLS', label: 'Scrolls' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: metric === item.key }}
                    style={[styles.metricButton, metric === item.key && { backgroundColor: colors.surfaceElevated }]}
                    onPress={() => setMetric(item.key)}
                  >
                    <Text style={[styles.metricButtonText, { color: metric === item.key ? colors.text : colors.textSecondary }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.chart}>
                {points.map((point) => {
                  const value = metric === 'TIME' ? point.seconds : point.scrolls;
                  const height = value === 0 ? 3 : Math.max(5, (value / maxValue) * 90);
                  return (
                    <View key={point.key} style={styles.chartColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height,
                              backgroundColor: metric === 'TIME' ? colors.primary : colors.accent,
                              opacity: value === 0 ? 0.3 : 1,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.chartLabel, { color: colors.textMuted }]} numberOfLines={1}>
                        {point.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headingIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 203, 129, 0.10)',
  },
  headingCopy: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  summaryMetric: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  metricSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
    alignSelf: 'flex-start',
  },
  metricButton: {
    minWidth: 70,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  metricButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chart: {
    height: 126,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 14,
    gap: 3,
  },
  chartColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '55%',
    minWidth: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  chartLabel: {
    width: '100%',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 5,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
});