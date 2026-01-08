import { supabase } from "./supabase";
import { CasesData, Case, Question, AnswerRegion } from "./types";

// 캐시 변수들
let casesCache: CasesData | null = null;
let casesCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 개별 케이스 캐시 (getCaseById용)
const caseCache = new Map<number, { data: Case; time: number }>();

// 로딩 중인 Promise 추적 (중복 요청 방지) - 추가
let loadingPromise: Promise<CasesData> | null = null;

// 케이스 목록만 빠르게 가져오기 (초기 로딩용) - 추가
export async function getCasesListOnly(): Promise<
  Array<{ id: number; title: string; image_url: string }>
> {
  const { data: cases, error: casesError } = await supabase
    .from("detective_puzzle_cases")
    .select("id, title, image_url")
    .eq("status", "approved")
    .order("id");

  if (casesError) {
    console.error("케이스 목록 로드 실패:", casesError);
    throw casesError;
  }

  return cases || [];
}

// 질문 개수 캐싱용 localStorage 키
const TOTAL_QUESTIONS_CACHE_KEY = "detective_game_total_questions";
const TOTAL_QUESTIONS_CACHE_TIME_KEY = "detective_game_total_questions_time";

// 질문 개수만 빠르게 가져오기 (localStorage 캐싱 사용)
export async function getTotalQuestionsCount(): Promise<number> {
  // 1. localStorage 캐시 확인 (페이지 새로고침 후에도 유지)
  if (typeof window !== "undefined") {
    try {
      const cachedCount = localStorage.getItem(TOTAL_QUESTIONS_CACHE_KEY);
      const cachedTime = localStorage.getItem(TOTAL_QUESTIONS_CACHE_TIME_KEY);

      if (cachedCount && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime, 10);
        if (cacheAge < CACHE_DURATION) {
          // 캐시가 유효하면 즉시 반환 (매우 빠름!)
          return parseInt(cachedCount, 10);
        }
      }
    } catch (error) {
      // localStorage 접근 실패 시 무시하고 계속 진행
      console.warn("localStorage 접근 실패:", error);
    }
  }

  // 2. 메모리 캐시 확인 (같은 세션 내에서)
  if (casesCache && Date.now() - casesCacheTime < CACHE_DURATION) {
    const total = casesCache.cases.reduce(
      (total, case_) => total + case_.questions.length,
      0
    );
    // localStorage에도 저장 (다음 접속 시 빠르게 사용)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TOTAL_QUESTIONS_CACHE_KEY, total.toString());
        localStorage.setItem(
          TOTAL_QUESTIONS_CACHE_TIME_KEY,
          Date.now().toString()
        );
      } catch {
        // localStorage 저장 실패 시 무시
      }
    }
    return total;
  }

  // 3. 캐시에 없으면 최적화된 쿼리로 질문 개수만 가져오기
  try {
    // 승인된 케이스 ID만 먼저 가져오기
    const { data: cases, error: casesError } = await supabase
      .from("detective_puzzle_cases")
      .select("id")
      .eq("status", "approved");

    if (casesError) {
      console.error("케이스 로드 실패:", casesError);
      throw casesError;
    }

    if (!cases || cases.length === 0) {
      return 0;
    }

    const approvedCaseIds = cases.map((c) => c.id);

    // 승인된 케이스의 질문 개수만 카운트 (정답 영역은 불필요)
    const { count, error: questionsError } = await supabase
      .from("detective_puzzle_questions")
      .select("*", { count: "exact", head: true })
      .in("case_id", approvedCaseIds);

    if (questionsError) {
      console.error("질문 개수 조회 실패:", questionsError);
      throw questionsError;
    }

    const total = count || 0;

    // localStorage에 캐시 저장 (다음 접속 시 빠르게 사용)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TOTAL_QUESTIONS_CACHE_KEY, total.toString());
        localStorage.setItem(
          TOTAL_QUESTIONS_CACHE_TIME_KEY,
          Date.now().toString()
        );
      } catch {
        // localStorage 저장 실패 시 무시
      }
    }

    return total;
  } catch (error) {
    console.error("질문 개수 조회 실패:", error);
    // 에러 발생 시 기본값 반환
    return 0;
  }
}

