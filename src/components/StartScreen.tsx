"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useCaseData } from "@/hooks/useCaseData";
import { preloadImage } from "@/utils/imagePreloader";
import styles from "@/styles/components.module.css";

interface StartScreenProps {
  caseId: number;
  onStartGame: () => void;
  onOpenCaseList?: () => void;
}

export default function StartScreen({
  caseId,
  onStartGame,
  onOpenCaseList,
}: StartScreenProps) {
  const { caseData, totalQuestions } = useCaseData({ caseId });

  // 게임 시작 버튼 hover 시 이미지 확실히 preload
  const handleStartButtonHover = () => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  };

  const startImagePath = "/images/그녀의_20260106_175453_0000.png";

  return (
    <div className={styles.startScreen}>
      {onOpenCaseList && (
        <button
          onClick={onOpenCaseList}
          className={styles.caseListButton}
          aria-label="케이스 목록 보기"
        >
          📋 케이스 목록
        </button>
      )}

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

        <div className={styles.startTitleSection}>
          <h1 className={styles.startTitle}>그녀의 명탐정 노트</h1>
          <p className={styles.startSubtitle}>
            {totalQuestions > 0
              ? `총 ${totalQuestions}개의 질문이 기다리고 있습니다`
              : "질문을 불러오는 중..."}
          </p>
        </div>
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
  );
}
