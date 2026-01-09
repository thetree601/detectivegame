import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local 파일 명시적으로 로드
config({ path: resolve(process.cwd(), '.env.local') });

// postgres 패키지 사용 (PostgreSQL 직접 연결)
import postgres from 'postgres';

/**
 * 연결 문자열의 비밀번호를 URL 인코딩
 */
function encodePassword(url: string): string {
  // postgresql://postgres:PASSWORD@host:port/db 형식에서 비밀번호 부분만 인코딩
  const match = url.match(/^(postgresql:\/\/postgres:)([^@]+)(@.+)$/);
  if (match) {
    const [, prefix, password, suffix] = match;
    const encodedPassword = encodeURIComponent(password);
    return `${prefix}${encodedPassword}${suffix}`;
  }
  return url;
}

let databaseUrl = process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error('❌ SUPABASE_DB_URL 환경 변수가 필요합니다.');
  console.log('\n📋 Supabase Dashboard → Settings → Database → Connection string → URI 에서 연결 문자열을 복사하세요.');
  console.log('   예: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
  console.log('\n   .env.local 파일에 추가:');
  console.log('   SUPABASE_DB_URL=postgresql://...');
  console.log('\n   ⚠️  비밀번호에 특수문자가 있으면 URL 인코딩이 필요할 수 있습니다.');
  process.exit(1);
}

// 연결 문자열 검증 및 디버깅 정보 출력
console.log('🔍 연결 정보 확인 중...');
const urlMatch = databaseUrl.match(/postgresql:\/\/postgres:([^@]+)@([^:]+):(\d+)\/(.+)/);
if (urlMatch) {
  const [, password, host, port, database] = urlMatch;
  console.log(`   호스트: ${host}`);
  console.log(`   포트: ${port}`);
  console.log(`   데이터베이스: ${database}`);
  console.log(`   비밀번호: ${password.length > 0 ? '***' : '(없음)'}`);
  
  // 비밀번호가 이미 인코딩되어 있는지 확인
  const decodedPassword = decodeURIComponent(password);
  if (decodedPassword !== password) {
    console.log('   ℹ️  비밀번호가 이미 URL 인코딩되어 있습니다.');
  }
} else {
  console.warn('⚠️  연결 문자열 형식이 예상과 다를 수 있습니다.');
  console.log(`   입력된 URL: ${databaseUrl.substring(0, 30)}...`);
}

// 비밀번호 자동 인코딩 시도 (이미 인코딩되어 있으면 그대로 사용)
try {
  databaseUrl = encodePassword(databaseUrl);
} catch (e) {
  // 인코딩 실패 시 원본 사용
  console.warn('⚠️  비밀번호 인코딩 중 오류 발생, 원본 URL 사용');
}

const sql = postgres(databaseUrl, {
  max: 1, // 연결 풀 크기
  connect_timeout: 10, // 연결 타임아웃 10초
});

const migrationSQL = `
-- 사용자 진행 기록 테이블
CREATE TABLE IF NOT EXISTS user_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- 하위 호환성을 위해 유지 (더 이상 사용하지 않음)
  case_id BIGINT NOT NULL REFERENCES detective_puzzle_cases(id) ON DELETE CASCADE,
  current_question_id INTEGER NOT NULL DEFAULT 1,
  completed_questions JSONB DEFAULT '[]'::jsonb, -- 완료한 질문 ID 배열
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, case_id), -- 모든 사용자(익명 포함): user_id + case_id
  UNIQUE(session_id, case_id), -- 하위 호환성을 위해 유지
  CHECK (
    user_id IS NOT NULL
  )
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_session_id ON user_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_case_id ON user_progress(case_id);

-- RLS 정책
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 중복 방지)
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Anonymous users can view own session progress" ON user_progress;
DROP POLICY IF EXISTS "Anonymous users can insert own session progress" ON user_progress;
DROP POLICY IF EXISTS "Anonymous users can update own session progress" ON user_progress;

-- 모든 사용자(로그인/익명): 본인 데이터만 읽기/쓰기
-- 익명 인증 사용 시 auth.uid()가 익명 사용자의 UUID를 반환하므로 동일한 정책으로 처리
CREATE POLICY "Users can view own progress"
ON user_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
ON user_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
ON user_progress FOR UPDATE
USING (auth.uid() = user_id);
`;

async function migrateUserProgress() {
  console.log('🚀 user_progress 테이블 마이그레이션 시작...\n');

  // 연결 테스트
  try {
    await sql`SELECT 1`;
    console.log('✅ 데이터베이스 연결 성공\n');
  } catch (connectError: any) {
    console.error('❌ 데이터베이스 연결 실패:', connectError.message);
    throw connectError;
  }

  try {
    // SQL을 개별 명령어로 분리하여 실행
    // (CREATE TABLE과 CREATE POLICY는 함께 실행할 수 없으므로)
    
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await sql.unsafe(statement);
          console.log('✅ SQL 실행 완료');
        } catch (error: any) {
          // 이미 존재하는 경우 무시
          if (error.message?.includes('already exists') || 
              error.message?.includes('duplicate') ||
              error.code === '42P07' || // relation already exists
              error.code === '42710') { // duplicate object
            console.log('⚠️  이미 존재함 (건너뜀)');
          } else {
            console.error('❌ SQL 실행 실패:', error.message);
            throw error;
          }
        }
      }
    }

    console.log('\n🎉 user_progress 테이블 마이그레이션 완료!');
    
  } catch (error: any) {
    console.error('\n❌ 마이그레이션 중 오류 발생:', error.message);
    
    // 연결 오류인 경우 상세 안내
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
      console.log('\n🔧 연결 오류 해결 방법:');
      console.log('   1. Supabase Dashboard → Settings → Database에서 연결 문자열 확인');
      console.log('   2. 비밀번호에 특수문자가 있으면 URL 인코딩 필요 (예: @ → %40)');
      console.log('   3. 또는 Supabase의 직접 DB 연결이 제한되어 있을 수 있습니다');
      console.log('   4. 이 경우 아래 SQL을 Supabase Dashboard의 SQL Editor에서 직접 실행하세요\n');
    } else {
      console.log('\n📋 아래 SQL을 Supabase Dashboard의 SQL Editor에서 실행해주세요:\n');
    }
    
    console.log('='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80));
    process.exit(1);
  } finally {
    try {
      await sql.end();
    } catch (e) {
      // 연결이 안 된 경우 end()도 실패할 수 있음
    }
  }
}

migrateUserProgress().catch(console.error);
