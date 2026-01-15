"use client";

import { useState } from "react";
import ImageViewer from "./ImageViewer";
import QuestionPanel from "./QuestionPanel";
import FeedbackModal from "./FeedbackModal";
import CoinChargeModal from "./CoinChargeModal";
import AuthModal from "./AuthModal";
import AlertModal from "./AlertModal";
import { useGameState } from "@/hooks/useGameState";
import { useAuth } from "@/contexts/AuthContext";
import { useCoins } from "@/hooks/useCoins";
import { getQuestionDbId, checkAnswerPurchased } from "@/utils/coins";
import styles from "@/styles/components.module.css";

interface GameScreenProps {
  caseId: number;
  initialQuestionId?: number;
  onCaseComplete?: () => void;
  onOpenCaseList?: () => void;
  onGoToMain?: () => void;
  onOpenMyPage?: () => void;
}

export default function GameScreen({
  caseId,
  initialQuestionId = 1,
  onCaseComplete,
  onOpenCaseList,
  onGoToMain,
  onOpenMyPage,
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
  const [showAnswerAlertModal, setShowAnswerAlertModal] = useState(false);
  const [answerAlertType, setAnswerAlertType] = useState<"login" | "coin_insufficient" | "coin_sufficient" | null>(null);

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
      setAnswerAlertType("login");
      setShowAnswerAlertModal(true);
      return;
    }

    // 1. [핵심 수정] 이 케이스의 이 질문만이 가진 '진짜 고유 ID'를 가져옵니다.
    const questionDbId = await getQuestionDbId(caseId, currentQuestionId);
    
    if (questionDbId) {
      // 2. 이제 1, 2, 3 같은 번호가 아니라, 고유한 ID로 구매 여부를 확인합니다.
      const isPurchased = await checkAnswerPurchased(userId, questionDbId);
      
      if (isPurchased) {
        // 이미 샀다면 코인 차감 없이 정답을 바로 보여줍니다.
        handleShowAnswer();
        return;
      }
    }

    // B. 코인 부족 시 안내 모달 표시
    if (balance < requiredCoins) {
      setAnswerAlertType("coin_insufficient");
      setShowAnswerAlertModal(true);
      return;
    }

    // C. 코인 충분 시 구매 확인 모달 표시
    setAnswerAlertType("coin_sufficient");
    setShowAnswerAlertModal(true);
  };

  const handleConfirmAnswerReveal = async () => {
    const userId = getCurrentUserId();
    if (!userId || !currentQuestionId) return;

    // 질문 번호로 질문의 DB ID 조회
    const questionDbId = await getQuestionDbId(caseId, currentQuestionId);
    if (!questionDbId) {
      alert("질문 정보를 찾을 수 없습니다.");
      return;
    }

    const result = await spendCoins(3, "answer_reveal", questionDbId);
    if (result.success) {
      handleShowAnswer();
    } else {
      alert(result.error || "코인 차감에 실패했습니다.");
    }
  };

  const getAnswerAlertMessage = () => {
    switch (answerAlertType) {
      case "login":
        return "정답 보기는 3코인이 필요합니다. 코인 충전을 위해 로그인을 해주세요.";
      case "coin_insufficient":
        return "정답 보기는 3코인이 필요합니다. 코인을 충전해주세요.";
      case "coin_sufficient":
        return "정답 보기는 3코인이 필요합니다. 구매하시겠습니까?";
      default:
        return "";
    }
  };

  const handleAnswerAlertConfirm = () => {
    setShowAnswerAlertModal(false);
    
    switch (answerAlertType) {
      case "login":
        setShowAuthModal(true);
        break;
      case "coin_insufficient":
        setShowCoinModal(true);
        break;
      case "coin_sufficient":
        handleConfirmAnswerReveal();
        break;
    }
  };

  return (
    <div className={styles.gameScreen}>
      {/* 프로필 아이콘 - 좌측 상단 */}
      {!isAnonymousUser && onOpenMyPage && (
        <button
          onClick={onOpenMyPage}
          className={styles.profileIconButton}
          style={{
            position: "absolute",
            bottom: "0.5rem",
            right: "0.5rem",
            zIndex: 10,
          }}
          aria-label="마이페이지"
        >
          👤
        </button>
      )}
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
        isOpen={showAnswerAlertModal}
        onClose={() => {
          setShowAnswerAlertModal(false);
          setAnswerAlertType(null);
        }}
        onConfirm={handleAnswerAlertConfirm}
        title="알림"
        message={getAnswerAlertMessage()}
        icon="🪙"
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
