'use client';

import Image from 'next/image';
import { getCaseById, getCases } from '@/utils/caseLoader';
import styles from '@/styles/components.module.css';

interface StartScreenProps {
  caseId: number;
  onStartGame: () => void;
  onOpenCaseList?: () => void;
}

export default function StartScreen({ caseId, onStartGame, onOpenCaseList }: StartScreenProps) {
  const caseData = getCaseById(caseId);
  
  // 모든 케이스의 총 질문 개수 계산
  const allCases = getCases();
  const totalQuestions = allCases.cases.reduce(
    (total, case_) => total + case_.questions.length,
    0
  );

  if (!caseData) {
    return <div>케이스를 찾을 수 없습니다.</div>;
  }

  // 시작 화면 전용 이미지 경로
  const startImagePath = '/images/그녀의_20260106_175453_0000.png';

  return (
    <div className={styles.startScreen}>
      {/* 케이스 목록 버튼 - 상단 우측 */}
      {onOpenCaseList && (
        <button
          onClick={onOpenCaseList}
          className={styles.caseListButton}
          aria-label="케이스 목록 보기"
        >
          📋 케이스 목록
        </button>
      )}

      {/* 대표 이미지 영역 */}
      <div className={styles.startImageSection}>
        <div className={styles.startImageOverlay}>
          <Image
            src={startImagePath}
            alt="그녀의 명탐정 노트"
            fill
            className={styles.startImage}
            priority
          />
          <div className={styles.startGradientOverlay} />
        </div>
        
        {/* 타이틀 오버레이 */}
        <div className={styles.startTitleSection}>
          <h1 className={styles.startTitle}>
            그녀의 명탐정 노트
          </h1>
          <p className={styles.startSubtitle}>
            총 {totalQuestions}개의 질문이 기다리고 있습니다
          </p>
        </div>
      </div>

      {/* 시작 버튼 영역 */}
      <div className={styles.startButtonSection}>
        <button
          onClick={onStartGame}
          className={styles.startButton}
        >
          🕵️ 게임 시작하기
        </button>
      </div>
    </div>
  );
}