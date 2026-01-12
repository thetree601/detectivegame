"use client";

import { useState } from "react";
import ImageViewer from "./ImageViewer";
import QuestionPanel from "./QuestionPanel";
import FeedbackModal from "./FeedbackModal";
import CoinChargeModal from "./CoinChargeModal";
import CoinConfirmModal from "./CoinConfirmModal";
import AuthModal from "./AuthModal";
import AlertModal from "./AlertModal";
import { useGameState } from "@/hooks/useGameState";
import { useAuth } from "@/contexts/AuthContext";
import { useCoins } from "@/hooks/useCoins";
import styles from "@/styles/components.module.css";

interface GameScreenProps {
  caseId: number;
  initialQuestionId?: number;
  onCaseComplete?: () => void;
  onOpenCaseList?: () => void;
  onGoToMain?: () => void;
}

export default function GameScreen({
  caseId,
  initialQuestionId = 1,
  onCaseComplete,
  onOpenCaseList,
  onGoToMain,
}: GameScreenProps) {
  const {
    currentQuestionId,
    showFeedback,
    isCorrect,
    showAnswer,
    caseData,
    currentQuestion,
    loading,
    handleAnswerCorrect,
    handleAnswerWrong,
    handleRetry,
    handleShowAnswer,
    handleNextQuestion,
  } = useGameState({ caseId, initialQuestionId });
  const { user, isAnonymousUser, getCurrentUserId } = useAuth();
  const { balance, spendCoins } = useCoins();
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCoinConfirmModal, setShowCoinConfirmModal] = useState(false);
  const [showLoginAlertModal, setShowLoginAlertModal] = useState(false);

  const getNextImageSrc = () => {
    if (!caseData || !currentQuestion) return undefined;

    if (currentQuestionId < caseData.questions.length) {
      return caseData.image;
    }

    return undefined;
  };

  if (loading) {
    return <div className={styles.gameScreen}>로딩 중...</div>;
  }

  if (!caseData || !currentQuestion) {
    return <div className={styles.gameScreen}>케이스를 찾을 수 없습니다.</div>;
  }

  const handleNext = async () => {
    const hasNext = await handleNextQuestion();
    if (!hasNext) {
      if (onCaseComplete) {
        onCaseComplete();
      } else {
        alert("모든 질문을 완료했습니다!");
      }
    }
  };

  const handleOpenCaseListClick = () => {
    if (onOpenCaseList) {
      onOpenCaseList();
    } else {
      window.location.href = "/";
    }
  };

  const handleGoToMainClick = () => {
    if (onGoToMain) {
      onGoToMain();
    } else {
      window.location.href = "/";
    }
  };

  const handleShowAnswerClick = async () => {
    const userId = getCurrentUserId();
    const requiredCoins = 3;

    // A. 비로그인 또는 익명 사용자 → 안내 모달 표시 후 로그인 모달
    if (!userId || !user || isAnonymousUser) {
      setShowLoginAlertModal(true);
      return;
    }

    // B. 로그인 + 코인 부족 → 코인 충전 모달 표시
    if (balance < requiredCoins) {
      setShowCoinModal(true);
      return;
    }

    // C. 로그인 + 코인 충분 → 확인 모달 표시
    setShowCoinConfirmModal(true);
  };

  const handleConfirmAnswerReveal = async () => {
    const userId = getCurrentUserId();
    if (!userId || !currentQuestionId) return;

    const result = await spendCoins(3, "answer_reveal", currentQuestionId);
    if (result.success) {
      handleShowAnswer();
    } else {
      alert(result.error || "코인 차감에 실패했습니다.");
    }
  };

  return (
    <div className={styles.gameScreen}>
      {/* 코인 잔액 및 충전 버튼 - 현재는 모든 사용자에게 숨김 처리 */}
      {/* Phase 3에서 코인 사용 기능 추가 시 필요 시점에만 표시하도록 확장 가능 */}
      {false && !isAnonymousUser && (
        <div className={styles.coinBalance}>
          <span className={styles.coinBalanceIcon}>🪙</span>
          <span className={styles.coinBalanceAmount}>{balance}코인</span>
          <button
            onClick={() => setShowCoinModal(true)}
            className={styles.coinChargeButton}
            aria-label="코인 충전"
          >
            충전
          </button>
        </div>
      )}
      <QuestionPanel
        questionText={currentQuestion.text}
        questionNumber={currentQuestionId}
        totalQuestions={caseData.questions.length}
      />
      <div className={styles.imageContainer}>
        <ImageViewer
          imageSrc={caseData.image}
          answerRegions={currentQuestion.answerRegions}
          onAnswerCorrect={handleAnswerCorrect}
          onAnswerWrong={handleAnswerWrong}
          nextImageSrc={getNextImageSrc()}
        />
      </div>
      <FeedbackModal
        isOpen={showFeedback}
        isCorrect={isCorrect}
        explanation={showAnswer ? currentQuestion.explanation : undefined}
        onRetry={handleRetry}
        onShowAnswer={handleShowAnswerClick}
        onNextQuestion={handleNext}
        onOpenCaseList={handleOpenCaseListClick}
        onGoToMain={handleGoToMainClick}
      />
      <CoinChargeModal
        isOpen={showCoinModal}
        onClose={() => setShowCoinModal(false)}
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
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      <CoinConfirmModal
        isOpen={showCoinConfirmModal}
        onClose={() => setShowCoinConfirmModal(false)}
        onConfirm={handleConfirmAnswerReveal}
        purpose="answer_reveal"
        requiredCoins={3}
      />
    </div>
  );
}
