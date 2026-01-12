import { NextRequest, NextResponse } from "next/server";
import { PortOneClient } from "@portone/server-sdk";
import { chargeCoins } from "@/utils/coins";
import { getCoinProduct } from "@/utils/coinProducts";
import { supabase } from "@/utils/supabase";

/**
 * 포트원 클라이언트 초기화 (환경 변수 검증 포함)
 * @returns 포트원 클라이언트 인스턴스
 * @throws 환경 변수가 없으면 에러 발생
 */
function getPortOneClient() {
  const secret = process.env.PORTONE_V2_API_SECRET;
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  if (!secret) {
    // 개발 환경에서는 상세한 에러 메시지 제공
    const errorMessage = isDevelopment
      ? "PORTONE_V2_API_SECRET 환경 변수가 설정되지 않았습니다. .env.local 파일에 PORTONE_V2_API_SECRET=your_secret_key 형식으로 추가해주세요."
      : "PORTONE_V2_API_SECRET 환경 변수가 설정되지 않았습니다.";
    
    // 서버 로그에 환경 변수 상태 출력
    console.error("❌ 포트원 환경 변수 누락:");
    console.error("   PORTONE_V2_API_SECRET:", secret ? "✅ 설정됨" : "❌ 없음");
    if (isDevelopment) {
      console.error("💡 해결 방법: 프로젝트 루트의 .env.local 파일에 다음을 추가하세요:");
      console.error("   PORTONE_V2_API_SECRET=your_portone_v2_api_secret");
    }
    
    throw new Error(errorMessage);
  }

  return PortOneClient({
    secret,
  });
}

/**
 * 결제 검증
 * @param payment 포트원 결제 정보
 * @returns 검증 성공 여부
 */
function verifyPayment(payment: {
  channel: { type: string };
  customData?: string | null;
  orderName: string;
  amount: { total: number };
  currency: string;
}): boolean {
  // 테스트 모드에서는 channel.type이 "TEST"일 수 있음
  if (payment.channel.type !== "LIVE" && payment.channel.type !== "TEST") {
    return false;
  }

  // customData 확인
  if (!payment.customData) {
    return false;
  }

  try {
    const customData = JSON.parse(payment.customData);
    const product = getCoinProduct(customData.productId);

    if (product == null) {
      return false;
    }

    // 주문명, 금액, 통화 검증
    return (
      payment.orderName === product.name &&
      payment.amount.total === product.price &&
      payment.currency === "KRW"
    );
  } catch (e) {
    console.error("결제 검증 중 오류:", e);
    return false;
  }
}

/**
 * 문자열을 숫자로 변환 (해시 함수 사용)
 * @param str 입력 문자열
 * @returns 숫자 (BIGINT 범위 내)
 */
function stringToBigInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  // BIGINT 범위로 제한 (JavaScript Number.MAX_SAFE_INTEGER는 2^53-1)
  return Math.abs(hash % Number.MAX_SAFE_INTEGER);
}

/**
 * 중복 충전 방지: 이미 처리된 결제인지 확인
 * @param userId 사용자 ID
 * @param paymentId 포트원 결제 ID
 * @returns 이미 처리되었는지 여부
 */
async function isPaymentAlreadyProcessed(
  userId: string,
  paymentId: string
): Promise<boolean> {
  try {
    const relatedId = stringToBigInt(paymentId);
    const { data, error } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "charge")
      .eq("purpose", "coin_purchase")
      .eq("related_id", relatedId)
      .limit(1)
      .single();

    if (error) {
      // 데이터가 없으면 에러가 발생할 수 있음 (정상)
      if (error.code === "PGRST116") {
        return false; // 처리되지 않음
      }
      console.error("중복 확인 중 오류:", error);
      return false; // 에러 발생 시 재시도 가능하도록 false 반환
    }

    return !!data; // 데이터가 있으면 이미 처리됨
  } catch (err) {
    console.error("중복 확인 중 예상치 못한 오류:", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 개발 환경에서 환경 변수 상태 로그 출력
    const isDevelopment = process.env.NODE_ENV !== "production";
    if (isDevelopment) {
      const hasSecret = !!process.env.PORTONE_V2_API_SECRET;
      console.log("🔍 포트원 환경 변수 상태:");
      console.log("   PORTONE_V2_API_SECRET:", hasSecret ? "✅ 설정됨" : "❌ 없음");
      if (!hasSecret) {
        console.log("   💡 .env.local 파일에 PORTONE_V2_API_SECRET을 추가해주세요.");
      }
    }

    // 환경 변수 검증 및 포트원 클라이언트 초기화
    let portone;
    try {
      portone = getPortOneClient();
    } catch (envError) {
      const errorMessage = envError instanceof Error ? envError.message : "포트원 클라이언트 초기화 실패";
      console.error("포트원 클라이언트 초기화 실패:", errorMessage);
      
      // 개발 환경에서는 상세한 에러 메시지, 프로덕션에서는 일반적인 메시지
      return NextResponse.json(
        {
          success: false,
          error: isDevelopment
            ? errorMessage
            : "결제 시스템 설정 오류입니다. 관리자에게 문의하세요.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { paymentId, userId } = body;

    // 필수 파라미터 확인
    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { success: false, error: "올바르지 않은 요청입니다." },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, error: "사용자 정보가 없습니다." },
        { status: 401 }
      );
    }

    // 중복 충전 방지
    const alreadyProcessed = await isPaymentAlreadyProcessed(userId, paymentId);
    if (alreadyProcessed) {
      return NextResponse.json(
        { success: false, error: "이미 처리된 결제입니다." },
        { status: 400 }
      );
    }

    // 포트원 서버에서 결제 정보 조회
    let payment;
    try {
      payment = await portone.payment.getPayment({ paymentId });
    } catch (e: unknown) {
      console.error("포트원 결제 조회 실패:", e);
      return NextResponse.json(
        { success: false, error: "결제 정보를 조회할 수 없습니다." },
        { status: 400 }
      );
    }

    // 결제 상태 확인
    if (payment.status !== "PAID") {
      return NextResponse.json(
        { success: false, error: "결제가 완료되지 않았습니다." },
        { status: 400 }
      );
    }

    // 결제 검증
    if (!verifyPayment(payment)) {
      return NextResponse.json(
        { success: false, error: "결제 검증에 실패했습니다." },
        { status: 400 }
      );
    }

    // customData에서 상품 정보 가져오기
    if (!payment.customData) {
      return NextResponse.json(
        { success: false, error: "결제 정보가 올바르지 않습니다." },
        { status: 400 }
      );
    }
    const customData = JSON.parse(payment.customData);
    const product = getCoinProduct(customData.productId);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "상품 정보를 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    // 코인 충전
    const chargeResult = await chargeCoins(
      userId,
      product.totalCoins,
      paymentId
    );

    if (!chargeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: chargeResult.error || "코인 충전에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      coins: product.totalCoins,
      message: `${product.totalCoins}코인이 충전되었습니다.`,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "예상치 못한 오류가 발생했습니다.";
    console.error("결제 완료 처리 중 오류:", err);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
