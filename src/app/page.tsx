"use client";

import { useState, useEffect } from "react";
import StartScreen from "@/components/StartScreen";
import GameScreen from "@/components/GameScreen";
import CaseListModal from "@/components/CaseListModal";
import AuthModal from "@/components/AuthModal";
import { getCases } from "@/utils/caseLoader";
import { useAuth } from "@/contexts/AuthContext";

const CURRENT_CASE_ID_KEY = "detective_game_current_case_id";

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState(1);
  const [showCaseListModal, setShowCaseListModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { loading: authLoading } = useAuth();

  // 초기 로드 시 localStorage에서 현재 케이스 ID 불러오기 (게임 화면으로 복원하지 않음)
  useEffect(() => {
    if (typeof window === "undefined" || authLoading) {
      return;
    }

    async function initializeGame() {
      try {
        // localStorage에서 현재 케이스 ID 불러오기
        const savedCaseId = localStorage.getItem(CURRENT_CASE_ID_KEY);
        if (savedCaseId) {
          const caseId = parseInt(savedCaseId, 10);
          if (!isNaN(caseId) && caseId > 0) {
            setCurrentCaseId(caseId);
            // 게임 화면으로 복원하지 않음 - 항상 메인 화면에서 시작
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

  // currentCaseId 변경 시 localStorage에 저장 (초기 로드 제외)
  useEffect(() => {
    if (typeof window !== "undefined" && !isInitializing) {
      localStorage.setItem(CURRENT_CASE_ID_KEY, currentCaseId.toString());
    }
  }, [currentCaseId, isInitializing]);

  const handleCaseComplete = async () => {
    try {
      const cases = await getCases();
      const currentCaseIndex = cases.cases.findIndex(
        (c) => c.id === currentCaseId
      );

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

  const handleOpenCaseList = () => {
    setShowCaseListModal(true);
  };

  const handleGoToMain = () => {
    setGameStarted(false);
  };

  // 초기화 중이면 로딩 표시
  if (isInitializing || authLoading) {
    return <div>로딩 중...</div>;
  }

  if (!gameStarted) {
    return (
      <>
        <StartScreen
          caseId={currentCaseId}
          onStartGame={() => setGameStarted(true)}
          onOpenCaseList={handleOpenCaseList}
          onOpenAuth={() => setShowAuthModal(true)}
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
      </>
    );
  }

  return (
    <>
      <GameScreen
        caseId={currentCaseId}
        onCaseComplete={handleCaseComplete}
        onOpenCaseList={handleOpenCaseList}
        onGoToMain={handleGoToMain}
      />
      <CaseListModal
        isOpen={showCaseListModal}
        onClose={() => setShowCaseListModal(false)}
        onCaseSelect={handleCaseSelect}
      />
    </>
  );
}
