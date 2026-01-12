"use client";

import { useCoins } from "@/hooks/useCoins";
import styles from "@/styles/components.module.css";

interface CoinConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  purpose: "answer_reveal" | "case_unlock";
  requiredCoins: number;
}

export default function CoinConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  purpose,
  requiredCoins,
}: CoinConfirmModalProps) {
  const { balance } = useCoins();
  const hasEnoughCoins = balance >= requiredCoins;

  if (!isOpen) return null;

  const getMessage = () => {
    if (purpose === "answer_reveal") {
      return `정답을 보시려면 ${requiredCoins}코인이 필요합니다. 구매하시겠습니까?`;
    } else {
      return `케이스를 보려면 ${requiredCoins}코인이 필요합니다. 결제하시겠습니까?`;
    }
  };

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const handleOverlayClick = () => {
    onClose();
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.feedbackModal} onClick={handleModalClick}>
        <div className={styles.modalContent}>
          <div className={styles.modalIcon}>🪙</div>
          <h2 className={styles.modalTitle}>코인 결제 확인</h2>
          <p className={styles.modalMessage}>{getMessage()}</p>
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "#f3f4f6",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <span style={{ color: "#6b7280" }}>현재 코인 잔액:</span>
              <span
                style={{
                  fontWeight: 600,
                  color: hasEnoughCoins ? "#16a34a" : "#dc2626",
                }}
              >
                {balance}코인
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#6b7280" }}>필요 코인:</span>
              <span style={{ fontWeight: 600, color: "#1f2937" }}>
                {requiredCoins}코인
              </span>
            </div>
            {!hasEnoughCoins && (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  background: "#fee2e2",
                  borderRadius: "0.375rem",
                  color: "#dc2626",
                  fontSize: "0.75rem",
                  textAlign: "center",
                }}
              >
                코인이 부족합니다. ({balance}/{requiredCoins})
              </div>
            )}
          </div>
        </div>
        <div className={styles.modalButtons}>
          <button onClick={onClose} className={styles.secondaryButton}>
            취소
          </button>
          <button
            onClick={handleConfirm}
            className={styles.primaryButton}
            disabled={!hasEnoughCoins}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
