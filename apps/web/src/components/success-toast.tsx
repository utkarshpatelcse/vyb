"use client";

import { useEffect, useState } from "react";

interface SuccessToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function SuccessToast({ message, onDismiss }: SuccessToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const id = window.setTimeout(() => {
      setVisible(false);
      // wait for exit animation then clear
      const id2 = window.setTimeout(onDismiss, 320);
      return () => clearTimeout(id2);
    }, 2800);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`vyb-toast${visible ? " vyb-toast--visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="vyb-toast__icon" aria-hidden="true">✦</span>
      <span className="vyb-toast__text">{message}</span>
    </div>
  );
}
