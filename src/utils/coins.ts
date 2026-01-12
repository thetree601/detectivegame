import { supabase } from "./supabase";

/**
 * 사용자의 코인 잔액 조회
 * @param userId 사용자 ID
 * @returns 코인 잔액 (없으면 0)
 */
export async function getUserCoins(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("user_coins")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (error) {
      // 데이터가 없으면 0 반환 (에러 아님)
      if (error.code === "PGRST116") {
        // PGRST116은 "no rows returned" 에러이므로 정상 (코인 레코드가 없음)
        return 0;
      }
      // 다른 에러인 경우 로그만 남기고 0 반환
      console.warn("코인 잔액 조회 중 오류 (무시됨):", error.message);
      return 0;
    }

    return data?.balance ?? 0;
  } catch (err: unknown) {
    // 예상치 못한 에러인 경우 로그만 남기고 0 반환
    console.error("코인 잔액 조회 중 예상치 못한 오류:", err);
    return 0;
  }
}

/**
 * 사용자 최초 접속 시 코인 잔액 레코드 생성 (balance = 0)
 * @param userId 사용자 ID
 * @returns 성공 여부
 */
export async function initializeUserCoins(userId: string): Promise<boolean> {
  try {
    // 이미 존재하는지 확인
    const { data: existing } = await supabase
      .from("user_coins")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    // 이미 존재하면 성공 처리
    if (existing) {
      return true;
    }

    // 없으면 생성
    const { error } = await supabase.from("user_coins").insert({
      user_id: userId,
      balance: 0,
    });

    if (error) {
      // 이미 존재하는 경우 (동시성 문제) 성공 처리
      if (error.code === "23505") {
        // 23505는 unique violation이므로 이미 생성된 것
        return true;
      }
      console.error("코인 잔액 초기화 실패:", error);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.error("코인 잔액 초기화 중 예상치 못한 오류:", err);
    return false;
  }
}

/**
 * 코인 잔액 확인 (Phase 2, 3에서 사용)
 * @param userId 사용자 ID
 * @param requiredAmount 필요한 코인 수
 * @returns 잔액이 충분한지 여부
 */
export async function checkCoinBalance(
  userId: string,
  requiredAmount: number
): Promise<boolean> {
  try {
    const balance = await getUserCoins(userId);
    return balance >= requiredAmount;
  } catch (err: unknown) {
    console.error("코인 잔액 확인 중 예상치 못한 오류:", err);
    return false;
  }
}

/**
 * 문자열을 숫자로 변환 (해시 함수 사용)
 * @param str 입력 문자열
 * @returns 숫자 (BIGINT 범위 내)
 */
function stringToBigInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  // BIGINT 범위로 제한 (JavaScript Number.MAX_SAFE_INTEGER는 2^53-1)
  return Math.abs(hash % Number.MAX_SAFE_INTEGER);
}

/**
 * 코인 충전 (Phase 2: 결제 완료 시 호출)
 * @param userId 사용자 ID
 * @param amount 충전할 코인 수
 * @param transactionId 포트원 결제 ID (related_id에 저장)
 * @returns 성공 여부
 */
export async function chargeCoins(
  userId: string,
  amount: number,
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 코인 잔액 레코드가 없으면 먼저 생성
    await initializeUserCoins(userId);

    // 현재 잔액 조회
    const currentBalance = await getUserCoins(userId);

    // 코인 잔액 업데이트 (upsert 사용)
    const { error: updateError } = await supabase.from("user_coins").upsert(
      {
        user_id: userId,
        balance: currentBalance + amount,
      },
      {
        onConflict: "user_id",
      }
    );

    if (updateError) {
      console.error("코인 잔액 업데이트 실패:", updateError);
      return { success: false, error: updateError.message };
    }

    // transactionId를 숫자로 변환 (해시 사용)
    const relatedId = transactionId ? stringToBigInt(transactionId) : null;

    // 거래 내역 기록
    const { error: transactionError } = await supabase
      .from("coin_transactions")
      .insert({
        user_id: userId,
        type: "charge",
        amount: amount,
        purpose: "coin_purchase",
        related_id: relatedId,
      });

    if (transactionError) {
      console.error("거래 내역 기록 실패:", transactionError);
      // 거래 내역 기록 실패해도 코인 충전은 성공 처리 (데이터 일관성 유지)
      // 하지만 로그는 남김
      return { success: true };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "코인 충전 중 예상치 못한 오류";
    console.error("코인 충전 중 예상치 못한 오류:", err);
    return { success: false, error: errorMessage };
  }
}

