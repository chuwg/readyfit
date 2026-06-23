# 핏로그 (FitLog)

교대근무자를 위한 스마트 운동 파트너 앱.

수면, HRV, 안정시 심박, 최근 운동 기록을 바탕으로 매일의 **훈련 준비 점수**를 계산하고, 교대 근무 패턴에 따라 보충제 알림과 모닝 리포트를 자동 조정해주는 React Native 앱입니다. **러닝과 농구** 두 가지 운동 모드로 실시간 트래킹과 세션 리포트를 제공하며, **인바디 추적**과 **주간/월간 훈련 분석**까지 하나의 앱에서 관리합니다.

## 주요 기능

### 온보딩 (첫 실행)
앱 첫 실행 시 6단계 온보딩으로 모든 핵심 정보를 한 번에 설정합니다.

1. **기본 정보** — 이름, 나이, 성별
2. **근무 패턴** — 교대근무 / 일반직 / 자유직 중 선택. 교대근무 선택 시 8칸 사이클 직접 편집
3. **심박 설정** — `220 − 나이` 자동 계산 또는 직접 입력
4. **보충제** (선택) — 직접 추가하거나 건너뛰면 기본 5종 자동 등록
5. **러닝화** (선택) — 브랜드/모델/용도/목표 km 입력
6. **목표 설정** — 인바디 목표 점수 + 5km/10km 목표 시간

완료 시 `user_profile.onboarded = 1` 플래그 저장. 루트 레이아웃이 매 실행마다 플래그를 확인해 미설정 시 `/onboarding`으로 자동 이동합니다.

### 홈 대시보드
- 오늘 날짜 + 시간대별 인사말 + 오늘 근무 유형 배지
- **훈련 준비 점수** (0~100): 4가지 항목 합산 후 교대 근무 보정
- 이번 8일 사이클 미니 달력 (날짜별 훈련 가능 여부 색상 표시)
- 컨디션 상세: 수면 / HRV / 피로도 (프로그레스 바)
- 추천 훈련: 5km 목표 시간 기반 페이스 추천 또는 Zone 2 기준
- 현재 위치 날씨 + 미세먼지 (Open-Meteo API)

### 모닝 리포트
- 매일 사용자 지정 시간(기본 07:00)에 알림 발송
  - 야간 근무 당일은 자동 스킵
  - 야간 후 휴무일은 +2시간 자동 조정 (옵션)
- 알림 본문: `훈련 준비 N점 · 추천 훈련 · N°C 날씨`
  - `expo-background-fetch`로 백그라운드에서 점수를 주기적으로 재계산·재예약 → 본문 점수가 최신 상태 유지 (새 네이티브 빌드 필요)
- 알림 탭 → 전용 리포트 화면으로 이동
  - "{이름}님, 좋은 아침이에요!" 인사말
  - 훈련 준비 점수 + 컨디션 + 추천 훈련 + 날씨 + 오늘 보충제 (시간순)

### 운동 탭 — 러닝 / 농구

운동 탭 상단에서 **러닝 / 농구** 모드를 선택해 시작합니다.

#### 러닝 모드
- 시작 화면: 거리 (5km / 10km / 직접) + 목표 시간 (프로필 자동 또는 직접) + 페이스 가이드 토글 + 러닝화 선택
- **PacePro 4구간 페이스 분배**:
  - 0~20% 워밍업 (목표 +15초)
  - 20~70% 메인 (목표)
  - 70~90% 유지 (목표 −5초)
  - 90~100% 마무리 (목표 −10초)
- 라이브 세션 (GPS + HealthKit HR 폴링):
  - 현재 거리/페이스/목표 대비 ±초/예상 완주 시간
  - 심박수 + Zone 인디케이터 (Z1~Z5)
  - PacePro 진행 커서
  - **백그라운드 GPS 트래킹** — 화면이 꺼져도 측정 계속 (Always 권한 시)
  - **일시정지·재개** — 신호등·휴식 시 측정 정확하게 멈춤
- 종료 리포트:
  - 거리·시간·평균 페이스, 목표 달성 배지
  - 평균/최고 심박, Zone 분포 바 + 범례
  - **GPS 경로 지도** (`react-native-maps`) — 시작/종료 마커 + Polyline
  - 케이던스 / GCT / 수직진폭 (Apple Watch 기록 있을 때)
  - 이전 동일 거리 세션 비교 (±10%)
  - 자동 생성 한줄 피드백
  - **신발 km 자동 누적**

#### 농구 모드
- 시작 화면: 쿼터 시간 (10분 / 12분 / 무제한 / 직접) + 예상 쿼터 수
- 라이브 세션:
  - 쿼터 번호 + 남은/경과 시간 (총 경과 시간)
  - 실시간 심박 + Zone
  - **CoreMotion 기반 점프/스프린트 자동 카운트** (DeviceMotion 50Hz)
  - 일시정지 / 쿼터 종료 / 세션 종료 세 버튼
  - **일시정지·재개** — 시간·동작 감지·HR 폴링 모두 멈춤, 쿼터별/세션별 누적 분리
