"use client";

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
  refreshBalance: (newBalance?: number) => Promise<void>;
  spendCoins: (
    amount: number,
    purpose: "answer_reveal" | "case_unlock",
    relatedId?: number
  ) => Promise<{ success: boolean; error?: string }>;
}

export function useCoins(): UseCoinsReturn {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getCurrentUserId, user } = useAuth();

  /**
   * 코인 잔액 조회 및 업데이트
   * @param newBalance 서버에서 이미 계산된 잔액이 있다면 직접 입력 가능
   */
  const refreshBalance = useCallback(async (newBalance?: number) => {
    // 💡 1. 새로운 잔액이 직접 들어온 경우 즉시 업데이트 (가장 빠름)
    if (typeof newBalance === "number") {
      setBalance(newBalance);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setBalance(0);
        return;
      }

      // 초기화 로직 (레코드가 없을 때만 생성)
      await initializeUserCoins(userId);

      // 코인 잔액 조회
      const coins = await getUserCoins(userId);
      setBalance(coins);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "코인 잔액 조회에 실패했습니다.";
      setError(errorMessage);
      console.error("코인 잔액 조회 중 오류:", err);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId]);

  const spendCoins = useCallback(
    async (
      amount: number,
      purpose: "answer_reveal" | "case_unlock",
      relatedId?: number
    ): Promise<{ success: boolean; error?: string }> => {
      const userId = getCurrentUserId();
      if (!userId) {
        return { success: false, error: "로그인이 필요합니다." };
      }

      const result = await spendCoinsUtil(userId, amount, purpose, relatedId);
      if (result.success) {
        await refreshBalance();
      }
      return result;
    },
    [getCurrentUserId, refreshBalance]
  );

  useEffect(() => {
    refreshBalance();
  }, [user?.id, refreshBalance]);

  return { balance, loading, error, refreshBalance, spendCoins };
}