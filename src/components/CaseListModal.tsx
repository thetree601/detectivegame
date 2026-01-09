"use client";

import { useEffect, useState } from "react";
import { getCases } from "@/utils/caseLoader";
import { CasesData } from "@/utils/types";
import { preloadImage, preloadImages } from "@/utils/imagePreloader";
import { useProgress } from "@/hooks/useProgress";
import { useAuth } from "@/contexts/AuthContext";
import styles from "@/styles/components.module.css";

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
  const [cases, setCases] = useState<CasesData>({ cases: [] });
  const [loading, setLoading] = useState(false);
  const [lastCompletedCaseId, setLastCompletedCaseId] = useState<number>(0);
  const { getLastCompletedCaseId } = useProgress();
  const { user, loading: authLoading } = useAuth();

  // 모달이 열릴 때 케이스 데이터 로드 및 모든 이미지 preload
  useEffect(() => {
    if (isOpen) {
      (async () => {
        setLoading(true);
        try {
          // 인증이 완료될 때까지 대기 (익명 로그인 포함)
          if (authLoading) {
            // 인증 로딩 중이면 잠시 대기
            await new Promise((resolve) => {
              const checkAuth = setInterval(() => {
                if (!authLoading) {
                  clearInterval(checkAuth);
                  resolve(undefined);
                }
              }, 100);
              // 최대 5초 대기
              setTimeout(() => {
                clearInterval(checkAuth);
                resolve(undefined);
              }, 5000);
            });
          }

          const casesData = await getCases();
          setCases(casesData);

          // 모든 케이스 이미지를 미리 preload (딜레이 방지)
          preloadImages(casesData.cases.map((case_) => case_.image));

          // 사용자가 있으면 진행 기록 조회 (익명 사용자 포함)
          if (user) {
            const lastCompleted = await getLastCompletedCaseId();
            setLastCompletedCaseId(lastCompleted);
          } else {
            // 사용자가 없으면 완료된 케이스 없음
            setLastCompletedCaseId(0);
          }
        } catch (error) {
          console.error("케이스 로드 실패:", error);
          // 에러 발생 시 기본값 설정
          setLastCompletedCaseId(0);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isOpen, getLastCompletedCaseId, user, authLoading]);

  if (!isOpen) return null;

  const handleCaseClick = (caseId: number, isLocked: boolean) => {
    // 잠긴 케이스는 클릭 불가
    if (isLocked) {
      return;
    }

    // cases state에서 찾아서 preload (네트워크 요청 없음)
    const caseData = cases.cases.find((c) => c.id === caseId);
    if (caseData) {
      preloadImage(caseData.image); // 확실히 preload (이미 했을 수도 있지만 안전하게)
    }
    onCaseSelect(caseId);
  };

  // 케이스 잠금 상태 계산 함수
  // 로직: 마지막 완료 케이스(N)를 기준으로, 케이스(N+1)은 열고, 케이스(N+2)부터 잠금
  const getCaseLockStatus = (caseId: number) => {
    // 완료된 케이스가 없으면 (lastCompletedCaseId = 0) 케이스 1만 열림
    const unlockedThreshold = lastCompletedCaseId + 1;
    const isLocked = caseId > unlockedThreshold;
    const isCurrent = caseId === unlockedThreshold;
    return { isLocked, isCurrent };
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
              const { isLocked, isCurrent } = getCaseLockStatus(case_.id);
              
              // 클래스명 조합
              let className = styles.caseListItem;
              if (isLocked) {
                className += ` ${styles.caseListItemLocked}`;
              }
              if (isCurrent) {
                className += ` ${styles.caseListItemCurrent}`;
              }

              return (
                <button
                  key={case_.id}
                  onClick={() => handleCaseClick(case_.id, isLocked)}
                  onMouseEnter={() => !isLocked && handleCaseHover(case_.id)}
                  className={className}
                  disabled={isLocked}
                >
                  <span>
                    {case_.id}. {displayTitle}
                  </span>
                  {isLocked && (
                    <svg
                      className={styles.lockIcon}
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  )}
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
