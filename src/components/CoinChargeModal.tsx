"use client";

import { useState } from "react";
import PortOne from "@portone/browser-sdk/v2";
import { COIN_PRODUCTS, CoinProduct } from "@/utils/coinProducts";
import { useAuth } from "@/contexts/AuthContext";
import { useCoins } from "@/hooks/useCoins";
import styles from "@/styles/components.module.css";

interface CoinChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * UUID 생성 함수
 */
function generatePaymentId(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)))
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

export default function CoinChargeModal({
  isOpen,
  onClose,
}: CoinChargeModalProps) {
  const [loading, setLoading] = useState<string | null>(null); // 현재 처리 중인 상품 ID
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ coins: number } | null>(null);
  const { getCurrentUserId } = useAuth();
  const { refreshBalance } = useCoins();

  if (!isOpen) return null;

  const handlePurchase = async (product: CoinProduct) => {
    const userId = getCurrentUserId();
    if (!userId) {
      setError("로그인이 필요합니다.");
      return;
    }

    setLoading(product.id);
    setError(null);
    setSuccess(null);

    try {
      const paymentId = generatePaymentId();
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

      if (!storeId || !channelKey) {
        throw new Error("포트원 설정이 완료되지 않았습니다.");
      }

      // 포트원 결제창 호출
      const payment = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId,
        orderName: product.name,
        totalAmount: product.price,
        currency: "KRW",
        payMethod: "CARD",
        customData: {
          productId: product.id,
        },
      });

      // 결제 실패 처리
      if (!payment || payment.code !== undefined) {
        setError(
          payment?.message || "결제에 실패했습니다."
        );
        setLoading(null);
        return;
      }

      // 결제 완료 API 호출
      const completeResponse = await fetch("/api/payment/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentId: payment.paymentId,
          userId,
        }),
      });

      // Content-Type 확인
      const contentType = completeResponse.headers.get("content-type");
      const isJson = contentType?.includes("application/json");

      if (!completeResponse.ok) {
        // JSON 응답인 경우에만 파싱 시도
        if (isJson) {
          try {
            const errorData = await completeResponse.json();
            
            // 서버 에러 응답 상세 정보 로깅
            console.error("서버 에러 응답:");
            console.error("   상태 코드:", completeResponse.status);
            console.error("   에러 데이터:", errorData);
            
            // 서버에서 반환한 error 필드를 우선적으로 사용
            const errorMessage = errorData.error || "코인 충전에 실패했습니다.";
            throw new Error(errorMessage);
          } catch (parseError) {
            // JSON 파싱 실패 시 기본 에러 메시지 사용
            console.error("JSON 파싱 실패:", parseError);
            throw new Error(
              `서버 오류가 발생했습니다. (${completeResponse.status})`
            );
          }
        } else {
          // HTML 또는 다른 형식의 응답인 경우
          const text = await completeResponse.text();
          console.error("서버 응답 (비-JSON):");
          console.error("   상태 코드:", completeResponse.status);
          console.error("   응답 내용:", text.substring(0, 200));
          throw new Error(
            `서버 오류가 발생했습니다. (${completeResponse.status})`
          );
        }
      }

      // 성공 응답 처리
      if (!isJson) {
        throw new Error("서버 응답 형식이 올바르지 않습니다.");
      }

      const result = await completeResponse.json();
      if (result.success) {
        setSuccess({ coins: result.coins });
        // 코인 잔액 새로고침
        await refreshBalance();
      } else {
        throw new Error(result.error || "코인 충전에 실패했습니다.");
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "예상치 못한 오류가 발생했습니다.";
      
      // 상세 에러 로깅
      console.error("코인 충전 중 오류:");
      console.error("   에러:", err);
      if (err instanceof Error) {
        console.error("   메시지:", err.message);
        console.error("   스택:", err.stack);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setLoading(null);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div
        className={styles.feedbackModal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.authModalHeader}>
          <h2 className={styles.authModalTitle}>코인 충전</h2>
          <button
            onClick={handleClose}
            className={styles.authModalClose}
            disabled={!!loading}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className={styles.modalContent}>
            <div className={styles.modalIcon}>✅</div>
            <h3 className={`${styles.modalTitle} ${styles.modalTitleCorrect}`}>
              충전 완료!
            </h3>
            <p className={styles.modalMessage}>
              {success.coins}코인이 충전되었습니다.
            </p>
            <button
              onClick={handleClose}
              className={styles.primaryButton}
              style={{ marginTop: "1rem" }}
            >
              확인
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className={styles.authModalError} style={{ marginBottom: "1rem" }}>
                {error}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              {COIN_PRODUCTS.map((product) => {
                const isProcessing = loading === product.id;
                return (
                  <div
                    key={product.id}
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#1f2937",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {product.name}
                      </div>
                      {product.discountRate > 0 && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#dc2626",
                            fontWeight: 600,
                          }}
                        >
                          {product.discountRate}% 할인
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        textAlign: "center",
                      }}
                    >
                      기본 {product.baseCoins}코인
                      {product.bonusCoins > 0 && (
                        <span style={{ color: "#16a34a" }}>
                          {" "}
                          + 보너스 {product.bonusCoins}코인
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "#2563eb",
                        textAlign: "center",
                        marginTop: "0.25rem",
                      }}
                    >
                      총 {product.totalCoins}코인
                    </div>

                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "#1f2937",
                        textAlign: "center",
                        marginTop: "0.5rem",
                      }}
                    >
                      {product.price.toLocaleString()}원
                    </div>

                    <button
                      onClick={() => handlePurchase(product)}
                      disabled={!!loading}
                      className={styles.primaryButton}
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.875rem",
                        padding: "0.5rem",
                      }}
                      aria-busy={isProcessing}
                    >
                      {isProcessing ? "처리 중..." : "구매하기"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                fontSize: "0.75rem",
                color: "#6b7280",
                textAlign: "center",
                marginTop: "1rem",
                padding: "0.75rem",
                background: "#f3f4f6",
                borderRadius: "0.5rem",
              }}
            >
              💳 테스트 결제: 카드 번호 1234-5678-9012-3456 사용 가능
            </div>
          </>
        )}
      </div>
    </div>
  );
}
