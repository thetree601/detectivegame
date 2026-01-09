// 이미지 preload 유틸리티 함수
// Set으로 중복 추적하여 같은 이미지를 여러 번 preload하지 않도록 최적화

const preloadedImages = new Set<string>();

/**
 * 이미지를 preload합니다.
 * 이미 preload된 이미지는 스킵하여 중복 요청을 방지합니다.
 * 
 * @param src - preload할 이미지의 URL
 */
export function preloadImage(src: string): void {
  // 이미 preload된 이미지는 스킵
  if (preloadedImages.has(src)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = src;
  link.crossOrigin = "anonymous"; // CORS 문제 방지

  // 에러 처리
  link.onerror = () => {
    console.warn("이미지 preload 실패:", src);
    preloadedImages.delete(src);
  };

  document.head.appendChild(link);
  preloadedImages.add(src);
}

/**
 * 여러 이미지를 한 번에 preload합니다.
 * 
 * @param srcs - preload할 이미지 URL 배열
 */
export function preloadImages(srcs: string[]): void {
  srcs.forEach((src) => preloadImage(src));
}

/**
 * preload된 이미지 목록을 초기화합니다.
 * (테스트용 또는 메모리 정리용)
 */
export function clearPreloadedImages(): void {
  preloadedImages.clear();
}
