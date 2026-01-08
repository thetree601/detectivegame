'use client';

import { useEffect } from 'react';
import { getCases, getCaseById } from '@/utils/caseLoader';
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
  // 이미 존재하는지 확인
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
  const cases = getCases();

  // 모달이 열릴 때 모든 케이스 이미지 preload
  useEffect(() => {
    if (isOpen) {
      cases.cases.forEach((case_) => {
        preloadImage(case_.image);
      });
    }
  }, [isOpen, cases]);

  if (!isOpen) return null;

  const handleCaseClick = (caseId: number) => {
    const caseData = getCaseById(caseId);
    if (caseData) {
      // 클릭 시 해당 이미지 확실히 preload
      preloadImage(caseData.image);
    }
    onCaseSelect(caseId);
  };

  const handleCaseHover = (caseId: number) => {
    const caseData = getCaseById(caseId);
    if (caseData) {
      // hover 시 이미지 preload
      preloadImage(caseData.image);
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
          {cases.cases.map((case_) => {
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
          })}
        </div>
        <button onClick={onClose} className={styles.secondaryButton}>
          닫기
        </button>
      </div>
    </div>
  );
}