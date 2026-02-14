// firebase/gymSessionQueries.ts
import { db } from "./config";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import type { GymSession } from "../types/gym";

export async function getLatestSessionForTemplate(uid: string, templateId: string) {
  const colRef = collection(db, "users", uid, "gymSessions");
  const q = query(
    colRef,
    where("templateId", "==", templateId),
    orderBy("startedAt", "desc"),
    limit(1)
  );

  const snap = await getDocs(q);
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...(d.data() as any) } as GymSession) : null;
}

export async function getPreviousSessionForTemplate(
  uid: string,
  templateId: string,
  excludeSessionId?: string
) {
  const colRef = collection(db, "users", uid, "gymSessions");

  // Grab top 2; pick the one that isn't the current session.
  // This keeps reads low and works with "latest" queries. [web:29]
  const q = query(
    colRef,
    where("templateId", "==", templateId),
    orderBy("startedAt", "desc"),
    limit(2)
  );

  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as GymSession));

  if (!excludeSessionId) return docs[0] ?? null;

  const found = docs.find((s) => s.id !== excludeSessionId);
  return found ?? null;
}
