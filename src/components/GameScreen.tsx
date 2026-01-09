"use client";

import ImageViewer from "./ImageViewer";
import QuestionPanel from "./QuestionPanel";
import FeedbackModal from "./FeedbackModal";
import { useGameState } from "@/hooks/useGameState";
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

  return (
    <div className={styles.gameScreen}>
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
        onShowAnswer={handleShowAnswer}
        onNextQuestion={handleNext}
        onOpenCaseList={handleOpenCaseListClick}
        onGoToMain={handleGoToMainClick}
      />
    </div>
  );
}
