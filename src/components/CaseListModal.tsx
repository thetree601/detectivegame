'use client';

import { getCases } from '@/utils/caseLoader';
import styles from '@/styles/components.module.css';

interface CaseListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseSelect: (caseId: number) => void;
}

export default function CaseListModal({
  isOpen,
  onClose,
  onCaseSelect,
}: CaseListModalProps) {
  if (!isOpen) return null;

  const cases = getCases();

  const handleCaseClick = (caseId: number) => {
    onCaseSelect(caseId);
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
            // "사건 X: " 부분 제거
            const displayTitle = case_.title.replace(/^사건 \d+: /, '');
            return (
              <button
                key={case_.id}
                onClick={() => handleCaseClick(case_.id)}
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

