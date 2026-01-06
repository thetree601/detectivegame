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
    <div className="bg-white p-4 md:p-6 shadow-md border-b border-gray-200">
      <div className="mb-2 text-xs md:text-sm text-gray-500 font-medium">
        질문 {questionNumber} / {totalQuestions}
      </div>
      <h2 className="text-base md:text-xl font-bold text-gray-800 leading-relaxed">
        {questionText}
      </h2>
      <p className="mt-3 text-xs md:text-sm text-gray-600">
        이미지에서 정답을 찾아 클릭하세요.
      </p>
    </div>
  );
}