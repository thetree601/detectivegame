"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import styles from "@/styles/components.module.css";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = "login" | "signup";

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signUp, signIn, signInWithGoogle, signInWithKakao, error: authError, user } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 유효성 검사
      if (!email || !password) {
        setError("이메일과 비밀번호를 입력해주세요.");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("비밀번호가 일치하지 않습니다.");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("비밀번호는 최소 6자 이상이어야 합니다.");
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password);
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
      }

      // 성공 시 모달 닫기
      onClose();
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const displayError = error || authError;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.authModal} onClick={handleModalClick}>
        <div className={styles.authModalHeader}>
          <h2 className={styles.authModalTitle}>
            {mode === "login" ? "로그인" : "회원가입"}
          </h2>
          <button
            onClick={onClose}
            className={styles.authModalClose}
            disabled={loading}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.authModalForm}>
          {displayError && (
            <div className={styles.authModalError}>{displayError}</div>
          )}

          <div className={styles.authModalField}>
            <label htmlFor="email" className={styles.authModalLabel}>
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.authModalInput}
              placeholder="example@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.authModalField}>
            <label htmlFor="password" className={styles.authModalLabel}>
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.authModalInput}
              placeholder="비밀번호를 입력하세요"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          {mode === "signup" && (
            <div className={styles.authModalField}>
              <label htmlFor="confirmPassword" className={styles.authModalLabel}>
              비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.authModalInput}
              placeholder="비밀번호를 다시 입력하세요"
              required
              disabled={loading}
              minLength={6}
            />
          </div>
          )}

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={loading}
          >
            {loading
              ? "처리 중..."
              : mode === "login"
              ? "로그인"
              : "회원가입"}
          </button>
        </form>

        <div className={styles.authModalDivider}>
          <span className={styles.authModalDividerText}>또는</span>
        </div>

        <div className={styles.authModalSocial}>
          <button
            type="button"
            onClick={async () => {
              setError(null);
              setLoading(true);

              // OAuth 시작 전에 현재 익명 user_id를 로컬 스토리지에 저장
              if (user?.is_anonymous && user?.id) {
                localStorage.setItem("pending_anonymous_user_id", user.id);
                console.log(
                  "[OAuth] 익명 user_id 저장:",
                  user.id
                );
              }

              const { error } = await signInWithGoogle();
              if (error) {
                setError(error.message);
                setLoading(false);
                // 에러 발생 시 로컬 스토리지 정리
                localStorage.removeItem("pending_anonymous_user_id");
              }
            }}
            className={styles.socialButton}
            disabled={loading}
          >
            <span className={styles.socialButtonText}>Google로 로그인</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              setError(null);
              setLoading(true);

              // OAuth 시작 전에 현재 익명 user_id를 로컬 스토리지에 저장
              if (user?.is_anonymous && user?.id) {
                localStorage.setItem("pending_anonymous_user_id", user.id);
                console.log(
                  "[OAuth] 익명 user_id 저장:",
                  user.id
                );
              }

              const { error } = await signInWithKakao();
              if (error) {
                setError(error.message);
                setLoading(false);
                // 에러 발생 시 로컬 스토리지 정리
                localStorage.removeItem("pending_anonymous_user_id");
              }
            }}
            className={styles.socialButton}
            disabled={loading}
          >
            <span className={styles.socialButtonText}>카카오로 로그인</span>
          </button>
        </div>

        <div className={styles.authModalFooter}>
          <button
            type="button"
            onClick={switchMode}
            className={styles.authModalSwitch}
            disabled={loading}
          >
            {mode === "login"
              ? "계정이 없으신가요? 회원가입"
              : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}
