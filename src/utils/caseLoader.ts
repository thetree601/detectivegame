import { supabase } from "./supabase";
import { CasesData, Case, Question, AnswerRegion } from "./types";
import {
  getCasesCache,
  setCasesCache,
  getCaseCache,
  setCaseCache,
  findCaseInCache,
  getLoadingPromise,
  setLoadingPromise,
} from "./cache/caseCache";
import {
  getTotalQuestionsCache,
  setTotalQuestionsCache,
} from "./cache/storageCache";

/**
 * 케이스 목록만 빠르게 가져오기 (초기 로딩용)
 */
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

/**
 * 질문 개수만 빠르게 가져오기 (localStorage 캐싱 사용)
 */
export async function getTotalQuestionsCount(): Promise<number> {
  // 1. localStorage 캐시 확인
  const cachedCount = getTotalQuestionsCache();
  if (cachedCount !== null) {
    return cachedCount;
  }

  // 2. 메모리 캐시 확인
  const casesCache = getCasesCache();
  if (casesCache) {
    const total = casesCache.cases.reduce(
      (total, case_) => total + case_.questions.length,
      0
    );
    setTotalQuestionsCache(total);
    return total;
  }

  // 3. 캐시에 없으면 최적화된 쿼리로 질문 개수만 가져오기
  try {
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

    const { count, error: questionsError } = await supabase
      .from("detective_puzzle_questions")
      .select("*", { count: "exact", head: true })
      .in("case_id", approvedCaseIds);

    if (questionsError) {
      console.error("질문 개수 조회 실패:", questionsError);
      throw questionsError;
    }

    const total = count || 0;
    setTotalQuestionsCache(total);
    return total;
  } catch (error) {
    console.error("질문 개수 조회 실패:", error);
    return 0;
  }
}

/**
 * Question 배열을 변환하는 헬퍼 함수
 */
function transformQuestions(
  questions: Array<{
    id: number;
    question_number: number;
    text: string;
    explanation: string;
    case_id: number;
  }>,
  answerRegions: Array<{
    question_id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string | null;
  }>
): Question[] {
  return questions.map((q) => {
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
  });
}

/**
 * 단일 케이스를 변환하는 헬퍼 함수
 */
function transformCase(
  caseItem: {
    id: number;
    title: string;
    image_url: string;
  },
  questions: Question[]
): Case {
  return {
    id: caseItem.id,
    title: caseItem.title,
    image: caseItem.image_url,
    questions,
  } as Case;
}

/**
 * 데이터를 조합하여 Case 배열로 변환
 */
function combineCaseData(
  cases: Array<{ id: number; title: string; image_url: string }>,
  questions: Array<{
    id: number;
    question_number: number;
    text: string;
    explanation: string;
    case_id: number;
  }>,
  answerRegions: Array<{
    question_id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string | null;
  }>
): Case[] {
  const approvedCaseIds = new Set(cases.map((c) => c.id));
  const filteredQuestions =
    questions?.filter((q) => approvedCaseIds.has(q.case_id)) || [];
  const filteredAnswerRegions =
    answerRegions?.filter((r) =>
      filteredQuestions.some((q) => q.id === r.question_id)
    ) || [];

  return cases.map((caseItem) => {
    const caseQuestions = transformQuestions(
      filteredQuestions.filter((q) => q.case_id === caseItem.id),
      filteredAnswerRegions
    );
    return transformCase(caseItem, caseQuestions);
  });
}

/**
 * DB에서 모든 케이스 데이터 가져오기 (병렬 로딩으로 최적화)
 */
export async function getCases(): Promise<CasesData> {
  // 캐시 확인
  const cached = getCasesCache();
  if (cached) {
    return cached;
  }

  // 이미 로딩 중이면 기존 Promise 반환 (중복 요청 방지)
  const existingPromise = getLoadingPromise();
  if (existingPromise) {
    return existingPromise;
  }

  // 새로운 로딩 시작
  const promise = (async () => {
    try {
      // 병렬로 모든 데이터 가져오기
      const [casesResult, questionsResult, answerRegionsResult] =
        await Promise.all([
          supabase
            .from("detective_puzzle_cases")
            .select("*")
            .eq("status", "approved")
            .order("id"),
          supabase
            .from("detective_puzzle_questions")
            .select("*")
            .order("case_id")
            .order("question_number"),
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
        const result = { cases: [] };
        setCasesCache(result);
        return result;
      }

      if (questionsError) {
        console.error("질문 로드 실패:", questionsError);
        throw questionsError;
      }

      if (regionsError) {
        console.error("정답 영역 로드 실패:", regionsError);
        throw regionsError;
      }

      // 데이터 조합
      const casesWithQuestions = combineCaseData(
        cases,
        questions || [],
        answerRegions || []
      );

      const result = { cases: casesWithQuestions };
      setCasesCache(result);

      return result;
    } finally {
      setLoadingPromise(null);
    }
  })();

  setLoadingPromise(promise);
  return promise;
}

/**
 * 단일 케이스의 질문과 정답 영역을 조합하여 Case 객체로 변환
 */
function buildCaseFromData(
  caseItem: {
    id: number;
    title: string;
    image_url: string;
  },
  questions: Array<{
    id: number;
    question_number: number;
    text: string;
    explanation: string;
    case_id: number;
  }>,
  answerRegions: Array<{
    question_id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string | null;
  }>
): Case {
  const caseQuestions = transformQuestions(questions, answerRegions);
  return transformCase(caseItem, caseQuestions);
}

/**
 * 특정 케이스 가져오기 (getCases 캐시 우선 활용)
 */
export async function getCaseById(id: number): Promise<Case | undefined> {
  // 1. 개별 캐시 확인
  const cached = getCaseCache(id);
  if (cached) {
    return cached;
  }

  // 2. getCases 캐시 확인
  const foundInCache = findCaseInCache(id);
  if (foundInCache) {
    return foundInCache;
  }

  // 3. getCases가 로딩 중이면 기다리기
  const loadingPromise = getLoadingPromise();
  if (loadingPromise) {
    const allCases = await loadingPromise;
    const found = allCases.cases.find((c) => c.id === id);
    if (found) {
      setCaseCache(id, found);
      return found;
    }
  }

  // 4. 캐시에 없으면 개별 조회
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

  if (!questions || questions.length === 0) {
    const result = transformCase(caseItem, []);
    setCaseCache(id, result);
    return result;
  }

  const questionIds = questions.map((q) => q.id);
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

  const result = buildCaseFromData(caseItem, questions, answerRegions);
  setCaseCache(id, result);
  return result;
}

/**
 * 특정 케이스의 특정 질문 가져오기
 */
export async function getQuestionByCaseAndQuestionId(
  caseId: number,
  questionId: number
): Promise<Question | undefined> {
  const case_ = await getCaseById(caseId);
  return case_?.questions.find((q) => q.id === questionId);
}
