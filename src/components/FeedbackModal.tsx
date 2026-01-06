'use client';

interface FeedbackModalProps {
  isOpen: boolean;
  isCorrect: boolean;
  explanation?: string;
  onRetry: () => void;
  onShowAnswer: () => void;
  onNextQuestion: () => void;
  onGoToQuizList: () => void;
}

export default function FeedbackModal({
  isOpen,
  isCorrect,
  explanation,
  onRetry,
  onShowAnswer,
  onNextQuestion,
  onGoToQuizList,
}: FeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4">
        {isCorrect ? (
          <>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-green-600 mb-4">정답입니다!</h2>
              {explanation && (
                <p className="text-gray-700 leading-relaxed">{explanation}</p>
              )}
            </div>
            <button
              onClick={onNextQuestion}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              다음 질문으로
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-red-600 mb-4">오답입니다</h2>
              <p className="text-gray-600">다시 시도해보세요.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={onRetry}
                className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                재시도
              </button>
              <button
                onClick={onShowAnswer}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                정답 보기
              </button>
              <button
                onClick={onGoToQuizList}
                className="w-full bg-gray-100 text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                퀴즈 목록 보기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}