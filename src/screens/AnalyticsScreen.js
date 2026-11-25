import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../services/api';
import Header from '../components/Header';
import ConsistencyBarChart from '../components/ConsistencyBarChart';
import ScrollAwarenessCard from '../components/ScrollAwarenessCard';

export default function AnalyticsScreen() {
  const { themeMode } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = Colors[themeMode === 'LIGHT' ? 'light' : 'dark'];

  const [timeframe, setTimeframe] = useState('WEEKLY');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [chartPoints, setChartPoints] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [insights, setInsights] = useState(null);
  const [overallStreaks, setOverallStreaks] = useState({ currentStreak: 0, bestStreak: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await analyticsAPI.getAnalytics(timeframe, currentYear, currentMonth);
      const data = res.data.data;
      const points = data.chartPoints || [];
      setChartPoints(points);
      setSelectedIndex(points.length > 0 ? points.length - 1 : 0);
      setInsights(data.insights || null);
      setOverallStreaks(data.overallStreaks || { currentStreak: 0, bestStreak: 0 });
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe, currentYear, currentMonth]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Analytics" subtitle="Binance consistency metrics & trends" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Timeframe Selector (Daily, Weekly, Monthly) */}
        <View style={[styles.timeframeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {['DAILY', 'WEEKLY', 'MONTHLY'].map((tf) => {
            const isSelected = timeframe === tf;
            return (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.tfBtn,
                  isSelected && { backgroundColor: colors.surfaceElevated },
                ]}
                onPress={() => setTimeframe(tf)}
              >
                <Text
                  style={[
                    styles.tfBtnText,
                    { color: isSelected ? colors.text : colors.textSecondary },
                  ]}
                >
                  {tf === 'DAILY' ? '14D' : tf === 'WEEKLY' ? 'Monthly 4W' : '6M Trend'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollAwarenessCard timeframe={timeframe} refreshing={refreshing} />

        {/* Month Selector for Weekly view */}
        {timeframe === 'WEEKLY' && (
          <View style={[styles.monthNavRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.navArrow} onPress={handlePrevMonth}>
              <MaterialIcons name="chevron-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthNavTitle, { color: colors.text }]}>{monthLabel}</Text>
            <TouchableOpacity style={styles.navArrow} onPress={handleNextMonth}>
              <MaterialIcons name="chevron-right" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}

        {/* Binance Consistency Chart */}
        <ConsistencyBarChart
          points={chartPoints}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          height={180}
          showToggle={true}
          defaultChartType="curve"
        />

        {/* Streaks Cards */}
        <View style={styles.streaksRow}>
          <View style={[styles.streakCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="local-fire-department" size={22} color={colors.accent} />
            <Text style={[styles.streakValue, { color: colors.accent }]}>
              {overallStreaks.currentStreak} Days
            </Text>
            <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Active Streak</Text>
          </View>

          <View style={[styles.streakCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="emoji-events" size={22} color={colors.primary} />
            <Text style={[styles.streakValue, { color: colors.primary }]}>
              {overallStreaks.bestStreak} Days
            </Text>
            <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>All-Time Best</Text>
          </View>
        </View>

        {/* Monthly Summary Insights Card */}
        {insights && (
          <View style={[styles.insightsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.insightsCardTitle, { color: colors.text }]}>
              {insights.monthLabel} Insights
            </Text>

            <View style={styles.insightMetricsGrid}>
              <View style={styles.insightMetric}>
                <Text style={[styles.metricNumber, { color: colors.primary }]}>
                  {insights.consistencyScore}%
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Consistency Score</Text>
              </View>

              <View style={styles.insightMetric}>
                <Text style={[styles.metricNumber, { color: colors.text }]}>
                  {insights.activeDays}/{insights.totalEvaluatedDays}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Active Days</Text>
              </View>

              <View style={styles.insightMetric}>
                <Text style={[styles.metricNumber, { color: colors.accent }]}>
                  {insights.bestWeekLabel} ({insights.bestWeekPercent}%)
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Best Performing</Text>
              </View>

              <View style={styles.insightMetric}>
                <Text style={[styles.metricNumber, { color: colors.text }]}>
                  {insights.topCategoryName}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Top Habit</Text>
              </View>
            </View>
          </View>
        )}

        {/* Habit Breakdown list */}
        {insights && insights.categoryStats && insights.categoryStats.length > 0 && (
          <View style={styles.categoryStatsSection}>
            <Text style={[styles.categoryStatsTitle, { color: colors.text }]}>Habit Performance</Text>
            {insights.categoryStats.map((stat) => (
              <View
                key={stat.category._id}
                style={[styles.catStatRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.catStatInfo}>
                  <Text style={[styles.catStatName, { color: colors.text }]}>{stat.category.name}</Text>
                  <Text style={[styles.catStatSub, { color: colors.textSecondary }]}>
                    {stat.completedDays}/{stat.totalEvaluatedDays} days completed · Streak: {stat.currentStreak}d
                  </Text>
                </View>
                <Text
                  style={[
                    styles.catStatPercent,
                    {
                      color:
                        stat.consistencyPercent >= 60
                          ? colors.primary
                          : stat.consistencyPercent >= 30
                          ? colors.accent
                          : colors.danger,
                    },
                  ]}
                >
                  {stat.consistencyPercent}%
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  timeframeRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 10,
  },
  tfBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  tfBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  navArrow: {
    padding: 4,
  },
  streaksRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  streakCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  streakLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  insightsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginVertical: 10,
  },
  insightsCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  insightMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  insightMetric: {
    width: '50%',
  },
  metricNumber: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  categoryStatsSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  categoryStatsTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  catStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  catStatInfo: {
    flex: 1,
  },
  catStatName: {
    fontSize: 14,
    fontWeight: '700',
  },
  catStatSub: {
    fontSize: 12,
    marginTop: 2,
  },
  catStatPercent: {
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 12,
    fontVariant: ['tabular-nums'],
  },
});
