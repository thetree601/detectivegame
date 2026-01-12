"use client";

import styles from "@/styles/components.module.css";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  message: string;
  icon?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  title = "알림",
  message,
  icon = "ℹ️",
}: AlertModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
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
          <div className={styles.modalIcon}>{icon}</div>
          <h2 className={styles.modalTitle}>{title}</h2>
          <p className={styles.modalMessage}>{message}</p>
        </div>
        <button onClick={handleConfirm} className={styles.primaryButton}>
          확인
        </button>
      </div>
    </div>
  );
}
