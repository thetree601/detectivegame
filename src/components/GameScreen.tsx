'use client';

import { useState } from 'react';
import ImageViewer from './ImageViewer';
import QuestionPanel from './QuestionPanel';
import FeedbackModal from './FeedbackModal';
import { getCaseById, getQuestionByCaseAndQuestionId } from '@/utils/caseLoader';

interface GameScreenProps {
  caseId: number;
  initialQuestionId?: number;
}

export default function GameScreen({
  caseId,
  initialQuestionId = 1,
}: GameScreenProps) {
  const [currentQuestionId, setCurrentQuestionId] = useState(initialQuestionId);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

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
      // 모든 질문 완료
      alert('모든 질문을 완료했습니다!');
      setShowFeedback(false);
    }
  };

  const handleGoToQuizList = () => {
    // 메인 페이지로 이동 (나중에 구현)
    window.location.href = '/';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <QuestionPanel
        questionText={currentQuestion.text}
        questionNumber={currentQuestionId}
        totalQuestions={caseData.questions.length}
      />
      <div className="flex-1 relative overflow-hidden">
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
        onGoToQuizList={handleGoToQuizList}
      />
    </div>
  );
}