"use client";

import { useState } from "react";
import StartScreen from "@/components/StartScreen";
import GameScreen from "@/components/GameScreen";
import CaseListModal from "@/components/CaseListModal";
import { getCases } from "@/utils/caseLoader";

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState(1);
  const [showCaseListModal, setShowCaseListModal] = useState(false);

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

  if (!gameStarted) {
    return (
      <>
        <StartScreen
          caseId={currentCaseId}
          onStartGame={() => setGameStarted(true)}
          onOpenCaseList={handleOpenCaseList}
        />
        <CaseListModal
          isOpen={showCaseListModal}
          onClose={() => setShowCaseListModal(false)}
          onCaseSelect={handleCaseSelect}
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
