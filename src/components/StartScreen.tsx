'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getCaseById, getCases } from '@/utils/caseLoader';
import { Case } from '@/utils/types';
import styles from '@/styles/components.module.css';

interface StartScreenProps {
  caseId: number;
  onStartGame: () => void;
  onOpenCaseList?: () => void;
}

// 이미지 preload 유틸리티 함수
const preloadImage = (src: string) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  const existing = document.querySelector(`link[href="${src}"]`);
  if (!existing) {
    document.head.appendChild(link);
  }
};

export default function StartScreen({ caseId, onStartGame, onOpenCaseList }: StartScreenProps) {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);

  // 케이스 데이터 로드
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [case_, allCases] = await Promise.all([
          getCaseById(caseId),
          getCases(),
        ]);
        
        if (case_) {
          setCaseData(case_);
        }
        
        const total = allCases.cases.reduce(
          (total, case_) => total + case_.questions.length,
          0
        );
        setTotalQuestions(total);
      } catch (error) {
        console.error('데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [caseId]);

  // 현재 케이스 이미지 preload
  useEffect(() => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  }, [caseData]);

  // 게임 시작 버튼 hover 시 이미지 확실히 preload
  const handleStartButtonHover = () => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  };

  if (loading) {
    return <div className={styles.startScreen}>로딩 중...</div>;
  }

  const startImagePath = '/images/그녀의_20260106_175453_0000.png';

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
          <h1 className={styles.startTitle}>
            그녀의 명탐정 노트
          </h1>
          <p className={styles.startSubtitle}>
            총 {totalQuestions}개의 질문이 기다리고 있습니다
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