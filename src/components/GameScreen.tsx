"use client";

import { useState, useEffect } from "react";
import ImageViewer from "./ImageViewer";
import QuestionPanel from "./QuestionPanel";
import FeedbackModal from "./FeedbackModal";
import {
  getCaseById,
  getQuestionByCaseAndQuestionId,
} from "@/utils/caseLoader";
import { Case, Question } from "@/utils/types";
import styles from "@/styles/components.module.css";

interface GameScreenProps {
  caseId: number;
  initialQuestionId?: number;
  onCaseComplete?: () => void;
  onOpenCaseList?: () => void;
  onGoToMain?: () => void;
}

// 이미지 preload 유틸리티 함수 (개선: Set으로 중복 추적)
const preloadedImages = new Set<string>();

const preloadImage = (src: string) => {
  // 이미 preload된 이미지는 스킵
  if (preloadedImages.has(src)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = src;
  link.crossOrigin = "anonymous"; // CORS 문제 방지

  // 에러 처리
  link.onerror = () => {
    console.warn("이미지 preload 실패:", src);
    preloadedImages.delete(src);
  };

  document.head.appendChild(link);
  preloadedImages.add(src);
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
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  // 케이스 데이터 로드
  useEffect(() => {
    async function loadCase() {
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

  // 케이스 변경 시 첫 번째 질문으로 리셋
  useEffect(() => {
    setCurrentQuestionId(1);
    setShowFeedback(false);
    setShowAnswer(false);
    setIsCorrect(false);
  }, [caseId]);

  // 질문 변경 시 데이터 업데이트
  useEffect(() => {
    async function loadQuestion() {
      if (caseId && currentQuestionId) {
        const question = await getQuestionByCaseAndQuestionId(
          caseId,
          currentQuestionId
        );
        setCurrentQuestion(question || null);
      }
    }
    loadQuestion();
  }, [caseId, currentQuestionId]);

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

    // 다음 케이스 이미지 가져오기 (비동기 처리 필요하지만 일단 undefined 반환)
    return undefined;
  };

  if (loading) {
    return <div className={styles.gameScreen}>로딩 중...</div>;
  }

  if (!caseData || !currentQuestion) {
    return <div className={styles.gameScreen}>케이스를 찾을 수 없습니다.</div>;
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
        alert("모든 질문을 완료했습니다!");
      }
      setShowFeedback(false);
    }
  };

  const handleOpenCaseList = () => {
    if (onOpenCaseList) {
      onOpenCaseList();
    } else {
      window.location.href = "/";
    }
  };

  const handleGoToMain = () => {
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
