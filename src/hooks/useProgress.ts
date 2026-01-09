import { useState, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UserProgress } from "@/utils/types";
import { getCases } from "@/utils/caseLoader";

interface UseProgressReturn {
  saveProgress: (
    caseId: number,
    questionId: number,
    completedQuestions: number[]
  ) => Promise<void>;
  loadProgress: (caseId: number) => Promise<UserProgress | null>;
  clearProgress: (caseId: number) => Promise<void>;
  getLastCompletedCaseId: () => Promise<number>;
  loading: boolean;
  error: string | null;
}

/**
 * 진행 기록 저장/불러오기 훅
 * 로그인 사용자: user_id로 저장
 * 비회원: session_id로 저장
 */
export function useProgress(): UseProgressReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getCurrentUserId, user } = useAuth();

  /**
   * 진행 기록 저장
   */
  const saveProgress = useCallback(
    async (
      caseId: number,
      questionId: number,
      completedQuestions: number[]
    ) => {
      setLoading(true);
      setError(null);

      try {
        const userId = getCurrentUserId();
        if (!userId) {
          // userId가 없으면 저장할 수 없음 (비로그인 사용자의 경우 session_id가 있어야 함)
          console.warn("사용자 ID가 없어 진행 기록을 저장할 수 없습니다.");
          return;
        }

        const isAuthenticated = !!user;
        const progressData = {
          case_id: caseId,
          current_question_id: questionId,
          completed_questions: completedQuestions,
          last_updated_at: new Date().toISOString(),
          ...(isAuthenticated
            ? { user_id: userId, session_id: null }
            : { user_id: null, session_id: userId }),
        };

        // upsert: 이미 존재하면 업데이트, 없으면 생성
        const { error: upsertError } = await supabase
          .from("user_progress")
          .upsert(progressData, {
            onConflict: isAuthenticated
              ? "user_id,case_id"
              : "session_id,case_id",
          });

        if (upsertError) {
          // RLS 정책 에러나 다른 에러인 경우 로그만 남기고 계속 진행
          console.error("진행 기록 저장 실패:", upsertError);
          // 에러가 발생해도 게임 진행은 계속되도록 throw하지 않음
        }
      } catch (err: unknown) {
        // 예상치 못한 에러인 경우 로그만 남기고 계속 진행
        const errorMessage = err instanceof Error ? err.message : "진행 기록 저장에 실패했습니다.";
        setError(errorMessage);
        console.error("진행 기록 저장 중 예상치 못한 오류:", err);
        // 에러가 발생해도 게임 진행은 계속되도록 throw하지 않음
      } finally {
        setLoading(false);
      }
    },
    [getCurrentUserId, user]
  );

  /**
   * 진행 기록 불러오기
   */
  const loadProgress = useCallback(
    async (caseId: number): Promise<UserProgress | null> => {
      setLoading(true);
      setError(null);

      try {
        const userId = getCurrentUserId();
        if (!userId) {
          // userId가 없으면 진행 기록이 없음
          console.log("사용자 ID가 없어 진행 기록을 불러올 수 없습니다.");
          return null;
        }

        const isAuthenticated = !!user;
        const query = supabase
          .from("user_progress")
          .select("*")
          .eq("case_id", caseId);

        // 로그인 사용자면 user_id로, 비회원이면 session_id로 조회
        if (isAuthenticated) {
          query.eq("user_id", userId).is("session_id", null);
        } else {
          query.eq("session_id", userId).is("user_id", null);
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError) {
          // 데이터가 없으면 null 반환 (에러 아님)
          if (fetchError.code === "PGRST116") {
            // PGRST116은 "no rows returned" 에러이므로 정상 (진행 기록이 없음)
            return null;
          }
          // RLS 정책 에러나 다른 에러인 경우 로그만 남기고 null 반환
          console.warn("진행 기록 조회 중 오류 (무시됨):", fetchError.message);
          return null;
        }

        if (!data) {
          return null;
        }

        // JSONB를 배열로 변환
        return {
          ...data,
          completed_questions: Array.isArray(data.completed_questions)
            ? data.completed_questions
            : [],
        } as UserProgress;
      } catch (err: unknown) {
        // 예상치 못한 에러인 경우 로그만 남기고 null 반환
        console.error("진행 기록 불러오기 중 예상치 못한 오류:", err);
        return null; // 에러 발생 시 null 반환하여 게임은 처음부터 시작
      } finally {
        setLoading(false);
      }
    },
    [getCurrentUserId, user]
  );

  /**
   * 진행 기록 초기화
   */
  const clearProgress = useCallback(
    async (caseId: number) => {
      setLoading(true);
      setError(null);

      try {
        const userId = getCurrentUserId();
        if (!userId) {
          return;
        }

        const isAuthenticated = !!user;
        const query = supabase
          .from("user_progress")
          .delete()
          .eq("case_id", caseId);

        if (isAuthenticated) {
          query.eq("user_id", userId).is("session_id", null);
        } else {
          query.eq("session_id", userId).is("user_id", null);
        }

        const { error: deleteError } = await query;

        if (deleteError) {
          throw deleteError;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "진행 기록 삭제에 실패했습니다.";
        setError(errorMessage);
        console.error("진행 기록 삭제 실패:", err);
      } finally {
        setLoading(false);
      }
    },
    [getCurrentUserId, user]
  );

  /**
   * 가장 마지막에 완료한 케이스 ID 조회
   * 완료 기준: 해당 케이스의 모든 질문이 completed_questions에 포함됨
   * 완료된 케이스가 없으면 0 반환
   */
  const getLastCompletedCaseId = useCallback(async (): Promise<number> => {
    setLoading(true);
    setError(null);

    try {
      const userId = getCurrentUserId();
      if (!userId) {
        // 사용자 ID가 없으면 완료된 케이스 없음
        return 0;
      }

      // 모든 케이스 데이터 가져오기
      const casesData = await getCases();
      if (!casesData || casesData.cases.length === 0) {
        return 0;
      }

      const isAuthenticated = !!user;
      const query = supabase
        .from("user_progress")
        .select("case_id, completed_questions");

      // 로그인 사용자면 user_id로, 비회원이면 session_id로 조회
      if (isAuthenticated) {
        query.eq("user_id", userId).is("session_id", null);
      } else {
        query.eq("session_id", userId).is("user_id", null);
      }

      const { data: allProgress, error: fetchError } = await query;

      if (fetchError) {
        // 에러가 발생해도 게임은 계속 진행되도록 0 반환
        console.warn("진행 기록 조회 중 오류 (무시됨):", fetchError.message);
        return 0;
      }

      if (!allProgress || allProgress.length === 0) {
        return 0;
      }

      // 각 케이스의 완료 여부 확인
      let lastCompletedCaseId = 0;

      for (const case_ of casesData.cases) {
        const progress = allProgress.find((p) => p.case_id === case_.id);
        if (!progress) {
          continue;
        }

        const completedQuestions = Array.isArray(progress.completed_questions)
          ? progress.completed_questions
          : [];
        const totalQuestions = case_.questions.length;

        // 모든 질문이 완료되었는지 확인
        if (completedQuestions.length === totalQuestions && totalQuestions > 0) {
          // 완료된 케이스 중 가장 높은 ID 저장
          if (case_.id > lastCompletedCaseId) {
            lastCompletedCaseId = case_.id;
          }
        }
      }

      return lastCompletedCaseId;
    } catch (err: unknown) {
      // 예상치 못한 에러인 경우 로그만 남기고 0 반환
      console.error("완료된 케이스 조회 중 예상치 못한 오류:", err);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId, user]);

  return {
    saveProgress,
    loadProgress,
    clearProgress,
    getLastCompletedCaseId,
    loading,
    error,
  };
}
