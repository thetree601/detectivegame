-- ============================================
-- user_progress 테이블 마이그레이션 SQL
-- ============================================
-- 실행 방법: Supabase Dashboard → SQL Editor에서 이 파일의 내용을 복사하여 실행

-- 사용자 진행 기록 테이블
CREATE TABLE IF NOT EXISTS user_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- 비회원 사용자용 (localStorage에서 생성)
  case_id BIGINT NOT NULL REFERENCES detective_puzzle_cases(id) ON DELETE CASCADE,
  current_question_id INTEGER NOT NULL DEFAULT 1,
  completed_questions JSONB DEFAULT '[]'::jsonb, -- 완료한 질문 ID 배열
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, case_id), -- 로그인 사용자: user_id + case_id
  UNIQUE(session_id, case_id), -- 비회원: session_id + case_id
  CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR
    (user_id IS NULL AND session_id IS NOT NULL)
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

-- 로그인 사용자: 본인 데이터만 읽기/쓰기
CREATE POLICY "Users can view own progress"
ON user_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
ON user_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
ON user_progress FOR UPDATE
USING (auth.uid() = user_id);

-- 비회원: session_id로 읽기/쓰기 (anon 키로 접근 가능)
CREATE POLICY "Anonymous users can view own session progress"
ON user_progress FOR SELECT
USING (session_id IS NOT NULL);

CREATE POLICY "Anonymous users can insert own session progress"
ON user_progress FOR INSERT
WITH CHECK (session_id IS NOT NULL AND user_id IS NULL);

CREATE POLICY "Anonymous users can update own session progress"
ON user_progress FOR UPDATE
USING (session_id IS NOT NULL AND user_id IS NULL);