- 쿼터 종료 모달: 평균/최고 심박, Zone 분포, 점프/스프린트, 한줄 평가
- 종료 리포트:
  - 총 시간 + 칼로리 (심박 기반 추정)
  - 활동량: 점프/스프린트/평균·최고 심박
  - 심박 Zone 분포 바
  - **유산소/무산소 별점** (Z2-3 / Z4-5 비중 0~5점)
  - 쿼터별 심박 추이 막대 차트
  - **내일 훈련 권장** (오늘 부하 점수 기반)

### 교대 근무 패턴
- 8일 사이클 (기본: 주주휴휴야야휴휴) 직접 편집
- 사이클 시작일, 주간/야간 시작·끝 시간 모두 설정 가능
- 오늘 근무 유형 자동 계산: `주간` / `야간 전` / `야간 근무 중` / `야간 후 휴식` / `휴무`

### 보충제 관리
- 등록/수정/삭제, 교대 연동 토글, 알림 토글
- 기본 5종 자동 등록: 크리에이틴, 유청 단백, 마그네슘, 오메가3, 센트룸
- 4가지 복용 타이밍: 아침 식후 / 운동 전 / 운동 후 / 취침 전
- 각 타이밍별 기본 시간 사용자 설정 가능
- 향후 7일치 알림 자동 예약, 설정 변경 시 즉시 재예약

### 신발 관리
- 등록/수정/삭제, 활성 토글, 누적 km 자동 추적
- **용도 태그** (일반훈련 / 회복 / 대회) — 색상 구분
- 브랜드 + 모델명 인라인 편집
- 목표 km 설정 시 진행도 바 표시 (90% 초과 시 빨강)
- 러닝 세션 종료 시 선택한 신발에 거리 자동 누적
- **교체 임박 알림** — 90% 도달 시 1회 발송, 사용자가 km 조정 시 플래그 리셋

### 인바디 트래커 (분석 탭 인바디 섹션)
- **Apple Vision OCR**: 결과지를 카메라로 촬영하거나 갤러리에서 불러오면 항목을 자동 인식 (한국어+영어 동시)
  - 인식된 항목만 폼에 자동 채움, 나머지는 수동 입력 안내
  - 로컬 Expo Module(`modules/fitlog-vision-text/`)에서 `VNRecognizeTextRequest` 호출
- 수동 입력 폼: 측정일 + 체중 / 골격근량 / 체지방량 / 체지방률 / BMI / 점수
- 최신 기록 + 직전 기록 대비 ▲▼ 증감 (개선=초록 / 악화=빨강)
- 목표 달성률 진행도 바 (`user_profile.inbody_goal_score` 기반)
- 변화 추이 SVG 라인 차트 — 최근 6회 (체중 / 골격근량 / 체지방률 / 점수 토글)
- 홈 추천 훈련 점수별 분기:
  - 90+: 현재 훈련 유지
  - 85~89: 메인 후 근력 보강 15분
  - 85 미만: 근력 훈련(스쿼트·푸시업·런지 3세트) 추가 권장

### 분석 탭 (4-세그먼트)
- **주간**: 이번 주 거리/시간, 요일별 운동 막대 차트(러닝+농구), HR 기반 TRIMP의 ATL(7일)/CTL(28일), ACWR(급성/만성) ≥ 1.3 시 과부하 경고
- **월간**: 거리/세션/시간/칼로리, 5km·10km 베스트(목표 대비), 자동 하이라이트 (지난달 대비 증감, 베스트 단축, 농구 횟수)
- **트렌드**: 수면 / 평균 페이스 / 평균 심박 / GCT / 인바디 점수 라인 차트 (홈·모닝리포트 진입 시 수면 자동 캐시)
- **인바디**: 위 인바디 트래커 화면

### 세션 히스토리
- 운동 탭의 러닝/농구 시작 화면 하단에 **최근 5개 세션** 카드
- "전체 보기 ›" → `/sessions` 화면으로 이동
- `/sessions`: 통합 리스트 + 필터 칩 [전체 / 러닝 / 농구] (각 카운트 표시)
- 각 항목 탭 → 기존 러닝/농구 리포트 화면 재사용
- 빈 상태 안내 + 시작 화면으로 유도

### 데이터 백업 / 가져오기 (설정 탭)
- 12개 테이블 전체를 **JSON 단일 파일**로 내보내기 → 공유 시트 (iCloud Drive, AirDrop, 메일 등)
- 백업 파일을 선택해 **트랜잭션 안에서 전체 복원** — 중간 실패 시 ROLLBACK으로 원래 상태 유지
- 가져오기 전 안전 다이얼로그 + 형식·버전 검증 (`app === 'fitlog'`, `version ≤ 1`)
- 파일명: `fitlog-backup-YYYYMMDD-HHMM.json`

