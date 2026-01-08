# Supabase 마이그레이션 후 성능 최적화 작업 기록

## 작업 일자

2025년 1월 8일 목요일

## 작업 배경

Supabase 마이그레이션 후 발생한 성능 문제 해결:

- 메인 페이지 접속 시 "로딩중" 메시지가 오래 표시됨
- 케이스 목록 클릭 시 딜레이 발생
- 케이스 진입 시 이미지가 안 나오는 문제
- 다음 케이스로 넘어갈 때 이전 케이스 이미지가 보이는 문제

---

## 1. 데이터 로딩 최적화

### 문제점

**파일**: `src/utils/caseLoader.ts`

- `getCaseById`가 전체 케이스를 가져온 뒤 필터링하여 비효율적
- `getCases`에서 순차적으로 데이터를 가져와 느림
- `StartScreen`에서 `getCaseById`와 `getCases()`를 동시 호출하여 중복 요청 발생
- 동시에 여러 번 호출될 때 중복 네트워크 요청 발생

### 해결 방법

#### 1.1 캐싱 추가

```typescript
// 메모리 캐시 (5분 유지)
let casesCache: CasesData | null = null;
let casesCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 개별 케이스 캐시
const caseCache = new Map<number, { data: Case; time: number }>();

// 로딩 중인 Promise 추적 (중복 요청 방지)
let loadingPromise: Promise<CasesData> | null = null;
```

#### 1.2 병렬 로딩 구현

```typescript
// Promise.all로 케이스, 질문, 정답 영역을 동시에 가져오기
const [casesResult, questionsResult, answerRegionsResult] = await Promise.all([
  supabase.from('detective_puzzle_cases').select('*')...,
  supabase.from('detective_puzzle_questions').select('*')...,
  supabase.from('detective_puzzle_answer_regions').select('*')...,
]);
```

#### 1.3 Promise 공유로 중복 요청 방지

```typescript
// 이미 로딩 중이면 기존 Promise 반환
if (loadingPromise) {
  return loadingPromise;
}
```

#### 1.4 빠른 초기 로딩을 위한 함수 추가

```typescript
// 케이스 목록만 빠르게 가져오기 (id, title, image_url만)
export async function getCasesListOnly(): Promise<
  Array<{ id: number; title: string; image_url: string }>
>;

// 질문 개수만 빠르게 가져오기 (localStorage 캐싱 사용)
export async function getTotalQuestionsCount(): Promise<number>;
```

**구현 상세**:

- localStorage 캐싱으로 페이지 새로고침 후에도 5분간 유지
- 메모리 캐시 확인 (같은 세션 내에서 빠르게 사용)
- 최적화된 COUNT 쿼리 사용 (정답 영역 데이터는 가져오지 않음)
- 캐시 우선순위: localStorage → 메모리 캐시 → DB 조회

#### 1.5 getCaseById 최적화

```typescript
// 1. 개별 캐시 확인
// 2. getCases 캐시 확인
// 3. getCases가 로딩 중이면 기다리기
// 4. 캐시에 없으면 개별 조회 (최후의 수단)
```

---

## 2. 질문 개수 표시 최적화 (2025년 1월 8일 추가)

### 문제점

**파일**: `src/components/StartScreen.tsx`, `src/utils/caseLoader.ts`

- JSON 파일 시절에는 질문 개수가 즉시 표시되었지만, Supabase 마이그레이션 후 느려짐
- `getCases()`로 전체 데이터를 가져온 후 질문 개수를 계산하여 불필요한 데이터 조회 발생
- 페이지 새로고침 시마다 매번 질문 개수를 다시 계산
- 정답 영역 데이터까지 모두 가져와서 네트워크 비용 증가

### 해결 방법

#### 2.1 질문 개수 전용 함수 추가

**파일**: `src/utils/caseLoader.ts`

