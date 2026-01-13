import { useState, useEffect, useCallback, useRef } from "react";
import {
  getCaseById,
  getQuestionByCaseAndQuestionId,
} from "@/utils/caseLoader";
import { Case, Question } from "@/utils/types";
import { preloadImage } from "@/utils/imagePreloader";
import { useProgress } from "./useProgress";

interface UseGameStateProps {
  caseId: number;
  initialQuestionId?: number;
}

export function useGameState({
  caseId,
  initialQuestionId = 1,
}: UseGameStateProps) {
  const [currentQuestionId, setCurrentQuestionId] = useState(initialQuestionId);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedQuestions, setCompletedQuestions] = useState<number[]>([]);
  const progressLoadedRef = useRef(false);

  const { saveProgress, loadProgress } = useProgress();

  // 케이스 변경 시 리셋 및 데이터 로드
  useEffect(() => {
    async function loadCase() {
      // 케이스 변경 시 상태 리셋
      setCurrentQuestionId(initialQuestionId);
      setShowFeedback(false);
      setShowAnswer(false);
      setIsCorrect(false);
      setLoading(true);
      setCompletedQuestions([]);
      progressLoadedRef.current = false;

      try {
        const case_ = await getCaseById(caseId);
        if (case_) {
          setCaseData(case_);

          // 진행 기록 불러오기
          const progress = await loadProgress(caseId);
          if (progress) {
            const savedCompleted = progress.completed_questions || [];
            const totalQuestions = case_.questions.length;
            
            // 케이스 완료 여부 확인: 모든 질문이 완료되었는지 확인
            const isCaseCompleted = 
              savedCompleted.length === totalQuestions && totalQuestions > 0;
            
            // 완료된 케이스는 첫 번째 질문부터 시작, 진행 중인 케이스는 저장된 질문부터 시작
            const startQuestionId = isCaseCompleted 
              ? initialQuestionId 
              : progress.current_question_id;

            setCurrentQuestionId(startQuestionId);
            setCompletedQuestions(savedCompleted);

            const question = await getQuestionByCaseAndQuestionId(
              caseId,
              startQuestionId
            );
            setCurrentQuestion(question || null);
          } else {
            // 진행 기록이 없으면 초기 질문부터 시작
            const question = await getQuestionByCaseAndQuestionId(
              caseId,
              initialQuestionId
            );
            setCurrentQuestion(question || null);

            // 케이스 전환 시 첫 번째 질문 상태를 저장하여 케이스 전환을 명시적으로 기록
            progressLoadedRef.current = true;
            try {
              await saveProgress(caseId, initialQuestionId, []);
            } catch (error) {
              console.error("케이스 전환 시 진행 기록 저장 실패:", error);
              // 에러가 발생해도 게임은 계속 진행
            }
          }

          if (progress) {
            progressLoadedRef.current = true;
          }
        }
      } catch (error) {
        console.error("케이스 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    }
    loadCase();
  }, [caseId, initialQuestionId, loadProgress, saveProgress]);

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

  const handleAnswerCorrect = useCallback(async () => {
    setIsCorrect(true);
    setShowFeedback(true);
    setShowAnswer(true);

    // 정답을 맞춘 질문을 completed_questions에 추가
    if (currentQuestionId && !completedQuestions.includes(currentQuestionId)) {
      const updatedCompleted = [...completedQuestions, currentQuestionId];
      setCompletedQuestions(updatedCompleted);

      // 진행 기록 저장 (비동기, 에러가 나도 게임은 계속 진행)
      if (progressLoadedRef.current && caseData) {
        try {
          // 마지막 질문 완료 시에도 진행 기록 저장 (케이스 완료 상태)
          await saveProgress(caseId, currentQuestionId, updatedCompleted);
        } catch (error) {
          console.error("진행 기록 저장 실패:", error);
          // 에러가 발생해도 게임은 계속 진행
        }
      }
    }
  }, [currentQuestionId, completedQuestions, caseId, saveProgress, caseData]);

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

  const handleNextQuestion = useCallback(async () => {
    if (caseData && currentQuestionId < caseData.questions.length) {
      const nextQuestionId = currentQuestionId + 1;
      setCurrentQuestionId(nextQuestionId);
      setShowFeedback(false);
      setShowAnswer(false);
      setIsCorrect(false);

      // 다음 질문으로 이동 시 진행 기록 저장
      if (progressLoadedRef.current) {
        try {
          await saveProgress(caseId, nextQuestionId, completedQuestions);
        } catch (error) {
          console.error("진행 기록 저장 실패:", error);
          // 에러가 발생해도 게임은 계속 진행
        }
      }

      return true; // 다음 질문이 있음
    }
    setShowFeedback(false);
    return false; // 모든 질문 완료
  }, [caseData, currentQuestionId, caseId, completedQuestions, saveProgress]);

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
