"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IoChevronBack, IoCheckmark } from "react-icons/io5";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { saveOnboardingData } from "../firebase/profileService";
import {
  calcAge,
  calcBMR,
  calcDailyCalories,
  calcKgPerWeek,
  calcMacros,
  calcTDEE,
  type Gender,
  type GoalType,
  type JobType,
} from "../lib/nutritionCalc";
import styles from "./onboarding.module.css";

const TOTAL_STEPS = 6;

type WeightUnit = "kg" | "lbs";

interface FormState {
  // Step 1 — Identity
  firstName: string;
  birthDate: string;
  gender: Gender | "";
  // Step 2 — Body
  heightCm: string;
  weightKg: string;
  weightUnit: WeightUnit;
  // Step 3 — Lifestyle
  sleepHours: number;
  jobType: JobType | "";
  exerciseDays: number;
  // Step 4 — Goal
  goalType: GoalType | "";
  targetWeightKg: string;
  // Step 5 — Timeline
  weeks: number;
}

const INITIAL: FormState = {
  firstName: "", birthDate: "", gender: "",
  heightCm: "", weightKg: "", weightUnit: "kg",
  sleepHours: 7, jobType: "", exerciseDays: 3,
  goalType: "", targetWeightKg: "",
  weeks: 12,
};

const JOB_OPTIONS: { value: JobType; label: string; sub: string }[] = [
  { value: "sedentair", label: "Sedentair", sub: "Bureau / kantoorwerk, weinig beweging" },
  { value: "licht", label: "Licht actief", sub: "Staand of lopend werk (bijv. retail, horeca)" },
  { value: "actief", label: "Actief", sub: "Lichamelijk werk (bijv. bouw, logistiek)" },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "Man", label: "Man" },
  { value: "Vrouw", label: "Vrouw" },
  { value: "Anders", label: "Anders / Zeg ik liever niet" },
];

const GOAL_OPTIONS: { value: GoalType; label: string; sub: string }[] = [
  { value: "Toename", label: "Aankomen", sub: "Spiermassa opbouwen of gewicht toevoegen" },
  { value: "Recomp", label: "Body recomp", sub: "Tegelijk vet verliezen én spieren opbouwen" },
  { value: "Behoud", label: "Op gewicht blijven", sub: "Gewicht stabiel houden" },
  { value: "Afname", label: "Afvallen", sub: "Vetmassa verminderen" },
];

