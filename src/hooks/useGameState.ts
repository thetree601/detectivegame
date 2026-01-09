import { useState, useEffect, useCallback } from "react";
import {
  getCaseById,
  getQuestionByCaseAndQuestionId,
} from "@/utils/caseLoader";
import { Case, Question } from "@/utils/types";
import { preloadImage } from "@/utils/imagePreloader";

interface UseGameStateProps {
  caseId: number;
  initialQuestionId?: number;
}

export function useGameState({ caseId, initialQuestionId = 1 }: UseGameStateProps) {
  const [currentQuestionId, setCurrentQuestionId] = useState(initialQuestionId);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  // 케이스 변경 시 리셋 및 데이터 로드
  useEffect(() => {
    async function loadCase() {
      // 케이스 변경 시 상태 리셋
      setCurrentQuestionId(initialQuestionId);
      setShowFeedback(false);
      setShowAnswer(false);
      setIsCorrect(false);
      setLoading(true);

      try {
        const case_ = await getCaseById(caseId);
        if (case_) {
          setCaseData(case_);
          const question = await getQuestionByCaseAndQuestionId(
            caseId,
            initialQuestionId
          );
          setCurrentQuestion(question || null);
        }
      } catch (error) {
        console.error("케이스 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    }
    loadCase();
  }, [caseId, initialQuestionId]);

  // 질문 변경 시 데이터 업데이트
  useEffect(() => {
    async function loadQuestion() {
      if (caseId && currentQuestionId && caseData) {
        const question = await getQuestionByCaseAndQuestionId(
          caseId,
          currentQuestionId
        );
        setCurrentQuestion(question || null);
      }
    }
    loadQuestion();
  }, [caseId, currentQuestionId, caseData]);

  // 케이스 변경 시 해당 이미지 즉시 preload
  useEffect(() => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  }, [caseData]);

  const handleAnswerCorrect = useCallback(() => {
    setIsCorrect(true);
    setShowFeedback(true);
    setShowAnswer(true);
  }, []);

  const handleAnswerWrong = useCallback(() => {
    setIsCorrect(false);
    setShowFeedback(true);
    setShowAnswer(false);
  }, []);

  const handleRetry = useCallback(() => {
    setShowFeedback(false);
  }, []);

  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true);
    setIsCorrect(true);
  }, []);

  const handleNextQuestion = useCallback(() => {
    if (caseData && currentQuestionId < caseData.questions.length) {
      setCurrentQuestionId(currentQuestionId + 1);
      setShowFeedback(false);
      setShowAnswer(false);
      setIsCorrect(false);
      return true; // 다음 질문이 있음
    }
    setShowFeedback(false);
    return false; // 모든 질문 완료
  }, [caseData, currentQuestionId]);

  return {
    // State
    currentQuestionId,
    showFeedback,
    isCorrect: isCorrect || showAnswer,
    showAnswer,
    caseData,
    currentQuestion,
    loading,
    // Handlers
    handleAnswerCorrect,
    handleAnswerWrong,
    handleRetry,
    handleShowAnswer,
    handleNextQuestion,
  };
}
