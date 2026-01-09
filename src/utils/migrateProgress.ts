import { supabase } from "./supabase";
import { UserProgress } from "./types";

/**
 * 익명 사용자의 진행 기록을 정식 계정으로 마이그레이션
 * 
 * @param anonymousUserId 익명 사용자의 user_id
 * @param newUserId 새로운 정식 계정의 user_id
 * @returns 마이그레이션 성공 여부
 */
export async function migrateAnonymousProgress(
  anonymousUserId: string,
  newUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      `[마이그레이션 시작] 익명: ${anonymousUserId} → 정식: ${newUserId}`
    );

    // 먼저 데이터베이스 함수를 사용하여 마이그레이션 시도 (더 안전하고 트랜잭션 보장)
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "migrate_anonymous_progress",
        {
          anonymous_user_id: anonymousUserId,
          new_user_id: newUserId,
        }
      );

      if (!rpcError && data) {
        const result = data as { success: boolean; error?: string; migrated_count?: number; merged_count?: number };
        if (result.success) {
          console.log(
            `[마이그레이션 완료] 이동: ${result.migrated_count || 0}, 병합: ${result.merged_count || 0}`
          );
          return { success: true };
        } else {
          console.warn(
            "[마이그레이션] 데이터베이스 함수 실패, 클라이언트 구현으로 폴백:",
            result.error
          );
          // 폴백: 클라이언트 구현으로 계속 진행
        }
      } else if (rpcError) {
        // 함수가 존재하지 않거나 권한 문제인 경우 클라이언트 구현으로 폴백
        console.warn(
          "[마이그레이션] 데이터베이스 함수 호출 실패, 클라이언트 구현으로 폴백:",
          rpcError.message
        );
        // 폴백: 클라이언트 구현으로 계속 진행
      }
    } catch (rpcErr) {
      // 함수가 존재하지 않는 경우 등 예외 처리
      console.warn(
        "[마이그레이션] 데이터베이스 함수 사용 불가, 클라이언트 구현으로 폴백:",
        rpcErr
      );
      // 폴백: 클라이언트 구현으로 계속 진행
    }

    // 클라이언트 구현 (폴백)
    // 1. 익명 사용자의 모든 진행 기록 조회
    const { data: anonymousProgress, error: fetchError } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", anonymousUserId);

    if (fetchError) {
      console.error("[마이그레이션] 익명 진행 기록 조회 실패:", fetchError);
      return {
        success: false,
        error: `익명 진행 기록 조회 실패: ${fetchError.message}`,
      };
    }

    if (!anonymousProgress || anonymousProgress.length === 0) {
      console.log("[마이그레이션] 마이그레이션할 진행 기록이 없습니다.");
      return { success: true };
    }

    console.log(
      `[마이그레이션] ${anonymousProgress.length}개의 진행 기록 발견`
    );

    // 2. 정식 계정의 기존 진행 기록 조회
    const { data: existingProgress, error: existingError } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", newUserId);

    if (existingError) {
      console.error("[마이그레이션] 정식 계정 진행 기록 조회 실패:", existingError);
      // 기존 기록 조회 실패해도 계속 진행 (없을 수도 있음)
    }

    // case_id별로 기존 기록 매핑
    const existingProgressMap = new Map<number, UserProgress>();
    if (existingProgress) {
      for (const progress of existingProgress) {
        existingProgressMap.set(progress.case_id, progress as UserProgress);
      }
    }

    // 3. 각 case_id별로 마이그레이션 처리
    const migrationResults = [];

    for (const anonymousRecord of anonymousProgress) {
      const caseId = anonymousRecord.case_id;
      const existingRecord = existingProgressMap.get(caseId);

      if (!existingRecord) {
        // 정식 계정에 기록이 없으면 → 익명 기록을 그대로 이동
        const { error: insertError } = await supabase
          .from("user_progress")
          .insert({
            user_id: newUserId,
            case_id: caseId,
            current_question_id: anonymousRecord.current_question_id,
            completed_questions: anonymousRecord.completed_questions || [],
            last_updated_at: anonymousRecord.last_updated_at,
            created_at: anonymousRecord.created_at,
          });

        if (insertError) {
          console.error(
            `[마이그레이션] 케이스 ${caseId} 이동 실패:`,
            insertError
          );
          migrationResults.push({
            caseId,
            success: false,
            error: insertError.message,
          });
        } else {
          console.log(`[마이그레이션] 케이스 ${caseId} 이동 완료`);
          migrationResults.push({ caseId, success: true });
        }
      } else {
        // 정식 계정에 기록이 있으면 → 병합
        const mergedRecord = mergeProgressRecords(
          anonymousRecord as UserProgress,
          existingRecord
        );

        const { error: updateError } = await supabase
          .from("user_progress")
          .update({
            current_question_id: mergedRecord.current_question_id,
            completed_questions: mergedRecord.completed_questions,
            last_updated_at: mergedRecord.last_updated_at,
          })
          .eq("user_id", newUserId)
          .eq("case_id", caseId);

        if (updateError) {
          console.error(
            `[마이그레이션] 케이스 ${caseId} 병합 실패:`,
            updateError
          );
          migrationResults.push({
            caseId,
            success: false,
            error: updateError.message,
          });
        } else {
          console.log(`[마이그레이션] 케이스 ${caseId} 병합 완료`);
          migrationResults.push({ caseId, success: true });
        }
      }
    }

    // 4. 익명 사용자의 진행 기록 삭제 (마이그레이션 완료 후)
    // RLS 정책 때문에 익명 계정으로는 삭제할 수 없을 수 있음
    // 정식 계정으로 전환된 후에는 익명 계정에 접근할 수 없으므로
    // 삭제는 선택사항 (데이터 정리 목적)
    try {
      const { error: deleteError } = await supabase
        .from("user_progress")
        .delete()
        .eq("user_id", anonymousUserId);

      if (deleteError) {
        console.warn(
          "[마이그레이션] 익명 진행 기록 삭제 실패 (무시됨):",
          deleteError
        );
        // 삭제 실패는 치명적이지 않음 (이미 마이그레이션 완료)
      } else {
        console.log("[마이그레이션] 익명 진행 기록 삭제 완료");
      }
    } catch (deleteErr) {
      console.warn(
        "[마이그레이션] 익명 진행 기록 삭제 중 오류 (무시됨):",
        deleteErr
      );
    }

    // 5. 결과 요약
    const successCount = migrationResults.filter((r) => r.success).length;
    const failCount = migrationResults.filter((r) => !r.success).length;

    console.log(
      `[마이그레이션 완료] 성공: ${successCount}, 실패: ${failCount}`
    );

    if (failCount > 0) {
      const errors = migrationResults
        .filter((r) => !r.success)
        .map((r) => `케이스 ${r.caseId}: ${r.error}`)
        .join("; ");
      return {
        success: false,
        error: `일부 마이그레이션 실패: ${errors}`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[마이그레이션] 예상치 못한 오류:", err);
    return {
      success: false,
      error: `마이그레이션 중 오류: ${errorMessage}`,
    };
  }
}

