import { useEffect, useState } from "react";
import {
  getCasesListOnly,
  getCases,
  getTotalQuestionsCount,
} from "@/utils/caseLoader";
import { Case } from "@/utils/types";
import { preloadImage, preloadImages } from "@/utils/imagePreloader";

interface UseCaseDataProps {
  caseId: number;
}

export function useCaseData({ caseId }: UseCaseDataProps) {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // 케이스 데이터 로드 (병렬 로딩으로 최적화)
  useEffect(() => {
    async function loadData() {
      try {
        // 1단계: 케이스 목록만 빠르게 가져오기
        const casesList = await getCasesListOnly();

        // 현재 케이스 찾기
        const currentCaseInfo = casesList.find((c) => c.id === caseId);
        if (currentCaseInfo) {
          // 케이스 기본 정보로 먼저 UI 표시 가능
          setCaseData({
            id: currentCaseInfo.id,
            title: currentCaseInfo.title,
            image: currentCaseInfo.image_url,
            questions: [],
          } as Case);

          // 현재 케이스 이미지 preload
          preloadImage(currentCaseInfo.image_url);
        }

        // 2단계: 모든 케이스 이미지 preload (비동기로 병렬 실행)
        preloadImages(casesList.map((caseInfo) => caseInfo.image_url));

        // 3단계: 질문 개수와 전체 데이터를 병렬로 실행
        const totalPromise = getTotalQuestionsCount();
        const casesPromise = getCases();

        // 질문 개수가 먼저 완료되면 즉시 표시
        totalPromise
          .then((total) => {
            setTotalQuestions(total);
          })
          .catch((error) => {
            console.error("질문 개수 로드 실패:", error);
          });

        // 전체 데이터가 완료되면 현재 케이스 업데이트
        casesPromise
          .then((allCases) => {
            const currentCase = allCases.cases.find((c) => c.id === caseId);
            if (currentCase) {
              setCaseData(currentCase);
            }
          })
          .catch((error) => {
            console.error("케이스 데이터 로드 실패:", error);
          });
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      }
    }
    loadData();
  }, [caseId]);

  // 현재 케이스 이미지 preload
  useEffect(() => {
    if (caseData) {
      preloadImage(caseData.image);
    }
  }, [caseData]);

  return {
    caseData,
    totalQuestions,
  };
}
