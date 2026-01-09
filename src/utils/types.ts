export interface AnswerRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  }
  
  export interface Question {
    id: number;
    text: string;
    answerRegions: AnswerRegion[];
    explanation: string;
  }
  
  export interface Case {
    id: number;
    title: string;
    image: string;
    questions: Question[];
  }
  
  export interface CasesData {
    cases: Case[];
  }

  export interface UserProgress {
    id: number;
    user_id: string | null;
    session_id: string | null;
    case_id: number;
    current_question_id: number;
    completed_questions: number[];
    last_updated_at: string;
    created_at: string;
  }