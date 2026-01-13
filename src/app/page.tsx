"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"; // 추가
import StartScreen from "@/components/StartScreen";
import GameScreen from "@/components/GameScreen";
import CaseListModal from "@/components/CaseListModal";
import AuthModal from "@/components/AuthModal";
import MyPageModal from "@/components/MyPageModal";
import { getCases } from "@/utils/caseLoader";
import { useAuth } from "@/contexts/AuthContext";
import { useCoins } from "@/hooks/useCoins"; // 추가

const CURRENT_CASE_ID_KEY = "detective_game_current_case_id";

/**
 * 💡 결제 리디렉션 처리 컴포넌트
 */
function PaymentHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshBalance } = useCoins();
  const { getCurrentUserId } = useAuth();
  const isProcessing = useRef(false);

  useEffect(() => {
    const paymentId = searchParams.get("paymentId");
    const userId = getCurrentUserId();

    if (paymentId && userId && !isProcessing.current) {
      isProcessing.current = true;

      const verifyPayment = async () => {
        try {
          // 서버에 결제 확인 요청
          const response = await fetch("/api/payment/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId, userId }),
          });

          const result = await response.json();

          if (result.success) {
            alert("✅ 코인 충전이 완료되었습니다!");
            // 💡 서버가 준 새로운 코인 잔액이 있다면 즉시 업데이트, 없으면 1초 뒤 재조회
            if (result.coins !== undefined) {
              await refreshBalance(result.coins);
            } else {
              setTimeout(() => refreshBalance(), 1000);
            }
          } else {
            alert(`❌ 결제 실패: ${result.error || "알 수 없는 오류"}`);
          }
        } catch (error) {
          console.error("결제 검증 오류:", error);
        } finally {
          // URL에서 파라미터 제거하여 메인 주소를 깔끔하게 유지
          router.replace("/");
          isProcessing.current = false;
        }
      };

      verifyPayment();
    }
  }, [searchParams, getCurrentUserId, refreshBalance, router]);

  return null;
}

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState(1);
  const [showCaseListModal, setShowCaseListModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMyPageModal, setShowMyPageModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined" || authLoading) return;

    async function initializeGame() {
      try {
        const savedCaseId = localStorage.getItem(CURRENT_CASE_ID_KEY);
        if (savedCaseId) {
          const caseId = parseInt(savedCaseId, 10);
          if (!isNaN(caseId) && caseId > 0) {
            setCurrentCaseId(caseId);
          }
        }
      } catch (error) {
        console.error("게임 상태 복원 실패:", error);
      } finally {
        setIsInitializing(false);
      }
    }
    initializeGame();
  }, [authLoading]);

  useEffect(() => {
    if (typeof window !== "undefined" && !isInitializing) {
      localStorage.setItem(CURRENT_CASE_ID_KEY, currentCaseId.toString());
    }
  }, [currentCaseId, isInitializing]);

  const handleCaseComplete = async () => {
    try {
      const cases = await getCases();
      const currentCaseIndex = cases.cases.findIndex((c) => c.id === currentCaseId);

      if (currentCaseIndex < cases.cases.length - 1) {
        const nextCaseId = cases.cases[currentCaseIndex + 1].id;
        setCurrentCaseId(nextCaseId);
      } else {
        alert("모든 질문을 완료했습니다! 🎉");
        setCurrentCaseId(1);
        setGameStarted(false);
      }
    } catch (error) {
      console.error("케이스 완료 처리 실패:", error);
    }
  };

  const handleCaseSelect = (caseId: number) => {
    setCurrentCaseId(caseId);
    setGameStarted(true);
    setShowCaseListModal(false);
  };

  if (isInitializing || authLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <>
      {/* 💡 결제 처리 컴포넌트 추가 */}
      <Suspense fallback={null}>
        <PaymentHandler />
      </Suspense>

      {!gameStarted ? (
        <>
          <StartScreen
            caseId={currentCaseId}
            onStartGame={() => setGameStarted(true)}
            onOpenCaseList={() => setShowCaseListModal(true)}
            onOpenAuth={() => setShowAuthModal(true)}
            onOpenMyPage={() => setShowMyPageModal(true)}
          />
          <CaseListModal
            isOpen={showCaseListModal}
            onClose={() => setShowCaseListModal(false)}
            onCaseSelect={handleCaseSelect}
          />
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
          <MyPageModal
            isOpen={showMyPageModal}
            onClose={() => setShowMyPageModal(false)}
          />
        </>
      ) : (
        <>
          <GameScreen
            caseId={currentCaseId}
            onCaseComplete={handleCaseComplete}
            onOpenCaseList={() => setShowCaseListModal(true)}
            onGoToMain={() => setGameStarted(false)}
            onOpenMyPage={() => setShowMyPageModal(true)}
          />
          <CaseListModal
            isOpen={showCaseListModal}
            onClose={() => setShowCaseListModal(false)}
            onCaseSelect={handleCaseSelect}
          />
          <MyPageModal
            isOpen={showMyPageModal}
            onClose={() => setShowMyPageModal(false)}
          />
        </>
      )}
    </>
  );
}