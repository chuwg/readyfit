import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import {
  ensureDefaultSupplements,
  insertShoe,
  insertSupplement,
  saveShiftConfig,
  saveUserProfile,
} from '../src/services/db';
import {
  defaultShiftConfig,
  flexibleWorkConfig,
  officeWorkConfig,
  shiftShortLabel,
} from '../src/services/shift';
import { TIMING_LABEL, TIMING_ORDER } from '../src/services/notifications';
import { colors, radius, spacing } from '../src/theme/colors';
import type {
  Gender,
  ShiftConfig,
  ShiftKind,
  ShoePurpose,
  SupplementTiming,
  WorkType,
} from '../src/types';

const TOTAL_STEPS = 6;
const STEP_TITLES = [
  '기본 정보',
  '근무 패턴',
  '심박 설정',
  '보충제',
  '러닝화',
  '목표 설정',
];

interface SupplementDraft {
  name: string;
  dose: string;
  timing: SupplementTiming;
}

interface ShoeDraft {
  brand: string;
  name: string;
  purpose: ShoePurpose;
  targetKm: string;
}

const NEXT_KIND: Record<ShiftKind, ShiftKind> = {
  day: 'night',
  night: 'off',
  off: 'day',
};

const KIND_COLOR: Record<ShiftKind, string> = {
  day: colors.good,
  night: colors.ok,
  off: colors.textMuted,
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);

  // Step 2
  const [workType, setWorkType] = useState<WorkType>('office');
  const [cycle, setCycle] = useState<ShiftKind[]>([
    'day',
    'day',
    'off',
    'off',
    'night',
    'night',
    'off',
    'off',
  ]);

  // Step 3
  const [maxHr, setMaxHr] = useState('');
  const [autoMaxHr, setAutoMaxHr] = useState(true);

  // Step 4
  const [supplements, setSupplements] = useState<SupplementDraft[]>([]);
  const [suppForm, setSuppForm] = useState<SupplementDraft>({
    name: '',
    dose: '',
    timing: 'morning',
  });

  // Step 5
  const [shoes, setShoes] = useState<ShoeDraft[]>([]);
  const [shoeForm, setShoeForm] = useState<ShoeDraft>({
    brand: '',
    name: '',
    purpose: 'general',
    targetKm: '',
  });

  // Step 6
  const [inbodyGoal, setInbodyGoal] = useState('90');
  const [goal5k, setGoal5k] = useState('');
  const [goal10k, setGoal10k] = useState('');

  const computedMaxHr = useMemo(() => {
    const a = parseInt(age, 10);
    if (isNaN(a) || a < 10 || a > 100) return null;
    return 220 - a;
  }, [age]);

  const effectiveMaxHr = autoMaxHr
    ? computedMaxHr
    : maxHr.trim() && !isNaN(parseInt(maxHr, 10))
      ? parseInt(maxHr, 10)
      : null;

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return name.trim().length > 0 && parseInt(age, 10) > 0 && gender !== null;
      case 1:
        return workType !== null;
      case 2:
        return effectiveMaxHr !== null && effectiveMaxHr >= 100 && effectiveMaxHr <= 230;
      default:
        return true;
    }
  };

  const next = () => {
    if (!canProceed()) {
      Alert.alert('입력 확인', '필수 항목을 입력해주세요.');
      return;
    }
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const parseGoalInput = (s: string): number | null => {
    const m = s.trim().match(/^(\d{1,3}):([0-5]?\d)$/);
    if (!m) return null;
    return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
  };

  const finish = async () => {
    const ageNum = parseInt(age, 10);
    const inbodyNum = parseInt(inbodyGoal, 10);
    const g5 = parseGoalInput(goal5k);
    const g10 = parseGoalInput(goal10k);

    await saveUserProfile({
      name: name.trim(),
      age: isNaN(ageNum) ? null : ageNum,
      gender,
      maxHeartRate: effectiveMaxHr,
      inbodyGoalScore: isNaN(inbodyNum) ? null : inbodyNum,
      runningGoal5kSeconds: g5,
      runningGoal10kSeconds: g10,
      onboarded: true,
    });

    let cfg: ShiftConfig;
    if (workType === 'shift') {
      cfg = { ...defaultShiftConfig(), cycle };
    } else if (workType === 'office') {
      cfg = officeWorkConfig();
    } else {
      cfg = flexibleWorkConfig();
    }
    await saveShiftConfig(cfg);

    if (supplements.length === 0) {
      await ensureDefaultSupplements();
    } else {
      for (const s of supplements) {
        await insertSupplement({
          name: s.name,
          dose: s.dose,
          timing: s.timing,
          shiftAdjust: s.timing === 'morning' || s.timing === 'bedtime',
          enabled: true,
        });
      }
    }

    for (const s of shoes) {
      const target = s.targetKm.trim() ? parseFloat(s.targetKm) : null;
      await insertShoe({
        name: s.name.trim(),
        brand: s.brand.trim() || null,
        purpose: s.purpose,
        currentKm: 0,
        targetKm: target && !isNaN(target) ? target : null,
        isActive: true,
        replacementAlerted: false,
      });
    }

    router.replace('/(tabs)');
  };

  const addSupplement = () => {
    if (!suppForm.name.trim() || !suppForm.dose.trim()) {
      Alert.alert('입력 확인', '이름과 용량을 입력해주세요');
      return;
    }
    setSupplements([...supplements, { ...suppForm }]);
    setSuppForm({ name: '', dose: '', timing: 'morning' });
  };

  const addShoe = () => {
    if (!shoeForm.name.trim()) {
      Alert.alert('입력 확인', '모델명을 입력해주세요');
      return;
    }
    setShoes([...shoes, { ...shoeForm }]);
    setShoeForm({ brand: '', name: '', purpose: 'general', targetKm: '' });
  };

  const toggleCycleCell = (i: number) => {
    const next = [...cycle];
    next[i] = NEXT_KIND[next[i]!];
    setCycle(next);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.brandName}>레디핏</Text>
            <Text style={styles.title}>{STEP_TITLES[step]}</Text>
            <View style={styles.progressRow}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i <= step && styles.progressDotActive,
                  ]}
                />
              ))}
              <Text style={styles.progressText}>
                {step + 1}/{TOTAL_STEPS}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 && (
              <Step1Basic
                name={name}
                age={age}
                gender={gender}
                onName={setName}
                onAge={setAge}
                onGender={setGender}
              />
            )}
            {step === 1 && (
              <Step2Work
                workType={workType}
                cycle={cycle}
                onWorkType={setWorkType}
                onToggleCell={toggleCycleCell}
              />
            )}
            {step === 2 && (
              <Step3Hr
                age={age}
                autoMaxHr={autoMaxHr}
                onAutoMaxHr={setAutoMaxHr}
                maxHr={maxHr}
                onMaxHr={setMaxHr}
                computedMaxHr={computedMaxHr}
              />
            )}
            {step === 3 && (
              <Step4Supplements
                items={supplements}
                onRemove={(i) =>
                  setSupplements(supplements.filter((_, idx) => idx !== i))
                }
                form={suppForm}
                setForm={setSuppForm}
                onAdd={addSupplement}
              />
            )}
            {step === 4 && (
              <Step5Shoes
                items={shoes}
                onRemove={(i) =>
                  setShoes(shoes.filter((_, idx) => idx !== i))
                }
                form={shoeForm}
                setForm={setShoeForm}
                onAdd={addShoe}
              />
            )}
            {step === 5 && (
              <Step6Goals
                inbodyGoal={inbodyGoal}
                onInbodyGoal={setInbodyGoal}
                goal5k={goal5k}
                onGoal5k={setGoal5k}
                goal10k={goal10k}
                onGoal10k={setGoal10k}
              />
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 && (
              <Pressable onPress={prev} style={styles.btnGhost}>
                <Text style={styles.btnGhostText}>이전</Text>
              </Pressable>
            )}
            {(step === 3 || step === 4) && (
              <Pressable onPress={next} style={styles.btnSkip}>
                <Text style={styles.btnSkipText}>건너뛰기</Text>
              </Pressable>
            )}
            <Pressable
              onPress={step === TOTAL_STEPS - 1 ? finish : next}
              style={styles.btnPrimary}
            >
              <Text style={styles.btnPrimaryText}>
                {step === TOTAL_STEPS - 1 ? '시작하기' : '다음'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function Step1Basic({
  name,
  age,
  gender,
  onName,
  onAge,
  onGender,
}: {
  name: string;
  age: string;
  gender: Gender | null;
  onName: (v: string) => void;
  onAge: (v: string) => void;
  onGender: (v: Gender) => void;
}) {
  return (
    <Card title="기본 정보">
      <Text style={styles.fieldLabel}>이름</Text>
      <TextInput
        value={name}
        onChangeText={onName}
        placeholder="홍길동"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>나이</Text>
      <TextInput
        value={age}
        onChangeText={onAge}
        placeholder="30"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>성별</Text>
      <View style={styles.row}>
        {(
          [
            { v: 'male' as Gender, label: '남성' },
            { v: 'female' as Gender, label: '여성' },
          ] as const
        ).map((g) => (
          <Pressable
            key={g.v}
            onPress={() => onGender(g.v)}
            style={[styles.chip, gender === g.v && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                gender === g.v && styles.chipTextActive,
              ]}
            >
              {g.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function Step2Work({
  workType,
  cycle,
  onWorkType,
  onToggleCell,
}: {
  workType: WorkType;
  cycle: ShiftKind[];
  onWorkType: (t: WorkType) => void;
  onToggleCell: (i: number) => void;
}) {
  const TYPES: Array<{ v: WorkType; label: string; desc: string }> = [
    { v: 'shift', label: '교대근무', desc: '주간/야간 사이클로 근무' },
    { v: 'office', label: '일반직', desc: '월~금 정시 근무' },
    { v: 'flexible', label: '자유직', desc: '고정 스케줄 없음' },
  ];

  return (
    <>
      <Card title="근무 유형">
        {TYPES.map((t) => (
          <Pressable
            key={t.v}
            onPress={() => onWorkType(t.v)}
            style={[
              styles.optionCard,
              workType === t.v && styles.optionCardActive,
            ]}
          >
            <View style={styles.optionRadio}>
              <View
                style={[
                  styles.optionRadioDot,
                  workType === t.v && styles.optionRadioDotActive,
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>{t.label}</Text>
              <Text style={styles.optionDesc}>{t.desc}</Text>
            </View>
          </Pressable>
        ))}
      </Card>

      {workType === 'shift' && (
        <Card title="근무 사이클 (탭해서 변경)">
          <Text style={styles.hint}>
            예: 주주휴휴야야휴휴 — 각 칸을 눌러 주간(주) / 야간(야) / 휴무(휴)로 변경하세요
          </Text>
          <View style={styles.cycleRow}>
            {cycle.map((k, i) => (
              <Pressable
                key={i}
                onPress={() => onToggleCell(i)}
                style={[
                  styles.cycleCell,
                  {
                    borderColor: KIND_COLOR[k] + '77',
                    backgroundColor: KIND_COLOR[k] + '1E',
                  },
                ]}
              >
                <Text style={[styles.cycleCellText, { color: KIND_COLOR[k] }]}>
                  {shiftShortLabel(k)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

function Step3Hr({
  age,
  autoMaxHr,
  onAutoMaxHr,
  maxHr,
  onMaxHr,
  computedMaxHr,
}: {
  age: string;
  autoMaxHr: boolean;
  onAutoMaxHr: (v: boolean) => void;
  maxHr: string;
  onMaxHr: (v: string) => void;
  computedMaxHr: number | null;
}) {
  return (
    <Card title="최대 심박수">
      <Pressable
        onPress={() => onAutoMaxHr(true)}
        style={[styles.optionCard, autoMaxHr && styles.optionCardActive]}
      >
        <View style={styles.optionRadio}>
          <View
            style={[
              styles.optionRadioDot,
              autoMaxHr && styles.optionRadioDotActive,
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionLabel}>나이 기반 자동 계산</Text>
          <Text style={styles.optionDesc}>
            220 − {age || '나이'} ={' '}
            {computedMaxHr !== null ? `${computedMaxHr} bpm` : '-'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onAutoMaxHr(false)}
        style={[styles.optionCard, !autoMaxHr && styles.optionCardActive]}
      >
        <View style={styles.optionRadio}>
          <View
            style={[
              styles.optionRadioDot,
              !autoMaxHr && styles.optionRadioDotActive,
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionLabel}>직접 입력</Text>
          <Text style={styles.optionDesc}>측정한 값이 있다면 입력</Text>
        </View>
      </Pressable>
      {!autoMaxHr && (
        <View style={styles.hrInputRow}>
          <TextInput
            value={maxHr}
            onChangeText={onMaxHr}
            placeholder="190"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1 }]}
          />
          <Text style={styles.unit}>bpm</Text>
        </View>
      )}
    </Card>
  );
}

function Step4Supplements({
  items,
  onRemove,
  form,
  setForm,
  onAdd,
}: {
  items: SupplementDraft[];
  onRemove: (i: number) => void;
  form: SupplementDraft;
  setForm: (v: SupplementDraft) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <Card title="자주 먹는 보충제">
        <Text style={styles.hint}>
          여기서 추가하지 않으면 기본 5종(크리에이틴/유청/마그네슘/오메가3/센트룸)이 자동 등록됩니다.
        </Text>
        {items.map((s, i) => (
          <View key={i} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listName}>{s.name}</Text>
              <Text style={styles.listMeta}>
                {s.dose} · {TIMING_LABEL[s.timing]}
              </Text>
            </View>
            <Pressable onPress={() => onRemove(i)} style={styles.removeBtn}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card title="추가">
        <TextInput
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
          placeholder="이름 (예: 비타민D)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={form.dose}
          onChangeText={(v) => setForm({ ...form, dose: v })}
          placeholder="용량 (예: 1000IU)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <View style={styles.timingRow}>
          {TIMING_ORDER.map((t) => (
            <Pressable
              key={t}
              onPress={() => setForm({ ...form, timing: t })}
              style={[
                styles.timingChip,
                t === form.timing && styles.timingChipActive,
              ]}
            >
              <Text
                style={[
                  styles.timingChipText,
                  t === form.timing && styles.timingChipTextActive,
                ]}
              >
                {TIMING_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onAdd} style={styles.btnAdd}>
          <Text style={styles.btnAddText}>+ 추가</Text>
        </Pressable>
      </Card>
    </>
  );
}

function Step5Shoes({
  items,
  onRemove,
  form,
  setForm,
  onAdd,
}: {
  items: ShoeDraft[];
  onRemove: (i: number) => void;
  form: ShoeDraft;
  setForm: (v: ShoeDraft) => void;
  onAdd: () => void;
}) {
  const PURPOSES: Array<{ v: ShoePurpose; label: string }> = [
    { v: 'general', label: '일반훈련' },
    { v: 'recovery', label: '회복' },
    { v: 'race', label: '대회' },
  ];
  return (
    <>
      <Card title="현재 사용 중인 러닝화">
        <Text style={styles.hint}>없으면 건너뛰기 가능합니다. 나중에 설정에서 추가할 수 있어요.</Text>
        {items.map((s, i) => (
          <View key={i} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listName}>
                {s.brand ? `${s.brand} ` : ''}
                {s.name}
              </Text>
              <Text style={styles.listMeta}>
                {PURPOSES.find((p) => p.v === s.purpose)?.label}
                {s.targetKm ? ` · 목표 ${s.targetKm}km` : ''}
              </Text>
            </View>
            <Pressable onPress={() => onRemove(i)} style={styles.removeBtn}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card title="추가">
        <TextInput
          value={form.brand}
          onChangeText={(v) => setForm({ ...form, brand: v })}
          placeholder="브랜드 (예: Nike)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
          placeholder="모델명 (예: Pegasus 41)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <View style={styles.timingRow}>
          {PURPOSES.map((p) => (
            <Pressable
              key={p.v}
              onPress={() => setForm({ ...form, purpose: p.v })}
              style={[
                styles.timingChip,
                p.v === form.purpose && styles.timingChipActive,
              ]}
            >
              <Text
                style={[
                  styles.timingChipText,
                  p.v === form.purpose && styles.timingChipTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.hrInputRow}>
          <TextInput
            value={form.targetKm}
            onChangeText={(v) => setForm({ ...form, targetKm: v })}
            placeholder="목표 km (선택, 예: 800)"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1 }]}
          />
          <Text style={styles.unit}>km</Text>
        </View>
        <Pressable onPress={onAdd} style={styles.btnAdd}>
          <Text style={styles.btnAddText}>+ 추가</Text>
        </Pressable>
      </Card>
    </>
  );
}

function Step6Goals({
  inbodyGoal,
  onInbodyGoal,
  goal5k,
  onGoal5k,
  goal10k,
  onGoal10k,
}: {
  inbodyGoal: string;
  onInbodyGoal: (v: string) => void;
  goal5k: string;
  onGoal5k: (v: string) => void;
  goal10k: string;
  onGoal10k: (v: string) => void;
}) {
  return (
    <>
      <Card title="인바디 목표 점수">
        <View style={styles.hrInputRow}>
          <TextInput
            value={inbodyGoal}
            onChangeText={onInbodyGoal}
            placeholder="90"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1 }]}
          />
          <Text style={styles.unit}>점</Text>
        </View>
        <Text style={styles.hint}>1~100 사이의 점수. 분석 탭과 홈 추천에 사용됩니다.</Text>
      </Card>

      <Card title="러닝 목표">
        <Text style={styles.fieldLabel}>5km 목표 시간 (MM:SS, 선택)</Text>
        <TextInput
          value={goal5k}
          onChangeText={onGoal5k}
          placeholder="25:30"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>10km 목표 시간 (MM:SS, 선택)</Text>
        <TextInput
          value={goal10k}
          onChangeText={onGoal10k}
          placeholder="55:00"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={styles.input}
        />
        <Text style={styles.hint}>
          목표 시간이 있으면 페이스 기반 추천이, 없으면 Zone 2 기준 추천이 제공됩니다.
        </Text>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  brandName: {
    color: colors.mint,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
  },
  progressDot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
  },
  progressDotActive: {
    backgroundColor: colors.mint,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: 'auto',
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  fieldLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  unit: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    borderColor: colors.mint,
    backgroundColor: colors.mint + '22',
  },
  chipText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.mint,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  optionCardActive: {
    borderColor: colors.mint,
    backgroundColor: colors.mint + '11',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionRadioDotActive: {
    backgroundColor: colors.mint,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionDesc: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  cycleRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  cycleCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  cycleCellText: {
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  hrInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  listName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  listMeta: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  timingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: spacing.sm,
  },
  timingChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timingChipActive: {
    backgroundColor: colors.mint + '22',
    borderColor: colors.mint,
  },
  timingChipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  timingChipTextActive: {
    color: colors.mint,
  },
  btnAdd: {
    backgroundColor: colors.mint + '22',
    borderColor: colors.mint,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  btnAddText: {
    color: colors.mint,
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.mint,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
  },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnGhostText: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  btnSkip: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSkipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
