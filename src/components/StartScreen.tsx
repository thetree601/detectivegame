"use client";

import { useState } from "react";
import Image from "next/image";
import { useCaseData } from "@/hooks/useCaseData";
import { useAuth } from "@/contexts/AuthContext";
import CoinChargeModal from "./CoinChargeModal";
import { useCoins } from "@/hooks/useCoins";
import { preloadImage } from "@/utils/imagePreloader";
import styles from "@/styles/components.module.css";

interface StartScreenProps {
  caseId: number;
  onStartGame: () => void;
  onOpenCaseList?: () => void;
  onOpenAuth?: () => void;
  onOpenMyPage?: () => void;
}

export default function StartScreen({
  caseId,
  onStartGame,
  onOpenCaseList,
  onOpenAuth,
  onOpenMyPage,
}: StartScreenProps) {
  const { caseData } = useCaseData({ caseId });
  const { signOut, isAnonymousUser } = useAuth();
  const { balance } = useCoins();
  const [showCoinModal, setShowCoinModal] = useState(false);

  // 게임 시작 버튼 hover 시 이미지 확실히 preload
  const handleStartButtonHover = () => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  };

  const startImagePath = "/images/그녀의_20260106_175453_0000.png";

  const handleAuthClick = async () => {
    if (isAnonymousUser) {
      // 익명 사용자: 로그인 모달 열기
      if (onOpenAuth) {
        onOpenAuth();
      }
    } else {
      // 정식 로그인 사용자: 로그아웃
      try {
        await signOut();
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    }
  };

  return (
    <div className={styles.startScreen}>
      {/* 코인 잔액 및 충전 버튼 - 현재는 모든 사용자에게 숨김 처리 */}
      {/* Phase 3에서 코인 사용 기능 추가 시 필요 시점에만 표시하도록 확장 가능 */}
      {false && !isAnonymousUser && (
        <div className={styles.startScreenCoinBalance}>
          <span className={styles.startScreenCoinBalanceIcon}>🪙</span>
          <span className={styles.startScreenCoinBalanceAmount}>
            {balance}코인
          </span>
          <button
            onClick={() => setShowCoinModal(true)}
            className={styles.coinChargeButton}
            aria-label="코인 충전"
          >
            충전
          </button>
        </div>
      )}
      {/* 프로필 아이콘 - 좌측 상단 */}
      {!isAnonymousUser && onOpenMyPage && (
        <button
          onClick={onOpenMyPage}
          className={styles.profileIconButton}
          style={{
            position: "absolute",
            top: "1rem",
            left: "1rem",
            zIndex: 10,
          }}
          aria-label="마이페이지"
        >
          👤
        </button>
      )}
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
            aria-label={isAnonymousUser ? "로그인" : "로그아웃"}
          >
            {isAnonymousUser ? "🔐 로그인" : "로그아웃"}
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
      <CoinChargeModal
        isOpen={showCoinModal}
        onClose={() => setShowCoinModal(false)}
      />
    </div>
  );
}
