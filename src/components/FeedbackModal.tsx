'use client';

import styles from '@/styles/components.module.css';

interface FeedbackModalProps {
  isOpen: boolean;
  isCorrect: boolean;
  explanation?: string;
  onRetry: () => void;
  onShowAnswer: () => void;
  onNextQuestion: () => void;
  onOpenCaseList?: () => void;
  onGoToMain?: () => void;
}

export default function FeedbackModal({
  isOpen,
  isCorrect,
  explanation,
  onRetry,
  onShowAnswer,
  onNextQuestion,
  onOpenCaseList,
  onGoToMain,
}: FeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.feedbackModal}>
        {isCorrect ? (
          <>
            <div className={styles.modalContent}>
              <div className={styles.modalIcon}>✅</div>
              <h2 className={`${styles.modalTitle} ${styles.modalTitleCorrect}`}>정답입니다!</h2>
              {explanation && (
                <p className={styles.modalExplanation}>{explanation}</p>
              )}
            </div>
            <button
              onClick={onNextQuestion}
              className={styles.primaryButton}
            >
              다음 질문으로
            </button>
          </>
        ) : (
          <>
            <div className={styles.modalContent}>
              <div className={styles.modalIcon}>❌</div>
              <h2 className={`${styles.modalTitle} ${styles.modalTitleWrong}`}>오답입니다</h2>
              <p className={styles.modalMessage}>다시 시도해보세요.</p>
            </div>
            <div className={styles.modalButtons}>
              <button
                onClick={onRetry}
                className={styles.secondaryButton}
              >
                재시도
              </button>
              <button
                onClick={onShowAnswer}
                className={styles.primaryButton}
              >
                정답 보기
              </button>
              <button
                onClick={onOpenCaseList}
                className={styles.tertiaryButton}
              >
                퀴즈 목록 보기
              </button>
              {onGoToMain && (
                <button
                  onClick={onGoToMain}
                  className={styles.tertiaryButton}
                >
                  메인 화면으로
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}