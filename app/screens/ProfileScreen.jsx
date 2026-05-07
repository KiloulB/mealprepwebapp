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
} from "react-icons/io5";

import { auth } from "../firebase/config";
import { useUser } from "../context/UserContext";
import {
  subscribeToProfile,
  subscribeToPlan,
  updateProfile,
  updatePlan,
  addWeightEntry,
  toggleMealPrep,
  toggleHelpMode,
} from "../firebase/profileService";
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
            stroke="#2e2e30" strokeWidth={1} />
        ))}
        {/* Y-axis labels (right side) */}
        {yLabels.map((l, i) => (
          <text key={i} x={W - PAD_RIGHT + 4} y={l.y + 4}
            fontSize={9} fill="#666" textAnchor="start">
            {l.val}
          </text>
        ))}
        {/* Line */}
        <path d={pathD} fill="none" stroke="#FC9158" strokeWidth={2} strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#FC9158" />
        ))}
        {/* X-axis labels */}
        <text x={PAD_LEFT} y={H - 4} fontSize={9} fill="#666" textAnchor="start">{firstDate}</text>
        <text x={W - PAD_RIGHT} y={H - 4} fontSize={9} fill="#666" textAnchor="end">{lastDate}</text>
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
          <IoChevronForward size={16} color="#555" />
        </div>
      </div>
    );
  }

  const noWeightGoal = goalType === "Behoud" || goalType === "Recomp";
  const isLoss = goalType === "Afvallen";
  const isGain = goalType === "Toename";

  const title = noWeightGoal
    ? (goalType === "Recomp" ? "Body Recomp" : "Op gewicht blijven")
    : `${isGain ? "Aankomen" : "Afvallen"} ${goalAmount ?? 0} kg`;

  const badgeColor = isLoss ? "#FC9158" : isGain ? "#8DCF42" : "#08B6DC";
  const badgeBg   = isLoss ? "rgba(252,145,88,0.12)" : isGain ? "rgba(141,207,66,0.12)" : "rgba(8,182,220,0.12)";
  const badgeLabel = isLoss ? "Afvallen" : isGain ? "Aankomen" : goalType === "Recomp" ? "Recomp" : "Behoud";

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
        <IoChevronForward size={16} color="#555" style={{ flexShrink: 0 }} />
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

