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

    // answer_reveal 목적이고 relatedId가 있으면 중복 구매 확인
    if (purpose === "answer_reveal" && relatedId) {
      const { data: existingTransaction, error: checkError } = await supabase
        .from("coin_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("purpose", "answer_reveal")
        .eq("related_id", relatedId)
        .limit(1);

      if (checkError) {
        console.error("구매 기록 확인 실패:", checkError);
        // 확인 실패해도 계속 진행 (에러가 발생할 수 있지만 구매는 진행)
      } else if (existingTransaction && existingTransaction.length > 0) {
        return {
          success: false,
          error: "이미 구매한 정답입니다.",
        };
      }
    }

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
 * 질문 번호로 질문의 DB ID 조회
 * @param caseId 케이스 ID
 * @param questionNumber 질문 번호
 * @returns 질문의 DB ID (없으면 null)
 */
export async function getQuestionDbId(
  caseId: number,
  questionNumber: number
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("detective_puzzle_questions")
      .select("id")
      .eq("case_id", caseId)
      .eq("question_number", questionNumber)
      .single();

    if (error || !data) {
      console.error("[getQuestionDbId] 질문 DB ID 조회 실패:", error);
      return null;
    }

    return Number(data.id);
  } catch (err: unknown) {
    console.error("[getQuestionDbId] 질문 DB ID 조회 중 예상치 못한 오류:", err);
    return null;
  }
}

/**
 * 질문 DB ID와 질문 번호로 직접 구매 기록 확인 (fallback)
 * @param userId 사용자 ID
 * @param questionDbId 질문의 DB ID
 * @param questionNumber 질문 번호 (선택적)
 * @returns 구매 여부
 */
