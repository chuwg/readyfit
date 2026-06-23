import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/inbody/LineChart';
import { WeekBarChart } from '../../src/components/analytics/WeekBarChart';
import {
  METRIC_LABEL,
  METRIC_ORDER,
  METRIC_UNIT,
  diffArrow,
  formatDiff,
  formatMetric,
  goalProgress,
  metricDiff,
  metricValue,
  seriesFor,
} from '../../src/lib/inbody';
import {
  addMonths,
  buildHighlights,
  buildMonthSummary,
  buildWeekDays,
  computeLoadIndex,
  startOfMonth,
  startOfWeek,
  trendGct,
  trendHr,
  trendPace,
  type LoadIndex,
  type MonthHighlight,
  type MonthSummary,
} from '../../src/lib/analytics';
import { formatDuration, formatPace } from '../../src/lib/pace';
import {
  getLatestInbody,
  getPreviousInbody,
  listAllBasketballSessions,
  listAllRunningSessions,
  listBasketballSessionsBetween,
  listInbodyRecords,
  listRunningSessionsBetween,
  listSleepRecords,
  loadUserProfile,
} from '../../src/services/db';
import { colors, radius, spacing } from '../../src/theme/colors';
import type {
  BasketballSession,
  InbodyMetric,
  InbodyRecord,
  RunningSession,
  SleepRecord,
  UserProfile,
} from '../../src/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 2 - spacing.lg * 2;

const METRIC_COLOR: Record<InbodyMetric, string> = {
  weightKg: colors.sleep,
  skeletalMuscleKg: colors.mint,
  bodyFatPct: colors.warn,
  score: colors.hrv,
};

type Tab = 'week' | 'month' | 'trend' | 'inbody';

interface Data {
  weekRunning: RunningSession[];
  weekBasketball: BasketballSession[];
  monthRunning: RunningSession[];
  monthBasketball: BasketballSession[];
  prevMonthRunning: RunningSession[];
  prevMonthBasketball: BasketballSession[];
  allRunning: RunningSession[];
  allBasketball: BasketballSession[];
  allInbody: InbodyRecord[];
  latestInbody: InbodyRecord | null;
  previousInbody: InbodyRecord | null;
  sleepRecords: SleepRecord[];
  profile: UserProfile;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('week');
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = startOfMonth(now);
    const monthEnd = addMonths(monthStart, 1);
    const prevMonthStart = addMonths(monthStart, -1);

    const [
      weekRunning,
      weekBasketball,
      monthRunning,
      monthBasketball,
      prevMonthRunning,
      prevMonthBasketball,
      allRunning,
      allBasketball,
      allInbody,
      latestInbody,
      sleepRecords,
      profile,
    ] = await Promise.all([
      listRunningSessionsBetween(weekStart.getTime(), weekEnd.getTime()),
      listBasketballSessionsBetween(weekStart.getTime(), weekEnd.getTime()),
      listRunningSessionsBetween(monthStart.getTime(), monthEnd.getTime()),
      listBasketballSessionsBetween(monthStart.getTime(), monthEnd.getTime()),
      listRunningSessionsBetween(prevMonthStart.getTime(), monthStart.getTime()),
      listBasketballSessionsBetween(prevMonthStart.getTime(), monthStart.getTime()),
      listAllRunningSessions(),
      listAllBasketballSessions(),
      listInbodyRecords(),
      getLatestInbody(),
      listSleepRecords(30),
      loadUserProfile(),
    ]);
    const previousInbody = latestInbody
      ? await getPreviousInbody(latestInbody.measuredAt)
      : null;

