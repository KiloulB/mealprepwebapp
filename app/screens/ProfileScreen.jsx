"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  IoSettingsOutline,
  IoChevronBack,
  IoChevronForward,
  IoPersonOutline,
  IoLogOutOutline,
  IoClose,
  IoAdd,
  IoEyeOutline,
  IoEyeOffOutline,
  IoCheckmark,
  IoCalendarOutline,
  IoInformationCircleOutline,
  IoTrashOutline,
  IoColorPaletteOutline,
  IoBarbellOutline,
  IoNutritionOutline,
  IoTrendingUpOutline,
  IoFlagOutline,
  IoBodyOutline,
  IoKeyOutline,
  IoCopyOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { useTheme } from "../context/ThemeContext";

import { calcBMR, calcTDEE, calcAge } from "../lib/nutritionCalc";
import { auth } from "../firebase/config";
import { useUser } from "../context/UserContext";
import {
  subscribeToProfile,
  subscribeToPlan,
  updateProfile,
  updatePlan,
  addWeightEntry,
  removeWeightEntry,
  toggleMealPrep,
  toggleHelpMode,
} from "../firebase/profileService";
import { getRecentLoggedDays } from "../firebase/dataService";
import HelpOverlay from "../components/HelpOverlay";
import { subscribeToGymSessionsInRange } from "../firebase/gymService";

import styles from "./ProfileScreen.module.css";

// ─── Constants ───────────────────────────────────────────────────────────────

const MUSCLE_NAMES_NL = {
  chest: "Borst",
  biceps: "Biceps",
  triceps: "Triceps",
  shoulders: "Schouders",
  "upper-back": "Bovenrug",
  "lower-back": "Onderrug",
  abs: "Buikspieren",
  quads: "Quadriceps",
  hamstrings: "Hamstrings",
  glutes: "Billen",
  calves: "Kuiten",
  forearms: "Onderarmen",
  traps: "Trapezius",
  lats: "Lat",
};

function muscleSlugToNl(slug) {
  return MUSCLE_NAMES_NL[slug] || slug;
}

function formatShortDate(ms) {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

// ─── Weight chart SVG ─────────────────────────────────────────────────────────

function WeightChart({ entries }) {
  if (!entries || entries.length < 2) {
    return (
      <div className={styles.chartEmpty}>
        {entries?.length === 1 ? "Voeg meer metingen toe voor een grafiek." : "Nog geen gewichtsdata."}
      </div>
    );
  }

  const W = 300;
  const H = 130;
  const PAD_LEFT = 10;
  const PAD_RIGHT = 44; // room for y-axis labels on the right
  const PAD_TOP = 10;
  const PAD_BOT = 22;

  const weights = entries.map((e) => e.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const padRange = range * 0.25 + 0.5;
  const lo = Math.floor((minW - padRange) * 2) / 2;
  const hi = Math.ceil((maxW + padRange) * 2) / 2;
  const totalRange = hi - lo;

  const toX = (i) => PAD_LEFT + (i / (entries.length - 1)) * (W - PAD_LEFT - PAD_RIGHT);
  const toY = (w) => PAD_TOP + ((hi - w) / totalRange) * (H - PAD_TOP - PAD_BOT);

  const points = entries.map((e, i) => ({ x: toX(i), y: toY(e.weight), ...e }));

  // Smooth bezier path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    const cp1y = points[i - 1].y;
    const cp2x = cp1x;
    const cp2y = points[i].y;
    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i].x} ${points[i].y}`;
  }

  // Y-axis: 4 labels on right
  const yLabels = [hi, hi - totalRange / 3, hi - (2 * totalRange) / 3, lo].map((w) => ({
    val: Math.round(w * 10) / 10,
    y: toY(w),
  }));

  const firstDate = formatAxisDate(entries[0].date);
  const lastDate = formatAxisDate(entries[entries.length - 1].date);

  return (
    <div className={styles.chartWrap}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <line key={i} x1={PAD_LEFT} y1={l.y} x2={W - PAD_RIGHT} y2={l.y}
            style={{ stroke: "var(--border-sep)" }} strokeWidth={1} />
        ))}
        {/* Y-axis labels (right side) */}
        {yLabels.map((l, i) => (
          <text key={i} x={W - PAD_RIGHT + 4} y={l.y + 4}
            fontSize={9} style={{ fill: "var(--text-muted)" }} textAnchor="start">
            {l.val}
          </text>
        ))}
        {/* Line */}
        <path d={pathD} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2} strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} style={{ fill: "var(--accent)" }} />
        ))}
        {/* X-axis labels */}
        <text x={PAD_LEFT} y={H - 4} fontSize={9} style={{ fill: "var(--text-muted)" }} textAnchor="start">{firstDate}</text>
        <text x={W - PAD_RIGHT} y={H - 4} fontSize={9} style={{ fill: "var(--text-muted)" }} textAnchor="end">{lastDate}</text>
      </svg>
    </div>
  );
}

function formatAxisDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function formatLongDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const months = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const PERIODS = ["1W", "1M", "3M", "6M", "Alles"];

function filterByPeriod(entries, period) {
  if (!entries) return [];
  if (period === "Alles") return entries;
  const days = { "1W": 7, "1M": 30, "3M": 90, "6M": 180 }[period];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return entries.filter((e) => e.date >= cutoffStr);
}

// ─── WeightChartLarge ─────────────────────────────────────────────────────────

function WeightChartLarge({ entries, targetWeight }) {
  if (!entries || entries.length < 2) {
    return (
      <div className={styles.chartEmpty} style={{ padding: "32px 0" }}>
        {entries?.length === 1
          ? "Voeg meer metingen toe voor een grafiek."
          : "Nog geen data voor deze periode."}
      </div>
    );
  }

  const W = 300;
  const H = 180;
  const PAD_L = 10;
  const PAD_R = 44;
  const PAD_T = 14;
  const PAD_B = 22;

  const allW = [...entries.map((e) => e.weight), ...(targetWeight != null ? [targetWeight] : [])];
  const minW = Math.min(...allW);
  const maxW = Math.max(...allW);
  const range = maxW - minW || 1;
  const pad = range * 0.25 + 0.5;
  const lo = Math.floor((minW - pad) * 2) / 2;
  const hi = Math.ceil((maxW + pad) * 2) / 2;
  const total = hi - lo;

  const toX = (i) => PAD_L + (i / (entries.length - 1)) * (W - PAD_L - PAD_R);
  const toY = (w) => PAD_T + ((hi - w) / total) * (H - PAD_T - PAD_B);

  const pts = entries.map((e, i) => ({ x: toX(i), y: toY(e.weight) }));

  let pathD = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    pathD += ` C ${cx} ${pts[i - 1].y}, ${cx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
  }

  const yLabels = [hi, hi - total / 3, hi - (2 * total) / 3, lo].map((w) => ({
    val: Math.round(w * 10) / 10,
    y: toY(w),
  }));

  const targetY = targetWeight != null ? toY(targetWeight) : null;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", touchAction: "none", userSelect: "none" }}
    >
      {yLabels.map((l, i) => (
        <line key={i} x1={PAD_L} y1={l.y} x2={W - PAD_R} y2={l.y} style={{ stroke: "var(--border-sep)" }} strokeWidth={1} />
      ))}
      {yLabels.map((l, i) => (
        <text key={i} x={W - PAD_R + 4} y={l.y + 4} fontSize={9} style={{ fill: "var(--text-muted)" }} textAnchor="start">{l.val}</text>
      ))}
      {targetY != null && (
        <>
          <line x1={PAD_L} y1={targetY} x2={W - PAD_R} y2={targetY} stroke="#72A82C" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - PAD_R + 4} y={targetY + 4} fontSize={9} fill="#72A82C" textAnchor="start">doel</text>
        </>
      )}
      <path d={pathD} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2.5} strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} style={{ fill: "var(--accent)" }} />
      ))}
      <text x={PAD_L} y={H - 4} fontSize={9} style={{ fill: "var(--text-muted)" }} textAnchor="start">{formatAxisDate(entries[0].date)}</text>
      <text x={W - PAD_R} y={H - 4} fontSize={9} style={{ fill: "var(--text-muted)" }} textAnchor="end">{formatAxisDate(entries[entries.length - 1].date)}</text>
    </svg>
  );
}