```typescript
// 질문 개수 캐싱용 localStorage 키
const TOTAL_QUESTIONS_CACHE_KEY = 'detective_game_total_questions';
const TOTAL_QUESTIONS_CACHE_TIME_KEY = 'detective_game_total_questions_time';

export async function getTotalQuestionsCount(): Promise<number> {
  // 1. localStorage 캐시 확인 (페이지 새로고침 후에도 유지, 5분 유효)
  if (typeof window !== 'undefined') {
    const cachedCount = localStorage.getItem(TOTAL_QUESTIONS_CACHE_KEY);
    const cachedTime = localStorage.getItem(TOTAL_QUESTIONS_CACHE_TIME_KEY);
    if (cachedCount && cachedTime) {
      const cacheAge = Date.now() - parseInt(cachedTime, 10);
      if (cacheAge < CACHE_DURATION) {
        return parseInt(cachedCount, 10); // 즉시 반환
      }
    }
  }

  // 2. 메모리 캐시 확인 (같은 세션 내에서)
  if (casesCache && Date.now() - casesCacheTime < CACHE_DURATION) {
    const total = casesCache.cases.reduce(...);
    // localStorage에도 저장
    localStorage.setItem(TOTAL_QUESTIONS_CACHE_KEY, total.toString());
    return total;
  }

  // 3. 최적화된 COUNT 쿼리로 질문 개수만 가져오기
  // - 정답 영역 데이터는 가져오지 않음
  // - 승인된 케이스의 질문 개수만 카운트
  const { count } = await supabase
    .from('detective_puzzle_questions')
    .select('*', { count: 'exact', head: true })
    .in('case_id', approvedCaseIds);

  // localStorage에 캐시 저장
  localStorage.setItem(TOTAL_QUESTIONS_CACHE_KEY, count.toString());
  return count;
}
```

**최적화 포인트**:

- COUNT 쿼리만 사용하여 네트워크 전송량 최소화
- 정답 영역 데이터는 가져오지 않음
- localStorage 캐싱으로 페이지 새로고침 후에도 즉시 표시
- 메모리 캐시와 localStorage 캐시 이중 활용

#### 2.2 병렬 처리로 독립 실행

**파일**: `src/components/StartScreen.tsx`

```typescript
// 질문 개수와 전체 데이터를 병렬로 실행 (독립적으로)
const totalPromise = getTotalQuestionsCount();
const casesPromise = getCases();

// 질문 개수가 먼저 완료되면 즉시 표시 (Promise.all 사용 안 함)
totalPromise
  .then((total) => {
    setTotalQuestions(total);
  })
  .catch((error) => {
    console.error("질문 개수 로드 실패:", error);
  });

// 전체 데이터가 완료되면 현재 케이스 업데이트
casesPromise
  .then((allCases) => {
    const currentCase = allCases.cases.find((c) => c.id === caseId);
    if (currentCase) {
      setCaseData(currentCase);
    }
  })
  .catch((error) => {
    console.error("케이스 데이터 로드 실패:", error);
  });
```

**병렬 처리의 장점**:

- `getTotalQuestionsCount()`와 `getCases()`가 동시에 실행되어 전체 시간 단축
- 질문 개수가 먼저 완료되면 즉시 표시 (사용자 경험 개선)
- `Promise.all()`을 사용하지 않아 각각 독립적으로 처리됨
- 이미지 preload도 동시에 진행 (총 3개 작업 병렬)

**성능 비교**:

- **이전**: `getCases()` 완료 후 질문 개수 계산 → 느림
- **개선**: `getTotalQuestionsCount()` 먼저 완료 → 빠르게 표시, `getCases()`는 백그라운드에서 진행

---

## 3. 단계적 로딩 (Progressive Loading)

### 문제점

**파일**: `src/components/StartScreen.tsx`

- 전체 데이터를 모두 가져온 후에야 UI 표시
- "로딩중" 메시지가 오래 표시됨

