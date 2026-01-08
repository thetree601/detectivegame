import { supabase } from './supabase';
import { CasesData, Case, Question, AnswerRegion } from './types';

// DB에서 모든 케이스 데이터 가져오기
export async function getCases(): Promise<CasesData> {
  // 1. 승인된 케이스들 가져오기
  const { data: cases, error: casesError } = await supabase
    .from('detective_puzzle_cases')
    .select('*')
    .eq('status', 'approved')
    .order('id');

  if (casesError) {
    console.error('케이스 로드 실패:', casesError);
    throw casesError;
  }

  if (!cases || cases.length === 0) {
    return { cases: [] };
  }

  // 2. 모든 질문들 가져오기
  const caseIds = cases.map((c) => c.id);
  const { data: questions, error: questionsError } = await supabase
    .from('detective_puzzle_questions')
    .select('*')
    .in('case_id', caseIds)
    .order('case_id')
    .order('question_number');

  if (questionsError) {
    console.error('질문 로드 실패:', questionsError);
    throw questionsError;
  }

  // 3. 모든 정답 영역들 가져오기
  const questionIds = questions?.map((q) => q.id) || [];
  const { data: answerRegions, error: regionsError } = await supabase
    .from('detective_puzzle_answer_regions')
    .select('*')
    .in('question_id', questionIds)
    .order('question_id');

  if (regionsError) {
    console.error('정답 영역 로드 실패:', regionsError);
    throw regionsError;
  }

  // 4. 데이터 조합
  const casesWithQuestions: Case[] = cases.map((caseItem) => {
    const caseQuestions = questions
      ?.filter((q) => q.case_id === caseItem.id)
      .map((q) => {
        const questionAnswerRegions = answerRegions
          ?.filter((r) => r.question_id === q.id)
          .map((r): AnswerRegion => ({
            x: Number(r.x),
            y: Number(r.y),
            width: Number(r.width),
            height: Number(r.height),
            description: r.description,
          })) || [];

        return {
          id: q.question_number,
          text: q.text,
          answerRegions: questionAnswerRegions,
          explanation: q.explanation,
        } as Question;
      }) || [];

    return {
      id: caseItem.id,
      title: caseItem.title,
      image: caseItem.image_url,
      questions: caseQuestions,
    } as Case;
  });

  return { cases: casesWithQuestions };
}

// 특정 케이스 가져오기
export async function getCaseById(id: number): Promise<Case | undefined> {
  const cases = await getCases();
  return cases.cases.find((case_) => case_.id === id);
}

// 특정 케이스의 특정 질문 가져오기
export async function getQuestionByCaseAndQuestionId(
  caseId: number,
  questionId: number
): Promise<Question | undefined> {
  const case_ = await getCaseById(caseId);
  return case_?.questions.find((q) => q.id === questionId);
}