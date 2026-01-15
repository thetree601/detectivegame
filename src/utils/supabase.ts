// utils/supabase.ts (또는 현재 파일)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// 서버 전용 키 추가 (NEXT_PUBLIC이 붙지 않은 환경변수)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

// 1. 브라우저/일반 유저용 (RLS 적용됨)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 2. 서버 API 전용 관리자용 (RLS 무시/우회)
// 서버 환경에서만 생성되도록 조건부 처리
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase; // 키가 없으면 기본 클라이언트 사용 (방어 코드)