const GOAL_INFO: Record<string, string> = {
  Toename:
    "Je eet méér dan je verbrandt. Het calorie-surplus geeft je lichaam de energie om spiermassa op te bouwen. Eiwitinname: 1,8 g/kg. Veilig tempo: max. 0,5 kg/week.",
  Recomp:
    "Je eet precies je onderhoudsbehoefte (TDEE). Je lichaam verbrandt tijdens training vetreserves als energie, terwijl de hoge eiwitinname (2,2 g/kg) spieropbouw stimuleert. Werkt het beste voor beginners of mensen die terugkomen na een pauze.",
  Behoud:
    "Je eet exact wat je verbrandt. Je gewicht blijft stabiel. De macro's zijn afgestemd op energie en herstel (1,6 g/kg eiwit).",
  Afname:
    "Je eet minder dan je verbrandt. Het tekort zorgt voor vetverbranding. Hogere eiwitinname (2,0 g/kg) beschermt spiermassa. Veilig tempo: max. 0,75 kg/week.",
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
  const [step, setStep] = useState(editMode ? 1 : 1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      setStep(1);
    })();
  }, [editMode, uid]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  // ── Live calculation ──────────────────────────────────────────────────────

  const weightKg = useMemo(() => toKg(form.weightKg, form.weightUnit), [form.weightKg, form.weightUnit]);
  const targetKg = useMemo(() => toKg(form.targetWeightKg, form.weightUnit), [form.targetWeightKg, form.weightUnit]);
  const age = useMemo(() => calcAge(form.birthDate), [form.birthDate]);

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

  const isAggressiveGain = kgPerWeek > 0.5 && form.goalType === "Toename";
  const isAggressiveLoss = kgPerWeek < -0.75 && form.goalType === "Afname";

  // ── Inline field validation ───────────────────────────────────────────────

  const birthdateError = useMemo(() => {
    if (!form.birthDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birth = new Date(form.birthDate);
    if (birth >= today) return "Geboortedatum kan niet vandaag of in de toekomst liggen.";
    const years = calcAge(form.birthDate);
    if (years < 13) return "Je moet minimaal 13 jaar oud zijn.";
    if (years > 110) return "Voer een geldige geboortedatum in.";
    return null;
  }, [form.birthDate]);

  const heightError = useMemo(() => {
    if (!form.heightCm) return null;
    const h = parseFloat(form.heightCm);
    if (isNaN(h) || h < 100 || h > 250) return "Voer een geldige lengte in (100–250 cm).";
    return null;
  }, [form.heightCm]);

  const weightError = useMemo(() => {
    if (!form.weightKg) return null;
    const w = toKg(form.weightKg, form.weightUnit);
    if (w < 20 || w > 300) return `Voer een geldig gewicht in (20–300 ${form.weightUnit}).`;
    return null;
  }, [form.weightKg, form.weightUnit]);

  const targetWeightError = useMemo(() => {
    if (!form.goalType || !form.targetWeightKg || !form.weightKg) return null;
    const target = toKg(form.targetWeightKg, form.weightUnit);
    if (form.goalType === "Toename" && target <= weightKg)
      return "Doelgewicht moet hoger zijn dan je huidige gewicht.";
    if (form.goalType === "Afname" && target >= weightKg)
      return "Doelgewicht moet lager zijn dan je huidige gewicht.";
    return null;
  }, [form.goalType, form.targetWeightKg, form.weightKg, form.weightUnit, weightKg]);

  // ── Week preview ──────────────────────────────────────────────────────────

  const weekPreview = useMemo(() => {
    if (form.goalType === "Behoud" || form.goalType === "Recomp" || !form.goalType) return [];
    if (!weightKg || !form.weeks) return [];
    const today = new Date();
    return Array.from({ length: form.weeks }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + (i + 1) * 7);
      const dateStr = date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
      const weight = Math.round((weightKg + kgPerWeek * (i + 1)) * 10) / 10;
      return { week: i + 1, date: dateStr, weight };
    });
  }, [form.goalType, form.weeks, weightKg, kgPerWeek]);

  // ── Validation per step ───────────────────────────────────────────────────

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: {
        if (!form.firstName.trim() || !form.birthDate || !form.gender) return false;
        if (birthdateError) return false;
        return true;
      }
      case 2: {
        const h = parseFloat(form.heightCm);
        const w = toKg(form.weightKg, form.weightUnit);
        return !!(form.heightCm && h >= 100 && h <= 250 && form.weightKg && w >= 20 && w <= 300);
      }
      case 3: return !!form.jobType;
      case 4: {
        if (!form.goalType) return false;
        if (form.goalType === "Behoud" || form.goalType === "Recomp") return true;
        const target = toKg(form.targetWeightKg, form.weightUnit);
        if (!form.targetWeightKg || target <= 0) return false;
        if (form.goalType === "Toename" && target <= weightKg) return false;
        if (form.goalType === "Afname" && target >= weightKg) return false;
        return true;
      }
      case 5: return form.weeks >= 4;
      case 6: return !!macros;
      default: return false;
    }
  }, [step, form, macros, weightKg, birthdateError]);

  const next = () => {
    if (!canAdvance) { setError("Vul alle velden in om door te gaan."); return; }
    setError("");
    setStep((s) => s + 1);
  };

  const back = async () => {
    setError("");
    if (step === 1) {
      if (editMode) { router.replace("/?tab=profile"); return; }
      await signOut(auth);
      router.replace("/auth");
      return;
    }
    setStep((s) => s - 1);
  };

  // ── Save & finish ─────────────────────────────────────────────────────────

  const handleFinish = async () => {
    if (!uid || !macros || !form.goalType) return;
    setSaving(true);
    try {
      const goalAmount =
        form.goalType === "Behoud" || form.goalType === "Recomp"
          ? 0
          : Math.abs(parseFloat(form.targetWeightKg) - parseFloat(form.weightKg)) || 0;

      const goalDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + form.weeks * 7);
        return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
      })();

      await saveOnboardingData(uid, {
        profile: {
          firstName: form.firstName.trim(),
          birthDate: form.birthDate.trim(),
          gender: form.gender,
          weight: weightKg,
          height: parseFloat(form.heightCm) || 0,
          weightUnit: form.weightUnit,
          sleepHours: form.sleepHours,
          jobType: form.jobType,
          exerciseDaysPerWeek: form.exerciseDays,
          onboardingComplete: true,
        },
        plan: {
          goalType: form.goalType,
          goalAmount,
          goalDate,
          startWeight: weightKg,
          targetWeight:
            form.goalType === "Behoud" || form.goalType === "Recomp" ? weightKg : targetKg,
          dailyCalories: macros.kcal,
          planName:
            form.goalType === "Toename" ? "Spieropbouw" :
            form.goalType === "Afname"  ? "Vetverlies"  :
            form.goalType === "Recomp"  ? "Body Recomp" : "Onderhoud",
          planDescription:
            form.goalType === "Toename"
              ? "Dit plan is gericht op het opbouwen van spiermassa. Een verhoogde eiwitinname ondersteunt de spiergroei, terwijl een gezonde hoeveelheid koolhydraten zorgt voor energie tijdens de training."
              : form.goalType === "Afname"
              ? "Dit plan is gericht op vetverlies. Een verhoogde eiwitinname helpt bij het behoud van spiermassa tijdens een calorietekort, zodat je zo lean mogelijk afvalt."
              : form.goalType === "Recomp"
              ? "Dit plan is gericht op gelijktijdig vetverlies en spieropbouw. Je eet op onderhoudsniveau (TDEE) met een hoge eiwitinname (2,2 g/kg), waardoor je lichaam vet verbrandt als energie terwijl spieren behouden en opgebouwd worden."
              : "Dit plan is gericht op het stabiel houden van je gewicht en het ondersteunen van je prestaties. De macro's zijn berekend om je energieniveau en herstel te optimaliseren.",
          weightHistory: [{ date: new Date().toISOString().split("T")[0], weight: weightKg }],
        },
        macros,
      });
      router.replace(editMode ? "/?tab=profile" : "/?tab=gym");
    } catch {
      setError("Opslaan mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  if (!uid) return null;

  const pct = (step / TOTAL_STEPS) * 100;

  return (
    <div className={styles.page}>
      {/* Progress bar */}
      <div className={styles.progressBarTrack}>
        <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
      </div>

      <div className={styles.content}>
        <button className={styles.backBtn} onClick={back}>
          <IoChevronBack size={16} /> {editMode && step === 1 ? "Annuleren" : "Terug"}
        </button>

        <div className={styles.stepLabel}>
          {editMode ? "Plan bijwerken" : `Stap ${step} van ${TOTAL_STEPS}`}
        </div>

        {/* ── Step 1: Identity ────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className={styles.stepTitle}>Wie ben jij?</div>
            <div className={styles.stepSubtitle}>We gebruiken dit om je plan te personaliseren.</div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Voornaam</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Jouw naam"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Geboortedatum</label>
              <input
                className={styles.input}
                type="date"
                value={form.birthDate}
                max={new Date().toISOString().split("T")[0]}
                min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 110); return d.toISOString().split("T")[0]; })()}
                onChange={(e) => set("birthDate", e.target.value)}
                style={{ colorScheme: "dark" }}
              />
              {birthdateError && <div className={styles.fieldError}>{birthdateError}</div>}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Geslacht</label>
              <div className={styles.pickerCard}>
                {GENDER_OPTIONS.map((opt) => (
                  <div key={opt.value} className={styles.pickerRow} onClick={() => set("gender", opt.value)}>
                    <span className={styles.pickerRowLabel}>{opt.label}</span>
                    {form.gender === opt.value && (
                      <span className={styles.pickerCheck}><IoCheckmark size={20} /></span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Body metrics ────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div className={styles.stepTitle}>Lichaamsmaten</div>
            <div className={styles.stepSubtitle}>Nodig voor een nauwkeurige BMR-berekening.</div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Eenheid</label>
              <div className={styles.unitToggle}>
                {(["kg", "lbs"] as WeightUnit[]).map((u) => (
                  <button
                    key={u}
                    className={`${styles.unitToggleBtn} ${form.weightUnit === u ? styles.unitToggleBtnActive : ""}`}
                    onClick={() => set("weightUnit", u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Lengte (cm)</label>
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="181"
                  value={form.heightCm}
                  onChange={(e) => set("heightCm", e.target.value)}
                />
                <span className={styles.inputUnit}>cm</span>
              </div>
              {heightError && <div className={styles.fieldError}>{heightError}</div>}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Huidig gewicht</label>
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={form.weightUnit === "kg" ? "80" : "176"}
                  value={form.weightKg}
                  onChange={(e) => set("weightKg", e.target.value)}
                />
                <span className={styles.inputUnit}>{form.weightUnit}</span>
              </div>
              {weightError && <div className={styles.fieldError}>{weightError}</div>}
            </div>
          </>
        )}

        {/* ── Step 3: Lifestyle ───────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div className={styles.stepTitle}>Levensstijl</div>
            <div className={styles.stepSubtitle}>
              Slaap, werk en trainingsfrequentie bepalen je dagelijks energieverbruik.
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Uren slaap per nacht</label>
              <div className={styles.sliderWrap}>
                <div className={styles.sliderValue}>{form.sleepHours} uur</div>
                <div className={styles.sliderTrackWrap}>
                  <input
                    type="range"
                    className={styles.slider}
                    min={4} max={10} step={1}
                    value={form.sleepHours}
                    onChange={(e) => set("sleepHours", parseInt(e.target.value))}
                  />
                </div>
                <div className={styles.sliderValueRow}>
                  <span className={styles.sliderMin}>4 uur</span>
                  <span className={styles.sliderMax}>10 uur</span>
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Type werk</label>
              <div className={styles.pickerCard}>
                {JOB_OPTIONS.map((opt) => (
                  <div key={opt.value} className={styles.pickerRow} onClick={() => set("jobType", opt.value)}>
                    <div style={{ flex: 1 }}>
                      <div className={styles.pickerRowLabel}>{opt.label}</div>
                      <div className={styles.pickerRowSub}>{opt.sub}</div>
                    </div>
                    {form.jobType === opt.value && (
                      <span className={styles.pickerCheck}><IoCheckmark size={20} /></span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Trainingen per week</label>
              <div className={styles.stepper}>
                <button
                  className={styles.stepperBtn}
                  onClick={() => set("exerciseDays", Math.max(0, form.exerciseDays - 1))}
                  disabled={form.exerciseDays === 0}
                >−</button>
                <span className={styles.stepperValue}>{form.exerciseDays}</span>
                <button
                  className={styles.stepperBtn}
                  onClick={() => set("exerciseDays", Math.min(7, form.exerciseDays + 1))}
                  disabled={form.exerciseDays === 7}
                >+</button>
              </div>
              <div className={styles.stepperLabel}>dagen per week</div>
            </div>
          </>
        )}

        {/* ── Step 4: Goal ────────────────────────────────────────────────── */}
        {step === 4 && (
          <>
            <div className={styles.stepTitle}>Jouw doel</div>
            <div className={styles.stepSubtitle}>Wat wil je bereiken?</div>

            <div className={styles.formGroup}>
              <div className={styles.pickerCard}>
                {GOAL_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    className={styles.pickerRow}
                    onClick={() => { set("goalType", opt.value); set("targetWeightKg", ""); }}
                  >
                    <div style={{ flex: 1 }}>
                      <div className={styles.pickerRowLabel}>{opt.label}</div>
                      <div className={styles.pickerRowSub}>{opt.sub}</div>
                    </div>
                    {form.goalType === opt.value && (
                      <span className={styles.pickerCheck}><IoCheckmark size={20} /></span>
                    )}
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
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={form.weightUnit === "kg" ? "85" : "187"}
                    value={form.targetWeightKg}
                    onChange={(e) => set("targetWeightKg", e.target.value)}
                  />
                  <span className={styles.inputUnit}>{form.weightUnit}</span>
                </div>
                {targetWeightError && (
                  <div className={styles.fieldError}>{targetWeightError}</div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Step 5: Timeline ────────────────────────────────────────────── */}
        {step === 5 && (
          <>
            <div className={styles.stepTitle}>Tijdlijn</div>
            <div className={styles.stepSubtitle}>
              Stel in hoe snel je je doel wilt bereiken. Een realistisch tempo is gezonder en houdbaarder.
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Looptijd</label>
              <div className={styles.sliderWrap}>
                <div className={styles.sliderValue}>{form.weeks} weken</div>
                <div className={styles.sliderTrackWrap}>
                  <input
                    type="range"
                    className={styles.slider}
                    min={4} max={52} step={1}
                    value={form.weeks}
                    onChange={(e) => set("weeks", parseInt(e.target.value))}
                  />
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
                  <span className={styles.liveLabel}>Gewicht per week</span>
                  <span className={styles.liveValueAccent}>
                    {kgPerWeek > 0 ? "+" : ""}{kgPerWeek} {form.weightUnit}/wk
                  </span>
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
                ⚠️ Dit is een ambitieus tempo. Een veilig en duurzaam tempo is{" "}
                {form.goalType === "Toename" ? "max. 0,5 kg/week" : "max. 0,75 kg/week"}.
                Overweeg een langere looptijd voor betere resultaten.
              </div>
            )}

            {weekPreview.length > 0 && (
              <div className={styles.weekPreviewWrap}>
                <table className={styles.weekPreviewTable}>
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Datum</th>
                      <th>Verwacht</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekPreview.map((row) => (
                      <tr key={row.week} className={row.week === form.weeks ? styles.weekPreviewEnd : ""}>
                        <td>{row.week}</td>
                        <td>{row.date}</td>
                        <td>{row.weight} {form.weightUnit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Step 6: Result ──────────────────────────────────────────────── */}
        {step === 6 && macros && (
          <>
            <div className={styles.stepTitle}>Jouw plan 🎯</div>
            <div className={styles.stepSubtitle}>
              Berekend op basis van wetenschappelijk onderzoek, persoonlijk voor jou.
            </div>

            <div className={styles.sourceCard}>
              <div className={styles.sourceTitle}>📚 Bronnen</div>
              <div className={styles.sourceItem}>
                • <strong>BMR:</strong> Mifflin-St Jeor formule (1990) — <em>Am J Clin Nutr</em>
              </div>
              <div className={styles.sourceItem}>
                • <strong>Activiteit:</strong> Harris-Benedict PAL factoren (Frankenfield, 2005) — <em>J Am Diet Assoc</em>
              </div>
              <div className={styles.sourceItem}>
                • <strong>Slaap &amp; metabolisme:</strong> Spiegel et al. (2004) — <em>Ann Intern Med</em>
              </div>
              <div className={styles.sourceItem}>
                • <strong>Eiwit:</strong> Morton et al. (2018) — <em>Br J Sports Med</em>
              </div>
            </div>

            <div className={styles.resultKcal}>{macros.kcal}</div>
            <div className={styles.resultKcalLabel}>kcal per dag</div>

            <div className={styles.macroRow}>
              <div className={styles.macroCard}>
                <div className={`${styles.macroCardValue} ${styles.macroProtein}`}>{macros.protein}g</div>
                <div className={styles.macroCardLabel}>Eiwit</div>
              </div>
              <div className={styles.macroCard}>
                <div className={`${styles.macroCardValue} ${styles.macroCarbs}`}>{macros.carbs}g</div>
                <div className={styles.macroCardLabel}>Koolhydraten</div>
              </div>
              <div className={styles.macroCard}>
                <div className={`${styles.macroCardValue} ${styles.macroFat}`}>{macros.fat}g</div>
                <div className={styles.macroCardLabel}>Vet</div>
              </div>
            </div>

            <div className={styles.tdeeNote}>
              Onderhoudsbehoefte (TDEE): {tdee} kcal/dag
            </div>
          </>
        )}

        {error && <div className={styles.errorText}>{error}</div>}
      </div>

      {/* Footer button */}
      <div className={styles.footer}>
        {step < TOTAL_STEPS ? (
          <button className={styles.primaryBtn} onClick={next} disabled={!canAdvance}>
            Volgende stap
          </button>
        ) : (
          <button
            className={styles.primaryBtn}
            onClick={handleFinish}
            disabled={saving || !macros}
          >
            {saving ? "Opslaan..." : editMode ? "Plan opslaan" : "Plan starten 🚀"}
          </button>
        )}
      </div>
    </div>
  );
}
