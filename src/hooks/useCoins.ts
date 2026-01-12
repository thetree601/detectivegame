import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserCoins,
  initializeUserCoins,
  spendCoins as spendCoinsUtil,
} from "@/utils/coins";

interface UseCoinsReturn {
  balance: number;
  loading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
  spendCoins: (
    amount: number,
    purpose: "answer_reveal" | "case_unlock",
    relatedId?: number
  ) => Promise<{ success: boolean; error?: string }>;
}

/**
 * 코인 잔액 상태 관리 훅
 * 사용자 로그인 시 자동으로 코인 잔액 조회
 * 사용자 변경 시 잔액 자동 업데이트
 */
export function useCoins(): UseCoinsReturn {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getCurrentUserId, user } = useAuth();

  /**
   * 코인 잔액 조회 및 초기화
   */
  const refreshBalance = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userId = getCurrentUserId();
      if (!userId) {
        // userId가 없으면 잔액 0으로 설정
        setBalance(0);
        return;
      }

      // 코인 잔액 레코드 초기화 (없으면 생성)
      await initializeUserCoins(userId);

      // 코인 잔액 조회
      const coins = await getUserCoins(userId);
      setBalance(coins);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "코인 잔액 조회에 실패했습니다.";
      setError(errorMessage);
      console.error("코인 잔액 조회 중 예상치 못한 오류:", err);
      // 에러 발생 시에도 잔액은 0으로 유지
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId]);

  /**
   * 코인 소비 함수
   */
  const spendCoins = useCallback(
    async (
      amount: number,
      purpose: "answer_reveal" | "case_unlock",
      relatedId?: number
    ): Promise<{ success: boolean; error?: string }> => {
      const userId = getCurrentUserId();
      if (!userId) {
        return {
          success: false,
          error: "로그인이 필요합니다.",
        };
      }

      const result = await spendCoinsUtil(userId, amount, purpose, relatedId);

      // 코인 소비 성공 시 잔액 새로고침
      if (result.success) {
        await refreshBalance();
      }

      return result;
    },
    [getCurrentUserId, refreshBalance]
  );

  // 사용자 변경 시 자동으로 코인 잔액 조회
  useEffect(() => {
    // user 객체가 변경될 때마다 잔액 새로고침
    refreshBalance();
  }, [user?.id, refreshBalance]);

  return {
    balance,
    loading,
    error,
    refreshBalance,
    spendCoins,
  };
}
