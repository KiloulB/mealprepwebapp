"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IoChevronBack, IoCheckmark, IoWarningOutline, IoCopyOutline, IoCheckmarkOutline } from "react-icons/io5";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { saveOnboardingData } from "../firebase/profileService";
import {
  calcAge, calcBMR, calcDailyCalories, calcKgPerWeek,
  calcMacros, calcTDEE,
  type Gender, type GoalType, type JobType,
} from "../lib/nutritionCalc";
import styles from "./onboarding.module.css";

const SLEEP_OPTIONS = [5, 6, 7, 8, 9, 10];

type WeightUnit = "kg" | "lbs";

interface FormState {
  firstName: string; birthDate: string; gender: Gender | "";
  heightCm: string; weightKg: string; weightUnit: WeightUnit;
  sleepHours: number; jobType: JobType | ""; exerciseDays: number;
  goalType: GoalType | ""; targetWeightKg: string; weeks: number;
}

const INITIAL: FormState = {
  firstName: "", birthDate: "", gender: "",
  heightCm: "", weightKg: "", weightUnit: "kg",
  sleepHours: 7, jobType: "", exerciseDays: 3,
  goalType: "", targetWeightKg: "", weeks: 12,
};

const JOB_OPTIONS: { value: JobType; label: string; sub: string }[] = [
  { value: "sedentair", label: "Zittend werk",      sub: "Bureau, kantoor, weinig lopen" },
  { value: "licht",     label: "Licht actief werk", sub: "Retail, horeca, regelmatig staan" },
  { value: "actief",    label: "Zwaar werk",         sub: "Bouw, logistiek, lichamelijke arbeid" },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "Man",    label: "Man" },
  { value: "Vrouw",  label: "Vrouw" },
  { value: "Anders", label: "Anders / zeg ik liever niet" },
];

const GOAL_OPTIONS: { value: GoalType; label: string; sub: string }[] = [
  { value: "Toename", label: "Aankomen",           sub: "Spiermassa opbouwen" },
  { value: "Recomp",  label: "Body recomp",         sub: "Vet verliezen én spieren opbouwen" },
  { value: "Behoud",  label: "Op gewicht blijven",  sub: "Gewicht stabiel houden" },
  { value: "Afname",  label: "Afvallen",             sub: "Vetmassa verminderen" },
];

const GOAL_INFO: Record<string, string> = {
  Toename: "Caloriësurplus voor spieropbouw. Eiwit: 1,8 g/kg. Veilig tempo: max. 0,5 kg/week.",
  Recomp:  "Eet op TDEE met hoge eiwitinname (2,2 g/kg). Vet verliezen én spieren opbouwen. Werkt het best voor (her)starters.",
  Behoud:  "Eet precies wat je verbrandt. Stabiel gewicht, optimale prestaties.",
  Afname:  "Calorietekort met hoge eiwitinname (2,0 g/kg) om spiermassa te behouden. Veilig tempo: max. 0,75 kg/week.",
};

function toKg(value: string, unit: WeightUnit): number {
  const n = parseFloat(value) || 0;
  return unit === "lbs" ? Math.round((n / 2.205) * 10) / 10 : n;
}

export default function OnboardingPageWrapper() {
  return <Suspense><OnboardingPage /></Suspense>;
}

