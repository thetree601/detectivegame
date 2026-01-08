'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getCasesListOnly, getCases } from '@/utils/caseLoader';
import { Case } from '@/utils/types';
import styles from '@/styles/components.module.css';

interface StartScreenProps {
  caseId: number;
  onStartGame: () => void;
  onOpenCaseList?: () => void;
}

// 이미지 preload 유틸리티 함수 (개선: Set으로 중복 추적)
const preloadedImages = new Set<string>();

const preloadImage = (src: string) => {
  // 이미 preload된 이미지는 스킵
  if (preloadedImages.has(src)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.crossOrigin = 'anonymous';
  
  link.onerror = () => {
    console.warn('이미지 preload 실패:', src);
    preloadedImages.delete(src);
  };

  document.head.appendChild(link);
  preloadedImages.add(src);
};

export default function StartScreen({ caseId, onStartGame, onOpenCaseList }: StartScreenProps) {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(false);

  // 케이스 데이터 로드 (병렬 로딩으로 최적화)
  useEffect(() => {
    async function loadData() {
      try {
        // 1단계: 케이스 목록만 빠르게 가져오기 (네트워크 1번만, 매우 빠름)
        const casesList = await getCasesListOnly();
        
        // 현재 케이스 찾기
        const currentCaseInfo = casesList.find((c) => c.id === caseId);
        if (currentCaseInfo) {
          // 케이스 기본 정보로 먼저 UI 표시 가능
          setCaseData({
            id: currentCaseInfo.id,
            title: currentCaseInfo.title,
            image: currentCaseInfo.image_url,
            questions: [],
          } as Case);
          
          // 현재 케이스 이미지 preload
          preloadImage(currentCaseInfo.image_url);
        }
        
        // 2단계: 모든 케이스 이미지 preload (백그라운드에서 병렬로 처리)
        // 케이스 목록 열기 전에 미리 로드하여 딜레이 없게 함
        casesList.forEach((caseInfo) => {
          preloadImage(caseInfo.image_url);
        });
        
        // 3단계: 전체 데이터 가져오기 (질문 수 계산을 위해 필요)
        // 이미지 preload와 병렬로 진행되지만, 질문 수 계산은 우선순위 높음
        const allCases = await getCases();
        
        // 현재 케이스 업데이트 (전체 데이터 포함)
        const currentCase = allCases.cases.find((c) => c.id === caseId);
        if (currentCase) {
          setCaseData(currentCase);
        }
        
        // 4단계: 질문 수 계산 및 즉시 업데이트 (UI에 표시되므로 우선순위 높음)
        const total = allCases.cases.reduce(
          (total, case_) => total + case_.questions.length,
          0
        );
        setTotalQuestions(total);
        
      } catch (error) {
        console.error('데이터 로드 실패:', error);
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
            {totalQuestions > 0 
              ? `총 ${totalQuestions}개의 질문이 기다리고 있습니다`
              : '질문을 불러오는 중...'}
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