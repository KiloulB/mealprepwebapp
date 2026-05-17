"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/config";
import { recoverByCode } from "../../firebase/recoveryService";
import { checkOnboardingComplete } from "../../firebase/profileService";
import { IoKeyOutline, IoWarningOutline } from "react-icons/io5";
import styles from "../auth.module.css";

function formatInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.startsWith("PEAK")) {
    const rest = clean.slice(4);
    if (rest.length <= 4) return `PEAK-${rest}`;
    return `PEAK-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  }
  return clean.slice(0, 12);
}

export default function RecoverPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (raw: string) => {
    setCode(formatInput(raw));
    setError("");
  };

  const handleRecover = async () => {
    setError("");
    const trimmed = code.trim();
    if (trimmed.length < 12) { setError("Vul je volledige herstelcode in."); return; }
    setLoading(true);
    try {
      const result = await recoverByCode(trimmed);
      if (!result) {
        setError("Herstelcode niet herkend. Controleer of je hem goed hebt overgenomen.");
        return;
      }
      const email = `${result.username}@mealprep.local`;
      const cred = await signInWithEmailAndPassword(auth, email, `${result.pin}_mealprep`);
      const done = await checkOnboardingComplete(cred.user.uid);
      router.replace(done ? "/" : "/onboarding");
    } catch {
      setError("Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 21L9 5l5 8 3-5 6 13H1z" />
            </svg>
          </div>
          <div className={styles.logoName}>Peak</div>
        </div>

        <h1 className={styles.title}>Toegang herstellen</h1>
        <p className={styles.subtitle}>
          Vul je herstelcode in. Je wordt daarna automatisch ingelogd.
        </p>

        <div className={styles.formGroup}>
          <label className={styles.label}>Herstelcode</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}><IoKeyOutline size={16} /></span>
            <input
              className={`${styles.input} ${styles.inputMono}`}
              type="text"
              placeholder="PEAK-XXXX-XXXX"
              value={code}
              onChange={(e) => handleChange(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={14}
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <IoWarningOutline size={15} color="#ff6b6b" />
            <span className={styles.errorText}>{error}</span>
          </div>
        )}

        <button
          className={styles.primaryBtn}
          onClick={handleRecover}
          disabled={code.trim().length < 12 || loading}
        >
          {loading ? "Controleren…" : "Herstel toegang"}
        </button>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>of</span>
          <div className={styles.dividerLine} />
        </div>

        <div className={styles.switchRow}>
          <button className={styles.switchBtn} onClick={() => router.push("/auth")}>
            Terug naar inloggen
          </button>
        </div>
      </div>
    </div>
  );
}
