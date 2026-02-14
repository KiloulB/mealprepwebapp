// firebase/gymTemplateService.ts
import { db } from "./config";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import type { GymTemplate } from "../types/gym";

export async function createGymTemplate(uid: string, template: Omit<GymTemplate, "id">) {
  const colRef = collection(db, "users", uid, "gymTemplates");
  const docRef = await addDoc(colRef, template);
  return docRef.id;
}

export async function getGymTemplate(uid: string, templateId: string) {
  const ref = doc(db, "users", uid, "gymTemplates", templateId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as GymTemplate;
}

export function subscribeToGymTemplates(uid: string, cb: (rows: GymTemplate[]) => void) {
  const colRef = collection(db, "users", uid, "gymTemplates");
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as GymTemplate[]);
  });
}

export async function deleteGymTemplate(uid: string, templateId: string) {
  await deleteDoc(doc(db, "users", uid, "gymTemplates", templateId));
}
