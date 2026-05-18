"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft } from "react-icons/fi";
import { IoAdd, IoTrash } from "react-icons/io5";
import { useUser } from "../../context/UserContext";
import { saveMealPrepPlan } from "../../firebase/mealPrepService";
import type { MealPrepPlan, PrepMeal } from "../../types/mealPrep";
import type { Recipe } from "../../types/user";
import RecipePickerModal from "./RecipePickerModal";
import styles from "./PlanSetupModal.module.css";

const DAY_LABELS_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DAY_LABELS_FULL  = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

const MEAL_TYPE_OPTIONS: { value: "breakfast" | "lunch" | "dinner"; emoji: string; label: string }[] = [
  { value: "breakfast", emoji: "🌅", label: "Ontbijt" },
  { value: "lunch",     emoji: "☀️",  label: "Lunch" },
  { value: "dinner",    emoji: "🌙",  label: "Avondeten" },
];

const PATTERN_OPTIONS: { value: PrepMeal["pattern"]; label: string }[] = [
  { value: "daily",      label: "Elke dag" },
  { value: "alternateA", label: "Dag A" },
  { value: "alternateB", label: "Dag B" },
  { value: "manual",     label: "Handmatig" },
];

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

function todayIso(): string { return new Date().toISOString().split("T")[0]; }

function stripUndefined<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }

interface Props {
  onClose: () => void;
  existingPlan?: MealPrepPlan;
}