### Apple Watch 컴패니언
- iPhone 홈 화면 진입 시 점수/상태/추천/수면을 워치로 자동 sync
- WatchConnectivity의 `sendMessage` (즉시) + `updateApplicationContext` (다음 부팅) 둘 다 사용
- 워치 화면: 큰 점수 (색상별 컨디션) + 상태 라벨 + 추천 한줄 + 🌙 수면 시간 + 갱신 시각
- **시계 페이스 컴플리케이션** (WidgetKit, 4가지 family) — circular / corner / inline / rectangular
- App Group으로 워치 앱 ↔ 컴플리케이션 데이터 공유, `WidgetCenter.reloadAllTimelines()` 자동 갱신
- ⚠ Expo는 watchOS target을 자동 생성하지 않습니다. **`WATCHOS.md` 가이드대로 Xcode에서 1회 수동 통합** 필요

## 브랜드

다크 그라디언트 배경 (#0B0F14 → #1C242F) + 민트 #00D4AA 'F' 글자 + 심박파형 라인 — 피트니스와 건강 모니터링 컨셉.

`scripts/build-icons.mjs`로 SVG 마스터 1개 → iOS / Android adaptive / splash / favicon PNG 일괄 생성. 디자인 수정 시 SVG만 고친 후 스크립트 한 번만 돌리면 됩니다.

## 기술 스택

- **프레임워크**: React Native 0.74 + Expo SDK 51
- **네비게이션**: Expo Router (파일 기반)
- **로컬 DB**: expo-sqlite
- **알림**: expo-notifications (kind 태그 기반 분리 관리)
- **백그라운드**: expo-task-manager + expo-background-fetch (모닝리포트 점수 갱신·재예약)
- **위치/GPS**: expo-location + expo-task-manager (백그라운드) + Open-Meteo API
- **지도**: react-native-maps (iOS Apple Maps / Android Google Maps)
- **건강 데이터**: @kingstinct/react-native-healthkit (iOS HealthKit)
- **백업/공유**: expo-sharing + expo-document-picker + expo-file-system
- **동작 감지**: expo-sensors (DeviceMotion / CoreMotion)
- **시간 입력**: @react-native-community/datetimepicker (네이티브 스피너)
- **언어**: TypeScript (strict mode)

## 점수 계산

총 100점, 각 항목 합산 후 교대 근무 보정 + 자율신경 보정. 각 항목은 구간 버킷이 아닌 **선형 보간(클램프)**으로 계산해 미세 변화도 반영됩니다.

| 항목 | 만점 | 기준 (선형 보간) |
|---|---|---|
| 수면 | 30 | 수면시간 4h→6점 ~ 7h→25점 + 깊은수면(0.1→0.2: +0~3) + REM(0.1→0.22: +0~2) |
| HRV | 25 | 평균 대비 비율 0.85→8점 ~ 1.15→25점 |
| 회복 (안정시 심박) | 25 | 평균 대비 +4bpm→8점 ~ −3bpm→25점 |
| 훈련 부하 | 20 | 어제 휴식=20, 가벼움=16, 보통=12, 고강도=6, 이틀 연속 고강도=2 |

### 자율신경 보정 (호흡수·혈중산소)

수면 중 호흡수 상승이나 혈중 산소 저하는 회복 저하 신호로 보아 총점에서 추가 감점(0 ~ −10):

| 신호 | 감점 |
|---|---|
| 호흡수 평균 대비 +1회/분 → +3회/분 | 0 ~ −6 |
| 혈중 산소 95% → 92% 이하 | 0 ~ −6 |

(두 감점 합산 후 최대 −10으로 제한. 데이터 없으면 보정 없음)

### 교대 근무 보정

| 근무 유형 | 보정 |
|---|---|
| 주간 근무 | 0 |
| 야간 근무 당일 | −15 |
| 야간 후 휴무 | −20 |
| 일반 휴무 | +5 |

### 점수별 상태

| 점수 | 상태 | 추천 |
|---|---|---|
| 80~100 | 최상 🟢 | 고강도 훈련 가능 |
| 60~79 | 양호 🟡 | 일반 훈련 |
| 40~59 | 보통 🟠 | 가벼운 훈련 |
| 0~39 | 피로 🔴 | 휴식 권고 |

## 보충제 알림 보정

교대 연동 ON일 때 근무 유형에 따라 자동 조정:

| 타이밍 | 주간 | 야간 당일 | 야간 후 휴무 |
|---|---|---|---|
| 아침 식후 | 기본 | 기본 | +2시간 |
| 운동 전/후 | 기본 | 기본 | +2시간 |
| 취침 전 | 기본 | 주간 시작 +2시간 (퇴근 후) | +2시간 |

## 심박 Zone 계산

`user_profile.max_heart_rate` 기반 5단계.

| Zone | 비율 | 설명 |
|---|---|---|
| Z1 | <50% | 매우 가벼움 |
| Z2 | 50~60% | 가벼운 유산소 |
| Z3 | 60~70% | 중강도 유산소 |
| Z4 | 70~85% | 역치 |
| Z5 | ≥85% | 최대 |

## 농구 동작 감지

DeviceMotion 50Hz 가속도 샘플링.

```
mag_g  = sqrt(x² + y² + z²) / 9.81  (전체 합성)
horiz_g = sqrt(x² + y²) / 9.81      (수평 성분)

점프:    mag_g > jumpG → prev보다 감소 + jumpG×0.7 이하 → 800ms 쿨다운 후 카운트
스프린트: horiz_g > sprintG → 800ms 쿨다운 후 카운트
```

기본 임계값: **점프 2.5g / 스프린트 1.8g**, 설정에서 조정 가능.

### 유산소/무산소 별점

| Z2+Z3 또는 Z4+Z5 비중 | 별점 |
|---|---|
| ≥60% | 5 |
| 40~60% | 4 |
| 25~40% | 3 |
| 15~25% | 2 |
| 5~15% | 1 |
| <5% | 0 |

### 내일 훈련 권장 (부하 점수)

`load = minutes × (1 + Z4-Z5 비중 × 1.5)`

- ≥90 → 휴식 권고
- ≥60 → 가벼운 훈련 (Zone 2 조깅 30분)
- ≥30 → 일반 훈련 가능
- 그 미만 → 추가 훈련 가능

## 프로젝트 구조

```
fitlog/
├── modules/                          # 로컬 Expo Modules
│   ├── fitlog-vision-text/           # Apple Vision OCR
│   └── fitlog-watch-bridge/          # WatchConnectivity
├── watchos/                          # watchOS 앱 자산 (Xcode 수동 통합)
│   ├── FitLogWatchApp.swift
│   ├── ContentView.swift
│   ├── WatchSessionManager.swift
│   └── Complication/
│       └── FitLogComplication.swift  # WidgetKit 기반 시계 페이스 컴플리케이션
├── app/                              # Expo Router (라우팅)
│   ├── _layout.tsx                   # 루트 레이아웃 + 알림 응답 핸들러
│   ├── morning-report.tsx            # 모닝 리포트 상세 화면
│   ├── running-session.tsx           # 러닝 라이브 세션
│   ├── running-report.tsx            # 러닝 종료 리포트 (지도 포함)
│   ├── basketball-session.tsx        # 농구 라이브 세션
│   ├── basketball-report.tsx         # 농구 종료 리포트
│   ├── inbody-entry.tsx              # 인바디 수동 입력 + OCR
│   ├── sessions.tsx                  # 통합 세션 히스토리
│   ├── onboarding.tsx                # 6단계 온보딩
│   └── (tabs)/
│       ├── _layout.tsx               # 4개 탭 정의
│       ├── index.tsx                 # 홈
│       ├── workout.tsx               # 운동 (러닝/농구 토글)
│       ├── analytics.tsx             # 분석 (주간/월간/트렌드/인바디)
│       └── settings.tsx              # 설정
├── src/
│   ├── theme/colors.ts               # 민트 #00D4AA 다크 팔레트
│   ├── types.ts                      # 도메인 타입
│   ├── lib/
│   │   ├── readiness.ts              # 점수 계산, 추천 훈련
│   │   ├── pace.ts                   # 페이스 / Zone / PacePro / 하버사인
│   │   ├── motion.ts                 # DeviceMotion 점프·스프린트 감지
│   │   ├── basketball.ts             # 칼로리 / 별점 / 내일 권장
│   │   ├── inbody.ts                 # 메트릭 / 증감 / 목표 진행도
│   │   ├── inbody-ocr.ts             # OCR 정규식 파서
│   │   ├── analytics.ts              # 주간·월간·트렌드 집계 + ATL/CTL
│   │   ├── calories.ts               # MET × 체중 칼로리 계산
│   │   ├── dates.ts                  # 요일 라벨 공통
│   │   └── time.ts                   # HH:MM ↔ Date 변환
│   ├── services/
│   │   ├── db.ts                     # SQLite (13개 테이블)
│   │   ├── health.ts                 # HealthKit (수면 스테이지/HRV/RHR/호흡수/SpO2) + mock fallback
│   │   ├── background.ts             # expo-background-fetch 모닝리포트 갱신 태스크
│   │   ├── shift.ts                  # 사이클 계산, 오늘 근무 유형
│   │   ├── notifications.ts          # 보충제 + 모닝 + 신발 + OCR 알림
│   │   ├── location.ts               # expo-location + 제주 애월 기본
│   │   ├── weather.ts                # Open-Meteo + 대기질
│   │   ├── running.ts                # HR 폴링 + 워크아웃 다이내믹스
│   │   ├── run-tracker.ts            # 백그라운드 GPS (TaskManager)
│   │   ├── backup.ts                 # 전체 테이블 export/import
│   │   └── watch.ts                  # Apple Watch 데이터 sync
│   └── components/
│       ├── Card.tsx
│       ├── ConditionCard.tsx
│       ├── CyclePlanCard.tsx
│       ├── Placeholder.tsx
│       ├── ProgressBar.tsx
│       ├── ReadinessCard.tsx
│       ├── ShiftBadge.tsx
│       ├── TimePickerRow.tsx
│       ├── WeatherCard.tsx
│       ├── WorkoutRecommendCard.tsx
│       ├── SessionListItem.tsx       # 러닝/농구 통합 리스트 아이템
│       ├── RecentSessionsCard.tsx    # 운동 탭 임베드 카드
│       ├── running/
│       │   ├── StartForm.tsx
│       │   ├── DistancePicker.tsx
│       │   ├── ShoePicker.tsx
│       │   ├── PaceProBar.tsx
│       │   ├── HrZoneIndicator.tsx
│       │   ├── ZoneDistributionBar.tsx
│       │   └── RouteMap.tsx          # GPS 경로 지도
│       ├── basketball/
│       │   ├── StartForm.tsx
│       │   └── StarRating.tsx
│       ├── inbody/
│       │   └── LineChart.tsx
│       ├── analytics/
│       │   └── WeekBarChart.tsx
│       └── settings/
│           ├── UserProfileSection.tsx
│           ├── ShiftSection.tsx
│           ├── MorningReportSection.tsx
│           ├── SupplementTimesSection.tsx
│           ├── SupplementsSection.tsx
│           ├── ShoesSection.tsx
│           ├── BasketballThresholdsSection.tsx
│           └── BackupSection.tsx
└── package.json
```

## 데이터 모델 (SQLite)

| 테이블 | 용도 |
|---|---|
| `daily_scores` | 매일 점수 기록 (date, total, breakdown, status) |
| `shift_config` | 근무 유형(shift/office/flexible), 교대 사이클, 시작일, 근무 시간 (단일 행) |
| `supplements` | 보충제 목록 (이름, 용량, 타이밍, 교대연동, 활성) |
| `supplement_base_times` | 4가지 타이밍 기본 시간 (단일 행) |
| `user_profile` | 이름, 나이, 성별, 5k/10k 목표, 최대 심박, 인바디 목표 점수, 온보딩 플래그 (단일 행) |
| `morning_report_config` | 알림 시간, 야간 스킵, +2h 옵션 (단일 행) |
| `shoes` | 러닝화 (이름, 브랜드, 용도, 누적 km, 목표 km, 활성, 교체 알림 플래그) |
| `running_sessions` | 러닝 세션 기록 (거리, 시간, 페이스, HR, Zone, 다이내믹스, 신발, GPS 경로) |
| `basketball_sessions` | 농구 세션 기록 (쿼터 JSON, 점프/스프린트, HR, 별점, 내일 권장) |
| `basketball_config` | 점프/스프린트 임계값 (단일 행) |
| `inbody_records` | 인바디 측정 기록 (체중, 골격근량, 체지방량/률, BMI, 점수) |
| `sleep_records` | 일별 수면 시간 캐시 (HealthKit 자동) |

## 시작하기

```bash
cd fitlog
npm install

# 개발 서버
npx expo start

# iOS dev client (HealthKit, CoreMotion 사용시 필수)
npx expo prebuild
npx expo run:ios
```

### 주의사항

- **HealthKit**은 Expo Go에서 동작하지 않습니다. `expo prebuild` + 실기기 또는 개발 빌드가 필요합니다. 시뮬레이터/Expo Go에서는 자동으로 mock 데이터로 fallback 됩니다.
- **GPS**는 시뮬레이터에서 거의 안 옵니다. 실기기 또는 시뮬레이터 "Custom Location" 시뮬레이션 사용 권장.
- **CoreMotion (점프/스프린트)**은 시뮬레이터에서 동작하지 않습니다. 실기기 + 동작 권한 허용이 필요합니다. 권한 거부 시에도 다른 기능은 정상 동작합니다.
- **알림**은 Expo Go/시뮬레이터에서도 로컬 알림으로 동작하지만, 실기기 테스트가 권장됩니다.
- **위치 권한 거부 시** 제주 애월 기본 좌표(33.4637, 126.3379)로 날씨 조회. 권한 허용 시에는 앱 실행/탭 진입마다 현재 위치를 새로 조회합니다.
- **러닝 트래킹은 포그라운드만** 지원합니다. 화면 켜짐 유지를 권장합니다.

## 개발 변경 이력

### Phase 20 — 회복 지표 확장 + HR 훈련부하 + 백그라운드 모닝리포트 (v1.1.0)
- **호흡수·혈중산소(SpO2) 연동**: `health.ts`에 `RespiratoryRate`/`OxygenSaturation` 권한·조회 추가 (호흡수는 수면 구간 우선 + 30일 평균, SpO2는 0–1 fraction → % 정규화). `HealthSnapshot` 타입 확장, `ConditionCard`에 두 지표 표시
- **회복도 보조 감점**: 야간 호흡수 상승·SpO2 저하 시 총점에서 최대 −10 (`autonomicAdjust`)
- **수면 스테이지 분리**: SleepAnalysis를 딥/REM/코어/어웨이크로 집계, `remSleepRatio`/`lightSleepRatio`/`awakeMinutes` 추가, 수면 점수에 REM 보너스 반영
- **회복도 점수 연속화**: 수면·HRV·회복(안정시 심박) 점수를 3단계 버킷 → 선형 보간(`lerpClamp`)으로 변경
- **HR 기반 훈련부하**: 훈련부하를 칼로리 proxy → **TRIMP(Banister, HR 예비율 기반)**로 교체. HR 없으면 중강도 가정 폴백. 과부하 판정을 고정 칼로리 임계 → **상대 ACWR(급성/만성) ≥ 1.3**으로 변경 (`sessionLoad`, `computeLoadIndex`)
- **백그라운드 모닝리포트**: `expo-background-fetch` 도입, 백그라운드 태스크에서 health 재조회 → readiness 재계산 → daily score 저장 → 모닝리포트 재예약. 푸시 본문 점수가 더 이상 앱 마지막 실행 시점에 고정되지 않음 (`src/services/background.ts`, `_layout.tsx` 등록)
- ⚠ 네이티브 모듈 추가분이라 새 빌드(EAS/prebuild)에서만 백그라운드 갱신이 동작

### Phase 1 — 초기 스캐폴드
- Expo SDK 51 + TypeScript + Expo Router 4탭 구조
- 다크모드 기본, 민트 #00D4AA 테마, 한국어
- 홈 대시보드 5개 카드 (점수/컨디션/추천/날씨/사이클은 후속 추가)
- HealthKit 서비스 추상화 (실데이터 + mock fallback)
- Open-Meteo 날씨 + 미세먼지

### Phase 2 — 교대 근무 + 보충제
- 8일 사이클 패턴 편집 UI
- 근무 유형별 점수 보정 (−20 ~ +5)
- 홈에 사이클 미니 달력 추가
- 보충제 CRUD + 기본 5종 시드
- expo-notifications 향후 7일 일별 스케줄링
- 교대 연동 토글로 알림 시간 자동 조정

### Phase 3 — 시간 사용자 설정
- @react-native-community/datetimepicker 도입
- 주간/야간 시작·끝 4개 + 보충제 기본 시간 4개 모두 편집 가능
- 알림 시간 하드코딩 제거

### Phase 4 — 모닝 리포트
- 매일 아침 알림 (야간 스킵, 야간 후 +2h 옵션)
- 알림 탭 → 전용 모닝 리포트 화면 (콜드 스타트 케이스 처리 포함)
- 사용자 프로필 (이름 + 5k 목표 시간)
- 5k 목표 기반 페이스 추천 (목표 −10s/+20s/+60s)
- 보충제/모닝 알림 분리 관리 (kind 태그 기반)

### Phase 5 — 러닝 모드
- `user_profile`에 `max_heart_rate`, `running_goal_10k` 컬럼 추가 (마이그레이션)
- 신규 테이블: `shoes`, `running_sessions`
- 시작 화면: 거리/시간/페이스 가이드/신발 선택, 오늘 점수 표시
- PacePro 4구간 자동 계산
- 라이브 세션: GPS 워처 + HealthKit HR 폴링 (5초)
- 리포트: Zone 분포, 다이내믹스, 이전 세션 비교, 신발 km 자동 누적
- 자동 한줄 피드백 (페이스/Zone/GCT 기반)

### Phase 6 — 농구 모드
- expo-sensors 도입, app.json에 motion 권한 추가
- 신규 테이블: `basketball_sessions`, `basketball_config`
- 운동 탭을 [러닝 | 농구] 세그먼트 토글로 변경, 러닝 시작 폼 컴포넌트로 추출
- 시작 화면: 쿼터 시간(10/12/무제한/직접) + 예상 쿼터 수
- 라이브 세션: 쿼터 카운터, 실시간 심박/Zone, CoreMotion 점프/스프린트 카운트
- 쿼터 종료 모달 → 다음 쿼터 / 세션 종료
- 리포트: 칼로리(HR 기반), Zone 분포, 유산소/무산소 별점, 쿼터별 심박 추이, 내일 훈련 권장

### Phase 7 — 인바디 트래커
- 신규 테이블: `inbody_records`, `user_profile.inbody_goal_score` 컬럼 추가
- 수동 입력 화면 (`app/inbody-entry.tsx`) — 6개 메트릭, 네이티브 DatePicker
- `src/lib/inbody.ts`: 메트릭 추출, 증감 계산(메트릭별 개선 방향), 목표 진행도
- `react-native-svg` 직접 그린 LineChart 컴포넌트 (의존성 추가 없음)
- 분석 탭에 인바디 섹션 통합 (하단 탭 4개 유지)
- 홈 추천 훈련에 인바디 목표 부족 시 근력 훈련 권장 자동 추가
- `recommendWorkout` 시그니처를 옵션 객체로 확장 (`{goal5kSeconds?, inbodyGoalGap?}`)
- (OCR은 보류, 향후 ML Kit 도입 예정)

### Phase 19 — 워치 컴플리케이션 + 배포 가이드
- `watchos/Complication/FitLogComplication.swift` — WidgetKit Provider + 4가지 family Views
- App Group(`group.com.fitlog.app.shared`)으로 워치 앱과 데이터 공유
- `WatchSessionManager`가 데이터 수신 시 UserDefaults 저장 + `WidgetCenter.reloadAllTimelines()`
- `WATCHOS.md`에 Widget Extension 통합 가이드 추가 (App Group + 3 target capability)
- `DEPLOY.md` (신규): Apple Developer 가입 → App Store Connect → EAS Build / Xcode Archive → TestFlight → 정식 출시 단계별 가이드
- `eas.json` 빌드 프로파일 (development/preview/production)

### Phase 18 — Apple Watch 컴패니언
- 새 로컬 Expo Module: `modules/fitlog-watch-bridge` (WatchConnectivity Swift wrapper)
- watchOS 앱 코드: `watchos/` (SwiftUI App + ContentView + WatchSessionManager)
- `src/services/watch.ts`: `syncToWatch(payload)` — 홈 화면 진입 시 자동 호출
- `WATCHOS.md`: Xcode에서 watchOS target 추가하는 단계별 가이드
- iPhone → Watch 페이로드: `{ score, status, advice, sleepHours, updatedAt }`
- 점수에 따라 워치 화면 숫자 색상 자동 변경 (민트/노랑/주황/빨강)

### Phase 17 — 데이터 백업 / 가져오기
- `expo-sharing` + `expo-document-picker` + `expo-file-system` 도입
- `src/services/backup.ts` — 12개 테이블 전체를 JSON 단일 파일로 직렬화 / 트랜잭션 복원
- 파일명 자동 생성: `fitlog-backup-YYYYMMDD-HHMM.json`
- `BackupSection`을 설정 탭 마지막에 추가 (안전 다이얼로그 + 형식·버전 검증)
- 가져오기 시 BEGIN/COMMIT/ROLLBACK으로 안전성 보장

### Phase 16 — 수면 추세 차트
- `sleep_records` 테이블 신규
- 홈·모닝리포트 진입 시 HealthKit `sleepMinutes` 자동 캐시 (`upsertSleepRecord`)
- 분석 트렌드 뷰 최상단에 수면 카드 추가 (시간 단위 표시)
- `TrendCard`에 `format` prop 추가 (수면은 `toFixed(1)`)

### Phase 15 — 세션 일시정지 / 재개
- `run-tracker.ts`: `setTrackingPaused()` 추가, 백그라운드 task가 paused 동안 좌표 push 차단
- 러닝: 일시정지/종료 두 버튼, GPS·HR·페이스·시간 모두 멈춤
- 농구: 일시정지/쿼터종료/세션종료 세 버튼, 동작 감지·HR·쿼터·세션 시간 멈춤
- 일시정지 동안 화면 상단 "일시정지 중" 배지
- 종료 시 마지막 paused 구간 자동 누적 → 정확한 duration

### Phase 14 — 백그라운드 GPS 트래킹
- `expo-task-manager` 도입, `TaskManager.defineTask`로 백그라운드 location task 등록
- `src/services/run-tracker.ts` — `startLiveTracking` / `stopLiveTracking` / `drainPoints`
- 화면이 꺼지거나 다른 앱 사용 중에도 GPS 측정 계속
- 권한 거부 시 포그라운드 추적으로 자동 fallback
- 세션 화면 상단에 추적 모드 배지 표시 (`🛰 백그라운드 ON` / `ℹ 포그라운드만`)
- iOS `UIBackgroundModes: ["fetch", "location"]`, `NSLocationAlwaysAndWhenInUseUsageDescription` 추가
- Android `foregroundService` 알림으로 사용자에게 추적 진행 상황 알림

### Phase 13 — GPS 경로 지도
- `react-native-maps` 도입
- 러닝 세션 종료 시 GPS 좌표를 다운샘플링(≤250)해 `route_json` 컬럼에 저장
- 러닝 리포트에 `MapView` + `Polyline` + 시작(녹)/종료(빨) 마커 카드 추가
- bounding box 기반 자동 region 계산 (×1.4 패딩)

### Phase 12 — 브랜드 아이콘 + 스플래시
- 다크 그라디언트 + 민트 'F' + 심박파형 디자인
- `scripts/build-icons.mjs` — SVG 마스터 → sharp PNG 일괄 변환
- iOS icon, Android adaptive (투명 배경 안전영역), splash, favicon 모두 생성
- dev dep으로 sharp만 추가 (이미지 빌드 전용)

### Phase 11 — 세션 히스토리 리스트
- `app/sessions.tsx` — 통합 리스트 화면, 필터 [전체 / 러닝 / 농구]
- `src/components/SessionListItem.tsx` — 러닝/농구 통합 리스트 아이템
- `src/components/RecentSessionsCard.tsx` — 운동 탭에 임베드되는 최근 5개 카드
- 운동 탭 시작 폼(러닝/농구) 하단에 자동 표시, 탭하면 기존 리포트 재사용

### Phase 10 — 온보딩 화면
- `app/onboarding.tsx` — 6단계 stepper (기본 정보 / 근무 패턴 / 심박 / 보충제 / 러닝화 / 목표)
- `user_profile`에 `age`, `gender`, `onboarded` 컬럼 추가
- `shift_config`에 `work_type` 컬럼 추가 — `shift`/`office`/`flexible` 분기
  - office: 월~금 day, 토일 off cycle 자동 설정
  - flexible: `shiftDayForDate`가 항상 `day` 반환 (보정 0)
- 루트 `_layout.tsx`에서 `onboarded` 체크 후 `/onboarding` redirect
- `UserProfileSection`에 나이/성별 필드 추가 — 온보딩 후에도 편집 가능
- 보충제 미입력 시 기존 기본 5종(`ensureDefaultSupplements`) fallback

### Phase 9 — Apple Vision 인바디 OCR
- 로컬 Expo Module 추가: `modules/fitlog-vision-text/` (Swift + ExpoModulesCore)
- `VNRecognizeTextRequest`로 한국어/영어 동시 텍스트 인식
- `expo-image-picker` 도입 — 카메라 촬영 / 갤러리 선택
- `src/lib/inbody-ocr.ts`: 정규식 패턴 매칭 (체중/골격근량/체지방량·률/BMI/점수)
- 인식 결과를 입력 폼에 자동 채움, 일부 인식 시 알림으로 안내
- `recommendWorkout` 점수별 3단계 분기 (90+/85~89/85↓), `inbodyGoalGap` → `inbodyScore` 시그니처 변경
- 인바디 변화 추이 차트는 최근 6회로 제한
- 홈 화면, 모닝 리포트 모두 최신 인바디 점수를 추천에 반영
- iOS 카메라/갤러리 권한 메시지 추가 (NSCameraUsageDescription 등)

### Phase 8 — 러닝화 관리 + 분석 탭
- `shoes` 컬럼 마이그레이션: `purpose` (용도 태그), `replacement_alerted` (알림 플래그)
- `ShoesSection` 인라인 편집 폼, 용도 칩(일반훈련/회복/대회), 교체 임박 라벨
- 신발 90% 도달 시 1회 푸시 알림 (`sendShoeReplacementAlert`), 사용자가 km 줄이면 플래그 리셋
- `src/lib/analytics.ts`: 주간/월간 집계, ATL/CTL, 트렌드 시계열, 하이라이트 자동 생성
- `WeekBarChart` 요일별 스택 막대 (러닝/농구 색 구분)
- 분석 탭을 4개 세그먼트로 재구성 (주간/월간/트렌드/인바디)

## 리팩터 메모

- **칼로리 체중 반영** (`src/lib/calories.ts`): 분당 9kcal 고정값을 제거하고 MET × 체중 공식으로 변경. 인바디 최신 weight를 자동 적용해 체중 변화에 따라 칼로리도 정확해짐. 체중 미입력 시 기본 70kg fallback.
- **요일 배열 공통화** (`src/lib/dates.ts`): 홈/모닝리포트/주간차트에 중복되던 `WEEKDAY_KR` 상수를 한 곳으로 통합 (`SUN_FIRST` / `MON_FIRST` 두 변형).

## 향후 계획

- 가져오기 후 화면 자동 재로드 (현재는 사용자 안내만)
- CSV export 옵션 (현재는 JSON만)
- 시계 페이스 컴플리케이션 (워치 메인 화면에 점수 작은 위젯)
- 워치 → iPhone 새로고침 요청 (역방향 메시지)
- 워치에서 직접 러닝 시작 (HealthKit Workout)