    setData({
      weekRunning,
      weekBasketball,
      monthRunning,
      monthBasketball,
      prevMonthRunning,
      prevMonthBasketball,
      allRunning,
      allBasketball,
      allInbody,
      latestInbody,
      previousInbody,
      sleepRecords,
      profile,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>분석</Text>
          {tab === 'inbody' && (
            <Pressable
              onPress={() => router.push('/inbody-entry')}
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>+ 기록 추가</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.segments}>
          {(
            [
              { v: 'week', label: '주간' },
              { v: 'month', label: '월간' },
              { v: 'trend', label: '트렌드' },
              { v: 'inbody', label: '인바디' },
            ] as Array<{ v: Tab; label: string }>
          ).map((s) => (
            <Pressable
              key={s.v}
              onPress={() => setTab(s.v)}
              style={[styles.segment, tab === s.v && styles.segmentActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  tab === s.v && styles.segmentTextActive,
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {!data ? null : tab === 'week' ? (
          <WeekView data={data} />
        ) : tab === 'month' ? (
          <MonthView data={data} />
        ) : tab === 'trend' ? (
          <TrendView data={data} />
        ) : (
          <InbodyView data={data} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WeekView({ data }: { data: Data }) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weightKg = data.latestInbody?.weightKg ?? null;
  const days = useMemo(
    () => buildWeekDays(weekStart, data.weekRunning, data.weekBasketball, weightKg),
    [data.weekBasketball, data.weekRunning, weekStart, weightKg],
  );
  const load: LoadIndex = useMemo(
    () =>
      computeLoadIndex(now, data.allRunning, data.allBasketball, {
        maxHr: data.profile.maxHeartRate,
      }),
    [data.allBasketball, data.allRunning, now, data.profile.maxHeartRate],
  );
  const totalKm = days.reduce((a, d) => a + d.runningKm, 0);
  const totalMin = days.reduce(
    (a, d) => a + d.runningMinutes + d.basketballMinutes,
    0,
  );

  return (
    <>
      <Card title="이번 주 활동">
        <View style={styles.summaryRow}>
          <SummaryCell label="러닝 거리" value={`${totalKm.toFixed(1)}km`} />
          <SummaryCell label="총 시간" value={`${totalMin}분`} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <WeekBarChart data={days} />
        </View>
      </Card>

      <Card title="훈련 부하 (ATL/CTL)">
        <View style={styles.summaryRow}>
          <SummaryCell label="ATL (7일)" value={`${load.atl}`} />
          <SummaryCell label="CTL (28일)" value={`${load.ctl}`} />
          <SummaryCell
            label="ACWR"
            value={load.acwr.toFixed(2)}
            color={load.warning ? colors.bad : colors.mint}
          />
        </View>
        {load.warning && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              급성 부하가 만성 대비 높아요 (ACWR ≥ 1.3). 회복일을 추가해보세요.
            </Text>
          </View>
        )}
        <Text style={styles.hint}>
          심박 기반 훈련부하(TRIMP)의 7일·28일 일평균입니다. ACWR(급성/만성)이 0.8~1.3이면 적정, 1.3 이상이면 과부하 신호.
        </Text>
      </Card>
    </>
  );
}

function MonthView({ data }: { data: Data }) {
  const weightKg = data.latestInbody?.weightKg ?? null;
  const summary = useMemo(
    () => buildMonthSummary(data.monthRunning, data.monthBasketball, weightKg),
    [data.monthBasketball, data.monthRunning, weightKg],
  );
  const prevSummary = useMemo(
    () => buildMonthSummary(data.prevMonthRunning, data.prevMonthBasketball, weightKg),
    [data.prevMonthBasketball, data.prevMonthRunning, weightKg],
  );
  const highlights = useMemo<MonthHighlight[]>(
    () =>
      buildHighlights(
        summary,
        prevSummary,
        prevSummary.best5kSeconds,
        prevSummary.best10kSeconds,
      ),
    [prevSummary, summary],
  );

  const goal5k = data.profile.runningGoal5kSeconds;
  const goal10k = data.profile.runningGoal10kSeconds;

  return (
    <>
      <Card title="이번 달">
        <View style={styles.summaryRow}>
          <SummaryCell
            label="러닝 거리"
            value={`${summary.totalRunningKm.toFixed(1)}km`}
          />
          <SummaryCell
            label="농구 세션"
            value={`${summary.totalBasketballSessions}회`}
          />
          <SummaryCell label="총 시간" value={`${summary.totalMinutes}분`} />
        </View>
        <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
          <SummaryCell
            label="총 칼로리"
            value={`${summary.totalCalories} kcal`}
          />
        </View>
      </Card>

      <Card title="베스트 기록 (이번 달)">
        <BestRow
          label="5km"
          value={summary.best5kSeconds}
          goal={goal5k}
        />
        <BestRow
          label="10km"
          value={summary.best10kSeconds}
          goal={goal10k}
        />
      </Card>

      <Card title="하이라이트">
        {highlights.length === 0 ? (
          <Text style={styles.dim}>
            기록이 더 쌓이면 흥미로운 변화를 보여드릴게요.
          </Text>
        ) : (
          highlights.map((h, i) => (
            <View key={i} style={styles.highlightRow}>
              <View
                style={[
                  styles.highlightDot,
                  { backgroundColor: h.positive ? colors.good : colors.warn },
                ]}
              />
              <Text style={styles.highlightText}>{h.text}</Text>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function BestRow({
  label,
  value,
  goal,
}: {
  label: string;
  value: number | null;
  goal: number | null;
}) {
  if (value === null) {
    return (
      <View style={styles.bestRow}>
        <Text style={styles.bestLabel}>{label}</Text>
        <Text style={styles.dim}>기록 없음</Text>
      </View>
    );
  }
  const goalDiff = goal !== null ? value - goal : null;
  const achieved = goalDiff !== null && goalDiff <= 0;
  return (
    <View style={styles.bestRow}>
      <Text style={styles.bestLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={styles.bestValue}>{formatDuration(value)}</Text>
        {goal !== null && (
          <Text
            style={[
              styles.bestGoal,
              { color: achieved ? colors.good : colors.textDim },
            ]}
          >
            {achieved
              ? '목표 달성'
              : `목표 ${formatDuration(goal)} (+${formatDuration(value - goal)})`}
          </Text>
        )}
      </View>
    </View>
  );
}

function TrendView({ data }: { data: Data }) {
  const paceSeries = useMemo(() => trendPace(data.allRunning), [data.allRunning]);
  const hrSeries = useMemo(
    () => trendHr(data.allRunning, data.allBasketball),
    [data.allBasketball, data.allRunning],
  );
  const gctSeries = useMemo(() => trendGct(data.allRunning), [data.allRunning]);
  const inbodyScoreSeries = useMemo(
    () =>
      data.allInbody
        .filter((r) => r.score !== null)
        .map((r) => ({ ts: r.measuredAt, value: r.score as number })),
    [data.allInbody],
  );
  const sleepSeries = useMemo(
    () =>
      data.sleepRecords.map((r) => ({
        ts: dateStringToMs(r.date),
        value: r.sleepMinutes / 60,
      })),
    [data.sleepRecords],
  );

  return (
    <>
      <TrendCard
        title="수면"
        unit="시간"
        color={colors.sleep}
        series={sleepSeries}
        format={(v) => v.toFixed(1)}
      />
      <TrendCard
        title="평균 페이스"
        unit="초/km"
        color={colors.mint}
        series={paceSeries}
      />
      <TrendCard
        title="평균 심박"
        unit="bpm"
        color={colors.bad}
        series={hrSeries}
      />
      <TrendCard
        title="GCT (지면 접촉 시간)"
        unit="ms"
        color={colors.ok}
        series={gctSeries}
      />
      <TrendCard
        title="인바디 점수"
        unit="점"
        color={colors.hrv}
        series={inbodyScoreSeries}
      />
    </>
  );
}

function dateStringToMs(date: string): number {
  const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
}

function TrendCard({
  title,
  unit,
  color,
  series,
  format,
}: {
  title: string;
  unit: string;
  color: string;
  series: Array<{ ts: number; value: number }>;
  format?: (v: number) => string;
}) {
  if (series.length === 0) {
    return (
      <Card title={title}>
        <Text style={styles.dim}>기록이 쌓이면 보여드릴게요</Text>
      </Card>
    );
  }
  const latest = series[series.length - 1]!.value;
  const display = format
    ? format(latest)
    : title === '평균 페이스'
      ? formatPace(latest)
      : Math.round(latest).toString();
  return (
    <Card title={title}>
      <View style={styles.trendHeader}>
        <Text style={styles.trendValue}>{display}</Text>
        <Text style={styles.trendUnit}>
          {title === '평균 페이스' ? '/km' : ` ${unit}`}
        </Text>
      </View>
      <LineChart
        data={series}
        width={CHART_WIDTH}
        height={140}
        color={color}
        unit={unit}
      />
    </Card>
  );
}

function InbodyView({ data }: { data: Data }) {
  const [metric, setMetric] = useState<InbodyMetric>('skeletalMuscleKg');
  const series = useMemo(
    () => seriesFor(data.allInbody, metric, 6),
    [data.allInbody, metric],
  );
  const progress = useMemo(
    () => goalProgress(data.latestInbody, data.profile.inbodyGoalScore),
    [data.latestInbody, data.profile.inbodyGoalScore],
  );

  return (
    <>
      {data.latestInbody ? (
        <Card title="최신 인바디 기록">
          <Text style={styles.latestDate}>
            {formatDateOnly(data.latestInbody.measuredAt)}
          </Text>
          <View style={styles.metricsGrid}>
            {METRIC_ORDER.map((m) => {
              const diff = metricDiff(
                data.latestInbody!,
                data.previousInbody,
                m,
              );
              return (
                <View key={m} style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{METRIC_LABEL[m]}</Text>
                  <Text style={styles.metricValue}>
                    {formatMetric(metricValue(data.latestInbody!, m), m)}
                    <Text style={styles.metricUnit}>{METRIC_UNIT[m]}</Text>
                  </Text>
                  {diff.diff !== null && (
                    <Text
                      style={[
                        styles.metricDiff,
                        {
                          color:
                            diff.isImprovement === null
                              ? colors.textDim
                              : diff.isImprovement
                                ? colors.good
                                : colors.bad,
                        },
                      ]}
                    >
                      {diffArrow(diff)} {formatDiff(diff, m)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      ) : (
        <Card title="인바디 기록">
          <Text style={styles.dim}>
            첫 기록을 추가해보세요. 측정일과 주요 항목만 입력하면 됩니다.
          </Text>
        </Card>
      )}

      {progress && (
        <Card title="목표 달성률">
          <View style={styles.goalRow}>
            <Text style={styles.goalCurrent}>{progress.current}</Text>
            <Text style={styles.goalSep}>/</Text>
            <Text style={styles.goalTarget}>{progress.goal}점</Text>
            <Text
              style={[
                styles.goalStatus,
                { color: progress.achieved ? colors.good : colors.warn },
              ]}
            >
              {progress.achieved ? '목표 달성' : `${progress.gap}점 남음`}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${progress.ratio * 100}%`,
                  backgroundColor: progress.achieved ? colors.good : colors.mint,
                },
              ]}
            />
          </View>
        </Card>
      )}

      <Card title="변화 추이">
        <View style={styles.chips}>
          {METRIC_ORDER.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              style={[styles.chip, m === metric && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  m === metric && { color: METRIC_COLOR[m] },
                ]}
              >
                {METRIC_LABEL[m]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: spacing.md }}>
          <LineChart
            data={series}
            width={CHART_WIDTH}
            height={180}
            color={METRIC_COLOR[metric]}
            unit={METRIC_UNIT[metric]}
          />
        </View>
      </Card>
    </>
  );
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function formatDateOnly(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  addBtn: {
    backgroundColor: colors.mint + '22',
    borderColor: colors.mint,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  addBtnText: {
    color: colors.mint,
    fontSize: 13,
    fontWeight: '700',
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: colors.mint + '22',
  },
  segmentText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.mint,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCell: {
    flex: 1,
  },
  summaryLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  warnBox: {
    backgroundColor: colors.bad + '22',
    borderColor: colors.bad + '55',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnText: {
    color: colors.bad,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  bestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bestLabel: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  bestValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  bestGoal: {
    fontSize: 12,
    fontWeight: '600',
  },
  dim: {
    color: colors.textDim,
    fontSize: 13,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  highlightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  highlightText: {
    color: colors.text,
    fontSize: 13,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  trendValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  trendUnit: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  latestDate: {
    color: colors.textDim,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCell: {
    width: '50%',
    paddingVertical: spacing.sm,
  },
  metricLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  metricUnit: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  metricDiff: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  goalCurrent: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
  },
  goalSep: {
    color: colors.textMuted,
    fontSize: 18,
    marginHorizontal: 4,
  },
  goalTarget: {
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '700',
  },
  goalStatus: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  track: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.mint,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
});
