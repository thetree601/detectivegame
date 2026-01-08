'use client';

import { useEffect, useState } from 'react';
import { getCases, getCaseById } from '@/utils/caseLoader';
import { CasesData } from '@/utils/types';
import styles from '@/styles/components.module.css';

interface CaseListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseSelect: (caseId: number) => void;
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

export default function CaseListModal({
  isOpen,
  onClose,
  onCaseSelect,
}: CaseListModalProps) {
  const [cases, setCases] = useState<CasesData>({ cases: [] });
  const [loading, setLoading] = useState(false);

  // 모달이 열릴 때 케이스 데이터 로드
  useEffect(() => {
    if (isOpen) {
      (async () => {
        setLoading(true);
        try {
          const casesData = await getCases();
          setCases(casesData);
          
          // 모든 케이스 이미지 preload
          casesData.cases.forEach((case_) => {
            preloadImage(case_.image);
          });
        } catch (error) {
          console.error('케이스 로드 실패:', error);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCaseClick = async (caseId: number) => {
    try {
      const caseData = await getCaseById(caseId);
      if (caseData) {
        preloadImage(caseData.image);
      }
    } catch (error) {
      console.error('케이스 로드 실패:', error);
    }
    onCaseSelect(caseId);
  };

  const handleCaseHover = async (caseId: number) => {
    try {
      const caseData = await getCaseById(caseId);
      if (caseData) {
        preloadImage(caseData.image);
      }
    } catch (error) {
      console.error('케이스 로드 실패:', error);
    }
  };

  const handleOverlayClick = () => {
    onClose();
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.caseListModal} onClick={handleModalClick}>
        <h2 className={styles.caseListTitle}>케이스 선택</h2>
        <div className={styles.caseListScrollContainer}>
          {loading ? (
            <div>로딩 중...</div>
          ) : (
            cases.cases.map((case_) => {
              const displayTitle = case_.title.replace(/^사건 \d+: /, '');
              return (
                <button
                  key={case_.id}
                  onClick={() => handleCaseClick(case_.id)}
                  onMouseEnter={() => handleCaseHover(case_.id)}
                  className={styles.caseListItem}
                >
                  {case_.id}. {displayTitle}
                </button>
              );
            })
          )}
        </div>
        <button onClick={onClose} className={styles.secondaryButton}>
          닫기
        </button>
      </div>
    </div>
  );
}