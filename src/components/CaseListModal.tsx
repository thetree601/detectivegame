"use client";

import { useEffect, useState } from "react";
import { getCases } from "@/utils/caseLoader";
import { CasesData } from "@/utils/types";
import styles from "@/styles/components.module.css";

interface CaseListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseSelect: (caseId: number) => void;
}

// 이미지 preload 유틸리티 함수 (Set으로 중복 추적)
const preloadedImages = new Set<string>();

const preloadImage = (src: string) => {
  // 이미 preload된 이미지는 스킵 (중복 방지)
  if (preloadedImages.has(src)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = src;
  link.crossOrigin = "anonymous"; // CORS 문제 방지

  // 에러 처리
  link.onerror = () => {
    console.warn("이미지 preload 실패:", src);
    preloadedImages.delete(src);
  };

  document.head.appendChild(link);
  preloadedImages.add(src);
};

export default function CaseListModal({
  isOpen,
  onClose,
  onCaseSelect,
}: CaseListModalProps) {
  const [cases, setCases] = useState<CasesData>({ cases: [] });
  const [loading, setLoading] = useState(false);

  // 모달이 열릴 때 케이스 데이터 로드 및 모든 이미지 preload
  useEffect(() => {
    if (isOpen) {
      (async () => {
        setLoading(true);
        try {
          const casesData = await getCases();
          setCases(casesData);

          // 모든 케이스 이미지를 미리 preload (딜레이 방지)
          casesData.cases.forEach((case_) => {
            preloadImage(case_.image);
          });
        } catch (error) {
          console.error("케이스 로드 실패:", error);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCaseClick = (caseId: number) => {
    // cases state에서 찾아서 preload (네트워크 요청 없음)
    const caseData = cases.cases.find((c) => c.id === caseId);
    if (caseData) {
      preloadImage(caseData.image); // 확실히 preload (이미 했을 수도 있지만 안전하게)
    }
    onCaseSelect(caseId);
  };

  const handleCaseHover = (caseId: number) => {
    // hover 시에도 preload (사진이 미리 받아져서 딜레이 없게)
    // cases state에서 찾아서 preload (네트워크 요청 없음)
    const caseData = cases.cases.find((c) => c.id === caseId);
    if (caseData) {
      preloadImage(caseData.image); // Set으로 중복 방지되므로 안전하게 호출 가능
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
              const displayTitle = case_.title.replace(/^사건 \d+: /, "");
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
