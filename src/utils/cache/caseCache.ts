import { CasesData, Case } from "../types";

const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 전체 케이스 목록 캐시
let casesCache: CasesData | null = null;
let casesCacheTime = 0;

// 개별 케이스 캐시
const caseCache = new Map<number, { data: Case; time: number }>();

// 로딩 중인 Promise 추적 (중복 요청 방지)
let loadingPromise: Promise<CasesData> | null = null;

/**
 * 캐시가 유효한지 확인
 */
function isCacheValid(cacheTime: number): boolean {
  return Date.now() - cacheTime < CACHE_DURATION;
}

/**
 * 전체 케이스 목록 캐시 가져오기
 */
export function getCasesCache(): CasesData | null {
  if (casesCache && isCacheValid(casesCacheTime)) {
    return casesCache;
  }
  return null;
}

/**
 * 전체 케이스 목록 캐시 설정
 */
export function setCasesCache(data: CasesData): void {
  casesCache = data;
  casesCacheTime = Date.now();
  
  // 개별 케이스 캐시도 업데이트
  data.cases.forEach((case_) => {
    caseCache.set(case_.id, { data: case_, time: Date.now() });
  });
}

/**
 * 개별 케이스 캐시 가져오기
 */
export function getCaseCache(id: number): Case | null {
  const cached = caseCache.get(id);
  if (cached && isCacheValid(cached.time)) {
    return cached.data;
  }
  return null;
}

/**
 * 개별 케이스 캐시 설정
 */
export function setCaseCache(id: number, data: Case): void {
  caseCache.set(id, { data, time: Date.now() });
}

/**
 * 전체 케이스 목록 캐시에서 개별 케이스 찾기
 */
export function findCaseInCache(id: number): Case | null {
  const casesCache = getCasesCache();
  if (casesCache) {
    const found = casesCache.cases.find((c) => c.id === id);
    if (found) {
      setCaseCache(id, found);
      return found;
    }
  }
  return null;
}

/**
 * 로딩 중인 Promise 가져오기
 */
export function getLoadingPromise(): Promise<CasesData> | null {
  return loadingPromise;
}

/**
 * 로딩 중인 Promise 설정
 */
export function setLoadingPromise(promise: Promise<CasesData> | null): void {
  loadingPromise = promise;
}

/**
 * 모든 캐시 초기화 (테스트용)
 */
export function clearCache(): void {
  casesCache = null;
  casesCacheTime = 0;
  caseCache.clear();
  loadingPromise = null;
}