// ─── Main component ───────────────────────────────────────────────────────────

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
    statusColor = "#FC9158";
  } else if (goodDiff) {
    statusLabel = "Voorop schema";
    statusColor = "#8DCF42";
  } else {
    statusLabel = `${Math.abs(diff).toFixed(1)} kg achter`;
    statusColor = "#E4222A";
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { authUser, mealPrepEnabled, helpModeEnabled } = useUser();
  const router = useRouter();

  // Navigation
  const [view, setView] = useState("main"); // main | settings | account | edit | plan
  const [editField, setEditField] = useState(null); // { key, label, type, options }
  const [editValue, setEditValue] = useState("");
  const [editVisible, setEditVisible] = useState(false); // for PIN
  const [saving, setSaving] = useState(false);

  // Data
  const [profileData, setProfileData] = useState({});
  const [planData, setPlanData] = useState({});

  // Gym sessions (last 60 days for workout-data card)
  const [recentSessions, setRecentSessions] = useState([]);

  // Add weight modal
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  const [addWeightValue, setAddWeightValue] = useState("");
  const [addingWeight, setAddingWeight] = useState(false);

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

  const openPlanEdit = () => {
    router.push("/onboarding?mode=edit");
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
          <p><strong>Waar stel je dit in?</strong><br />Tik op de rode kaart bovenaan om je plan te openen. Tik daarna op &apos;Wijzig&apos; rechtsboven om je doelen in te stellen of aan te passen.</p>
          <p><strong>Doeltype kiezen</strong><br />Je kiest uit vier opties: afvallen, aankomen, body recomp (vetmassa verminderen en spiermassa opbouwen) of op gewicht blijven. Vul daarna je startgewicht, doelgewicht en gewenste einddatum in.</p>
          <p><strong>Calorie-advies</strong><br />Op basis van je gegevens berekent de app hoeveel calorieën je per dag nodig hebt. Dit advies verschijnt in je planweergave en wordt ook gebruikt als doel in het Voeding-scherm.</p>
        </>
      ),
    },
    {
      title: "Gewicht bijhouden",
      description: (
        <>
          <p><strong>Meting toevoegen</strong><br />Open je plan via de rode kaart. Tik op de + knop naast &apos;Voortgang&apos; om je huidige gewicht in te loggen. Voer het gewicht in kilogram in en tik op &apos;Opslaan&apos;.</p>
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
          <p><strong>Kleuren</strong><br /><strong style={{color: "#8DCF42"}}>Groen</strong> = je loopt voor op schema. <strong style={{color: "#FC9158"}}>Oranje</strong> = je zit precies op schema. <strong style={{color: "#E4222A"}}>Rood</strong> = je loopt iets achter.</p>
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
          <p><strong>Uitleg modus</strong><br />Met deze schakelaar zet je het informatie-icoontje (ⓘ) aan of uit. Zet het uit zodra je de app goed kent en de uitleg niet meer nodig hebt.</p>
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
            <div style={{ minWidth: 36 }} />
            <span style={{ fontSize: 22, fontWeight: 700 }}>{displayName}&apos;s profiel</span>
            <button className={styles.navActionIcon} onClick={() => setView("settings")}>
              <IoSettingsOutline size={22} />
            </button>
          </div>

          <GoalCard planData={planData} onClick={() => setView("plan")} />

          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Workout-data</div>
            <div className={styles.infoCardRow}>
              Laatste workout: {workoutStats.lastDate ?? "—"}
            </div>
            <div className={styles.infoCardRow}>
              Meest getrainde spiergroep: {workoutStats.topMuscle ?? "—"}
            </div>
          </div>
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
              <span className={styles.settingsRowLabel}>Account</span>
              <span className={styles.settingsRowArrow}><IoChevronForward size={18} /></span>
            </div>

            <div className={styles.settingsRow} style={{ cursor: "default" }}>
              <span className={styles.settingsRowIcon}><IoCalendarOutline size={20} /></span>
              <span className={styles.settingsRowLabel}>Meal Prep Planner</span>
              <button
                className={mealPrepEnabled ? styles.toggleBtnOn : styles.toggleBtnOff}
                onClick={() => authUser && toggleMealPrep(authUser.uid, !mealPrepEnabled)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
            <div className={styles.settingsRow} style={{ cursor: "default" }}>
              <span className={styles.settingsRowIcon}><IoInformationCircleOutline size={20} /></span>
              <span className={styles.settingsRowLabel}>Uitleg modus</span>
              <button
                className={helpModeEnabled ? styles.toggleBtnOn : styles.toggleBtnOff}
                onClick={() => authUser && toggleHelpMode(authUser.uid, !helpModeEnabled)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
            <div className={styles.settingsRow} onClick={handleLogout}>
              <span className={styles.settingsRowIcon}><IoLogOutOutline size={20} /></span>
              <span className={styles.settingsRowLabel}>Uitloggen</span>
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
                <button className={styles.progressHeaderBtn}>
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

            {/* Calorie advice + plan description */}
            {planData.dailyCalories ? (
              <>
                <div className={styles.planCalorieValue}>{Math.round(planData.dailyCalories)}</div>
                <div className={styles.planCalorieLabel}>Dagelijkse calorie-advies</div>
              </>
            ) : null}

            {planData.planName && (
              <div className={styles.planTypeTitle}>{planData.planName}</div>
            )}
            {planData.planDescription && (
              <div className={styles.planDescription}>{planData.planDescription}</div>
            )}

            {!planData.goalType && (
              <div style={{ color: "#555", fontSize: 14, textAlign: "center", paddingTop: 24 }}>
                Geen plan ingesteld. Druk op &quot;Wijzig&quot; om te beginnen.
              </div>
            )}
          </div>
        </>
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

      {helpModeEnabled && (
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