export default function PlanSetupModal({ onClose, existingPlan }: Props) {
  const { authUser } = useUser();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: meal types
  const [mealTypes, setMealTypes] = useState<("breakfast" | "lunch" | "dinner")[]>(existingPlan?.mealTypes ?? []);

  // Step 2: planning basics
  const [cookDay, setCookDay]             = useState<number>(existingPlan?.cookDay ?? 7);
  const [cookFrequency, setCookFrequency] = useState<"weekly" | "biweekly" | "custom">(existingPlan?.cookFrequency ?? "weekly");
  const [cookFrequencyDays, setCookFrequencyDays] = useState<number>(existingPlan?.cookFrequencyDays ?? 3);
  const [timeSpanWeeks, setTimeSpanWeeks] = useState<number>(existingPlan?.timeSpanWeeks ?? 2);

  // Step 3: meals
  const [meals, setMeals]           = useState<PrepMeal[]>(existingPlan?.meals ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  const startDate = todayIso();
  const endDate   = addWeeks(startDate, timeSpanWeeks);

  const toggleMealType = (val: "breakfast" | "lunch" | "dinner") => {
    setMealTypes((prev) => prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]);
  };

  const handleRecipeSelect = (recipe: Recipe & { id: string }) => {
    setPickerOpen(false);
    const newMeal: PrepMeal = {
      id:          crypto.randomUUID(),
      recipeId:    recipe.id,
      recipeTitle: recipe.title,
      kcal:        recipe.kcal    ?? 0,
      protein:     recipe.protein ?? 0,
      carbs:       recipe.carbs   ?? 0,
      fat:         recipe.fat     ?? 0,
      pattern:     "daily",
    };
    setMeals((prev) => [...prev, newMeal]);
  };

  const updateMealPattern = (id: string, pattern: PrepMeal["pattern"]) => {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (pattern === "manual") return { ...m, pattern, manualDays: m.manualDays ?? [] };
        const { manualDays: _dropped, ...rest } = m;
        return { ...rest, pattern };
      })
    );
  };

  const toggleManualDay = (id: string, day: number) => {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const days = m.manualDays ?? [];
        return { ...m, manualDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] };
      })
    );
  };

  const removeMeal = (id: string) => setMeals((prev) => prev.filter((m) => m.id !== id));

  const handleSave = async () => {
    if (!authUser) return;
    setSaving(true);
    try {
      const plan: MealPrepPlan = {
        startDate, endDate, cookDay, cookFrequency,
        ...(cookFrequency === "custom" ? { cookFrequencyDays } : {}),
        timeSpanWeeks, mealTypes, meals, status: "active",
      };
      await saveMealPrepPlan(authUser.uid, stripUndefined(plan));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canNext: Record<number, boolean> = {
    1: mealTypes.length > 0,
    2: true,
    3: meals.length > 0,
  };

  const stepTitle: Record<number, string> = {
    1: "Maaltijdtype",
    2: "Planning",
    3: "Maaltijden",
    4: "Bevestigen",
  };

  return createPortal(
    <div className={styles.overlay}>

      {/* â”€â”€ Top bar â”€â”€ */}
      <div className={styles.topBar}>
        {step === 1 ? (
          <button className={styles.cancelBtn} onClick={onClose}>Annuleren</button>
        ) : (
          <button className={styles.backBtn} onClick={() => setStep((s) => (s - 1) as 1|2|3|4)}>
            <FiChevronLeft size={16} style={{ verticalAlign: "middle" }} /> Terug
          </button>
        )}

        <span className={styles.topTitle}>{stepTitle[step]}</span>

        {step < 4 ? (
          <button
            className={styles.nextBtn}
            disabled={!canNext[step]}
            onClick={() => setStep((s) => (s + 1) as 1|2|3|4)}
          >
            Volgende →
          </button>
        ) : (
          <button className={styles.saveBtn} disabled={saving} onClick={handleSave}>
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        )}
      </div>

      {/* â”€â”€ Step dots (4) â”€â”€ */}
      <div className={styles.stepDots}>
        {([1, 2, 3, 4] as const).map((n) => (
          <div key={n} className={`${styles.dot} ${step === n ? styles.dotActive : ""}`} />
        ))}
      </div>

      {/* â”€â”€ Body â”€â”€ */}
      <div className={styles.body}>

        {/* â•â•â•â• STEP 1: Maaltijdtype â•â•â•â• */}
        {step === 1 && (
          <>
            <p className={styles.sectionHint}>Voor welke maaltijden wil je van tevoren koken?</p>
            <div className={styles.mealTypeGrid}>
              {MEAL_TYPE_OPTIONS.map((opt) => {
                const active = mealTypes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    className={`${styles.mealTypeChip} ${active ? styles.mealTypeChipActive : ""}`}
                    onClick={() => toggleMealType(opt.value)}
                  >
                    <span className={styles.mealTypeEmoji}>{opt.emoji}</span>
                    <span className={styles.mealTypeLabel}>{opt.label}</span>
                    {active && <span className={styles.chipCheck}>✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* â•â•â•â• STEP 2: Planning â•â•â•â• */}
        {step === 2 && (
          <>
            <div className={styles.sectionLabel}>Kookdag</div>
            <p className={styles.sectionHint}>Op welke dag bereid je je maaltijden voor?</p>
            <div className={styles.pillRow}>
              {DAY_LABELS_SHORT.map((label, i) => {
                const d = i + 1;
                return (
                  <button
                    key={d}
                    className={`${styles.pill} ${cookDay === d ? styles.pillActive : ""}`}
                    onClick={() => setCookDay(d)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className={styles.sectionLabel} style={{ marginTop: 28 }}>Kookfrequentie</div>
            <div className={styles.pillRow}>
              {(["weekly", "biweekly", "custom"] as const).map((f) => (
                <button
                  key={f}
                  className={`${styles.pill} ${cookFrequency === f ? styles.pillActive : ""}`}
                  onClick={() => setCookFrequency(f)}
                >
                  {f === "weekly" ? "Wekelijks" : f === "biweekly" ? "Om de 2 weken" : "Anders"}
                </button>
              ))}
            </div>
            {cookFrequency === "custom" && (
              <div className={styles.customFreqRow}>
                <span className={styles.customFreqLabel}>Elke</span>
                <button className={styles.stepperBtn} onClick={() => setCookFrequencyDays((d) => Math.max(1, d - 1))}>-</button>
                <span className={styles.stepperVal}>{cookFrequencyDays}</span>
                <button className={styles.stepperBtn} onClick={() => setCookFrequencyDays((d) => Math.min(30, d + 1))}>+</button>
                <span className={styles.customFreqLabel}>dagen</span>
              </div>
            )}

            <div className={styles.sectionLabel} style={{ marginTop: 28 }}>
              Tijdspan —{" "}
              <span style={{ color: "var(--accent)" }}>{timeSpanWeeks} {timeSpanWeeks !== 1 ? "weken" : "week"}</span>
            </div>
            <p className={styles.sectionHint}>Hoe lang wil je dit meal prep schema volhouden?</p>
            <input
              className={styles.slider}
              type="range"
              min={1}
              max={12}
              value={timeSpanWeeks}
              onChange={(e) => setTimeSpanWeeks(Number(e.target.value))}
            />
            <div className={styles.sliderLabels}><span>1 wk</span><span>12 wk</span></div>
          </>
        )}

        {/* â•â•â•â• STEP 3: Maaltijden â•â•â•â• */}
        {step === 3 && (
          <>
            {meals.map((meal) => (
              <div key={meal.id} className={styles.mealCard}>
                <div className={styles.mealCardHeader}>
                  <span className={styles.mealCardTitle}>{meal.recipeTitle}</span>
                  <button className={styles.removeBtn} onClick={() => removeMeal(meal.id)}>
                    <IoTrash size={15} />
                  </button>
                </div>
                <div className={styles.patternRow}>
                  {PATTERN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`${styles.patternPill} ${meal.pattern === opt.value ? styles.patternPillActive : ""}`}
                      onClick={() => updateMealPattern(meal.id, opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {meal.pattern === "manual" && (
                  <div className={styles.manualDayRow}>
                    {DAY_LABELS_SHORT.map((label, i) => {
                      const d = i + 1;
                      const selected = meal.manualDays?.includes(d) ?? false;
                      return (
                        <button
                          key={d}
                          className={`${styles.pill} ${selected ? styles.pillActive : ""}`}
                          onClick={() => toggleManualDay(meal.id, d)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {meals.length === 0 && (
              <p className={styles.emptyHint}>Nog geen maaltijden. Voeg er een toe.</p>
            )}

            <button className={styles.addMealBtn} onClick={() => setPickerOpen(true)}>
              <IoAdd size={16} /> Maaltijd toevoegen
            </button>
          </>
        )}

        {/* â•â•â•â• STEP 4: Bevestigen â•â•â•â• */}
        {step === 4 && (
          <>
            <div className={styles.summaryCard}>
              {[
                { label: "Maaltijden",  value: mealTypes.map((t) => t === "breakfast" ? "Ontbijt" : t === "lunch" ? "Lunch" : "Avondeten").join(", ") },
                { label: "Kookdag",     value: DAY_LABELS_FULL[cookDay - 1] },
                { label: "Frequentie",  value: cookFrequency === "weekly" ? "Wekelijks" : cookFrequency === "biweekly" ? "Om de 2 weken" : `Elke ${cookFrequencyDays} dagen` },
                { label: "Duur",        value: `${timeSpanWeeks} ${timeSpanWeeks !== 1 ? "weken" : "week"}` },
                { label: "Einddatum",   value: endDate },
              ].map(({ label, value }) => (
                <div key={label} className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>{label}</span>
                  <span className={styles.summaryValue}>{value}</span>
                </div>
              ))}
            </div>

            {meals.length > 0 && (
              <>
                <div className={styles.sectionLabel}>Recepten</div>
                <div className={styles.summaryCard}>
                  {meals.map((m) => (
                    <div key={m.id} className={styles.summaryRow}>
                      <span className={styles.summaryMealTitle}>{m.recipeTitle}</span>
                      <span className={styles.summaryMealPattern}>
                        {m.pattern === "daily" ? "Elke dag"
                          : m.pattern === "alternateA" ? "Dag A"
                          : m.pattern === "alternateB" ? "Dag B"
                          : (m.manualDays ?? []).map((d) => DAY_LABELS_SHORT[d - 1]).join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {pickerOpen &&
        createPortal(
          <RecipePickerModal onSelect={handleRecipeSelect} onClose={() => setPickerOpen(false)} />,
          document.body
        )}
    </div>,
    document.body
  );
}
