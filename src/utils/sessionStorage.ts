/**
 * 비회원 사용자를 위한 session_id 관리
 * localStorage에 저장하여 브라우저 세션 간 유지
 */

const SESSION_ID_KEY = 'detective_game_session_id';

/**
 * session_id를 가져오거나 생성
 * @returns session_id (UUID 형식)
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    // 서버 사이드에서는 빈 문자열 반환
    return '';
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  
  if (!sessionId) {
    // UUID v4 생성
    sessionId = generateUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * session_id 삭제 (로그인 시 비회원 세션 정리용)
 */
export function clearSessionId(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem(SESSION_ID_KEY);
}

/**
 * UUID v4 생성
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
