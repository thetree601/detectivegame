"use client";

import { useState, useEffect, useCallback } from "react"; // useCallback 추가
import { useAuth } from "@/contexts/AuthContext";
import { useCoins } from "@/hooks/useCoins";
import { getCoinTransactions, CoinTransaction } from "@/utils/coins";
import CoinChargeModal from "./CoinChargeModal";
import styles from "@/styles/components.module.css";

interface MyPageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MyPageModal({ isOpen, onClose }: MyPageModalProps) {
  const { getCurrentUserId, isAnonymousUser } = useAuth();
  const { balance, refreshBalance } = useCoins();
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCoinModal, setShowCoinModal] = useState(false);

  // loadTransactions를 useCallback으로 감싸서 빌드 에러를 근본적으로 해결합니다.
  const loadTransactions = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId || isAnonymousUser) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getCoinTransactions(userId);
      setTransactions(data);
    } catch (error) {
      console.error("거래 내역 로드 실패:", error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId, isAnonymousUser]); // 의존성 추가

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen, loadTransactions]); // 이제 loadTransactions를 여기에 넣어도 안전합니다.

  const handleCoinChargeClose = async () => {
    setShowCoinModal(false);
    // 모달이 닫힐 때마다 잔액과 거래 내역 새로고침
    await refreshBalance();
    await loadTransactions();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  const getPurposeLabel = (
    purpose: string | null,
    transaction?: CoinTransaction
  ) => {
    switch (purpose) {
      case "coin_purchase":
        return "코인 충전";
      case "answer_reveal":
        if (
          transaction &&
          transaction.caseId !== undefined &&
          transaction.questionNumber !== undefined
        ) {
          // 여기서 transaction.caseTitle을 활용하면 더 정확한 이름이 나옵니다.
          const title = transaction.caseTitle || `케이스 ${transaction.caseId}`;
          return `정답 보기 (${title}, 질문 ${transaction.questionNumber})`;
        }
        return "정답 보기";
      case "case_unlock":
        return transaction?.caseTitle 
          ? `케이스 잠금 해제 (${transaction.caseTitle})`
          : "케이스 잠금 해제";
      default:
        return "기타";
    }
  };

  if (!isOpen) return null;

  const chargeTransactions = transactions.filter((t) => t.type === "charge");
  const spendTransactions = transactions.filter((t) => t.type === "spend");

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={styles.myPageModal}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.authModalHeader}>
            <h2 className={styles.authModalTitle}>마이페이지</h2>
            <button
              onClick={onClose}
              className={styles.authModalClose}
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div className={styles.myPageContent}>
            {isAnonymousUser ? (
              <div className={styles.modalContent}>
                <div className={styles.modalIcon}>👤</div>
                <p className={styles.modalMessage}>
                  마이페이지를 이용하려면 로그인이 필요합니다.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.myPageBalance}>
                  <div className={styles.myPageBalanceLabel}>현재 잔액</div>
                  <div className={styles.myPageBalanceAmount}>
                    <span className={styles.coinBalanceIcon}>🪙</span>
                    {balance}코인
                  </div>
                  <button
                    onClick={() => setShowCoinModal(true)}
                    className={styles.primaryButton}
                    style={{ marginTop: "1rem" }}
                  >
                    코인 충전
                  </button>
                </div>

                <div className={styles.transactionSection}>
                  <h3 className={styles.transactionSectionTitle}>
                    충전 내역
                  </h3>
                  {loading ? (
                    <div className={styles.transactionLoading}>로딩 중...</div>
                  ) : chargeTransactions.length === 0 ? (
                    <div className={styles.transactionEmpty}>
                      충전 내역이 없습니다.
                    </div>
                  ) : (
                    <div className={styles.transactionList}>
                      {chargeTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className={`${styles.transactionItem} ${styles.transactionTypeCharge}`}
                        >
                          <div className={styles.transactionItemMain}>
                            <div className={styles.transactionItemType}>
                              {getPurposeLabel(transaction.purpose)}
                            </div>
                            <div className={styles.transactionItemAmount}>
                              +{transaction.amount}코인
                            </div>
                          </div>
                          <div className={styles.transactionItemDate}>
                            {formatDate(transaction.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.transactionSection}>
                  <h3 className={styles.transactionSectionTitle}>사용 내역</h3>
                  {loading ? (
                    <div className={styles.transactionLoading}>로딩 중...</div>
                  ) : spendTransactions.length === 0 ? (
                    <div className={styles.transactionEmpty}>
                      사용 내역이 없습니다.
                    </div>
                  ) : (
                    <div className={styles.transactionList}>
                      {spendTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className={`${styles.transactionItem} ${styles.transactionTypeSpend}`}
                        >
                          <div className={styles.transactionItemMain}>
                            <div className={styles.transactionItemType}>
                              {getPurposeLabel(transaction.purpose, transaction)}
                            </div>
                            <div className={styles.transactionItemAmount}>
                              -{transaction.amount}코인
                            </div>
                          </div>
                          <div className={styles.transactionItemDate}>
                            {formatDate(transaction.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CoinChargeModal
        isOpen={showCoinModal}
        onClose={handleCoinChargeClose}
      />
    </>
  );
}