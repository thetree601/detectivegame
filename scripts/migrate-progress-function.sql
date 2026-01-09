-- ============================================
-- 익명 진행 기록 마이그레이션을 위한 데이터베이스 함수
-- ============================================
-- 실행 방법: Supabase Dashboard → SQL Editor에서 이 파일의 내용을 복사하여 실행
--
-- 이 함수는 익명 사용자의 진행 기록을 정식 계정으로 마이그레이션합니다.
-- RLS 정책을 우회하여 안전하게 트랜잭션으로 처리합니다.
--
-- 사용법:
--   SELECT migrate_anonymous_progress(
--     '익명_user_id'::uuid,
--     '정식_user_id'::uuid
--   );

CREATE OR REPLACE FUNCTION migrate_anonymous_progress(
  anonymous_user_id UUID,
  new_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- RLS 정책 우회 (서버 권한으로 실행)
AS $$
DECLARE
  migrated_count INTEGER := 0;
  merged_count INTEGER := 0;
  error_message TEXT;
BEGIN
  -- 입력 검증
  IF anonymous_user_id IS NULL OR new_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '익명 user_id와 정식 user_id가 모두 필요합니다.'
    );
  END IF;

  IF anonymous_user_id = new_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '익명 user_id와 정식 user_id가 동일합니다.'
    );
  END IF;

  BEGIN
    -- 트랜잭션 시작 (함수 내부는 자동으로 트랜잭션)
    
    -- 1. 익명 사용자의 모든 진행 기록을 조회
    -- 2. 각 case_id별로 처리:
    --    - 정식 계정에 기록이 없으면 → 익명 기록을 그대로 이동
    --    - 정식 계정에 기록이 있으면 → 병합
    
    FOR record IN (
      SELECT * FROM user_progress
      WHERE user_id = anonymous_user_id
    ) LOOP
      -- 정식 계정에 같은 case_id의 기록이 있는지 확인
      DECLARE
        existing_record RECORD;
        merged_completed_questions INTEGER[];
        merged_current_question_id INTEGER;
        merged_last_updated_at TIMESTAMPTZ;
      BEGIN
        SELECT * INTO existing_record
        FROM user_progress
        WHERE user_id = new_user_id
          AND case_id = record.case_id
        LIMIT 1;

        IF existing_record IS NULL THEN
          -- 정식 계정에 기록이 없으면 → 익명 기록을 그대로 이동
          INSERT INTO user_progress (
            user_id,
            case_id,
            current_question_id,
            completed_questions,
            last_updated_at,
            created_at
          ) VALUES (
            new_user_id,
            record.case_id,
            record.current_question_id,
            record.completed_questions,
            record.last_updated_at,
            record.created_at
          )
          ON CONFLICT (user_id, case_id) DO NOTHING; -- 중복 방지
          
          migrated_count := migrated_count + 1;
        ELSE
          -- 정식 계정에 기록이 있으면 → 병합
          -- completed_questions: 두 배열의 합집합 (중복 제거)
          SELECT ARRAY(
            SELECT DISTINCT unnest(
              COALESCE(record.completed_questions, ARRAY[]::INTEGER[]) ||
              COALESCE(existing_record.completed_questions, ARRAY[]::INTEGER[])
            )
            ORDER BY 1
          ) INTO merged_completed_questions;

          -- current_question_id: 더 높은 값 사용
          merged_current_question_id := GREATEST(
            record.current_question_id,
            existing_record.current_question_id
          );

          -- last_updated_at: 더 최근 값 사용
          merged_last_updated_at := GREATEST(
            record.last_updated_at,
            existing_record.last_updated_at
          );

          -- 정식 계정의 기록 업데이트
          UPDATE user_progress
          SET
            current_question_id = merged_current_question_id,
            completed_questions = merged_completed_questions,
            last_updated_at = merged_last_updated_at
          WHERE user_id = new_user_id
            AND case_id = record.case_id;

          merged_count := merged_count + 1;
        END IF;
      END;
    END LOOP;

    -- 3. 익명 사용자의 진행 기록 삭제 (마이그레이션 완료 후)
    DELETE FROM user_progress
    WHERE user_id = anonymous_user_id;

    -- 성공 응답 반환
    RETURN jsonb_build_object(
      'success', true,
      'migrated_count', migrated_count,
      'merged_count', merged_count,
      'total_processed', migrated_count + merged_count
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- 에러 발생 시 롤백 (함수 내부 트랜잭션 자동 롤백)
      GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
      RETURN jsonb_build_object(
        'success', false,
        'error', error_message
      );
  END;
END;
$$;

-- 함수 실행 권한 부여 (인증된 사용자만 실행 가능)
-- RLS 정책은 함수 내부에서 처리되므로, 함수 자체는 인증된 사용자에게만 노출
GRANT EXECUTE ON FUNCTION migrate_anonymous_progress(UUID, UUID) TO authenticated;

-- 함수 설명 추가
COMMENT ON FUNCTION migrate_anonymous_progress(UUID, UUID) IS 
'익명 사용자의 진행 기록을 정식 계정으로 마이그레이션합니다. 트랜잭션으로 안전하게 처리하며, 같은 case_id가 있으면 병합합니다.';
