'use client';

import Image from 'next/image';
import { getCaseById } from '@/utils/caseLoader';

interface StartScreenProps {
  caseId: number;
  onStartGame: () => void;
}

export default function StartScreen({ caseId, onStartGame }: StartScreenProps) {
  const caseData = getCaseById(caseId);

  if (!caseData) {
    return <div>케이스를 찾을 수 없습니다.</div>;
  }

  // 시작 화면 전용 이미지 경로
  const startImagePath = '/images/그녀의_20260106_175453_0000.png';

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* 대표 이미지 영역 */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={startImagePath}
            alt="그녀의 명탐정 노트"
            fill
            className="object-cover opacity-90"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
        </div>
        
        {/* 타이틀 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pb-16">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-lg">
            그녀의 명탐정 노트
          </h1>
          <p className="text-gray-200 text-lg drop-shadow-md">
            총 {caseData.questions.length}개의 질문이 기다리고 있습니다
          </p>
        </div>
      </div>

      {/* 시작 버튼 영역 */}
      <div className="p-6 bg-gray-900 border-t border-gray-700">
        <button
          onClick={onStartGame}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 active:scale-[0.98]"
        >
          🕵️ 게임 시작하기
        </button>
      </div>
    </div>
  );
}