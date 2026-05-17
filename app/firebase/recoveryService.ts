import { db } from "./config";
import { doc, setDoc, getDoc } from "firebase/firestore";

// No O, I, 0, 1 — avoids visual ambiguity when reading the code aloud or handwritten.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode(): string {
  const seg = (n: number) =>
    Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
  return `PEAK-${seg(4)}-${seg(4)}`;
}

function normalize(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}

async function codeHash(code: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalize(code)));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function shiftPin(pin: string, hash: string, dir: 1 | -1): string {
  return pin
    .split("")
    .map((d, i) => ((parseInt(d) + dir * (parseInt(hash[i], 16) % 10) + 10) % 10).toString())
    .join("");
}

export const saveRecoveryData = async (
  uid: string,
  username: string,
  pin: string,
  code: string
): Promise<void> => {
  const hash = await codeHash(code);
  await setDoc(doc(db, "recovery", hash), {
    uid,
    username,
    encryptedPin: shiftPin(pin, hash, 1),
  });
};

// Returns username + plaintext PIN when the code is correct, null otherwise.
export const recoverByCode = async (
  code: string
): Promise<{ uid: string; username: string; pin: string } | null> => {
  const hash = await codeHash(code);
  const snap = await getDoc(doc(db, "recovery", hash));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: data.uid as string,
    username: data.username as string,
    pin: shiftPin(data.encryptedPin as string, hash, -1),
  };
};
