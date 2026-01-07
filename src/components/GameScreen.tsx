'use client';

import { useState, useEffect } from 'react';
import ImageViewer from './ImageViewer';
import QuestionPanel from './QuestionPanel';
import FeedbackModal from './FeedbackModal';
import { getCaseById, getQuestionByCaseAndQuestionId } from '@/utils/caseLoader';
import styles from '@/styles/components.module.css';

interface GameScreenProps {
  caseId: number;
  initialQuestionId?: number;
  onCaseComplete?: () => void;
  onOpenCaseList?: () => void;
}

export default function GameScreen({
  caseId,
  initialQuestionId = 1,
  onCaseComplete,
  onOpenCaseList,
}: GameScreenProps) {
  const [currentQuestionId, setCurrentQuestionId] = useState(initialQuestionId);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  // 케이스가 변경되면 첫 번째 질문으로 리셋
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
      // 현재 케이스의 모든 질문 완료
      // onCaseComplete가 있으면 호출 (다음 케이스로 이동 또는 전체 완료 처리)
      if (onCaseComplete) {
        onCaseComplete();
      } else {
        // fallback: onCaseComplete가 없으면 기본 메시지
        alert('모든 질문을 완료했습니다!');
      }
      setShowFeedback(false);
    }
  };

  const handleOpenCaseList = () => {
    if (onOpenCaseList) {
      onOpenCaseList();
    } else {
      // fallback: 기존 동작 유지
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
      />
    </div>
  );
}