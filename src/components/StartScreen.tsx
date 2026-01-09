"use client";

import Image from "next/image";
import { useCaseData } from "@/hooks/useCaseData";
import { useAuth } from "@/contexts/AuthContext";
import { preloadImage } from "@/utils/imagePreloader";
import styles from "@/styles/components.module.css";

interface StartScreenProps {
  caseId: number;
  onStartGame: () => void;
  onOpenCaseList?: () => void;
  onOpenAuth?: () => void;
}

export default function StartScreen({
  caseId,
  onStartGame,
  onOpenCaseList,
  onOpenAuth,
}: StartScreenProps) {
  const { caseData } = useCaseData({ caseId });
  const { signOut, isAuthenticated } = useAuth();

  // 게임 시작 버튼 hover 시 이미지 확실히 preload
  const handleStartButtonHover = () => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  };

  const startImagePath = "/images/그녀의_20260106_175453_0000.png";

  const handleAuthClick = async () => {
    if (isAuthenticated) {
      // 로그아웃
      try {
        await signOut();
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    } else {
      // 로그인 모달 열기
      if (onOpenAuth) {
        onOpenAuth();
      }
    }
  };

  return (
    <div className={styles.startScreen}>
      <div className={styles.startScreenTopButtons}>
        {onOpenCaseList && (
          <button
            onClick={onOpenCaseList}
            className={styles.caseListButton}
            aria-label="케이스 목록 보기"
          >
            📋 케이스 목록
          </button>
        )}
        {onOpenAuth && (
          <button
            onClick={handleAuthClick}
            className={styles.authButton}
            aria-label={isAuthenticated ? "로그아웃" : "로그인"}
          >
            {isAuthenticated ? "로그아웃" : "🔐 로그인"}
          </button>
        )}
      </div>

      <div className={styles.startImageSection}>
        <div className={styles.startImageOverlay}>
          <Image
            src={startImagePath}
            alt="그녀의 명탐정 노트"
            fill
            className={styles.startImage}
            priority
            sizes="100vw"
            quality={85}
          />
          <div className={styles.startGradientOverlay} />
        </div>
        <div className={styles.startButtonSection}>
          <button
            onClick={onStartGame}
            onMouseEnter={handleStartButtonHover}
            className={styles.startButton}
          >
            🕵️ 게임 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
