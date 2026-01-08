'use client';

import { useState, useEffect } from 'react';
import ImageViewer from './ImageViewer';
import QuestionPanel from './QuestionPanel';
import FeedbackModal from './FeedbackModal';
import { getCaseById, getQuestionByCaseAndQuestionId, getCases } from '@/utils/caseLoader';
import styles from '@/styles/components.module.css';

interface GameScreenProps {
  caseId: number;
  initialQuestionId?: number;
  onCaseComplete?: () => void;
  onOpenCaseList?: () => void;
  onGoToMain?: () => void;
}

// 이미지 preload 유틸리티 함수
const preloadImage = (src: string) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  const existing = document.querySelector(`link[href="${src}"]`);
  if (!existing) {
    document.head.appendChild(link);
  }
};

export default function GameScreen({
  caseId,
  initialQuestionId = 1,
  onCaseComplete,
  onOpenCaseList,
  onGoToMain,
}: GameScreenProps) {
  const [currentQuestionId, setCurrentQuestionId] = useState(initialQuestionId);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setCurrentQuestionId(1);
    setShowFeedback(false);
    setShowAnswer(false);
    setIsCorrect(false);
  }, [caseId]);

  const caseData = getCaseById(caseId);
  const currentQuestion = getQuestionByCaseAndQuestionId(
    caseId,
    currentQuestionId
  );

  // 케이스 변경 시 해당 이미지 즉시 preload
  useEffect(() => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  }, [caseData]);

  const getNextImageSrc = () => {
    if (!caseData || !currentQuestion) return undefined;

    if (currentQuestionId < caseData.questions.length) {
      return caseData.image;
    }

    const allCases = getCases();
    const currentCaseIndex = allCases.cases.findIndex(c => c.id === caseId);
    if (currentCaseIndex < allCases.cases.length - 1) {
      const nextCase = allCases.cases[currentCaseIndex + 1];
      return nextCase.image;
    }

    return undefined;
  };

  if (!caseData || !currentQuestion) {
    return <div>케이스를 찾을 수 없습니다.</div>;
  }

  const handleAnswerCorrect = () => {
    setIsCorrect(true);
    setShowFeedback(true);
    setShowAnswer(true);
  };

  const handleAnswerWrong = () => {
    setIsCorrect(false);
    setShowFeedback(true);
    setShowAnswer(false);
  };

  const handleRetry = () => {
    setShowFeedback(false);
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    setIsCorrect(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionId < caseData.questions.length) {
      setCurrentQuestionId(currentQuestionId + 1);
      setShowFeedback(false);
      setShowAnswer(false);
      setIsCorrect(false);
    } else {
      if (onCaseComplete) {
        onCaseComplete();
      } else {
        alert('모든 질문을 완료했습니다!');
      }
      setShowFeedback(false);
    }
  };

  const handleOpenCaseList = () => {
    if (onOpenCaseList) {
      onOpenCaseList();
    } else {
      window.location.href = '/';
    }
  };

  const handleGoToMain = () => {
    if (onGoToMain) {
      onGoToMain();
    } else {
      window.location.href = '/';
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
        isCorrect={isCorrect || showAnswer}
        explanation={showAnswer ? currentQuestion.explanation : undefined}
        onRetry={handleRetry}
        onShowAnswer={handleShowAnswer}
        onNextQuestion={handleNextQuestion}
        onOpenCaseList={handleOpenCaseList}
        onGoToMain={handleGoToMain}
      />
    </div>
  );
}