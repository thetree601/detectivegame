'use client';

import { useState } from 'react';
import StartScreen from '@/components/StartScreen';
import GameScreen from '@/components/GameScreen';
import CaseListModal from '@/components/CaseListModal';
import { getCases } from '@/utils/caseLoader';

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState(1);
  const [showCaseListModal, setShowCaseListModal] = useState(false);

  const handleCaseComplete = () => {
    const cases = getCases();
    const currentCaseIndex = cases.cases.findIndex(c => c.id === currentCaseId);
    
    if (currentCaseIndex < cases.cases.length - 1) {
      // 다음 케이스로 이동 (완료 메시지 없이, StartScreen 거치지 않고 바로 GameScreen으로 전환)
      const nextCaseId = cases.cases[currentCaseIndex + 1].id;
      setCurrentCaseId(nextCaseId);
      // gameStarted는 true로 유지하여 바로 다음 케이스의 GameScreen 표시
    } else {
      // 모든 케이스의 모든 질문 완료 - 이때만 완료 메시지 표시
      alert('모든 질문을 완료했습니다! 🎉');
      setCurrentCaseId(1); // 첫 번째 케이스로 리셋
      setGameStarted(false); // StartScreen으로 돌아감
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
    setGameStarted(false); // StartScreen으로 돌아가기
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