/**
 * 두 진행 기록을 병합
 * 
 * @param anonymousRecord 익명 사용자의 진행 기록
 * @param existingRecord 정식 계정의 기존 진행 기록
 * @returns 병합된 진행 기록
 */
function mergeProgressRecords(
  anonymousRecord: UserProgress,
  existingRecord: UserProgress
): {
  current_question_id: number;
  completed_questions: number[];
  last_updated_at: string;
} {
  // completed_questions: 두 배열의 합집합 (중복 제거)
  const anonymousCompleted = Array.isArray(anonymousRecord.completed_questions)
    ? anonymousRecord.completed_questions
    : [];
  const existingCompleted = Array.isArray(existingRecord.completed_questions)
    ? existingRecord.completed_questions
    : [];
  const mergedCompleted = Array.from(
    new Set([...anonymousCompleted, ...existingCompleted])
  ).sort((a, b) => a - b);

  // current_question_id: 더 높은 값 사용 (더 많이 진행한 쪽)
  const mergedCurrentQuestionId = Math.max(
    anonymousRecord.current_question_id,
    existingRecord.current_question_id
  );

  // last_updated_at: 더 최근 값 사용
  const anonymousDate = new Date(anonymousRecord.last_updated_at).getTime();
  const existingDate = new Date(existingRecord.last_updated_at).getTime();
  const mergedLastUpdatedAt =
    anonymousDate > existingDate
      ? anonymousRecord.last_updated_at
      : existingRecord.last_updated_at;

  return {
    current_question_id: mergedCurrentQuestionId,
    completed_questions: mergedCompleted,
    last_updated_at: mergedLastUpdatedAt,
  };
}
