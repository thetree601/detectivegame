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