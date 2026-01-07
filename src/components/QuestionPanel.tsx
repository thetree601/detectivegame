import styles from '@/styles/components.module.css';

interface QuestionPanelProps {
  questionText: string;
  questionNumber: number;
  totalQuestions: number;
}

export default function QuestionPanel({
  questionText,
  questionNumber,
  totalQuestions,
}: QuestionPanelProps) {
  return (
    <div className={styles.questionPanel}>
      <div className={styles.questionNumber}>
        질문 {questionNumber} / {totalQuestions}
      </div>
      <h2 className={styles.questionTitle}>
        {questionText}
      </h2>
      <p className={styles.questionHint}>
        이미지에서 정답을 찾아 클릭하세요.
      </p>
    </div>
  );
}