### 해결 방법

```typescript
// 1단계: 케이스 목록만 빠르게 가져오기 (네트워크 1번만, 매우 빠름)
const casesList = await getCasesListOnly();

// 현재 케이스 기본 정보로 먼저 UI 표시 가능
setCaseData({
  id: currentCaseInfo.id,
  title: currentCaseInfo.title,
  image: currentCaseInfo.image_url,
  questions: [],
} as Case);

// 2단계: 모든 케이스 이미지 preload (비동기로 병렬 실행)
casesList.forEach((caseInfo) => {
  preloadImage(caseInfo.image_url);
});

// 3단계: 질문 개수와 전체 데이터를 병렬로 실행
const totalPromise = getTotalQuestionsCount();
const casesPromise = getCases();

// 질문 개수가 먼저 완료되면 즉시 표시
totalPromise.then((total) => {
  setTotalQuestions(total);
});
```

**결과**: UI가 먼저 표시되고, 질문 수와 전체 데이터는 백그라운드에서 로딩됨

---

## 4. 이미지 Preload 개선

### 문제점

- 이미지 preload가 중복 실행됨
- CORS 문제로 인한 preload 실패 가능성

### 해결 방법

**파일들**: `src/components/StartScreen.tsx`, `src/components/CaseListModal.tsx`, `src/components/ImageViewer.tsx`

```typescript
// Set으로 중복 추적
const preloadedImages = new Set<string>();

const preloadImage = (src: string) => {
  // 이미 preload된 이미지는 스킵
  if (preloadedImages.has(src)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = src;
  link.crossOrigin = "anonymous"; // CORS 문제 방지

  link.onerror = () => {
    console.warn("이미지 preload 실패:", src);
    preloadedImages.delete(src);
  };

  document.head.appendChild(link);
  preloadedImages.add(src);
};
```

---

## 5. CaseListModal 최적화

### 문제점

**파일**: `src/components/CaseListModal.tsx`

- hover 시 `getCaseById`를 호출하여 불필요한 네트워크 요청 발생
- 이미 `getCases()`로 모든 데이터를 가져왔는데도 추가 요청

### 해결 방법

```typescript
const handleCaseHover = (caseId: number) => {
  // cases state에서 찾아서 preload (네트워크 요청 없음)
  const caseData = cases.cases.find((c) => c.id === caseId);
  if (caseData) {
    preloadImage(caseData.image); // Set으로 중복 방지되므로 안전하게 호출 가능
  }
};
```

---

## 6. Next.js Image 설정 업데이트

### 문제점

**파일**: `next.config.mjs`

- Supabase Storage URL이 `remotePatterns`에 없어 이미지 최적화가 안 됨

### 해결 방법

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
```

---

## 결과

### 초기 최적화 결과

- 최초 접속 시 "로딩중" 메시지 없이 UI가 즉시 표시됨
- 케이스 목록 클릭 시 딜레이 없음
- 케이스 진입 시 이미지가 즉시 표시됨
- 다음 케이스로 넘어갈 때 이전 이미지가 보이지 않음

### 질문 개수 표시 최적화 결과 (2025년 1월 8일 추가)

- **최초 로딩**: COUNT 쿼리로 빠르게 조회 (정답 영역 데이터 불필요)
- **이후 접속**: localStorage 캐시에서 즉시 반환 (네트워크 요청 없음)
- **병렬 처리**: 질문 개수와 전체 데이터를 동시에 로딩하여 전체 시간 단축
- **사용자 경험**: 질문 개수가 먼저 표시되어 "질문을 불러오는 중..." 메시지가 거의 보이지 않음
- **네트워크 최적화**: 불필요한 정답 영역 데이터 조회 제거로 전송량 감소

### 전체 성능 개선

- 사용자 경험이 크게 개선됨
- 네트워크 요청 최소화
- 캐싱 전략으로 반복 접속 시 성능 향상