// DB에서 모든 케이스 데이터 가져오기 (병렬 로딩으로 최적화)
export async function getCases(): Promise<CasesData> {
  // 캐시가 있고 5분 이내면 캐시 반환
  if (casesCache && Date.now() - casesCacheTime < CACHE_DURATION) {
    return casesCache;
  }

  // 이미 로딩 중이면 기존 Promise 반환 (중복 요청 방지) - 추가
  if (loadingPromise) {
    return loadingPromise;
  }

  // 새로운 로딩 시작 - 수정
  loadingPromise = (async () => {
    try {
      // 병렬로 모든 데이터 가져오기 (순차적이 아닌 동시에)
      const [casesResult, questionsResult, answerRegionsResult] =
        await Promise.all([
          // 1. 승인된 케이스들 가져오기
          supabase
            .from("detective_puzzle_cases")
            .select("*")
            .eq("status", "approved")
            .order("id"),

          // 2. 모든 질문들 가져오기 (케이스 ID 없이 먼저 가져오기)
          supabase
            .from("detective_puzzle_questions")
            .select("*")
            .order("case_id")
            .order("question_number"),

          // 3. 모든 정답 영역들 가져오기
          supabase
            .from("detective_puzzle_answer_regions")
            .select("*")
            .order("question_id"),
        ]);

      const { data: cases, error: casesError } = casesResult;
      const { data: questions, error: questionsError } = questionsResult;
      const { data: answerRegions, error: regionsError } = answerRegionsResult;

      if (casesError) {
        console.error("케이스 로드 실패:", casesError);
        throw casesError;
      }

      if (!cases || cases.length === 0) {
        return { cases: [] };
      }

      // 승인된 케이스 ID만 필터링
      const approvedCaseIds = new Set(cases.map((c) => c.id));
      const filteredQuestions =
        questions?.filter((q) => approvedCaseIds.has(q.case_id)) || [];
      const filteredAnswerRegions =
        answerRegions?.filter((r) =>
          filteredQuestions.some((q) => q.id === r.question_id)
        ) || [];

      if (questionsError) {
        console.error("질문 로드 실패:", questionsError);
        throw questionsError;
      }

      if (regionsError) {
        console.error("정답 영역 로드 실패:", regionsError);
        throw regionsError;
      }

      // 데이터 조합
      const casesWithQuestions: Case[] = cases.map((caseItem) => {
        const caseQuestions = filteredQuestions
          .filter((q) => q.case_id === caseItem.id)
          .map((q) => {
            const questionAnswerRegions = filteredAnswerRegions
              .filter((r) => r.question_id === q.id)
              .map(
                (r): AnswerRegion => ({
                  x: Number(r.x),
                  y: Number(r.y),
                  width: Number(r.width),
                  height: Number(r.height),
                  description: r.description || "",
                })
              );

            return {
              id: q.question_number,
              text: q.text,
              answerRegions: questionAnswerRegions,
              explanation: q.explanation,
            } as Question;
          });

        return {
          id: caseItem.id,
          title: caseItem.title,
          image: caseItem.image_url,
          questions: caseQuestions,
        } as Case;
      });

      const result = { cases: casesWithQuestions };

      // 캐시 업데이트
      casesCache = result;
      casesCacheTime = Date.now();

      // 개별 케이스 캐시도 업데이트
      casesWithQuestions.forEach((case_) => {
        caseCache.set(case_.id, { data: case_, time: Date.now() });
      });

      return result;
    } finally {
      // 로딩 완료 후 Promise 초기화 - 추가
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

// 특정 케이스 가져오기 (getCases 캐시 우선 활용)
export async function getCaseById(id: number): Promise<Case | undefined> {
  // 1. 개별 캐시 확인
  const cached = caseCache.get(id);
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }

  // 2. getCases 캐시 확인 (더 효율적)
  if (casesCache && Date.now() - casesCacheTime < CACHE_DURATION) {
    const case_ = casesCache.cases.find((c) => c.id === id);
    if (case_) {
      // 개별 캐시도 업데이트
      caseCache.set(id, { data: case_, time: Date.now() });
      return case_;
    }
  }

  // 3. getCases가 로딩 중이면 기다리기 (캐시에 없을 때) - 추가
  if (loadingPromise) {
    const allCases = await loadingPromise;
    const case_ = allCases.cases.find((c) => c.id === id);
    if (case_) {
      caseCache.set(id, { data: case_, time: Date.now() });
      return case_;
    }
  }

  // 4. 캐시에 없으면 개별 조회 (최후의 수단)
  const { data: caseItem, error: caseError } = await supabase
    .from("detective_puzzle_cases")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (caseError || !caseItem) {
    console.error("케이스 로드 실패:", caseError);
    return undefined;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("detective_puzzle_questions")
    .select("*")
    .eq("case_id", id)
    .order("question_number");

  if (questionsError) {
    console.error("질문 로드 실패:", questionsError);
    throw questionsError;
  }

  const questionIds = questions?.map((q) => q.id) || [];
  let answerRegions: Array<{
    question_id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string | null;
  }> = [];

  if (questionIds.length > 0) {
    const { data: regions, error: regionsError } = await supabase
      .from("detective_puzzle_answer_regions")
      .select("*")
      .in("question_id", questionIds)
      .order("question_id");

    if (regionsError) {
      console.error("정답 영역 로드 실패:", regionsError);
      throw regionsError;
    }
    answerRegions = regions || [];
  }

  const caseQuestions =
    questions?.map((q) => {
      const questionAnswerRegions = answerRegions
        .filter((r) => r.question_id === q.id)
        .map(
          (r): AnswerRegion => ({
            x: Number(r.x),
            y: Number(r.y),
            width: Number(r.width),
            height: Number(r.height),
            description: r.description || "",
          })
        );

      return {
        id: q.question_number,
        text: q.text,
        answerRegions: questionAnswerRegions,
        explanation: q.explanation,
      } as Question;
    }) || [];

  const result = {
    id: caseItem.id,
    title: caseItem.title,
    image: caseItem.image_url,
    questions: caseQuestions,
  } as Case;

  // 캐시에 저장
  caseCache.set(id, { data: result, time: Date.now() });

  return result;
}

// 특정 케이스의 특정 질문 가져오기
export async function getQuestionByCaseAndQuestionId(
  caseId: number,
  questionId: number
): Promise<Question | undefined> {
  const case_ = await getCaseById(caseId);
  return case_?.questions.find((q) => q.id === questionId);
}
