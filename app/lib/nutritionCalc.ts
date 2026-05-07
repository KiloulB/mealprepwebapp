/**
 * Scientific nutrition calculation functions.
 *
 * Sources:
 * - BMR: Mifflin MD, St Jeor ST et al. (1990). Am J Clin Nutr 51(2):241-247
 * - Activity PAL: Frankenfield D et al. (2005). J Am Diet Assoc
 * - Sleep & metabolism: Spiegel K et al. (2004). Ann Intern Med
 * - Protein targets: Morton RW et al. (2018). Br J Sports Med
 */

export type Gender = "Man" | "Vrouw" | "Anders";
export type GoalType = "Toename" | "Afname" | "Behoud" | "Recomp";
export type JobType = "sedentair" | "licht" | "actief";

export interface MacroResult {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

/**
 * Mifflin-St Jeor BMR (1990)
 */
export function calcBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === "Vrouw" ? base - 161 : base + 5;
}

/**
 * Activity multiplier from exercise days/week (Frankenfield 2005 PAL factors)
 */
function exerciseMultiplier(exerciseDaysPerWeek: number): number {
  if (exerciseDaysPerWeek === 0) return 1.2;
  if (exerciseDaysPerWeek <= 2) return 1.375;
  if (exerciseDaysPerWeek <= 4) return 1.55;
  if (exerciseDaysPerWeek <= 6) return 1.725;
  return 1.9;
}

/**
 * Job-type NEAT bonus on top of exercise multiplier.
 * Kept small to avoid double-counting with PAL factors (Frankenfield 2005),
 * which already assume baseline daily activity.
 */
function jobBonus(jobType: JobType): number {
  if (jobType === "licht") return 0.05;
  if (jobType === "actief") return 0.10;
  return 0;
}

/**
 * Sleep factor (Spiegel et al. 2004)
 */
function sleepFactor(sleepHours: number): number {
  if (sleepHours < 6) return 0.95;
  if (sleepHours < 7) return 0.975;
  return 1.0;
}

/**
 * TDEE = BMR × min(exercise_mult + job_bonus, 1.9) × sleep_factor
 */
export function calcTDEE(
  bmr: number,
  exerciseDaysPerWeek: number,
  jobType: JobType,
  sleepHours: number
): number {
  const mult = Math.min(exerciseMultiplier(exerciseDaysPerWeek) + jobBonus(jobType), 1.9);
  return Math.round(bmr * mult * sleepFactor(sleepHours));
}

/**
 * kg change per week given weeks to goal
 */
export function calcKgPerWeek(
  currentWeight: number,
  targetWeight: number,
  weeks: number
): number {
  if (weeks <= 0) return 0;
  return Math.round(((targetWeight - currentWeight) / weeks) * 100) / 100;
}

/**
 * Daily calorie target based on TDEE + caloric surplus/deficit for goal.
 * 1 kg body fat ≈ 7700 kcal (Hall et al.)
 * Cap: gain ≤ +1000 kcal/day, loss ≥ -750 kcal/day.
 */
export function calcDailyCalories(
  tdee: number,
  kgPerWeek: number,
  goalType: GoalType
): number {
  if (goalType === "Behoud" || goalType === "Recomp") return tdee;
  const rawDelta = (kgPerWeek * 7700) / 7;
  const cappedDelta =
    goalType === "Toename"
      ? Math.min(rawDelta, 1000)
      : Math.max(rawDelta, -750);
  return Math.round(tdee + cappedDelta);
}

/**
 * Macro breakdown (Morton et al. 2018 + ISSN guidelines)
 * - Protein: 1.8 g/kg (gain), 1.6 g/kg (maintain), 2.0 g/kg (loss)
 * - Fat: 28% of daily kcal ÷ 9
 * - Carbs: remainder ÷ 4
 */
export function calcMacros(
  dailyCalories: number,
  weightKg: number,
  goalType: GoalType
): MacroResult {
  const proteinPerKg =
    goalType === "Toename" ? 1.8 :
    goalType === "Afname"  ? 2.0 :
    goalType === "Recomp"  ? 2.2 : 1.6;
  const protein = Math.round(weightKg * proteinPerKg);
  const fat = Math.round((dailyCalories * 0.28) / 9);
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbs = Math.max(0, Math.round((dailyCalories - proteinKcal - fatKcal) / 4));
  return { kcal: dailyCalories, protein, fat, carbs };
}

/**
 * Calculate age in years from ISO birth date string ("YYYY-MM-DD" or "D-M-YYYY")
 */
export function calcAge(birthDate: string): number {
  // Support both YYYY-MM-DD and D-M-YYYY
  let d: Date;
  if (birthDate.includes("-") && birthDate.split("-")[0].length === 4) {
    d = new Date(birthDate);
  } else {
    const parts = birthDate.split("-");
    if (parts.length === 3) {
      d = new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`);
    } else {
      return 25; // fallback
    }
  }
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(1, age);
}