// ─── WeightHistorySheet ───────────────────────────────────────────────────────

function WeightHistorySheet({ entries, targetWeight, onClose, onDelete }) {
  const [period, setPeriod] = useState("1M");
  const [deletingDate, setDeletingDate] = useState(null);
  const swipeStartX = useRef(null);

  const filtered = filterByPeriod(entries, period);
  const sorted = [...(entries || [])].reverse();
  const periodIdx = PERIODS.indexOf(period);

  const handlePointerDown = (e) => { swipeStartX.current = e.clientX; };
  const handlePointerUp = (e) => {
    if (swipeStartX.current === null) return;
    const dx = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0 && periodIdx < PERIODS.length - 1) setPeriod(PERIODS[periodIdx + 1]);
    else if (dx > 0 && periodIdx > 0) setPeriod(PERIODS[periodIdx - 1]);
  };

  const handleDelete = async (date) => {
    setDeletingDate(date);
    await onDelete(date);
    setDeletingDate(null);
  };

  return createPortal(
    <div className={styles.whOverlay} onClick={onClose}>
      <div className={styles.whSheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.whHandle} />
        <div className={styles.whHeader}>
          <span className={styles.whTitle}>Gewichtsvoortgang</span>
          <button className={styles.whCloseBtn} onClick={onClose}><IoClose size={20} /></button>
        </div>

        <div className={styles.whScroll}>
          {/* Period selector */}
          <div className={styles.whPeriodRow}>
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`${styles.whPeriodBtn} ${period === p ? styles.whPeriodBtnActive : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Swipeable chart */}
          <div
            className={styles.whChartWrap}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <WeightChartLarge entries={filtered} targetWeight={targetWeight} />
          </div>
          {filtered.length >= 2 && (
            <div className={styles.whSwipeHint}>Swipe de grafiek om van periode te wisselen</div>
          )}

          {/* History list */}
          <div className={styles.whListSection}>
            <div className={styles.whListTitle}>Alle metingen</div>
            {sorted.length === 0 ? (
              <div className={styles.whEmpty}>Nog geen metingen</div>
            ) : sorted.map((e) => (
              <div key={e.date} className={styles.whRow}>
                <div className={styles.whRowDate}>{formatLongDate(e.date)}</div>
                <div className={styles.whRowWeight}>{e.weight} kg</div>
                <button
                  className={styles.whDeleteBtn}
                  onClick={() => handleDelete(e.date)}
                  disabled={deletingDate === e.date}
                >
                  {deletingDate === e.date ? "…" : <IoTrashOutline size={15} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({ planData, onClick }) {
  const { goalType, goalAmount, goalDate, startWeight, targetWeight } = planData || {};
  const currentWeight = planData?.weightHistory?.length
    ? planData.weightHistory[planData.weightHistory.length - 1].weight
    : null;

  if (!goalType) {
    return (
      <div className={styles.goalCard} onClick={onClick}>
        <div className={styles.goalCardRow}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <div style={{ flex: 1 }}>
            <div className={styles.goalCardTitle}>Geen doel ingesteld</div>
            <div className={styles.goalCardDate}>Tik om je plan in te stellen</div>
          </div>
          <IoChevronForward size={16} color="var(--text-muted)" />
        </div>
      </div>
    );
  }

  const noWeightGoal = goalType === "Behoud" || goalType === "Recomp";
  const isLoss = goalType === "Afvallen";
  const isGain = goalType === "Toename";

  const title = "Jouw plan";

  const badgeColor = isLoss ? "var(--accent)" : isGain ? "#72A82C" : "#2A9DB5";
  const badgeBg   = isLoss ? "rgba(252,145,88,0.12)" : isGain ? "rgba(141,207,66,0.12)" : "rgba(42,157,181,0.12)";
  const badgeLabel = noWeightGoal
    ? (goalType === "Recomp" ? "Body Recomp" : "Op gewicht blijven")
    : `${goalAmount ?? 0} kg ${isGain ? "aankomen" : "afvallen"}`;

  let progressPct = null;
  if (!noWeightGoal && startWeight != null && targetWeight != null && currentWeight != null) {
    const total = Math.abs(targetWeight - startWeight);
    if (total > 0) progressPct = Math.min(100, Math.max(0, (Math.abs(currentWeight - startWeight) / total) * 100));
  }

  return (
    <div className={styles.goalCard} onClick={onClick}>
      {/* Title row */}
      <div className={styles.goalCardRow}>
        <div className={styles.goalCardTitle}>{title}</div>
        <IoChevronForward size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      </div>

      {/* Badge + date row */}
      <div className={styles.goalCardRow} style={{ marginTop: 6 }}>
        <span className={styles.goalCardBadge} style={{ color: badgeColor, background: badgeBg }}>
          {badgeLabel}
        </span>
        {goalDate && <span className={styles.goalCardDate}>Deadline: {goalDate}</span>}
      </div>

      {/* Progress bar */}
      {progressPct !== null && (
        <div className={styles.goalProgressWrap}>
          <div className={styles.goalProgressBar}>
            <div className={styles.goalProgressFill} style={{ width: `${progressPct}%`, background: badgeColor }} />
          </div>
          <span className={styles.goalProgressLabel}>{Math.round(progressPct)}%</span>
        </div>
      )}

      {/* Weight stats */}
      {(startWeight != null || currentWeight != null || targetWeight != null) && (
        <div className={styles.goalCardStats}>
          {startWeight  != null && <span className={styles.goalCardStat}>Start: {startWeight} kg</span>}
          {currentWeight != null && <span className={styles.goalCardStat}>Nu: {currentWeight} kg</span>}
          {targetWeight  != null && <span className={styles.goalCardStat}>Doel: {targetWeight} kg</span>}
        </div>
      )}
    </div>
  );
}

// ─── SmartInsightsCard ────────────────────────────────────────────────────────

function getWorkoutInsight(sessions) {
  const now = Date.now();
  const DAY = 86400000;
  const weekAgo = now - 7 * DAY;
  const twoWeeksAgo = now - 14 * DAY;

  if (sessions.length === 0)
    return { heading: "Nog niets getraind.", body: "Zodra je traint zie je hier je voortgang." };

  const thisWeek = sessions.filter((s) => s.startedAt >= weekAgo).length;
  const lastWeek = sessions.filter((s) => s.startedAt >= twoWeeksAgo && s.startedAt < weekAgo).length;
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  const daysSinceLast = Math.floor((now - sorted[0].startedAt) / DAY);

  if (thisWeek === 0 && daysSinceLast > 14)
    return { stat: "0", statLabel: "workouts", body: "Al meer dan twee weken niet getraind. Zelfs een korte sessie helpt je op gang te komen." };
  if (thisWeek === 0)
    return { stat: "0", statLabel: "workouts deze week", body: "Je hebt nog tijd om er een in te plannen." };
  if (thisWeek === 1 && lastWeek >= 3)
    return { stat: "1", statLabel: "workout deze week", body: `Vorige week deed je er ${lastWeek}. Pak het momentum terug.` };
  if (thisWeek === 1)
    return { stat: "1", statLabel: "workout deze week", body: "Je eerste workout staat erop. Ga door zo." };
  if (thisWeek >= 3 && thisWeek > lastWeek && lastWeek > 0)
    return { stat: String(thisWeek), statLabel: "workouts deze week", body: "Betere week dan vorige. Zo bouw je aan resultaat." };
  if (thisWeek >= 3)
    return { stat: String(thisWeek), statLabel: "workouts deze week", body: "Consistent bezig. Zo bouw je aan resultaat." };
  return { stat: String(thisWeek), statLabel: "workouts deze week", body: "Je bent goed bezig." };
}

function getVoedingInsight(loggedDaysCount) {
  if (loggedDaysCount === null) return null;
  const stat = `${loggedDaysCount}/7`;
  const statLabel = "dagen gelogd";
  if (loggedDaysCount === 7)
    return { stat, statLabel, body: "Elke dag bijgehouden. Zo krijg je het beste inzicht in je voeding." };
  if (loggedDaysCount >= 5)
    return { stat, statLabel, body: `${loggedDaysCount} van de 7 dagen bijgehouden. Je bent er bijna.` };
  if (loggedDaysCount >= 3)
    return { stat, statLabel, body: "Elke dag bijhouden geeft een beter beeld. Je bent op de goede weg." };
  if (loggedDaysCount >= 1)
    return { stat, statLabel, body: "Weinig gelogd deze week. Probeer het elke dag even bij te houden." };
  return { stat, statLabel, body: "Nog niets gelogd deze week. Begin vandaag, ook een kort overzicht helpt al." };
}

function getWeightTrendInsight(weightHistory, goalType) {
  if (!weightHistory || weightHistory.length < 2) return null;
  const recent = weightHistory.slice(-4);
  const diff = recent[recent.length - 1].weight - recent[0].weight;
  const absKg = Math.abs(diff).toFixed(1);
  const n = recent.length;
  const isLoss = goalType === "Afvallen";
  const isGain = goalType === "Toename";

  if (Math.abs(diff) < 0.3) {
    const currentW = recent[recent.length - 1].weight;
    const onTrack = goalType === "Behoud" || goalType === "Recomp";
    return {
      stat: `${currentW} kg`,
      statLabel: "huidig gewicht",
      body: onTrack
        ? "Je gewicht schommelt nauwelijks. Precies wat je wilt."
        : isLoss
        ? "Weinig verandering de laatste metingen. Overweeg je calorie-inname iets te verlagen."
        : isGain
        ? "Weinig verandering. Voeg meer calorieën toe om groei te stimuleren."
        : "Je gewicht is stabiel de laatste metingen.",
    };
  }

  if (diff < 0) {
    return {
      stat: `-${absKg} kg`,
      statLabel: `laatste ${n} metingen`,
      body: isLoss
        ? "Goed bezig. Blijf consistent en het resultaat komt vanzelf."
        : isGain
        ? "Je bent afgevallen, maar je doel is aankomen. Verhoog je calorie-inname."
        : "Je gewicht daalt licht. Blijf meten om de trend te volgen.",
    };
  }

  return {
    stat: `+${absKg} kg`,
    statLabel: `laatste ${n} metingen`,
    body: isGain
      ? "Prima progressie. Blijf consistent trainen en goed eten."
      : isLoss
      ? "Je bent wat zwaarder geworden. Bekijk je eetpatroon en blijf consistent trainen."
      : "Je gewicht stijgt licht. Houd dit in de gaten als je stabiel wilt blijven.",
  };
}

function getGoalProgressInsight(planData) {
  const { goalType, startWeight, targetWeight, weightHistory } = planData || {};
  if (!goalType || goalType === "Behoud" || goalType === "Recomp") return null;
  if (!startWeight || !targetWeight || !weightHistory?.length) return null;

  const current = weightHistory[weightHistory.length - 1].weight;
  const total = Math.abs(targetWeight - startWeight);
  if (total === 0) return null;
  const achieved = Math.abs(current - startWeight);
  const remaining = Math.abs(targetWeight - current);
  const pct = Math.min(100, Math.round((achieved / total) * 100));

  if (pct >= 100) {
    return {
      stat: "100%",
      statLabel: "doel bereikt",
      body: "Je hebt je streefgewicht behaald. Stel een nieuw doel in of schakel over naar gewichtsbehoud.",
    };
  }

  let etaText = "";
  if (weightHistory.length >= 2) {
    const firstDate = new Date(weightHistory[0].date);
    const lastDate = new Date(weightHistory[weightHistory.length - 1].date);
    const weeksPassed = Math.max(0.5, (lastDate - firstDate) / (7 * 24 * 60 * 60 * 1000));
    const kgPerWeek = achieved / weeksPassed;
    if (kgPerWeek > 0.05 && remaining > 0) {
      const weeksLeft = Math.round(remaining / kgPerWeek);
      if (weeksLeft === 1) etaText = " Op dit tempo bereik je je doel over circa 1 week.";
      else if (weeksLeft > 1 && weeksLeft <= 104) etaText = ` Op dit tempo bereik je je doel over circa ${weeksLeft} weken.`;
    }
  }

  if (pct === 0) {
    return {
      stat: `${remaining.toFixed(1)} kg`,
      statLabel: "te gaan",
      body: "Je bent net begonnen. Elke week telt.",
    };
  }

  return {
    stat: `${pct}%`,
    statLabel: "van je doel bereikt",
    body: `Nog ${remaining.toFixed(1)} kg te gaan.${etaText}`,
  };
}

function getMuscleBalanceInsight(sessions) {
  const twoWeeksAgo = Date.now() - 14 * 86400000;
  const recent = sessions.filter((s) => s.startedAt >= twoWeeksAgo);
  if (recent.length < 2) return null;

  const freq = {};
  for (const s of recent) {
    for (const m of s.musclesWorked || []) {
      freq[m] = (freq[m] || 0) + 1;
    }
  }
  if (Object.keys(freq).length === 0) return null;

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const topMuscles = sorted.slice(0, 2).map(([m]) => muscleSlugToNl(m));
  const MAJOR = ["chest", "lats", "upper-back", "quads", "hamstrings", "glutes", "shoulders"];
  const missed = MAJOR.filter((m) => !freq[m]).map(muscleSlugToNl);

  if (missed.length === 0) {
    return {
      heading: "Goede spierbalans.",
      body: "Je hebt de afgelopen twee weken vrijwel alle grote spiergroepen getraind.",
    };
  }

  const top = topMuscles.join(" en ");
  const lowArr = missed.slice(0, 2);
  const low = lowArr.join(" en ");
  const verb = lowArr.length === 1 ? "kreeg" : "kregen";

  if (missed.length >= 5) {
    return {
      heading: `Veel focus op ${top}.`,
      body: "Voeg meer afwisseling toe voor een completer programma.",
    };
  }

  return {
    heading: `${low} ${verb} weinig aandacht.`,
    body: `Je traint goed op ${top}, maar ${low} kwamen de afgelopen twee weken minder aan bod.`,
  };
}

function getMealPrepInsight(mealPrepPlan) {
  const days = mealPrepPlan
    ? Object.keys(mealPrepPlan.days || mealPrepPlan.meals || {}).length
    : 0;
  const stat = `${days}/7`;
  const statLabel = "dagen gepland";
  if (days === 0)
    return { heading: "Maaltijdplan is leeg.", body: "Voeg maaltijden toe om je week goed voor te bereiden." };
  if (days >= 7)
    return { stat, statLabel, body: "Je maaltijdplan staat klaar voor de hele week." };
  if (days >= 5)
    return { stat, statLabel, body: `${days} van de 7 dagen gepland. Nog een paar maaltijden toe te voegen.` };
  return { stat, statLabel, body: "Vul het plan verder aan voor een rustigere week." };
}

function SmartInsightsCard({ sessions, mealPrepEnabled, mealPrepPlan, loggedDaysCount, planData }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);

  const voedingInsight = getVoedingInsight(loggedDaysCount);
  const weightTrendInsight = getWeightTrendInsight(planData?.weightHistory, planData?.goalType);
  const goalProgressInsight = getGoalProgressInsight(planData);
  const muscleBalanceInsight = getMuscleBalanceInsight(sessions);

  const insights = [
    { ...getWorkoutInsight(sessions),           category: "Training",     icon: <IoBarbellOutline size={12} /> },
    ...(weightTrendInsight  ? [{ ...weightTrendInsight,  category: "Gewicht",      icon: <IoTrendingUpOutline size={12} /> }] : []),
    ...(goalProgressInsight ? [{ ...goalProgressInsight, category: "Doelstelling", icon: <IoFlagOutline size={12} /> }] : []),
    ...(voedingInsight      ? [{ ...voedingInsight,      category: "Voeding",      icon: <IoNutritionOutline size={12} /> }] : []),
    ...(muscleBalanceInsight ? [{ ...muscleBalanceInsight, category: "Spieren",    icon: <IoBodyOutline size={12} /> }] : []),
    ...(mealPrepEnabled     ? [{ ...getMealPrepInsight(mealPrepPlan), category: "Meal prep", icon: <IoCalendarOutline size={12} /> }] : []),
  ];

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIdx(Math.round(el.scrollLeft / el.offsetWidth));
  }

  return (
    <div className={styles.insightCard}>
      <span className={styles.insightCardTitle}>Slimme inzichten</span>
      <div className={styles.insightScroll} ref={scrollRef} onScroll={handleScroll}>
        {insights.map((item, i) => (
          <div key={i} className={styles.insightPill}>
            <div className={styles.insightPillCat}>
              {item.icon}
              <span>{item.category}</span>
            </div>
            {item.stat != null ? (
              <>
                <div className={styles.insightPillStat}>{item.stat}</div>
                {item.statLabel && <div className={styles.insightPillStatLabel}>{item.statLabel}</div>}
              </>
            ) : (
              item.heading && <div className={styles.insightPillHeading}>{item.heading}</div>
            )}
            <div className={styles.insightPillBody}>{item.body}</div>
          </div>
        ))}
      </div>
      <div className={styles.insightDots}>
        {insights.map((_, i) => (
          <div key={i} className={`${styles.insightDot} ${i === activeIdx ? styles.insightDotActive : ""}`} />
        ))}
      </div>
    </div>
  );
}

// ─── WeekProgressCard ─────────────────────────────────────────────────────────

function WeekProgressCard({ planData }) {
  const { goalType, startWeight, targetWeight, goalDate, weightHistory } = planData || {};

  if (!goalType || goalType === "Behoud" || goalType === "Recomp") return null;
  if (!startWeight || !targetWeight || !goalDate || !weightHistory?.length) return null;

  const currentWeight = weightHistory[weightHistory.length - 1].weight;
  const startDate = weightHistory[0].date;
  const today = todayIso();

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysPassed = Math.max(0, (new Date(today).getTime() - new Date(startDate).getTime()) / msPerDay);
  const totalDays = Math.max(1, (new Date(goalDate).getTime() - new Date(startDate).getTime()) / msPerDay);
  const fraction = Math.min(1, daysPassed / totalDays);
  const pct = Math.round(fraction * 100);

  const expectedNow = startWeight + (targetWeight - startWeight) * fraction;
  const diff = currentWeight - expectedNow;
  const isLoss = targetWeight < startWeight;

  const goodDiff = isLoss ? diff < -0.2 : diff > 0.2;
  const onTrackDiff = Math.abs(diff) <= 0.2;

  let statusLabel, statusColor;
  if (onTrackDiff) {
    statusLabel = "Op schema";
    statusColor = "var(--accent)";
  } else if (goodDiff) {
    statusLabel = "Voorop schema";
    statusColor = "#72A82C";
  } else {
    statusLabel = `${Math.abs(diff).toFixed(1)} kg achter`;
    statusColor = "#C13232";
  }

  return (
    <div className={styles.onTrackCard}>
      <div className={styles.onTrackHeader}>
        <span className={styles.onTrackTitle}>Gewichtsdoel</span>
        <span className={styles.onTrackStatus} style={{ color: statusColor }}>{statusLabel}</span>
      </div>
      <div className={styles.onTrackRow}>
        <div className={styles.onTrackItem}>
          <span className={styles.onTrackItemLabel}>Verwacht nu</span>
          <span className={styles.onTrackItemVal}>{expectedNow.toFixed(1)} kg</span>
        </div>
        <div className={styles.onTrackDivider} />
        <div className={styles.onTrackItem}>
          <span className={styles.onTrackItemLabel}>Huidig</span>
          <span className={styles.onTrackItemVal}>{currentWeight.toFixed(1)} kg</span>
        </div>
        <div className={styles.onTrackDivider} />
        <div className={styles.onTrackItem}>
          <span className={styles.onTrackItemLabel}>Doel</span>
          <span className={styles.onTrackItemVal}>{targetWeight.toFixed(1)} kg</span>
        </div>
      </div>
      <div className={styles.onTrackBar}>
        <div className={styles.onTrackBarFill} style={{ width: `${pct}%`, backgroundColor: statusColor }} />
      </div>
      <div className={styles.onTrackBarLabel}>{pct}% van plan verstreken</div>
    </div>
  );
}

// ─── PlanNutritionCard ────────────────────────────────────────────────────────

function getActivityLabel(days) {
  if (!days || days === 0) return "sedentair";
  if (days <= 2) return `${days}×/week licht actief`;
  if (days <= 4) return `${days}×/week matig actief`;
  if (days <= 6) return `${days}×/week zeer actief`;
  return `${days}×/week extreem actief`;
}

function getActivityMultiplier(days) {
  if (!days || days === 0) return "×1.20";
  if (days <= 2) return "×1.375";
  if (days <= 4) return "×1.55";
  if (days <= 6) return "×1.725";
  return "×1.90";
}

function getProteinPerKg(goalType) {
  if (goalType === "Toename") return 1.8;
  if (goalType === "Afname" || goalType === "Afvallen") return 2.0;
  if (goalType === "Recomp") return 2.2;
  return 1.6;
}

function PlanNutritionCard({ macros, profileData, planData }) {
  const { kcal, protein, fat, carbs } = macros || {};
  const { weight, height, birthDate, gender, exerciseDaysPerWeek, jobType, sleepHours } = profileData || {};
  const { goalType, dailyCalories } = planData || {};

  let bmr = null, tdee = null, delta = null;
  if (weight && height && birthDate && gender) {
    try {
      const age = calcAge(birthDate);
      bmr = Math.round(calcBMR(weight, height, age, gender));
      tdee = calcTDEE(bmr, exerciseDaysPerWeek || 0, jobType || "sedentair", sleepHours || 7);
      if (dailyCalories) delta = Math.round(dailyCalories - tdee);
    } catch {}
  }

  const proteinPerKg = getProteinPerKg(goalType);

  if (!kcal) return null;

  return (
    <div className={styles.nutritionCard}>
      {/* Kcal + macros */}
      <div className={styles.nutritionTop}>
        <div>
          <div className={styles.planCalorieValue}>{Math.round(kcal)}</div>
          <div className={styles.planCalorieLabel}>kcal per dag</div>
        </div>
      </div>

      <div className={styles.nutritionMacroRow}>
        {[
          { label: "Eiwit",  val: protein, unit: "g", color: "#C13232" },
          { label: "Vet",    val: fat,     unit: "g", color: "var(--accent)" },
          { label: "Koolh.", val: carbs,   unit: "g", color: "#2A9DB5" },
        ].map(({ label, val, unit, color }) => (
          <div key={label} className={styles.nutritionMacroItem}>
            <span className={styles.nutritionMacroVal} style={{ color }}>{val}</span>
            <span className={styles.nutritionMacroUnit}>{unit}</span>
            <span className={styles.nutritionMacroLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Onderbouwing */}
      <div className={styles.nutritionSep} />
      <div className={styles.nutritionUnderpinTitle}>Onderbouwing</div>

      {bmr && (
        <div className={styles.nutritionRow}>
          <div className={styles.nutritionRowLabel}>Basismetabolisme</div>
          <div className={styles.nutritionRowVal}>{bmr.toLocaleString("nl-NL")} kcal</div>
        </div>
      )}

      {tdee && (
        <div className={styles.nutritionRow}>
          <div className={styles.nutritionRowLabel}>Totaal verbruik</div>
          <div className={styles.nutritionRowVal}>{tdee.toLocaleString("nl-NL")} kcal</div>
        </div>
      )}

      {delta != null && Math.abs(delta) > 0 && (
        <div className={styles.nutritionRow}>
          <div className={styles.nutritionRowLabel}>Doelcorrectie</div>
          <div className={styles.nutritionRowVal} style={{ color: delta > 0 ? "#72A82C" : "var(--accent)" }}>
            {delta > 0 ? "+" : ""}{delta} kcal
          </div>
        </div>
      )}

      <div className={styles.nutritionRow}>
        <div className={styles.nutritionRowLabel}>Eiwitdoelstelling</div>
        <div className={styles.nutritionRowVal}>{proteinPerKg} g/kg</div>
      </div>
    </div>
  );
}

// ─── PlanUnderpinExplain ──────────────────────────────────────────────────────

function PlanUnderpinExplain({ profileData, planData }) {
  const { weight, height, birthDate, gender, exerciseDaysPerWeek, jobType, sleepHours } = profileData || {};
  const { goalType, dailyCalories } = planData || {};

  let bmr = null, tdee = null, delta = null;
  if (weight && height && birthDate && gender) {
    try {
      const age = calcAge(birthDate);
      bmr = Math.round(calcBMR(weight, height, age, gender));
      tdee = calcTDEE(bmr, exerciseDaysPerWeek || 0, jobType || "sedentair", sleepHours || 7);
      if (dailyCalories) delta = Math.round(dailyCalories - tdee);
    } catch {}
  }

  const items = [
    bmr && {
      title: "Basismetabolisme (BMR)",
      desc: "Je basismetabolisme is de hoeveelheid calorieën die je lichaam per dag verbrandt terwijl je volledig in rust bent. Denk aan ademhaling, je hartslag, lichaamstemperatuur en alle andere processen die je lichaam automatisch uitvoert. Dit getal verandert nauwelijks op dagelijkse basis en vormt de basis van je caloriebehoefte.",
      sub: "Berekend via Mifflin-St Jeor (1990)",
    },
    tdee && {
      title: "Totaal dagverbruik (TDEE)",
      desc: `Je totale dagverbruik is je basismetabolisme vermenigvuldigd met een activiteitsfactor. Die factor houdt rekening met hoe actief je bent in het dagelijks leven en hoeveel je sport. Op basis van jouw ingestelde activiteitsniveau (${getActivityLabel(exerciseDaysPerWeek)}) wordt een factor van ${getActivityMultiplier(exerciseDaysPerWeek)} gebruikt. Dit is de hoeveelheid calorieën die je per dag nodig hebt om op gewicht te blijven.`,
      sub: "Total Daily Energy Expenditure",
    },
    delta != null && Math.abs(delta) > 0 && {
      title: "Doelcorrectie",
      desc: goalType === "Toename"
        ? "Omdat je wilt aankomen, eet je bewust iets meer dan je verbruikt. Dit kleine overschot aan calorieën geeft je lichaam de energie en bouwstoffen die nodig zijn voor spiergroei en gewichtstoename. Zonder dit overschot is het lastig om spiermassa op te bouwen."
        : "Omdat je wilt afvallen, eet je bewust iets minder dan je verbruikt. Je lichaam haalt de ontbrekende energie dan uit je vetreserves. Het tekort is bewust klein gehouden zodat je spiermassa zoveel mogelijk behoudt terwijl je toch afvalt.",
      sub: goalType === "Toename" ? "Calorie-surplus" : "Calorie-deficit",
    },
    {
      title: "Eiwitdoelstelling",
      desc: "Eiwit is het belangrijkste voedingsstof voor spierherstel en spieropbouw. Na het sporten heeft je lichaam eiwit nodig om spiervezels te herstellen en sterker te maken. Hoe actiever je bent en hoe groter je doel, hoe meer eiwit je per kilogram lichaamsgewicht nodig hebt. De aanbeveling is gebaseerd op uitgebreid wetenschappelijk onderzoek naar sporters.",
      sub: "Morton et al. (2018), British Journal of Sports Medicine",
    },
  ].filter(Boolean);

  return (
    <div className={styles.underpinSection}>
      {items.map((item) => (
        <div key={item.title} className={styles.underpinItem}>
          <div className={styles.planTypeTitle}>{item.title}</div>
          <div className={styles.underpinItemDesc}>{item.desc}</div>
          <div className={styles.underpinItemSub}>{item.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { authUser, mealPrepEnabled, helpModeEnabled, isAdmin, macroTargets, mealPrepPlan } = useUser();
  const { theme, themes, setTheme } = useTheme();
  const router = useRouter();

  // Navigation
  const [view, setView] = useState("main"); // main | settings | account | edit | plan | theme
  const [editField, setEditField] = useState(null); // { key, label, type, options }
  const [editValue, setEditValue] = useState("");
  const [editVisible, setEditVisible] = useState(false); // for PIN
  const [saving, setSaving] = useState(false);

  // Data
  const [profileData, setProfileData] = useState({});
  const [planData, setPlanData] = useState({});

  // Gym sessions (last 60 days for workout-data card)
  const [recentSessions, setRecentSessions] = useState([]);

  // Voeding logging days this week
  const [loggedDaysCount, setLoggedDaysCount] = useState(null);

  // Add weight modal
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  const [addWeightValue, setAddWeightValue] = useState("");
  const [addingWeight, setAddingWeight] = useState(false);

  // Weight history sheet
  const [weightHistoryOpen, setWeightHistoryOpen] = useState(false);

  // Recovery code display
  const [recoveryCodeVisible, setRecoveryCodeVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // Help overlay
  const [helpOpen, setHelpOpen] = useState(false);


  // ── Subscriptions ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authUser) return;
    return subscribeToProfile(authUser.uid, setProfileData);
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    return subscribeToPlan(authUser.uid, setPlanData);
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    return subscribeToGymSessionsInRange(authUser.uid, sixtyDaysAgo, now + 86400000, setRecentSessions);
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    getRecentLoggedDays(authUser.uid, 7).then(setLoggedDaysCount);
  }, [authUser]);

  // ── Computed workout data ──────────────────────────────────────────────────

  const workoutStats = useMemo(() => {
    if (!recentSessions.length) return { lastDate: null, topMuscle: null };
    const sorted = [...recentSessions].sort((a, b) => b.startedAt - a.startedAt);
    const lastDate = formatShortDate(sorted[0].startedAt);
    const freq = {};
    for (const s of recentSessions) {
      for (const m of s.musclesWorked || []) {
        freq[m] = (freq[m] || 0) + 1;
      }
    }
    const topSlug = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topMuscle = topSlug ? muscleSlugToNl(topSlug) : null;
    return { lastDate, topMuscle };
  }, [recentSessions]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openEdit = (field) => {
    setEditField(field);
    setEditValue(String(profileData[field.key] ?? ""));
    setEditVisible(false);
    setView("edit");
  };

  const handleSaveField = async () => {
    if (!authUser || !editField) return;
    setSaving(true);
    try {
      let val = editValue.trim();
      if (editField.type === "number") val = parseFloat(val) || 0;
      await updateProfile(authUser.uid, { [editField.key]: val });
      setView("account");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePickerField = async (value) => {
    if (!authUser || !editField) return;
    await updateProfile(authUser.uid, { [editField.key]: value });
    setView("account");
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleAddWeight = async () => {
    if (!authUser || !addWeightValue) return;
    const w = parseFloat(addWeightValue);
    if (isNaN(w) || w <= 0) return;
    setAddingWeight(true);
    try {
      await addWeightEntry(authUser.uid, { date: todayIso(), weight: w });
      setAddWeightOpen(false);
      setAddWeightValue("");
    } finally {
      setAddingWeight(false);
    }
  };

  const handleDeleteWeight = async (date) => {
    if (!authUser) return;
    await removeWeightEntry(authUser.uid, date);
  };

  const openPlanEdit = () => {
    router.push("/onboarding?mode=edit");
  };

  const handleCopyRecoveryCode = () => {
    if (!profileData.recoveryCode) return;
    navigator.clipboard.writeText(profileData.recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Account field definitions ──────────────────────────────────────────────

  const PERSONAL_FIELDS = [
    { key: "firstName", label: "Voornaam", type: "text" },
    { key: "birthDate", label: "Geboortedatum", type: "text", placeholder: "1-1-1996" },
    { key: "gender", label: "Geslacht", type: "picker", options: ["Man", "Vrouw", "Anders"] },
    { key: "weight", label: "Gewicht", type: "number", unit: "kg" },
    { key: "height", label: "Lengte", type: "number", unit: "cm" },
  ];

  const ACCOUNT_FIELDS = [
    { key: "username", label: "Gebruikersnaam", type: "text" },
    { key: "pin", label: "PIN", type: "pin" },
  ];

  const UNIT_FIELDS = [
    { key: "weightUnit", label: "Gewicht", type: "picker", options: ["kg", "lbs"] },
  ];

  function formatFieldValue(field) {
    const v = profileData[field.key];
    if (v === undefined || v === null || v === "") return "—";
    if (field.key === "pin") return "****";
    if (field.unit) return `${v} ${field.unit}`;
    return String(v);
  }

  // ── Current weight for plan ────────────────────────────────────────────────

  const currentWeight = useMemo(() => {
    if (planData.weightHistory?.length) {
      return planData.weightHistory[planData.weightHistory.length - 1].weight;
    }
    return profileData.weight ?? null;
  }, [planData.weightHistory, profileData.weight]);

  const displayName = profileData.firstName || authUser?.displayName?.split(" ")[0] || "Profiel";

  // ── Help steps ────────────────────────────────────────────────────────────

  const PROFILE_HELP_STEPS = [
    {
      title: "Doel instellen",
      description: (
        <>
          <p><strong>Waar stel je dit in?</strong><br />Tik op de doelkaart bovenaan om je plan te openen. Tik daarna op &apos;Wijzig&apos; rechtsboven om je doelen in te stellen of aan te passen.</p>
          <p><strong>Doeltype kiezen</strong><br />Je kiest uit vier opties: afvallen, aankomen, body recomp (vetmassa verminderen en spiermassa opbouwen) of op gewicht blijven. Vul daarna je startgewicht, doelgewicht en gewenste einddatum in.</p>
          <p><strong>Calorie-advies</strong><br />Op basis van je gegevens berekent de app hoeveel calorieën je per dag nodig hebt. Dit advies verschijnt in je planweergave en wordt ook gebruikt als doel in het Voeding-scherm.</p>
        </>
      ),
    },
    {
      title: "Gewicht bijhouden",
      description: (
        <>
          <p><strong>Meting toevoegen</strong><br />Open je plan via de doelkaart bovenaan. Tik op de + knop naast &apos;Voortgang&apos; om je huidige gewicht in te loggen. Voer het gewicht in kilogram in en tik op &apos;Opslaan&apos;.</p>
          <p><strong>Hoe vaak meten?</strong><br />Meet bij voorkeur wekelijks op dezelfde dag en hetzelfde tijdstip — bij voorkeur &apos;s ochtends voor het ontbijt. Zo zijn je metingen onderling vergelijkbaar en geeft de grafiek een betrouwbaar beeld.</p>
          <p><strong>De grafiek</strong><br />Alle metingen worden weergegeven als een vloeiende lijn over tijd. Je ziet direct de trend: gaat de lijn de goede kant op?</p>
        </>
      ),
    },
    {
      title: "Op schema?",
      description: (
        <>
          <p><strong>Wat berekent de app?</strong><br />De kaart &apos;Gewichtsdoel&apos; vergelijkt je huidige gewicht met het gewicht dat je op dit punt in je plan zou moeten hebben. De berekening gaat uit van een rechte lijn van je startgewicht naar je doelgewicht.</p>
          <p><strong>Kleuren</strong><br /><strong style={{color: "#72A82C"}}>Groen</strong> = je loopt voor op schema. <strong style={{color: "var(--accent)"}}>Oranje</strong> = je zit precies op schema. <strong style={{color: "#C13232"}}>Rood</strong> = je loopt iets achter.</p>
          <p><strong>Voortgangsbalk</strong><br />Onderaan de kaart zie je hoeveel procent van je plan al verstreken is. Zo zie je in één oogopslag hoe ver je al bent.</p>
        </>
      ),
    },
    {
      title: "Instellingen",
      description: (
        <>
          <p><strong>Openen</strong><br />Tik op het tandwiel-icoontje rechtsboven om naar de instellingen te gaan.</p>
          <p><strong>Account</strong><br />Pas hier je persoonlijke gegevens aan: voornaam, geboortedatum, geslacht, gewicht en lengte. Deze gegevens worden gebruikt voor berekeningen in de app.</p>
          <p><strong>Meal Prep Planner</strong><br />Schakel deze optie in om een extra tabblad toe te voegen aan de navigatiebalk onderaan. Zo heb je toegang tot de maaltijdplanningsfunctie.</p>
          <p><strong>Uitleg modus</strong><br />Schakel dit in om op alle navigatieschermen een ⓘ knop te tonen. Tik erop om per scherm uitleg te krijgen over de functies en hoe je ze gebruikt.</p>
        </>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.profilePage}>
      {/* ── Main ── */}
      {view === "main" && (
        <>
          <div className={styles.navHeader}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{displayName}&apos;s profiel</span>
            <button className={styles.navActionIcon} onClick={() => setView("settings")}>
              <IoSettingsOutline size={22} />
            </button>
          </div>

          <GoalCard planData={planData} onClick={() => setView("plan")} />

          <SmartInsightsCard
            sessions={recentSessions}
            mealPrepEnabled={mealPrepEnabled}
            mealPrepPlan={mealPrepPlan}
            loggedDaysCount={loggedDaysCount}
            planData={planData}
          />
        </>
      )}

      {/* ── Settings ── */}
      {view === "settings" && (
        <>
          <div className={styles.navHeader}>
            <button className={styles.navBackBtn} onClick={() => setView("main")}>
              <IoChevronBack size={22} />
            </button>
            <span className={styles.navTitle}>Instellingen</span>
            <div style={{ minWidth: 36 }} />
          </div>

          <div className={styles.settingsList}>
            <div className={styles.settingsRow} onClick={() => setView("account")}>
              <span className={styles.settingsRowIcon}><IoPersonOutline size={20} /></span>
              <div className={styles.settingsRowText}>
                <span className={styles.settingsRowLabel}>Account</span>
                <span className={styles.settingsRowSub}>Naam, PIN en persoonlijke gegevens</span>
              </div>
              <span className={styles.settingsRowArrow}><IoChevronForward size={18} /></span>
            </div>

            <div className={styles.settingsRow} onClick={() => setView("theme")}>
              <span className={styles.settingsRowIcon}><IoColorPaletteOutline size={20} /></span>
              <div className={styles.settingsRowText}>
                <span className={styles.settingsRowLabel}>Thema</span>
                <span className={styles.settingsRowSub}>{theme.name} — tik om te wijzigen</span>
              </div>
              <span className={styles.settingsRowArrow}><IoChevronForward size={18} /></span>
            </div>

            <div className={styles.settingsRow} style={{ cursor: "default" }}>
              <span className={styles.settingsRowIcon}><IoCalendarOutline size={20} /></span>
              <div className={styles.settingsRowText}>
                <span className={styles.settingsRowLabel}>Meal Prep Planner</span>
                <span className={styles.settingsRowSub}>Extra tabblad voor maaltijdplanning</span>
              </div>
              <button
                className={mealPrepEnabled ? styles.toggleBtnOn : styles.toggleBtnOff}
                onClick={() => authUser && toggleMealPrep(authUser.uid, !mealPrepEnabled)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>

            <div className={styles.settingsRow} style={{ cursor: "default" }}>
              <span className={styles.settingsRowIcon}><IoEyeOutline size={20} /></span>
              <div className={styles.settingsRowText}>
                <span className={styles.settingsRowLabel}>Uitleg modus</span>
                <span className={styles.settingsRowSub}>Toont ⓘ knop op elk scherm</span>
              </div>
              <button
                className={helpModeEnabled ? styles.toggleBtnOn : styles.toggleBtnOff}
                onClick={() => authUser && toggleHelpMode(authUser.uid, !helpModeEnabled)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>

            {isAdmin && (
              <div className={styles.settingsRow} onClick={() => router.push("/admin")}>
                <span className={styles.settingsRowIcon}><IoShieldCheckmarkOutline size={20} color="#FC9158" /></span>
                <div className={styles.settingsRowText}>
                  <span className={styles.settingsRowLabel}>Admin dashboard</span>
                  <span className={styles.settingsRowSub}>Gebruikers, oefeningen en recepten beheren</span>
                </div>
                <span className={styles.settingsRowArrow}><IoChevronForward size={18} /></span>
              </div>
            )}

            <div className={styles.settingsRow} onClick={handleLogout}>
              <span className={styles.settingsRowIcon}><IoLogOutOutline size={20} /></span>
              <div className={styles.settingsRowText}>
                <span className={styles.settingsRowLabel}>Uitloggen</span>
                <span className={styles.settingsRowSub}>Afmelden van Peak</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Theme ── */}
      {view === "theme" && (
        <>
          <div className={styles.navHeader}>
            <button className={styles.navBackBtn} onClick={() => setView("settings")}>
              <IoChevronBack size={22} />
            </button>
            <span className={styles.navTitle}>Thema Selecteren</span>
            <div style={{ minWidth: 36 }} />
          </div>

          <div className={styles.themePickerContent}>
            <div className={styles.themePickerCardList}>
              {themes.map((t) => {
                const isActive = theme.id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`${styles.themePickerCard} ${isActive ? styles.themePickerCardActive : ""}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <div className={styles.themePickerCardTop}>
                      <div className={styles.themePickerCardInfo}>
                        <div className={styles.themePickerCardName}>{t.name}</div>
                        <div className={styles.themePickerCardDesc}>{t.description}</div>
                      </div>
                      <div className={`${styles.themePickerCheck} ${isActive ? styles.themePickerCheckActive : ""}`}>
                        {isActive && <IoCheckmark size={14} />}
                      </div>
                    </div>
                    <div className={styles.themePickerSwatches}>
                      {t.swatchColors.map((color, i) => (
                        <div
                          key={i}
                          className={styles.themePickerSwatch}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Account ── */}
      {view === "account" && (
        <>
          <div className={styles.navHeader}>
            <button className={styles.navBackBtn} onClick={() => setView("settings")}>
              <IoChevronBack size={22} />
            </button>
            <span className={styles.navTitle}>Account</span>
            <div style={{ minWidth: 36 }} />
          </div>

          <div className={styles.accountContent}>
            <div className={styles.accountSection}>
              <div className={styles.accountSectionTitle}>Persoonlijke informatie</div>
              <div className={styles.accountList}>
                {PERSONAL_FIELDS.map((field) => (
                  <div key={field.key} className={styles.accountRow} onClick={() => openEdit(field)}>
                    <span className={styles.accountRowLabel}>{field.label}</span>
                    <span className={styles.accountRowValue}>{formatFieldValue(field)}</span>
                    <span className={styles.accountRowArrow}><IoChevronForward size={16} /></span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.accountSection}>
              <div className={styles.accountSectionTitle}>Gegevens</div>
              <div className={styles.accountList}>
                {ACCOUNT_FIELDS.map((field) => (
                  <div key={field.key} className={styles.accountRow} onClick={() => openEdit(field)}>
                    <span className={styles.accountRowLabel}>{field.label}</span>
                    <span className={styles.accountRowValue}>{formatFieldValue(field)}</span>
                    <span className={styles.accountRowArrow}><IoChevronForward size={16} /></span>
                  </div>
                ))}
                {profileData.recoveryCode && (
                  <div className={`${styles.accountRow} ${styles.recoveryCodeRow}`}>
                    <span className={styles.accountRowLabel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <IoKeyOutline size={15} color="var(--text-muted)" />
                      Herstelcode
                    </span>
                    <span className={`${styles.accountRowValue} ${styles.recoveryCodeValue} ${recoveryCodeVisible ? styles.recoveryCodeValueVisible : ""}`}>
                      {recoveryCodeVisible ? profileData.recoveryCode : "PEAK-••••-••••"}
                    </span>
                    <div className={styles.recoveryCodeActions}>
                      <button className={styles.recoveryCodeBtn} onClick={() => setRecoveryCodeVisible(v => !v)} type="button">
                        {recoveryCodeVisible ? <IoEyeOffOutline size={17} /> : <IoEyeOutline size={17} />}
                      </button>
                      {recoveryCodeVisible && (
                        <button className={styles.recoveryCodeBtn} onClick={handleCopyRecoveryCode} type="button">
                          {copied ? <IoCheckmark size={17} color="var(--accent)" /> : <IoCopyOutline size={17} />}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.accountSection}>
              <div className={styles.accountSectionTitle}>Eenheden</div>
              <div className={styles.accountList}>
                {UNIT_FIELDS.map((field) => (
                  <div key={field.key} className={styles.accountRow} onClick={() => openEdit(field)}>
                    <span className={styles.accountRowLabel}>{field.label}</span>
                    <span className={styles.accountRowValue}>{formatFieldValue(field)}</span>
                    <span className={styles.accountRowArrow}><IoChevronForward size={16} /></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit field ── */}
      {view === "edit" && editField && (
        <>
          <div className={styles.navHeader}>
            <button className={styles.navBackBtn} onClick={() => setView("account")}>
              <IoChevronBack size={22} />
            </button>
            <span className={styles.navTitle}>{editField.label}</span>
            {editField.type !== "picker" ? (
              <button className={styles.navAction} onClick={handleSaveField} disabled={saving}>
                Sla op
              </button>
            ) : (
              <div style={{ minWidth: 36 }} />
            )}
          </div>

          <div className={styles.editContent}>
            {editField.type === "picker" ? (
              <div className={styles.editPickerWrap}>
                {editField.options.map((opt) => (
                  <div
                    key={opt}
                    className={styles.editPickerOption}
                    onClick={() => handleSavePickerField(opt)}
                  >
                    <span className={styles.editPickerOptionLabel}>{opt}</span>
                    {String(profileData[editField.key]) === opt && (
                      <span className={styles.editPickerCheck}><IoCheckmark size={18} /></span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.editInputWrap}>
                <input
                  className={styles.editInput}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  type={editField.type === "pin" && !editVisible ? "password" : editField.type === "number" ? "number" : "text"}
                  inputMode={editField.type === "number" ? "decimal" : "text"}
                  placeholder={editField.placeholder ?? ""}
                  autoFocus
                />
                {editField.type === "pin" && (
                  <button className={styles.editVisibilityBtn} onClick={() => setEditVisible((v) => !v)}>
                    {editVisible ? <IoEyeOutline size={20} /> : <IoEyeOffOutline size={20} />}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Plan ── */}
      {view === "plan" && (
        <>
          <div className={styles.navHeader}>
            <button className={styles.navBackBtn} onClick={() => setView("main")}>
              <IoChevronBack size={22} />
            </button>
            <span className={styles.navTitle}>Mijn plan</span>
            <button className={styles.navAction} onClick={openPlanEdit}>Wijzig</button>
          </div>

          <GoalCard planData={planData} onClick={() => {}} />

          <div className={styles.planContent}>
            <WeekProgressCard planData={planData} />

            {/* Voortgang card */}
            <div className={styles.progressCard}>
              <div className={styles.progressHeader}>
                <span className={styles.progressTitle}>Voortgang</span>
                <button className={styles.progressHeaderBtn} onClick={() => { setAddWeightValue(""); setAddWeightOpen(true); }}>
                  <IoAdd size={20} />
                </button>
                <button className={styles.progressHeaderBtn} onClick={() => setWeightHistoryOpen(true)}>
                  <IoChevronForward size={18} />
                </button>
              </div>
              <div className={styles.progressCurrentRow}>
                <span className={styles.progressCurrentWeight}>
                  {currentWeight != null ? `${currentWeight} kg` : "—"}
                </span>
                <span className={styles.progressCurrentLabel}>Huidige gewicht</span>
              </div>
              <WeightChart entries={planData.weightHistory} />
            </div>

            <PlanNutritionCard
              macros={macroTargets}
              profileData={profileData}
              planData={planData}
            />

            {planData.planName && (
              <div className={styles.planTypeTitle}>{planData.planName}</div>
            )}
            {planData.planDescription && (
              <div className={styles.planDescription}>{planData.planDescription}</div>
            )}

            <PlanUnderpinExplain profileData={profileData} planData={planData} />

            {!planData.goalType && (
              <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", paddingTop: 24 }}>
                Geen plan ingesteld. Druk op &quot;Wijzig&quot; om te beginnen.
              </div>
            )}
          </div>
        </>
      )}


      {/* ── Weight history sheet ── */}
      {weightHistoryOpen && (
        <WeightHistorySheet
          entries={planData.weightHistory || []}
          targetWeight={planData.targetWeight}
          onClose={() => setWeightHistoryOpen(false)}
          onDelete={handleDeleteWeight}
        />
      )}

      {/* ── Add weight modal ── */}
      {addWeightOpen && createPortal(
        <div className={styles.modalOverlay} onClick={() => setAddWeightOpen(false)}>
          <div className={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Gewicht toevoegen</span>
              <button className={styles.modalCloseBtn} onClick={() => setAddWeightOpen(false)}>
                <IoClose size={20} />
              </button>
            </div>
            <div className={styles.modalInputWrap}>
              <input
                className={styles.modalInput}
                placeholder="82.0"
                value={addWeightValue}
                onChange={(e) => setAddWeightValue(e.target.value)}
                inputMode="decimal"
                autoFocus
              />
              <span className={styles.modalUnit}>kg</span>
            </div>
            <button
              className={styles.modalSaveBtn}
              onClick={handleAddWeight}
              disabled={addingWeight || !addWeightValue}
            >
              {addingWeight ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </div>,
        document.body
      )}

      {helpModeEnabled && view !== "settings" && (
        <button className={styles.helpBtn} onClick={() => setHelpOpen(true)} aria-label="Uitleg">
          <IoInformationCircleOutline size={22} />
        </button>
      )}
      {helpOpen && (
        <HelpOverlay steps={PROFILE_HELP_STEPS} onClose={() => setHelpOpen(false)} />
      )}

    </div>
  );
}
