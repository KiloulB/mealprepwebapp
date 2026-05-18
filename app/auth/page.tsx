"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { checkOnboardingComplete, saveRegistrationProfile, updateProfile } from "../firebase/profileService";
import { saveToUserRegistry, ensureInUserRegistry } from "../firebase/adminService";
import { IoPersonOutline, IoWarningOutline } from "react-icons/io5";
import { generateRecoveryCode, saveRecoveryData } from "../firebase/recoveryService";
import styles from "./auth.module.css";

const PIN_LENGTH = 4;

function toFirebaseEmail(username: string) {
  return `${username.toLowerCase().trim()}@mealprep.local`;
}

function toFirebasePassword(pin: string) {
  return `${pin}_mealprep`;
}

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      onChange(value.slice(0, i - 1));
    }
  };

  const handleChange = (i: number, ch: string) => {
    const digit = ch.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, PIN_LENGTH);
    onChange(next);
    if (i < PIN_LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (pasted.length) {
      onChange(pasted);
      inputs.current[Math.min(pasted.length, PIN_LENGTH - 1)]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div className={styles.pinRow}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          className={`${styles.pinBox} ${value[i] ? styles.pinBoxFilled : ""}`}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          onPaste={i === 0 ? handlePaste : undefined}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

function validateUsername(u: string): string | null {
  const trimmed = u.toLowerCase().trim();
  if (!trimmed) return "Vul een gebruikersnaam in.";
  if (!/^[a-z0-9_]+$/.test(trimmed)) return "Alleen letters, cijfers en _ toegestaan.";
  if (trimmed.length < 3) return "Minimaal 3 tekens.";
  if (trimmed.length > 20) return "Maximaal 20 tekens.";
  return null;
}

export default function AuthPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const skipRedirect = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !skipRedirect.current) {
        const done = await checkOnboardingComplete(user.uid);
        router.replace(done ? "/" : "/onboarding");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const doSubmit = async (currentPin: string) => {
    setError("");
    const usernameErr = validateUsername(username);
    if (usernameErr) { setError(usernameErr); return; }

    const email = toFirebaseEmail(username);
    const password = toFirebasePassword(currentPin);

    setLoading(true);
    if (isSignUp) skipRedirect.current = true;
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const cleanUsername = username.toLowerCase().trim();
        await saveRegistrationProfile(cred.user.uid, cleanUsername, currentPin);
        await saveToUserRegistry(cred.user.uid, { username: cleanUsername, createdAt: Date.now() });
        const code = generateRecoveryCode();
        await saveRecoveryData(cred.user.uid, cleanUsername, currentPin, code);
        await updateProfile(cred.user.uid, { recoveryCode: code });
        sessionStorage.setItem("pendingRecoveryCode", code);
        router.replace("/onboarding");
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await ensureInUserRegistry(cred.user.uid, username.toLowerCase().trim());
        const done = await checkOnboardingComplete(cred.user.uid);
        router.replace(done ? "/" : "/onboarding");
      }
    } catch (err: unknown) {
      skipRedirect.current = false;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("email-already-in-use")) setError("Gebruikersnaam is al bezet.");
      else if (msg.includes("wrong-password") || msg.includes("invalid-credential")) setError("Onjuiste PIN.");
      else if (msg.includes("user-not-found")) setError("Geen account gevonden.");
      else setError("Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < PIN_LENGTH) { setError("Vul een 4-cijferige PIN in."); return; }
    doSubmit(pin);
  };

  const handlePinChange = (v: string) => {
    setPin(v);
    setError("");
    if (!isSignUp && v.length === PIN_LENGTH && !validateUsername(username)) {
      doSubmit(v);
    }
  };

  const canSubmit = username.trim().length >= 3 && pin.length === PIN_LENGTH && !loading;

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

        <h1 className={styles.title}>
          {isSignUp ? "Account aanmaken" : "Inloggen"}
        </h1>
        <p className={styles.subtitle}>
          {isSignUp ? "Maak je gratis account aan om te beginnen." : "Vul je gebruikersnaam en PIN in."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Gebruikersnaam</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <IoPersonOutline size={16} />
              </span>
              <input
                className={styles.input}
                type="text"
                placeholder="Gebruikersnaam"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className={styles.label} style={{ marginBottom: 0 }}>PIN-code</label>
              {!isSignUp && (
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={() => router.push("/auth/recover")}
                >
                  Vergeten?
                </button>
              )}
            </div>
            <div className={styles.pinWrap}>
              <PinInput value={pin} onChange={handlePinChange} />
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <IoWarningOutline size={15} color="#ff6b6b" />
              <span className={styles.errorText}>{error}</span>
            </div>
          )}

          <button type="submit" className={styles.primaryBtn} disabled={!canSubmit}>
            {loading ? "Laden…" : isSignUp ? "Account aanmaken" : "Aanmelden"}
          </button>
        </form>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>of</span>
          <div className={styles.dividerLine} />
        </div>

        <div className={styles.switchRow}>
          <span className={styles.switchText}>
            {isSignUp ? "Al een account?" : "Nog geen account?"}
          </span>
          <button
            className={styles.switchBtn}
            onClick={() => { setIsSignUp(!isSignUp); setError(""); setPin(""); }}
          >
            {isSignUp ? "Inloggen" : "Account aanmaken"}
          </button>
        </div>
      </div>
    </div>
  );
}
