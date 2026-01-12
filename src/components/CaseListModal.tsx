"use client";

import { useEffect, useState, useRef } from "react";
import { getCases } from "@/utils/caseLoader";
import { CasesData } from "@/utils/types";
import { preloadImage, preloadImages } from "@/utils/imagePreloader";
import { useProgress } from "@/hooks/useProgress";
import { useAuth } from "@/contexts/AuthContext";
import { useCoins } from "@/hooks/useCoins";
import { getUnlockedCases, unlockCase } from "@/utils/coins";
import CoinChargeModal from "./CoinChargeModal";
import CoinConfirmModal from "./CoinConfirmModal";
import AuthModal from "./AuthModal";
import AlertModal from "./AlertModal";
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
  const [lastAccessibleCaseId, setLastAccessibleCaseId] = useState<number>(0);
  const [unlockedCaseIds, setUnlockedCaseIds] = useState<number[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCoinConfirmModal, setShowCoinConfirmModal] = useState(false);
  const [showLoginAlertModal, setShowLoginAlertModal] = useState(false);
  const [showCoinAlertModal, setShowCoinAlertModal] = useState(false);
  const { getLastCompletedCaseId, getLastAccessibleCaseId } = useProgress();
  const { user, loading: authLoading, getCurrentUserId, isAnonymousUser } = useAuth();
  const { balance, refreshBalance } = useCoins();
  // 최신 user와 authLoading 값을 추적하기 위한 ref
  const userRef = useRef(user);
  const authLoadingRef = useRef(authLoading);
  
  // ref를 최신 값으로 업데이트
  useEffect(() => {
    userRef.current = user;
    authLoadingRef.current = authLoading;
  }, [user, authLoading]);

  // 모달이 열릴 때 케이스 데이터 로드 및 모든 이미지 preload
  useEffect(() => {
    if (isOpen) {
      (async () => {
        setLoading(true);
        try {
          // 인증이 완료되고 user 객체가 설정될 때까지 대기 (익명 로그인 포함)
          if (authLoadingRef.current || !userRef.current) {
            // 인증 로딩 중이거나 user 객체가 없으면 대기
            await new Promise((resolve) => {
              const checkAuth = setInterval(() => {
                // ref를 통해 최신 값 확인 (클로저 문제 해결)
                if (!authLoadingRef.current && userRef.current) {
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
          
          // 대기 후 최신 user 값 확인 (ref에서 가져옴)
          const currentUser = userRef.current;

          const casesData = await getCases();
          setCases(casesData);

          // 모든 케이스 이미지를 미리 preload (딜레이 방지)
          preloadImages(casesData.cases.map((case_) => case_.image));

          // 사용자가 있으면 진행 기록 조회 (익명 사용자 포함)
          // currentUser는 ref에서 가져온 최신 값
          if (currentUser) {
            console.log("[CaseListModal] 사용자 확인됨, 진행 기록 조회 시작");
            console.log("[CaseListModal] user:", currentUser);
            console.log("[CaseListModal] user.id:", currentUser.id);
            console.log(
              "[CaseListModal] user.is_anonymous:",
              currentUser.is_anonymous
            );

            const lastCompleted = await getLastCompletedCaseId();
            console.log(
              "[CaseListModal] getLastCompletedCaseId() 반환값:",
              lastCompleted
            );
            
            // 완료된 케이스와 진행 중인 케이스 둘 다 확인
            const lastAccessible = await getLastAccessibleCaseId();
            console.log(
              "[CaseListModal] getLastAccessibleCaseId() 반환값:",
              lastAccessible
            );
            
            // 별도로 저장 (getCaseLockStatus에서 구분하여 사용)
            setLastCompletedCaseId(lastCompleted);
            setLastAccessibleCaseId(lastAccessible);

            // 코인으로 구매한 케이스 조회
            const unlocked = await getUnlockedCases(currentUser.id);
            setUnlockedCaseIds(unlocked);
          } else {
            // 사용자가 없으면 완료된 케이스 없음
            console.log("[CaseListModal] 사용자 없음 → 0 설정");
            setLastCompletedCaseId(0);
            setLastAccessibleCaseId(0);
            setUnlockedCaseIds([]);
          }
        } catch (error) {
          console.error("케이스 로드 실패:", error);
          // 에러 발생 시 기본값 설정
          setLastCompletedCaseId(0);
          setLastAccessibleCaseId(0);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isOpen, getLastCompletedCaseId, getLastAccessibleCaseId, user, authLoading]);

  if (!isOpen) return null;

  const handleCaseClick = async (caseId: number, isLocked: boolean) => {
    const userId = getCurrentUserId();
    const requiredCoins = 5;

    // 잠긴 케이스인 경우 코인 구매 플로우
    if (isLocked) {
      // A. 비로그인 또는 익명 사용자 → 안내 모달 표시 후 로그인 모달
      if (!userId || !user || isAnonymousUser) {
        setShowLoginAlertModal(true);
        return;
      }

      // B. 로그인 + 코인 부족 → 안내 모달 표시 후 코인 충전 모달
      if (balance < requiredCoins) {
        setSelectedCaseId(caseId);
        setShowCoinAlertModal(true);
        return;
      }

      // C. 로그인 + 코인 충분 → 확인 모달 표시
      setSelectedCaseId(caseId);
      setShowCoinConfirmModal(true);
      return;
    }

    // 잠금 해제된 케이스는 바로 선택
    const caseData = cases.cases.find((c) => c.id === caseId);
    if (caseData) {
      preloadImage(caseData.image);
    }
    onCaseSelect(caseId);
  };

  // 케이스 잠금 상태 계산 함수
  // 로직:
  // - 완료된 케이스 N이면: 케이스 N+1까지 열림
  // - 진행 중인 케이스 N이면: 케이스 N까지만 열림 (N+1은 잠김)
  // - 둘 다 있으면: 각각 계산한 값 중 더 큰 값 사용
  // - 둘 다 없으면: 케이스 1만 열림
  // - 코인으로 구매한 케이스는 항상 열림
  const getCaseLockStatus = (caseId: number) => {
    // 코인으로 구매한 케이스는 항상 열림
    if (unlockedCaseIds.includes(caseId)) {
      return { isLocked: false, isCurrent: false };
    }

    // 완료된 케이스 기준으로 열 수 있는 최대 케이스
    const completedThreshold = lastCompletedCaseId > 0 ? lastCompletedCaseId + 1 : 0;
    // 진행 중인 케이스 기준으로 열 수 있는 최대 케이스
    const accessibleThreshold = lastAccessibleCaseId > 0 ? lastAccessibleCaseId : 0;
    
    // 둘 중 더 큰 값 사용
    const unlockedThreshold = Math.max(completedThreshold, accessibleThreshold, 1);
    
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
                  onMouseEnter={() => handleCaseHover(case_.id)}
                  className={className}
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
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                        ry="2"
                      ></rect>
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
      <CoinChargeModal
        isOpen={showCoinModal}
        onClose={() => {
          setShowCoinModal(false);
          setSelectedCaseId(null);
        }}
      />
      <AlertModal
        isOpen={showLoginAlertModal}
        onClose={() => setShowLoginAlertModal(false)}
        onConfirm={() => {
          setShowLoginAlertModal(false);
          setShowAuthModal(true);
        }}
        title="로그인 필요"
        message="코인이 부족합니다. 코인 충전을 위해 로그인 해주세요."
        icon="🪙"
      />
      <AlertModal
        isOpen={showCoinAlertModal}
        onClose={() => {
          setShowCoinAlertModal(false);
          setSelectedCaseId(null);
        }}
        onConfirm={() => {
          setShowCoinAlertModal(false);
          setShowCoinModal(true);
        }}
        title="코인 부족"
        message="케이스를 보려면 5코인이 필요합니다. 코인을 충전해주세요."
        icon="🪙"
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setSelectedCaseId(null);
        }}
      />
      <CoinConfirmModal
        isOpen={showCoinConfirmModal}
        onClose={() => {
          setShowCoinConfirmModal(false);
          setSelectedCaseId(null);
        }}
        onConfirm={async () => {
          if (!selectedCaseId) return;
          const userId = getCurrentUserId();
          if (!userId) return;

          const result = await unlockCase(userId, selectedCaseId);
          if (result.success) {
            // 코인 잔액 새로고침
            await refreshBalance();
            // 구매한 케이스 목록 업데이트
            const unlocked = await getUnlockedCases(userId);
            setUnlockedCaseIds(unlocked);
            // 케이스 선택
            const caseData = cases.cases.find((c) => c.id === selectedCaseId);
            if (caseData) {
              preloadImage(caseData.image);
            }
            onCaseSelect(selectedCaseId);
          } else {
            alert(result.error || "케이스 잠금 해제에 실패했습니다.");
          }
        }}
        purpose="case_unlock"
        requiredCoins={5}
      />
    </div>
  );
}
