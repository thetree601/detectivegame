import { CasesData } from './types';
import casesData from '@/data/cases.json';

export function getCases(): CasesData {
  return casesData as CasesData;
}

export function getCaseById(id: number) {
  const data = getCases();
  return data.cases.find((case_) => case_.id === id);
}

export function getQuestionByCaseAndQuestionId(
  caseId: number,
  questionId: number
) {
  const case_ = getCaseById(caseId);
  return case_?.questions.find((q) => q.id === questionId);
}