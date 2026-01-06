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
      <div className="bg-white p-6 shadow-lg">
        <div className="mb-2 text-sm text-gray-500">
          질문 {questionNumber} / {totalQuestions}
        </div>
        <h2 className="text-xl font-bold text-gray-800">{questionText}</h2>
        <p className="mt-4 text-sm text-gray-600">
          이미지에서 정답을 찾아 클릭하세요.
        </p>
      </div>
    );
  }