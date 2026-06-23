import React from 'react';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { colors } from '../theme/colors';
import type { HealthSnapshot } from '../types';

function formatSleep(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}시간 ${m}분`;
}

export function ConditionCard({ snap }: { snap: HealthSnapshot }) {
  const sleepRatio = Math.min(1, snap.sleepMinutes / (8 * 60));
  const hrvRatio = snap.hrvAverageMs > 0
    ? Math.min(1, snap.hrvMs / (snap.hrvAverageMs * 1.3))
    : 0.5;
  const fatigueRatio = snap.restingHrAverageBpm > 0
    ? Math.min(1, Math.max(0, 1 - (snap.restingHrBpm - snap.restingHrAverageBpm + 5) / 15))
    : 0.5;

  return (
    <Card title="컨디션 상세">
      <ProgressBar
        label="수면"
        value={formatSleep(snap.sleepMinutes)}
        ratio={sleepRatio}
        color={colors.sleep}
      />
      <ProgressBar
        label="HRV"
        value={`${Math.round(snap.hrvMs)}ms`}
        ratio={hrvRatio}
        color={colors.hrv}
      />
      <ProgressBar
        label="피로도 (안정시 심박)"
        value={`${Math.round(snap.restingHrBpm)}bpm`}
        ratio={fatigueRatio}
        color={colors.recovery}
      />
      {snap.respiratoryRateBrpm > 0 && (
        <ProgressBar
          label="호흡수"
          value={`${snap.respiratoryRateBrpm.toFixed(1)}회/분`}
          ratio={Math.min(1, Math.max(0, 1 - (snap.respiratoryRateBrpm - 12) / 8))}
          color={colors.hrv}
        />
      )}
      {snap.oxygenSaturationPct > 0 && (
        <ProgressBar
          label="혈중 산소"
          value={`${snap.oxygenSaturationPct.toFixed(0)}%`}
          ratio={Math.min(1, Math.max(0, (snap.oxygenSaturationPct - 90) / 8))}
          color={colors.sleep}
        />
      )}
    </Card>
  );
}
