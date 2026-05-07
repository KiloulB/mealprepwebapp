"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import styles from "./HelpOverlay.module.css";

export interface HelpStep {
  title: string;
  description: React.ReactNode;
}

interface Props {
  steps: HelpStep[];
  onClose: () => void;
}

export default function HelpOverlay({ steps, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <span className={styles.counter}>{index + 1} van {steps.length}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Sluiten">
            <IoClose size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.stepTitle}>{step.title}</div>
          <div className={styles.stepDesc}>{step.description}</div>
        </div>

        <div className={styles.dots}>
          {steps.map((_, i) => (
            <div key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ""}`} />
          ))}
        </div>

        <div className={styles.footer}>
          {!isFirst ? (
            <button className={styles.prevBtn} onClick={() => setIndex((i) => i - 1)}>
              ← Vorige
            </button>
          ) : (
            <div />
          )}
          {isLast ? (
            <button className={styles.doneBtn} onClick={onClose}>Klaar</button>
          ) : (
            <button className={styles.nextBtn} onClick={() => setIndex((i) => i + 1)}>
              Volgende →
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