export async function checkAnswerPurchased(
  userId: string,
  questionDbId: number,
  questionNumber?: number
): Promise<boolean> {
  try {
    console.log("[checkAnswerPurchased] 시작:", { userId, questionDbId, questionNumber });
    
    // 방법 1: 질문 DB ID로 확인
    const { data: dataById, error: errorById } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("purpose", "answer_reveal")
      .eq("related_id", questionDbId)
      .limit(1);

    if (errorById) {
      console.error("[checkAnswerPurchased] 질문 DB ID로 확인 실패:", errorById);
    } else {
      const isPurchasedById = dataById && dataById.length > 0;
      console.log("[checkAnswerPurchased] 질문 DB ID로 확인 결과:", { questionDbId, isPurchasedById, count: dataById?.length || 0 });
      if (isPurchasedById) {
        return true;
      }
    }

    // 방법 2: 질문 번호로도 확인 (제공된 경우)
    if (questionNumber !== undefined) {
      const { data: dataByNumber, error: errorByNumber } = await supabase
        .from("coin_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("purpose", "answer_reveal")
        .eq("related_id", questionNumber)
        .limit(1);

      if (errorByNumber) {
        console.error("[checkAnswerPurchased] 질문 번호로 확인 실패:", errorByNumber);
      } else {
        const isPurchasedByNumber = dataByNumber && dataByNumber.length > 0;
        console.log("[checkAnswerPurchased] 질문 번호로 확인 결과:", { questionNumber, isPurchasedByNumber, count: dataByNumber?.length || 0 });
        if (isPurchasedByNumber) {
          return true;
        }
      }
    }

    console.log("[checkAnswerPurchased] 최종 결과: false");
    return false;
  } catch (err: unknown) {
    console.error("[checkAnswerPurchased] 예상치 못한 오류:", err);
    return false;
  }
}

/**
 * 사용자가 특정 케이스에서 구매한 정답 목록 조회
 * @param userId 사용자 ID
 * @param caseId 케이스 ID
 * @returns 구매한 질문 번호 배열 (question_number)
 */
export async function getPurchasedAnswers(
  userId: string,
  caseId: number
): Promise<number[]> {
  console.log("[getPurchasedAnswers] 시작:", { userId, caseId });
  try {
    // 1. 해당 케이스의 모든 질문 정보 가져오기
    const { data: questions, error: questionsError } = await supabase
      .from("detective_puzzle_questions")
      .select("id, question_number")
      .eq("case_id", caseId);

    if (questionsError) {
      console.error("[getPurchasedAnswers] 질문 조회 실패:", questionsError);
      return [];
    }

    if (!questions || questions.length === 0) {
      console.log("[getPurchasedAnswers] 질문이 없음:", { caseId });
      return [];
    }

    console.log("[getPurchasedAnswers] 질문 개수:", questions.length);
    console.log("[getPurchasedAnswers] 질문 목록:", questions.map(q => ({ id: q.id, question_number: q.question_number })));

    // 질문 DB ID -> 질문 번호 매핑
    const questionIdToNumberMap = new Map(
      questions.map((q) => [Number(q.id), q.question_number])
    );
    // 질문 DB ID 집합
    const questionIds = new Set(questions.map((q) => Number(q.id)));

    console.log("[getPurchasedAnswers] 질문 ID 배열:", Array.from(questionIds));
    console.log("[getPurchasedAnswers] 질문 ID -> 번호 매핑:", Array.from(questionIdToNumberMap.entries()));

    // 2. 케이스의 모든 answer_reveal 거래 조회 (related_id 제한 없이)
    const { data: transactions, error: transactionsError } = await supabase
      .from("coin_transactions")
      .select("related_id")
      .eq("user_id", userId)
      .eq("purpose", "answer_reveal");

    if (transactionsError) {
      console.error("[getPurchasedAnswers] 구매 기록 조회 실패:", transactionsError);
      return [];
    }

    if (!transactions || transactions.length === 0) {
      console.log("[getPurchasedAnswers] 전체 구매 기록 없음:", { userId });
      return [];
    }

    console.log("[getPurchasedAnswers] 전체 구매 기록 개수:", transactions.length);
    console.log("[getPurchasedAnswers] 전체 구매 기록 related_id 목록:", transactions.map(t => t.related_id));

    // 3. 각 거래의 related_id가 현재 케이스의 질문 DB ID인지 확인
    const purchasedQuestionNumbers = new Set<number>();

    transactions.forEach((t) => {
      if (!t.related_id) return;

      const relatedId = Number(t.related_id);
      console.log("[getPurchasedAnswers] 거래 확인:", { related_id: t.related_id, relatedId });

      // related_id가 현재 케이스의 질문 DB ID인 경우만 매칭
      if (questionIds.has(relatedId)) {
        const questionNumber = questionIdToNumberMap.get(relatedId);
        if (questionNumber !== undefined) {
          console.log("[getPurchasedAnswers] 질문 DB ID로 매칭:", { relatedId, questionNumber });
          purchasedQuestionNumbers.add(questionNumber);
        }
      } else {
        console.log("[getPurchasedAnswers] 매칭 실패 (다른 케이스의 질문이거나 유효하지 않은 ID):", { relatedId });
      }
    });

    console.log("[getPurchasedAnswers] 매칭된 질문 번호:", Array.from(purchasedQuestionNumbers));

    // 중복 제거 및 정렬
    const result = Array.from(purchasedQuestionNumbers).sort((a, b) => a - b);
    console.log("[getPurchasedAnswers] 최종 결과:", result);
    return result;
  } catch (err: unknown) {
    console.error("[getPurchasedAnswers] 예상치 못한 오류:", err);
    if (err instanceof Error) {
      console.error("[getPurchasedAnswers] 에러 상세:", err.message, err.stack);
    }
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

/**
 * 코인 거래 내역 타입
 */
export interface CoinTransaction {
  id: number;
  type: "charge" | "spend";
  amount: number;
  purpose: "answer_reveal" | "case_unlock" | "coin_purchase" | null;
  related_id: number | null;
  created_at: string;
  // 정답 보기(answer_reveal)인 경우에만 존재
  caseId?: number;
  caseTitle?: string;
  questionNumber?: number;
}

/**
 * 사용자의 코인 거래 내역 조회
 * @param userId 사용자 ID
 * @returns 코인 거래 내역 배열 (최신순)
 */
export async function getCoinTransactions(
  userId: string
): Promise<CoinTransaction[]> {
  try {
    const { data, error } = await supabase
      .from("coin_transactions")
      .select("id, type, amount, purpose, related_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("코인 거래 내역 조회 실패:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // answer_reveal 거래 중 related_id가 있는 것들만 필터링
    const answerRevealTransactions = data.filter(
      (row) => row.purpose === "answer_reveal" && row.related_id
    );

    // 케이스/질문 정보 조회 (answer_reveal인 경우만)
    const questionInfoMap = new Map<
      number,
      { caseId: number; caseTitle: string; questionNumber: number }
    >();

    if (answerRevealTransactions.length > 0) {
      const questionIds = answerRevealTransactions.map((t) =>
        Number(t.related_id)
      );

      // 질문 정보 조회
      const { data: questions, error: questionsError } = await supabase
        .from("detective_puzzle_questions")
        .select("id, case_id, question_number")
        .in("id", questionIds);

      if (questionsError) {
        console.error("질문 정보 조회 실패:", questionsError);
      } else if (questions && questions.length > 0) {
        const caseIds = Array.from(
          new Set(questions.map((q) => Number(q.case_id)))
        );

        // 케이스 정보 조회
        const { data: cases, error: casesError } = await supabase
          .from("detective_puzzle_cases")
          .select("id, title")
          .in("id", caseIds);

        if (casesError) {
          console.error("케이스 정보 조회 실패:", casesError);
        } else if (cases) {
          const caseTitleMap = new Map(
            cases.map((c) => [Number(c.id), c.title])
          );

          // 질문 ID -> 케이스/질문 정보 매핑 생성
          questions.forEach((q) => {
            const questionId = Number(q.id);
            const caseId = Number(q.case_id);
            const caseTitle = caseTitleMap.get(caseId) || "";
            questionInfoMap.set(questionId, {
              caseId,
              caseTitle,
              questionNumber: q.question_number,
            });
          });
        }
      }
    }

    // 거래 내역 매핑
    return (
      data?.map((row) => {
        const transaction: CoinTransaction = {
          id: Number(row.id),
          type: row.type as "charge" | "spend",
          amount: Number(row.amount),
          purpose: row.purpose as
            | "answer_reveal"
            | "case_unlock"
            | "coin_purchase"
            | null,
          related_id: row.related_id ? Number(row.related_id) : null,
          created_at: row.created_at,
        };

        // answer_reveal이고 related_id가 있으면 케이스/질문 정보 추가
        if (
          row.purpose === "answer_reveal" &&
          row.related_id &&
          questionInfoMap.has(Number(row.related_id))
        ) {
          const info = questionInfoMap.get(Number(row.related_id))!;
          transaction.caseId = info.caseId;
          transaction.caseTitle = info.caseTitle;
          transaction.questionNumber = info.questionNumber;
        }

        return transaction;
      }) || []
    );
  } catch (err: unknown) {
    console.error("코인 거래 내역 조회 중 예상치 못한 오류:", err);
    return [];
  }
}
