"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase";
import { getSessionId, clearSessionId } from "@/utils/sessionStorage";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithKakao: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  getCurrentUserId: () => string | null; // user_id 또는 session_id 반환
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 비로그인 상태의 진행 기록을 로그인 사용자로 마이그레이션
   * @param userId 로그인한 사용자의 user_id
   */
  const migrateSessionProgressToUser = async (userId: string): Promise<void> => {
    try {
      // 비로그인 상태의 session_id 가져오기
      const sessionId = getSessionId();
      if (!sessionId) {
        // session_id가 없으면 마이그레이션할 것이 없음
        return;
      }

      // session_id로 저장된 모든 진행 기록 조회
      // RLS 정책 문제가 발생할 수 있으므로 에러를 무시하고 계속 진행
      const { data: sessionProgress, error: fetchError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("session_id", sessionId)
        .is("user_id", null);

      if (fetchError) {
        // RLS 정책 에러나 다른 에러가 발생할 수 있음 (정상적인 경우일 수 있음)
        // 로그인한 사용자가 session_id로 저장된 기록을 조회할 때 RLS 정책에 의해 거부될 수 있음
        console.warn("비로그인 진행 기록 조회 실패 (RLS 정책 또는 기타 이유):", fetchError.message);
        return;
      }

      if (!sessionProgress || sessionProgress.length === 0) {
        // 마이그레이션할 기록이 없음
        return;
      }

      let migratedCount = 0;
      let errorCount = 0;

      // 각 케이스별로 마이그레이션
      for (const progress of sessionProgress) {
        try {
          // 동일한 케이스에 user_id로 저장된 기록이 있는지 확인
          const { data: userProgress, error: userProgressError } = await supabase
            .from("user_progress")
            .select("*")
            .eq("user_id", userId)
            .eq("case_id", progress.case_id)
            .single();

          if (userProgressError && userProgressError.code !== "PGRST116") {
            // PGRST116은 "no rows returned" 에러이므로 정상
            console.warn(`케이스 ${progress.case_id} 진행 기록 조회 실패:`, userProgressError.message);
            errorCount++;
            continue;
          }

          if (userProgress) {
            // 두 기록이 모두 있으면 병합
            // 완료된 질문 합치기 (중복 제거)
            const mergedCompleted = Array.from(
              new Set([
                ...(Array.isArray(userProgress.completed_questions)
                  ? userProgress.completed_questions
                  : []),
                ...(Array.isArray(progress.completed_questions)
                  ? progress.completed_questions
                  : []),
              ])
            );

            // 더 최신 기록의 current_question_id 사용
            const userProgressDate = new Date(userProgress.last_updated_at);
            const sessionProgressDate = new Date(progress.last_updated_at);
            const currentQuestionId =
              sessionProgressDate > userProgressDate
                ? progress.current_question_id
                : userProgress.current_question_id;

            // 병합된 기록으로 업데이트
            const { error: updateError } = await supabase
              .from("user_progress")
              .update({
                current_question_id: currentQuestionId,
                completed_questions: mergedCompleted,
                last_updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .eq("case_id", progress.case_id);

            if (updateError) {
              console.warn(`케이스 ${progress.case_id} 진행 기록 병합 실패:`, updateError.message);
              errorCount++;
              continue;
            }

            // session_id 기록 삭제 (에러가 발생해도 무시)
            await supabase
              .from("user_progress")
              .delete()
              .eq("session_id", sessionId)
              .eq("case_id", progress.case_id);
            
            migratedCount++;
          } else {
            // user_id 기록이 없으면 session_id 기록을 user_id로 변환
            const { error: migrateError } = await supabase
              .from("user_progress")
              .update({
                user_id: userId,
                session_id: null,
              })
              .eq("session_id", sessionId)
              .eq("case_id", progress.case_id);

            if (migrateError) {
              console.warn(`케이스 ${progress.case_id} 진행 기록 마이그레이션 실패:`, migrateError.message);
              errorCount++;
              continue;
            }
            
            migratedCount++;
          }
        } catch (err: unknown) {
          // 개별 케이스 마이그레이션 실패는 무시하고 계속 진행
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.warn(`케이스 ${progress.case_id} 마이그레이션 중 오류:`, errorMessage);
          errorCount++;
          continue;
        }
      }

      if (migratedCount > 0) {
        console.log(`비로그인 진행 기록 마이그레이션 완료: ${migratedCount}개 케이스`);
      }
      if (errorCount > 0) {
        console.warn(`마이그레이션 중 ${errorCount}개 케이스에서 오류 발생 (무시됨)`);
      }
    } catch (err: unknown) {
      // 마이그레이션 실패해도 게임 진행에는 영향 없도록 에러만 로그
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("진행 기록 마이그레이션 중 예상치 못한 오류:", errorMessage);
    }
  };

  // 초기 세션 로드
  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("세션 로드 실패:", error);
        setError(error.message);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        // 이미 로그인된 상태라면 마이그레이션 수행 (비동기로 실행, 로딩을 막지 않음)
        if (session?.user) {
          migrateSessionProgressToUser(session.user.id)
            .then(() => {
              clearSessionId();
            })
            .catch((err) => {
              console.error("마이그레이션 실패 (무시됨):", err);
              // 마이그레이션 실패해도 session_id는 정리
              clearSessionId();
            });
        }
      }
      setLoading(false);
    });

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setError(null);

      // 로그인 시 비로그인 진행 기록 마이그레이션 (비동기로 실행)
      if (session?.user) {
        migrateSessionProgressToUser(session.user.id)
          .then(() => {
            clearSessionId();
          })
          .catch((err) => {
            console.error("마이그레이션 실패 (무시됨):", err);
            // 마이그레이션 실패해도 session_id는 정리
            clearSessionId();
          });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    // 회원가입 성공 시 세션 설정
    if (data.session && data.user) {
      setSession(data.session);
      setUser(data.user);
      // 비로그인 진행 기록 마이그레이션 (비동기로 실행)
      migrateSessionProgressToUser(data.user.id)
        .then(() => {
          clearSessionId(); // 비회원 session_id 정리
        })
        .catch((err) => {
          console.error("마이그레이션 실패 (무시됨):", err);
          // 마이그레이션 실패해도 session_id는 정리
          clearSessionId();
        });
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    // 로그인 성공 시 세션 설정
    if (data.session && data.user) {
      setSession(data.session);
      setUser(data.user);
      // 비로그인 진행 기록 마이그레이션 (비동기로 실행)
      migrateSessionProgressToUser(data.user.id)
        .then(() => {
          clearSessionId(); // 비회원 session_id 정리
        })
        .catch((err) => {
          console.error("마이그레이션 실패 (무시됨):", err);
          // 마이그레이션 실패해도 session_id는 정리
          clearSessionId();
        });
    }

    return { error: null };
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    // OAuth는 리다이렉트되므로 여기서는 에러만 반환
    // 실제 로그인 성공은 onAuthStateChange에서 처리됨
    return { error: null };
  };

  const signInWithKakao = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    // OAuth는 리다이렉트되므로 여기서는 에러만 반환
    // 실제 로그인 성공은 onAuthStateChange에서 처리됨
    return { error: null };
  };

  const signOut = async () => {
    setError(null);
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      setError(error.message);
      throw error;
    }

    setSession(null);
    setUser(null);
  };

  const getCurrentUserId = (): string | null => {
    // 로그인 사용자면 user_id 반환
    if (user?.id) {
      return user.id;
    }
    // 비회원이면 session_id 반환
    return getSessionId();
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithKakao,
    signOut,
    getCurrentUserId,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
