"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase";
import { migrateAnonymousProgress } from "@/utils/migrateProgress";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithKakao: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  getCurrentUserId: () => string | null; // user_id 반환 (익명 사용자 포함)
  isAuthenticated: boolean;
  isAnonymousUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 초기 세션 로드 및 익명 로그인
  useEffect(() => {
    async function initializeAuth() {
      try {
        // 현재 세션 확인
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("세션 로드 실패:", sessionError);
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        // 세션이 있으면 설정
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          setLoading(false);
          return;
        }

        // 세션이 없으면 익명 로그인 시도
        const { data: anonymousData, error: anonymousError } =
          await supabase.auth.signInAnonymously();

        if (anonymousError) {
          console.error("익명 로그인 실패:", anonymousError);
          setError(anonymousError.message);
          setLoading(false);
          return;
        }

        // 익명 로그인 성공
        if (anonymousData.session && anonymousData.user) {
          setSession(anonymousData.session);
          setUser(anonymousData.user);
        }
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "알 수 없는 오류";
        console.error("인증 초기화 중 오류:", errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    initializeAuth();

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setError(null);

      // 세션이 없으면 익명 로그인 시도 (로그아웃 등으로 세션이 사라진 경우)
      if (!session) {
        supabase.auth.signInAnonymously().catch((err) => {
          console.error("익명 로그인 실패:", err);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    setError(null);

    // 회원가입 시도 전에 현재 익명 user_id 확보
    const anonymousUserId =
      user?.is_anonymous && user?.id ? user.id : null;

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

      // 익명 사용자에서 정식 계정으로 전환된 경우 마이그레이션 실행
      if (anonymousUserId && data.user.id !== anonymousUserId) {
        console.log(
          "[회원가입] 익명 계정에서 정식 계정으로 전환 감지, 마이그레이션 시작"
        );
        migrateAnonymousProgress(anonymousUserId, data.user.id).then(
          (result) => {
            if (result.success) {
              console.log("[회원가입] 진행 기록 마이그레이션 완료");
            } else {
              console.error(
                "[회원가입] 진행 기록 마이그레이션 실패:",
                result.error
              );
              // 마이그레이션 실패해도 회원가입은 성공 처리 (사용자 경험 우선)
            }
          }
        );
      }
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    setError(null);

    // 로그인 시도 전에 현재 익명 user_id 확보
    const anonymousUserId =
      user?.is_anonymous && user?.id ? user.id : null;

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

      // 익명 사용자에서 정식 계정으로 전환된 경우 마이그레이션 실행
      if (anonymousUserId && data.user.id !== anonymousUserId) {
        console.log(
          "[로그인] 익명 계정에서 정식 계정으로 전환 감지, 마이그레이션 시작"
        );
        migrateAnonymousProgress(anonymousUserId, data.user.id).then(
          (result) => {
            if (result.success) {
              console.log("[로그인] 진행 기록 마이그레이션 완료");
            } else {
              console.error(
                "[로그인] 진행 기록 마이그레이션 실패:",
                result.error
              );
              // 마이그레이션 실패해도 로그인은 성공 처리 (사용자 경험 우선)
            }
          }
        );
      }
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
    // 모든 사용자(로그인/익명)는 user.id 반환
    return user?.id ?? null;
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
    isAnonymousUser: user?.is_anonymous ?? false,
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