function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editMode = searchParams.get("mode") === "edit";

  const [uid, setUid] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("pendingRecoveryCode") ?? "" : ""
  );
  const [codeCopied, setCodeCopied] = useState(false);

  const effectiveTotalSteps = editMode ? 6 : recoveryCode ? 7 : 6;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { router.replace("/auth"); return; }
      setUid(user.uid);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!editMode || !uid) return;
    (async () => {
      const [profileSnap, planSnap] = await Promise.all([
        getDoc(doc(db, "users", uid, "settings", "profile")),
        getDoc(doc(db, "users", uid, "settings", "plan")),
      ]);
      const p = profileSnap.exists() ? profileSnap.data() : {};
      const pl = planSnap.exists() ? planSnap.data() : {};
      setForm((f) => ({
        ...f,
        firstName: p.firstName ?? f.firstName,
        birthDate: p.birthDate ?? f.birthDate,
        gender: (p.gender as Gender) ?? f.gender,
        heightCm: p.height ? String(p.height) : f.heightCm,
        weightKg: p.weight ? String(p.weight) : f.weightKg,
        weightUnit: (p.weightUnit as WeightUnit) ?? f.weightUnit,
        sleepHours: p.sleepHours ?? f.sleepHours,
        jobType: (p.jobType as JobType) ?? f.jobType,
        exerciseDays: p.exerciseDaysPerWeek ?? f.exerciseDays,
        goalType: (pl.goalType as GoalType) ?? f.goalType,
        targetWeightKg: pl.targetWeight ? String(pl.targetWeight) : f.targetWeightKg,
        weeks: f.weeks,
      }));
    })();
  }, [editMode, uid]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  // ── Live calculation ──────────────────────────────────────────────────────

  const weightKg  = useMemo(() => toKg(form.weightKg, form.weightUnit),       [form.weightKg, form.weightUnit]);
  const targetKg  = useMemo(() => toKg(form.targetWeightKg, form.weightUnit), [form.targetWeightKg, form.weightUnit]);
  const age       = useMemo(() => calcAge(form.birthDate),                     [form.birthDate]);

  const bmr = useMemo(() => {
    if (!form.gender || !weightKg || !form.heightCm) return 0;
    return calcBMR(weightKg, parseFloat(form.heightCm) || 0, age, form.gender as Gender);
  }, [form.gender, weightKg, form.heightCm, age]);

  const tdee = useMemo(() => {
    if (!bmr || !form.jobType) return 0;
    return calcTDEE(bmr, form.exerciseDays, form.jobType as JobType, form.sleepHours);
  }, [bmr, form.jobType, form.exerciseDays, form.sleepHours]);

  const kgPerWeek = useMemo(() => {
    if (!form.goalType || form.goalType === "Behoud" || form.goalType === "Recomp") return 0;
    return calcKgPerWeek(weightKg, targetKg, form.weeks);
  }, [form.goalType, weightKg, targetKg, form.weeks]);

  const dailyCalories = useMemo(() => {
    if (!tdee || !form.goalType) return 0;
    return calcDailyCalories(tdee, kgPerWeek, form.goalType as GoalType);
  }, [tdee, kgPerWeek, form.goalType]);

  const macros = useMemo(() => {
    if (!dailyCalories || !weightKg || !form.goalType) return null;
    return calcMacros(dailyCalories, weightKg, form.goalType as GoalType);
  }, [dailyCalories, weightKg, form.goalType]);

  const isAggressiveGain = kgPerWeek > 0.5  && form.goalType === "Toename";
  const isAggressiveLoss = kgPerWeek < -0.75 && form.goalType === "Afname";

  // ── Validation ────────────────────────────────────────────────────────────

  const birthdateError = useMemo(() => {
    if (!form.birthDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const birth = new Date(form.birthDate);
    if (birth >= today) return "Geboortedatum kan niet in de toekomst liggen.";
    const years = calcAge(form.birthDate);
    if (years < 13) return "Je moet minimaal 13 jaar oud zijn.";
    if (years > 110) return "Voer een geldige geboortedatum in.";
    return null;
  }, [form.birthDate]);

  const heightError = useMemo(() => {
    if (!form.heightCm) return null;
    const h = parseFloat(form.heightCm);
    if (isNaN(h) || h < 100 || h > 250) return "Geldige lengte: 100–250 cm.";
    return null;
  }, [form.heightCm]);

  const weightError = useMemo(() => {
    if (!form.weightKg) return null;
    const w = toKg(form.weightKg, form.weightUnit);
    if (w < 20 || w > 300) return `Geldig gewicht: 20–300 ${form.weightUnit}.`;
    return null;
  }, [form.weightKg, form.weightUnit]);

  const targetWeightError = useMemo(() => {
    if (!form.goalType || !form.targetWeightKg || !form.weightKg) return null;
    const target = toKg(form.targetWeightKg, form.weightUnit);
    if (form.goalType === "Toename" && target <= weightKg) return "Doelgewicht moet hoger zijn dan je huidige gewicht.";
    if (form.goalType === "Afname"  && target >= weightKg) return "Doelgewicht moet lager zijn dan je huidige gewicht.";
    return null;
  }, [form.goalType, form.targetWeightKg, form.weightKg, form.weightUnit, weightKg]);

  // ── Milestones ────────────────────────────────────────────────────────────

  const weekPreview = useMemo(() => {
    if (!form.goalType || form.goalType === "Behoud" || form.goalType === "Recomp") return [];
    if (!weightKg || !form.weeks) return [];
    const today = new Date();
    return Array.from({ length: form.weeks }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + (i + 1) * 7);
      return {
        week: i + 1,
        date: date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
        weight: Math.round((weightKg + kgPerWeek * (i + 1)) * 10) / 10,
      };
    });
  }, [form.goalType, form.weeks, weightKg, kgPerWeek]);

  const milestones = useMemo(() => {
    if (weekPreview.length === 0) return [];
    const mid = Math.floor((weekPreview.length - 1) / 2);
    return [
      { ...weekPreview[0],                       label: "Week 1" },
      { ...weekPreview[mid],                     label: `Week ${weekPreview[mid].week}` },
      { ...weekPreview[weekPreview.length - 1],  label: `Week ${form.weeks}` },
    ];
  }, [weekPreview, form.weeks]);

  // ── Step validation ───────────────────────────────────────────────────────

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return !!(form.firstName.trim() && form.birthDate && form.gender && !birthdateError);
      case 2: {
        const h = parseFloat(form.heightCm), w = toKg(form.weightKg, form.weightUnit);
        return !!(form.heightCm && h >= 100 && h <= 250 && form.weightKg && w >= 20 && w <= 300);
      }
      case 3: return !!form.jobType;
      case 4: {
        if (!form.goalType) return false;
        if (form.goalType === "Behoud" || form.goalType === "Recomp") return true;
        const target = toKg(form.targetWeightKg, form.weightUnit);
        if (!form.targetWeightKg || target <= 0) return false;
        if (form.goalType === "Toename" && target <= weightKg) return false;
        if (form.goalType === "Afname"  && target >= weightKg) return false;
        return true;
      }
      case 5: return form.weeks >= 4;
      case 6: return !!macros;
      case 7: return true;
      default: return false;
    }
  }, [step, form, macros, weightKg, birthdateError]);

  const next = () => {
    if (!canAdvance) { setError("Vul alle velden in om door te gaan."); return; }
    setError(""); setStep((s) => s + 1);
  };

  const back = async () => {
    setError("");
    if (step === 1) {
      if (editMode) { router.replace("/?tab=profile"); return; }
      await signOut(auth); router.replace("/auth"); return;
    }
    setStep((s) => s - 1);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleFinish = async () => {
    if (!uid || !macros || !form.goalType) return;
    setSaving(true);
    try {
      const goalAmount =
        form.goalType === "Behoud" || form.goalType === "Recomp" ? 0
          : Math.abs(parseFloat(form.targetWeightKg) - parseFloat(form.weightKg)) || 0;
      const goalDate = (() => {
        const d = new Date(); d.setDate(d.getDate() + form.weeks * 7);
        return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
      })();
      await saveOnboardingData(uid, {
        profile: {
          firstName: form.firstName.trim(), birthDate: form.birthDate.trim(),
          gender: form.gender, weight: weightKg,
          height: parseFloat(form.heightCm) || 0, weightUnit: form.weightUnit,
          sleepHours: form.sleepHours, jobType: form.jobType,
          exerciseDaysPerWeek: form.exerciseDays, onboardingComplete: true,
        },
        plan: {
          goalType: form.goalType, goalAmount, goalDate,
          startWeight: weightKg,
          targetWeight: form.goalType === "Behoud" || form.goalType === "Recomp" ? weightKg : targetKg,
          dailyCalories: macros.kcal,
          planName:
            form.goalType === "Toename" ? "Spieropbouw" :
            form.goalType === "Afname"  ? "Vetverlies"  :
            form.goalType === "Recomp"  ? "Body Recomp" : "Onderhoud",
          planDescription:
            form.goalType === "Toename" ? "Gericht op spieropbouw via een caloriësurplus en hoge eiwitinname." :
            form.goalType === "Afname"  ? "Gericht op vetverlies met behoud van spiermassa via een calorietekort en hoge eiwitinname." :
            form.goalType === "Recomp"  ? "Eten op TDEE met hoge eiwitinname (2,2 g/kg) voor gelijktijdig vetverlies en spieropbouw." :
                                          "Stabiel gewicht en optimale prestaties via onderhoudscalorieën.",
          weightHistory: [{ date: new Date().toISOString().split("T")[0], weight: weightKg }],
        },
        macros,
      });
      sessionStorage.removeItem("pendingRecoveryCode");
      router.replace(editMode ? "/?tab=profile" : "/?tab=gym");
    } catch {
      setError("Opslaan mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  if (!uid) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.content}>

        {/* Back + dots */}
        <button className={styles.backBtn} onClick={back}>
          <IoChevronBack size={15} />
          {editMode && step === 1 ? "Annuleren" : "Terug"}
        </button>

        {!editMode && (
          <div className={styles.stepDots}>
            {Array.from({ length: effectiveTotalSteps }, (_, i) => (
              <div
                key={i}
                className={[
                  styles.stepDot,
                  i === step - 1 ? styles.stepDotActive : "",
                  i < step - 1 ? styles.stepDotDone : "",
                ].join(" ")}
              />
            ))}
          </div>
        )}

        {/* ── Step 1: Identity ──────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className={styles.stepTitle}>Over jou</div>
            <div className={styles.stepSubtitle}>We gebruiken dit alleen om je plan te personaliseren.</div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Voornaam</label>
              <input className={styles.input} type="text" placeholder="Jouw naam"
                value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Geboortedatum</label>
              <input className={styles.input} type="date" value={form.birthDate}
                max={new Date().toISOString().split("T")[0]}
                min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 110); return d.toISOString().split("T")[0]; })()}
                onChange={(e) => set("birthDate", e.target.value)}
                style={{ colorScheme: "dark" }} />
              {birthdateError && <div className={styles.fieldError}>{birthdateError}</div>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Geslacht</label>
              <div className={styles.pickerCard}>
                {GENDER_OPTIONS.map((opt) => (
                  <div key={opt.value}
                    className={`${styles.pickerRow} ${form.gender === opt.value ? styles.pickerRowSelected : ""}`}
                    onClick={() => set("gender", opt.value)}>
                    <span className={styles.pickerRowLabel}>{opt.label}</span>
                    {form.gender === opt.value && <span className={styles.pickerCheck}><IoCheckmark size={18} /></span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Body ──────────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div className={styles.stepTitle}>Lichaamsmaten</div>
            <div className={styles.stepSubtitle}>Nodig voor een nauwkeurige berekening van je caloriebehoefte.</div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Eenheid</label>
              <div className={styles.unitToggle}>
                {(["kg", "lbs"] as WeightUnit[]).map((u) => (
                  <button key={u}
                    className={`${styles.unitToggleBtn} ${form.weightUnit === u ? styles.unitToggleBtnActive : ""}`}
                    onClick={() => set("weightUnit", u)}>{u}</button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Lengte</label>
              <div className={styles.inputWithUnit}>
                <input type="number" inputMode="decimal" placeholder=""
                  value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
                <span className={styles.inputUnit}>cm</span>
              </div>
              {heightError && <div className={styles.fieldError}>{heightError}</div>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Huidig gewicht</label>
              <div className={styles.inputWithUnit}>
                <input type="number" inputMode="decimal"
                  placeholder=""
                  value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
                <span className={styles.inputUnit}>{form.weightUnit}</span>
              </div>
              {weightError && <div className={styles.fieldError}>{weightError}</div>}
            </div>
          </>
        )}

        {/* ── Step 3: Lifestyle ─────────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div className={styles.stepTitle}>Jouw routine</div>
            <div className={styles.stepSubtitle}>Zo berekenen we hoeveel calorieën jij dagelijks verbrandt.</div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Uren slaap per nacht</label>
              <div className={styles.chipGroup}>
                {SLEEP_OPTIONS.map((h) => (
                  <button key={h}
                    className={`${styles.chip} ${form.sleepHours === h ? styles.chipActive : ""}`}
                    onClick={() => set("sleepHours", h)}>
                    {h}u
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Type werk</label>
              <div className={styles.pickerCard}>
                {JOB_OPTIONS.map((opt) => (
                  <div key={opt.value}
                    className={`${styles.pickerRow} ${form.jobType === opt.value ? styles.pickerRowSelected : ""}`}
                    onClick={() => set("jobType", opt.value)}>
                    <div style={{ flex: 1 }}>
                      <div className={styles.pickerRowLabel}>{opt.label}</div>
                      <div className={styles.pickerRowSub}>{opt.sub}</div>
                    </div>
                    {form.jobType === opt.value && <span className={styles.pickerCheck}><IoCheckmark size={18} /></span>}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Trainingen per week</label>
              <div className={styles.stepper}>
                <button className={styles.stepperBtn}
                  onClick={() => set("exerciseDays", Math.max(0, form.exerciseDays - 1))}
                  disabled={form.exerciseDays === 0}>−</button>
                <span className={styles.stepperValue}>{form.exerciseDays}</span>
                <button className={styles.stepperBtn}
                  onClick={() => set("exerciseDays", Math.min(7, form.exerciseDays + 1))}
                  disabled={form.exerciseDays === 7}>+</button>
              </div>
              <div className={styles.stepperLabel}>dagen per week</div>
            </div>
          </>
        )}

        {/* ── Step 4: Goal ──────────────────────────────────────────────────── */}
        {step === 4 && (
          <>
            <div className={styles.stepTitle}>Jouw doel</div>
            <div className={styles.stepSubtitle}>Kies wat bij jou past — je kunt dit later altijd aanpassen.</div>

            <div className={styles.formGroup}>
              <div className={styles.pickerCard}>
                {GOAL_OPTIONS.map((opt) => (
                  <div key={opt.value}
                    className={`${styles.pickerRow} ${form.goalType === opt.value ? styles.pickerRowSelected : ""}`}
                    onClick={() => { set("goalType", opt.value); set("targetWeightKg", ""); }}>
                    <div style={{ flex: 1 }}>
                      <div className={styles.pickerRowLabel}>{opt.label}</div>
                      <div className={styles.pickerRowSub}>{opt.sub}</div>
                    </div>
                    {form.goalType === opt.value && <span className={styles.pickerCheck}><IoCheckmark size={18} /></span>}
                  </div>
                ))}
              </div>
            </div>

            {form.goalType && (
              <div className={styles.goalInfoCard}>{GOAL_INFO[form.goalType]}</div>
            )}

            {form.goalType && form.goalType !== "Behoud" && form.goalType !== "Recomp" && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Doelgewicht</label>
                <div className={styles.inputWithUnit}>
                  <input type="number" inputMode="decimal"
                    placeholder={form.weightUnit === "kg" ? "75" : "165"}
                    value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} />
                  <span className={styles.inputUnit}>{form.weightUnit}</span>
                </div>
                {targetWeightError && <div className={styles.fieldError}>{targetWeightError}</div>}
              </div>
            )}
          </>
        )}

        {/* ── Step 5: Timeline ──────────────────────────────────────────────── */}
        {step === 5 && (
          <>
            <div className={styles.stepTitle}>Tijdlijn</div>
            <div className={styles.stepSubtitle}>Hoe snel wil je er komen? Duurzaam is beter dan snel.</div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Looptijd</label>
              <div className={styles.sliderWrap}>
                <div className={styles.sliderValue}>{form.weeks} weken</div>
                <div className={styles.sliderTrackWrap}>
                  <input type="range" className={styles.slider} min={4} max={52} step={1}
                    value={form.weeks} onChange={(e) => set("weeks", parseInt(e.target.value))} />
                </div>
                <div className={styles.sliderValueRow}>
                  <span className={styles.sliderMin}>4 weken</span>
                  <span className={styles.sliderMax}>52 weken</span>
                </div>
              </div>
            </div>

            <div className={styles.liveCard}>
              {form.goalType !== "Behoud" && form.goalType !== "Recomp" && (
                <div className={styles.liveRow}>
                  <span className={styles.liveLabel}>Gewichtsverandering</span>
                  <span className={styles.liveValueAccent}>{kgPerWeek > 0 ? "+" : ""}{kgPerWeek} {form.weightUnit}/week</span>
                </div>
              )}
              <div className={styles.liveRow}>
                <span className={styles.liveLabel}>Dagelijks calorie-doel</span>
                <span className={styles.liveValue}>{dailyCalories} kcal</span>
              </div>
              <div className={styles.liveRow}>
                <span className={styles.liveLabel}>Onderhoudsbehoefte (TDEE)</span>
                <span className={styles.liveValue}>{tdee} kcal</span>
              </div>
            </div>

            {(isAggressiveGain || isAggressiveLoss) && (
              <div className={styles.warning}>
                Let op: dit is een ambitieus tempo. Veilig is{" "}
                {form.goalType === "Toename" ? "max. 0,5 kg/week" : "max. 0,75 kg/week"}.
              </div>
            )}

            {milestones.length > 0 && (
              <div className={styles.milestoneRow}>
                {milestones.map((m, i) => (
                  <div key={i} className={`${styles.milestoneCard} ${i === milestones.length - 1 ? styles.milestoneCardEnd : ""}`}>
                    <div className={styles.milestoneLabel}>{m.label}</div>
                    <div className={styles.milestoneWeight}>{m.weight} {form.weightUnit}</div>
                    <div className={styles.milestoneDate}>{m.date}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Step 6: Result ────────────────────────────────────────────────── */}
        {step === 6 && macros && (
          <>
            <div className={styles.stepTitle}>Jouw plan</div>
            <div className={styles.stepSubtitle}>Persoonlijk berekend op basis van jouw lichaam en routine.</div>

            <div className={styles.sourceCard}>
              <div className={styles.sourceTitle}>Bronnen</div>
              <div className={styles.sourceItem}>• <strong>BMR:</strong> Mifflin-St Jeor (1990) — <em>Am J Clin Nutr</em></div>
              <div className={styles.sourceItem}>• <strong>Activiteit:</strong> Harris-Benedict PAL (Frankenfield, 2005) — <em>J Am Diet Assoc</em></div>
              <div className={styles.sourceItem}>• <strong>Slaap:</strong> Spiegel et al. (2004) — <em>Ann Intern Med</em></div>
              <div className={styles.sourceItem}>• <strong>Eiwit:</strong> Morton et al. (2018) — <em>Br J Sports Med</em></div>
            </div>

            <div className={styles.resultKcal}>{macros.kcal}</div>
            <div className={styles.resultKcalLabel}>kcal per dag</div>

            <div className={styles.macroRow}>
              <div className={`${styles.macroCard} ${styles.macroCardProtein}`}>
                <div className={`${styles.macroCardValue} ${styles.macroProtein}`}>{macros.protein}g</div>
                <div className={styles.macroCardLabel}>Eiwit</div>
              </div>
              <div className={`${styles.macroCard} ${styles.macroCardCarbs}`}>
                <div className={`${styles.macroCardValue} ${styles.macroCarbs}`}>{macros.carbs}g</div>
                <div className={styles.macroCardLabel}>Koolhydraten</div>
              </div>
              <div className={`${styles.macroCard} ${styles.macroCardFat}`}>
                <div className={`${styles.macroCardValue} ${styles.macroFat}`}>{macros.fat}g</div>
                <div className={styles.macroCardLabel}>Vet</div>
              </div>
            </div>

            <div className={styles.tdeeNote}>Onderhoudsbehoefte: {tdee} kcal/dag</div>
          </>
        )}

        {/* ── Step 7: Recovery code ──────────────────────────────────────────── */}
        {step === 7 && (
          <>
            <div className={styles.stepTitle}>Herstelcode</div>
            <div className={styles.stepSubtitle}>
              Gebruik deze code als je ooit je gebruikersnaam of PIN vergeet. Je kunt deze altijd terugvinden via Instellingen.
            </div>

            <div className={styles.recoverySection}>
              <div className={styles.recoveryWarning}>
                <IoWarningOutline size={14} />
                <span>Maak een screenshot of schrijf hem op.</span>
              </div>
              <div className={styles.recoveryCodeBox}>{recoveryCode}</div>
              <button className={styles.recoveryCopyBtn}
                onClick={async () => {
                  await navigator.clipboard.writeText(recoveryCode);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2500);
                }}>
                {codeCopied
                  ? <><IoCheckmarkOutline size={14} /> Gekopieerd</>
                  : <><IoCopyOutline size={14} /> Kopieer code</>}
              </button>
            </div>
          </>
        )}

        {error && <div className={styles.errorText}>{error}</div>}
      </div>

      <div className={styles.footer}>
        {step < effectiveTotalSteps ? (
          <button className={styles.primaryBtn} onClick={next} disabled={!canAdvance}>
            Volgende
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={handleFinish} disabled={saving || !macros}>
            {saving ? "Opslaan..." : editMode ? "Plan opslaan" : "Plan starten"}
          </button>
        )}
      </div>
    </div>
  );
}