/**
 * 코인 소비 (Phase 3: 정답 보기, 케이스 잠금 해제 등)
 * @param userId 사용자 ID
 * @param amount 소비할 코인 수
 * @param purpose 소비 목적 ('answer_reveal' | 'case_unlock')
 * @param relatedId 관련 ID (질문 ID 또는 케이스 ID)
 * @returns 성공 여부 및 에러 메시지
 */
export async function spendCoins(
  userId: string,
  amount: number,
  purpose: "answer_reveal" | "case_unlock",
  relatedId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 코인 잔액 레코드가 없으면 먼저 생성
    await initializeUserCoins(userId);

    // 현재 잔액 조회
    const currentBalance = await getUserCoins(userId);

    // 잔액 확인
    if (currentBalance < amount) {
      return {
        success: false,
        error: "코인이 부족합니다.",
      };
    }

    // 코인 잔액 차감 (upsert 사용)
    const { error: updateError } = await supabase.from("user_coins").upsert(
      {
        user_id: userId,
        balance: currentBalance - amount,
      },
      {
        onConflict: "user_id",
      }
    );

    if (updateError) {
      console.error("코인 잔액 업데이트 실패:", updateError);
      return { success: false, error: updateError.message };
    }

    // 거래 내역 기록
    const { error: transactionError } = await supabase
      .from("coin_transactions")
      .insert({
        user_id: userId,
        type: "spend",
        amount: amount,
        purpose: purpose,
        related_id: relatedId || null,
      });

    if (transactionError) {
      console.error("거래 내역 기록 실패:", transactionError);
      // 거래 내역 기록 실패해도 코인 차감은 성공 처리 (데이터 일관성 유지)
      // 하지만 로그는 남김
      return { success: true };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "코인 소비 중 예상치 못한 오류";
    console.error("코인 소비 중 예상치 못한 오류:", err);
    return { success: false, error: errorMessage };
  }
}

/**
 * 사용자가 코인으로 구매한 케이스 목록 조회
 * @param userId 사용자 ID
 * @returns 구매한 케이스 ID 배열
 */
export async function getUnlockedCases(userId: string): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from("unlocked_cases")
      .select("case_id")
      .eq("user_id", userId);

    if (error) {
      console.error("구매한 케이스 조회 실패:", error);
      return [];
    }

    return data?.map((row) => Number(row.case_id)) || [];
  } catch (err: unknown) {
    console.error("구매한 케이스 조회 중 예상치 못한 오류:", err);
    return [];
  }
}

/**
 * 케이스 잠금 해제 (코인 차감 + unlocked_cases 기록)
 * @param userId 사용자 ID
 * @param caseId 케이스 ID
 * @returns 성공 여부 및 에러 메시지
 */
export async function unlockCase(
  userId: string,
  caseId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 이미 구매한 케이스인지 확인
    const unlockedCases = await getUnlockedCases(userId);
    if (unlockedCases.includes(caseId)) {
      return {
        success: false,
        error: "이미 구매한 케이스입니다.",
      };
    }

    // 코인 차감 (5코인)
    const spendResult = await spendCoins(userId, 5, "case_unlock", caseId);
    if (!spendResult.success) {
      return spendResult;
    }

    // unlocked_cases 테이블에 기록
    const { error: unlockError } = await supabase
      .from("unlocked_cases")
      .insert({
        user_id: userId,
        case_id: caseId,
      });

    if (unlockError) {
      console.error("케이스 잠금 해제 기록 실패:", unlockError);
      // 이미 구매한 경우 (동시성 문제) 성공 처리
      if (unlockError.code === "23505") {
        // 23505는 unique violation이므로 이미 구매된 것
        return { success: true };
      }
      return {
        success: false,
        error: unlockError.message,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "케이스 잠금 해제 중 예상치 못한 오류";
    console.error("케이스 잠금 해제 중 예상치 못한 오류:", err);
    return { success: false, error: errorMessage };
  }
}
