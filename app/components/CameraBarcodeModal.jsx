"use client";

import React from "react";
import { useZxing } from "react-zxing";

export default function CameraBarcodeModal({ open, onClose, onDetected }) {
  const { ref } = useZxing({
    onDecodeResult(result) {
      onDetected(result.getText());
      onClose();
    },
    constraints: {
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    },
  });

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        zIndex: 9999,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: "#fff",
          margin: 16,
          padding: 12,
          borderRadius: 12,
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <h3 style={{ margin: 0 }}>Scan barcode</h3>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <video
          ref={ref}
          style={{ width: "100%", marginTop: 10, borderRadius: 10 }}
        />
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          Richt je camera op de streepjescode.
        </div>
      </div>
    </div>
  );
}
