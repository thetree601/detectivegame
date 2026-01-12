-- ============================================
-- 코인 시스템 마이그레이션 SQL
-- ============================================
-- 실행 방법: Supabase Dashboard → SQL Editor에서 이 파일의 내용을 복사하여 실행

-- ============================================
-- user_coins 테이블: 사용자별 코인 잔액
-- ============================================

CREATE TABLE IF NOT EXISTS user_coins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_coins_user_id ON user_coins(user_id);

-- RLS 정책
ALTER TABLE user_coins ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 중복 방지)
DROP POLICY IF EXISTS "Users can view own coins" ON user_coins;
DROP POLICY IF EXISTS "Users can insert own coins" ON user_coins;
DROP POLICY IF EXISTS "Users can update own coins" ON user_coins;

-- 사용자는 본인 코인 잔액만 읽기 가능
CREATE POLICY "Users can view own coins"
ON user_coins FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 본인 코인 잔액만 삽입 가능
CREATE POLICY "Users can insert own coins"
ON user_coins FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 본인 코인 잔액만 수정 가능
CREATE POLICY "Users can update own coins"
ON user_coins FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- coin_transactions 테이블: 코인 거래 내역
-- ============================================
-- Phase 2, 3에서 사용 예정

CREATE TABLE IF NOT EXISTS coin_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('charge', 'spend')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  purpose TEXT CHECK (purpose IN ('answer_reveal', 'case_unlock', 'coin_purchase')),
  related_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at);

-- RLS 정책
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 중복 방지)
DROP POLICY IF EXISTS "Users can view own transactions" ON coin_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON coin_transactions;

-- 사용자는 본인 거래 내역만 읽기 가능
CREATE POLICY "Users can view own transactions"
ON coin_transactions FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 본인 거래 내역만 삽입 가능
CREATE POLICY "Users can insert own transactions"
ON coin_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- unlocked_cases 테이블: 코인으로 구매한 케이스
-- ============================================
-- Phase 3에서 사용 예정

CREATE TABLE IF NOT EXISTS unlocked_cases (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id BIGINT NOT NULL REFERENCES detective_puzzle_cases(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, case_id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_unlocked_cases_user_id ON unlocked_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_cases_case_id ON unlocked_cases(case_id);

-- RLS 정책
ALTER TABLE unlocked_cases ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 중복 방지)
DROP POLICY IF EXISTS "Users can view own unlocked cases" ON unlocked_cases;
DROP POLICY IF EXISTS "Users can insert own unlocked cases" ON unlocked_cases;

-- 사용자는 본인이 구매한 케이스만 읽기 가능
CREATE POLICY "Users can view own unlocked cases"
ON unlocked_cases FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 본인이 구매한 케이스만 삽입 가능
CREATE POLICY "Users can insert own unlocked cases"
ON unlocked_cases FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- updated_at 자동 업데이트 함수 (user_coins 테이블용)
-- ============================================

CREATE OR REPLACE FUNCTION update_user_coins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (재실행 시 중복 방지)
DROP TRIGGER IF EXISTS trigger_update_user_coins_updated_at ON user_coins;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER trigger_update_user_coins_updated_at
  BEFORE UPDATE ON user_coins
  FOR EACH ROW
  EXECUTE FUNCTION update_user_coins_updated_at();
