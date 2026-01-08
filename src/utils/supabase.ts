import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Supabase 클라이언트 생성 (브라우저에서 사용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 타입 안전성을 위한 타입 export (나중에 DB 스키마 생성 시 사용)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any; // TODO: Supabase에서 생성한 타입으로 교체 예정