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
import { getPurchasedAnswers, getQuestionDbId, checkAnswerPurchased } from "@/utils/coins";
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

    console.log("[handleShowAnswerClick] 시작:", { userId, caseId, currentQuestionId, balance });

    // A. 비로그인 또는 익명 사용자 → 안내 모달 표시 후 로그인 모달
    if (!userId || !user || isAnonymousUser) {
      console.log("[handleShowAnswerClick] 비로그인 사용자");
      setAnswerAlertType("login");
      setShowAnswerAlertModal(true);
      return;
    }

    // 이미 구매한 정답인지 확인
    if (currentQuestionId) {
      console.log("[handleShowAnswerClick] 구매 기록 확인 시작:", { caseId, currentQuestionId, type: typeof currentQuestionId });
      
      // 방법 1: getPurchasedAnswers로 확인
      const purchasedAnswers = await getPurchasedAnswers(userId, caseId);
      console.log("[handleShowAnswerClick] 구매 기록 확인 결과:", { 
        purchasedAnswers, 
        currentQuestionId, 
        includes: purchasedAnswers.includes(currentQuestionId),
        purchasedAnswersTypes: purchasedAnswers.map(a => typeof a),
        currentQuestionIdType: typeof currentQuestionId
      });
      
      // 타입 안전성을 위해 명시적으로 숫자로 변환하여 비교
      const currentQuestionIdNum = Number(currentQuestionId);
      const purchasedAnswersNums = purchasedAnswers.map(a => Number(a));
      let isPurchased = purchasedAnswersNums.includes(currentQuestionIdNum);
      
      console.log("[handleShowAnswerClick] 타입 변환 후 비교:", {
        currentQuestionId,
        currentQuestionIdNum,
        purchasedAnswers,
        purchasedAnswersNums,
        isPurchased
      });
      
      // 방법 2: fallback - 질문 DB ID와 질문 번호로 직접 확인
      if (!isPurchased) {
        console.log("[handleShowAnswerClick] fallback 확인 시작");
        const questionDbId = await getQuestionDbId(caseId, currentQuestionId);
        console.log("[handleShowAnswerClick] 질문 DB ID:", questionDbId);
        
        if (questionDbId) {
          // 질문 DB ID와 질문 번호 모두 전달하여 확인
          isPurchased = await checkAnswerPurchased(userId, questionDbId, currentQuestionId);
          console.log("[handleShowAnswerClick] fallback 확인 결과:", isPurchased);
        }
      }
      
      if (isPurchased) {
        console.log("[handleShowAnswerClick] 이미 구매한 정답 - 바로 표시");
        // 이미 구매한 경우 코인 차감 없이 정답 표시
        handleShowAnswer();
        return;
      } else {
        console.log("[handleShowAnswerClick] 구매하지 않은 정답 - 구매 플로우 진행");
      }
    } else {
      console.log("[handleShowAnswerClick] currentQuestionId가 없음");
    }

    // B. 로그인 + 코인 부족 → 안내 모달 표시 후 코인 충전 모달
    if (balance < requiredCoins) {
      console.log("[handleShowAnswerClick] 코인 부족:", { balance, requiredCoins });
      setAnswerAlertType("coin_insufficient");
      setShowAnswerAlertModal(true);
      return;
    }

    // C. 로그인 + 코인 충분 → 안내 모달 표시 후 코인 차감 및 정답 노출
    console.log("[handleShowAnswerClick] 코인 충분 - 구매 확인 모달 표시");
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
            bottom: "2rem",
            right: "2rem",
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
