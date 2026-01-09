const CACHE_DURATION = 5 * 60 * 1000; // 5분

/**
 * localStorage에서 캐시된 값을 가져옵니다.
 * 
 * @param key - 캐시 키
 * @returns 캐시된 값 또는 null
 */
export function getStorageCache<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cachedValue = localStorage.getItem(key);
    const cachedTime = localStorage.getItem(`${key}_time`);

    if (cachedValue && cachedTime) {
      const cacheAge = Date.now() - parseInt(cachedTime, 10);
      if (cacheAge < CACHE_DURATION) {
        return JSON.parse(cachedValue) as T;
      }
    }
  } catch (error) {
    console.warn(`localStorage 캐시 읽기 실패 (${key}):`, error);
  }

  return null;
}

/**
 * localStorage에 값을 캐시합니다.
 * 
 * @param key - 캐시 키
 * @param value - 캐시할 값
 */
export function setStorageCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(`${key}_time`, Date.now().toString());
  } catch (error) {
    console.warn(`localStorage 캐시 저장 실패 (${key}):`, error);
  }
}

/**
 * localStorage에서 캐시를 제거합니다.
 * 
 * @param key - 캐시 키
 */
export function removeStorageCache(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_time`);
  } catch (error) {
    console.warn(`localStorage 캐시 제거 실패 (${key}):`, error);
  }
}

/**
 * 질문 개수 캐시 키
 */
const TOTAL_QUESTIONS_CACHE_KEY = "detective_game_total_questions";

/**
 * 질문 개수 캐시 가져오기
 */
export function getTotalQuestionsCache(): number | null {
  const cached = getStorageCache<number>(TOTAL_QUESTIONS_CACHE_KEY);
  return cached !== null ? cached : null;
}

/**
 * 질문 개수 캐시 설정
 */
export function setTotalQuestionsCache(count: number): void {
  setStorageCache(TOTAL_QUESTIONS_CACHE_KEY, count);
}
