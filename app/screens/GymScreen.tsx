function addDaysMs(ms: number, days: number) {
  return ms + days * 24 * 60 * 60 * 1000;
}
function formatShortDate(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}
function formatDuration(s: { durationSec?: number; finishedAt?: number; startedAt: number }): string {
  const secs =
    s.durationSec ??
    (s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 1000) : null);
  if (!secs || secs < 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import gymStyles from "../gym/gym.module.css";

import {
  IoExpandOutline,
  IoCalendarOutline,
  IoTimeOutline,
  IoEllipsisHorizontal,
  IoAdd,
  IoClose,
  IoInformationCircleOutline,
} from "react-icons/io5";

import MuscleMap from "../components/gym/muscle-map/MuscleMap";
import TemplateMakerModal from "../components/gym/TemplateMakerModal";
import TemplateStartModal from "../components/gym/TemplateStartModal";
import HelpOverlay from "../components/HelpOverlay";
import { useUser } from "../context/UserContext";

import { auth } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";

import { subscribeToGymSessionsInRange } from "../firebase/gymService";
import { subscribeToGymTemplates, deleteGymTemplate } from "../firebase/gymTemplateService";

import type { GymSession, GymTemplate } from "../types/gym";
import { startOfWeekMs } from "../lib/dateUtils";

export default function GymHomePage() {
  const router = useRouter();
  const { helpModeEnabled } = useUser();

  const [uid, setUid] = useState<string>("");
  const [authReady, setAuthReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Week navigation
  const [weekStartMs, setWeekStartMs] = useState(() => startOfWeekMs(new Date()));
  const weekEndMs = useMemo(() => addDaysMs(weekStartMs, 7), [weekStartMs]);
  const weekLabel = useMemo(() => {
    const start = new Date(weekStartMs);
    const endInclusive = new Date(weekEndMs - 1);
    const fmt = new Intl.DateTimeFormat("nl-NL", { month: "short", day: "numeric" });
    return `${fmt.format(start)} - ${fmt.format(endInclusive)}`;
  }, [weekStartMs, weekEndMs]);
  const thisWeekStartMs = useMemo(() => startOfWeekMs(new Date()), []);
  const disableNext = weekStartMs === thisWeekStartMs;

  // Data
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [templates, setTemplates] = useState<GymTemplate[]>([]);

  // Modals
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateMakerOpen, setTemplateMakerOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<GymTemplate | null>(null);

  // Template options menu
  const [menuTemplate, setMenuTemplate] = useState<GymTemplate | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  function openTemplateMenu(e: React.MouseEvent<HTMLButtonElement>, t: GymTemplate) {
    e.stopPropagation();
    if (menuTemplate?.id === t.id) {
      setMenuTemplate(null);
      setMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuTemplate(t);
  }

  function closeTemplateMenu() {
    setMenuTemplate(null);
    setMenuPos(null);
  }

  // Fullscreen muscle map
  const [muscleFullscreen, setMuscleFullscreen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "");
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) { setSessions([]); return; }
    return subscribeToGymSessionsInRange(uid, weekStartMs, weekEndMs, setSessions);
  }, [uid, weekStartMs, weekEndMs]);

  useEffect(() => {
    if (!uid) { setTemplates([]); return; }
    return subscribeToGymTemplates(uid, setTemplates);
  }, [uid]);

  const templateStatusMap = useMemo(() => {
    const map = new Map<string, "bezig" | "afgerond">();
    for (const s of sessions) {
      if (!s.templateId) continue;
      if (s.status === "unfinished") {
        map.set(s.templateId, "bezig");
      } else if (s.status === "finished" && map.get(s.templateId) !== "bezig") {
        map.set(s.templateId, "afgerond");
      }
    }
    return map;
  }, [sessions]);

  const weekMuscles = useMemo(() => {
    const slugs = new Set<string>();
    for (const s of sessions) {
      if (s.status !== "finished") continue;
      (s.musclesWorked || []).forEach((m) => slugs.add(String(m)));
    }
    return [...slugs];
  }, [sessions]);

  const hasUnfinishedThisWeek = useMemo(
    () => sessions.some((s) => s.status === "unfinished"),
    [sessions]
  );

  const historyMonthLabel = useMemo(() => {
    const d = new Date(weekStartMs);
    return d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" }).toUpperCase();
  }, [weekStartMs]);

  const GYM_HELP_STEPS = [
    {
      title: "Workout starten",
      description: (
        <>
          <p><strong>Hoe begin je?</strong><br />Tik op de oranje knop &apos;Workout starten&apos; rechtsboven. Je kiest daarna één van je opgeslagen templates om de workout mee te beginnen.</p>
          <p><strong>Tijdens de workout</strong><br />Tik het vakje naast een set aan zodra je hem hebt gedaan. Wil je het gewicht of het aantal herhalingen aanpassen? Tik op het getal en typ het nieuwe in. Wil je een extra set toevoegen? Tik op het + icoontje onder de oefening.</p>
          <p><strong>Afronden</strong><br />Als je klaar bent, tik je op &apos;Workout afronden&apos;. De sessie wordt opgeslagen en je kunt hem later terugvinden in de geschiedenis.</p>
        </>
      ),
    },
    {
      title: "Template aanmaken",
      description: (
        <>
          <p><strong>Nieuw schema</strong><br />Tik op het + icoontje rechtsboven (naast &apos;Workouts&apos;) om een nieuw trainingsschema aan te maken. Geef het een duidelijke naam, bijvoorbeeld &apos;Push dag&apos; of &apos;Benen&apos;.</p>
          <p><strong>Oefeningen toevoegen</strong><br />Zoek oefeningen op naam of spiergroep. Per oefening stel je het aantal sets, het startgewicht en de herhalingen in. Je kunt altijd meer sets toevoegen of alles aanpassen.</p>
          <p><strong>Spierkaart</strong><br />Terwijl je oefeningen toevoegt, kleurt de lichaamskaart live in welke spiergroepen je schema aanspreekt. Zo zie je direct of je schema compleet is.</p>
        </>
      ),
    },
    {
      title: "Getrainde spiergroepen",
      description: (
        <>
          <p><strong>Wat zie je?</strong><br />De lichaamskaart bovenaan toont welke spiergroepen je deze week al hebt getraind. Hoe intenser de kleur, hoe vaker die spiergroep aan bod is gekomen.</p>
          <p><strong>Waarvoor gebruik je dit?</strong><br />In één oogopslag zie je welke spiergroepen je deze week nog niet hebt getraind. Zo kun je je volgende workout daar bewust op afstemmen en voorkom je dat je steeds dezelfde delen traint.</p>
          <p><strong>Groter scherm</strong><br />Tik op het vergroot-icoontje rechts voor een volledig scherm overzicht van zowel voor- als achterkant van het lichaam.</p>
        </>
      ),
    },
    {
      title: "Workout geschiedenis",
      description: (
        <>
          <p><strong>Terugkijken</strong><br />Tik op het klok-icoontje rechtsboven om al je voltooide workouts te zien. Je ziet per sessie de datum en de duur.</p>
          <p><strong>Details bekijken</strong><br />Tik op een sessie voor de volledige details: alle oefeningen die je hebt gedaan, met de gebruikte gewichten, het aantal herhalingen en het totale volume (sets × reps × kg).</p>
          <p><strong>Progressie bijhouden</strong><br />Vergelijk sessies over tijd om te zien of je sterker wordt. Gaat het gewicht omhoog of kun je meer reps? Dan maak je progressie.</p>
        </>
      ),
    },
  ];

  return (
    <div className={gymStyles.gymPage}>
      {/* Header */}
      <div className={gymStyles.gymHeader}>
        <div className={gymStyles.gymTitle}>Workouts</div>

        <button
          className={gymStyles.workoutStartBtn}
          onClick={() => setTemplatePickerOpen(true)}
        >
          Workout starten
        </button>

        {/* Spiergroepen Card */}
        <div className={gymStyles.muscleCard}>
          <div className={gymStyles.muscleCardHeader}>
            <span className={gymStyles.muscleCardTitle}>Getrainde spiergroepen deze week</span>
            <button className={gymStyles.expandBtn} aria-label="Volledig scherm" onClick={() => setMuscleFullscreen(true)}>
              <IoExpandOutline size={16} />
            </button>
          </div>
          <div className={gymStyles.muscleMapRow}>
            <div className={gymStyles.muscleMapItem}>
              <MuscleMap view="front" workedSlugs={weekMuscles} height={180} />
            </div>
            <div className={gymStyles.muscleMapItem}>
              <MuscleMap view="back" workedSlugs={weekMuscles} height={180} />
            </div>
          </div>
          {hasUnfinishedThisWeek && (
            <div className={gymStyles.muscleCardNote}>
              Onvoltooide workouts tellen niet mee
            </div>
          )}
          <div className={gymStyles.weekSelectorRow}>
            <button
              className={gymStyles.weekSelectorBtn}
              onClick={() => setWeekStartMs((v) => addDaysMs(v, -7))}
              aria-label="Vorige week"
            >
              &#60;
            </button>
            <div className={gymStyles.weekLabel}>{weekLabel}</div>
            <button
              className={gymStyles.weekSelectorBtn}
              onClick={() => setWeekStartMs((v) => addDaysMs(v, 7))}
              disabled={disableNext}
              aria-label="Volgende week"
            >
              &#62;
            </button>
          </div>
        </div>

        {/* Workout-geschiedenis */}
        <div className={gymStyles.historyCard}>
          <div className={gymStyles.historyCardTitle}>Workout-geschiedenis</div>
          <div className={gymStyles.historyMonth}>{historyMonthLabel}</div>
          {!authReady ? (
            <div className={gymStyles.historyEmpty}>Account laden…</div>
          ) : !uid ? (
            <div className={gymStyles.historyEmpty}>Niet ingelogd.</div>
          ) : sessions.length === 0 ? (
            <div className={gymStyles.historyEmpty}>Geen workouts deze week.</div>
          ) : (
            sessions.map((s) => {
              const dur = formatDuration(s);
              const finished = s.status === "finished";
              return (
                <div
                  key={s.id}
                  className={gymStyles.historyRow}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/gym/workout/${s.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/gym/workout/${s.id}`); }}
                >
                  <div>
                    <div className={gymStyles.historyRowName}>{s.name || "Workout"}</div>
                    <div className={gymStyles.historyRowMeta}>
                      <span className={gymStyles.historyRowMetaItem}>
                        <IoCalendarOutline size={13} />
                        {formatShortDate(s.startedAt)}
                      </span>
                      {dur ? (
                        <span className={gymStyles.historyRowMetaItem}>
                          <IoTimeOutline size={13} />
                          {dur}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className={`${gymStyles.historyStatusBadge} ${finished ? gymStyles.historyStatusAfgerond : gymStyles.historyStatusBezig}`}>
                    {finished ? "Afgerond" : "Bezig"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Templates */}
        <div className={gymStyles.historyCard}>
          <div className={gymStyles.templateCardHeader}>
            <span className={gymStyles.historyCardTitle} style={{ marginBottom: 0 }}>
              Templates ({templates.length})
            </span>
            <button
              className={gymStyles.templateAddBtn}
              onClick={() => setTemplateMakerOpen(true)}
              aria-label="Template toevoegen"
            >
              <IoAdd size={20} />
            </button>
          </div>
          {templates.length === 0 ? (
            <div className={gymStyles.historyEmpty} style={{ marginTop: 14 }}>
              Nog geen templates.
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className={gymStyles.templateRow}
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
                onClick={() => { setPreviewTemplate(t); setTemplatePickerOpen(true); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setPreviewTemplate(t); setTemplatePickerOpen(true); } }}
              >
                <div className={gymStyles.templateRowMain}>
                  <div className={gymStyles.templateRowName}>{t.name}</div>
                  <div className={gymStyles.templateRowExercises}>
                    {(t.exercises || []).map((e) => e.ref.name).join(", ")}
                  </div>
                  {templateStatusMap.has(t.id) && (
                    <div className={`${gymStyles.templateStatusBadge} ${
                      templateStatusMap.get(t.id) === "bezig"
                        ? gymStyles.templateStatusBezig
                        : gymStyles.templateStatusAfgerond
                    }`}>
                      <div className={gymStyles.templateStatusDot} />
                      {templateStatusMap.get(t.id) === "bezig" ? "Bezig" : "Afgerond"}
                    </div>
                  )}
                </div>
                <button
                  className={gymStyles.templateDotBtn}
                  aria-label="Opties"
                  onClick={(e) => { e.stopPropagation(); openTemplateMenu(e, t); }}
                >
                  <IoEllipsisHorizontal size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <TemplateStartModal
        open={templatePickerOpen}
        uid={uid}
        onClose={() => { setTemplatePickerOpen(false); setPreviewTemplate(null); }}
        onStarted={(sessionId) => router.push(`/gym/workout/${sessionId}`)}
        initialTemplate={previewTemplate ?? undefined}
      />

      <TemplateMakerModal
        open={templateMakerOpen}
        uid={uid}
        onClose={() => setTemplateMakerOpen(false)}
      />

      {/* Fullscreen muscle map — portal */}
      {muscleFullscreen && createPortal(
        <div className={gymStyles.muscleFullOverlay}>
          <div className={gymStyles.muscleFullTopBar}>
            <button
              className={gymStyles.muscleFullCloseBtn}
              onClick={() => setMuscleFullscreen(false)}
              aria-label="Sluiten"
            >
              <IoClose size={20} />
            </button>
            <span className={gymStyles.muscleFullTitle}>Spiergroepen</span>
            <div style={{ width: 40 }} />
          </div>

          <div className={gymStyles.muscleFullScroll}>
            <div className={gymStyles.weekSelectorRow}>
              <button
                className={gymStyles.weekSelectorBtn}
                onClick={() => setWeekStartMs((v) => addDaysMs(v, -7))}
                aria-label="Vorige week"
              >
                &#60;
              </button>
              <div className={gymStyles.weekLabel}>{weekLabel}</div>
              <button
                className={gymStyles.weekSelectorBtn}
                onClick={() => setWeekStartMs((v) => addDaysMs(v, 7))}
                disabled={disableNext}
                aria-label="Volgende week"
              >
                &#62;
              </button>
            </div>

            <div className={gymStyles.muscleFullBigMaps}>
              <MuscleMap view="front" workedSlugs={weekMuscles} height={220} />
              <MuscleMap view="back" workedSlugs={weekMuscles} height={220} />
            </div>

            {hasUnfinishedThisWeek && (
              <div className={gymStyles.muscleCardNote}>Onvoltooide workouts tellen niet mee</div>
            )}

            {weekMuscles.length === 0 && (
              <div className={gymStyles.muscleCardNote} style={{ marginTop: 16 }}>
                Geen afgeronde workouts deze week.
              </div>
            )}

            {sessions.filter((s) => s.status === "finished" && (s.musclesWorked ?? []).length > 0).length > 0 && (
              <>
                <div className={gymStyles.muscleFullSectionLabel}>Per workout</div>
                {sessions
                  .filter((s) => s.status === "finished" && (s.musclesWorked ?? []).length > 0)
                  .map((s) => (
                    <div key={s.id} className={gymStyles.muscleFullSessionRow}>
                      <div className={gymStyles.muscleFullSessionInfo}>
                        <div className={gymStyles.muscleFullSessionName}>{s.name || "Workout"}</div>
                        <div className={gymStyles.muscleFullSessionDate}>{formatShortDate(s.startedAt)}</div>
                        <div className={gymStyles.muscleFullSessionMuscleList}>
                          {(s.musclesWorked ?? []).join(", ")}
                        </div>
                      </div>
                      <div className={gymStyles.muscleFullSessionMaps}>
                        <MuscleMap view="front" workedSlugs={s.musclesWorked ?? []} height={65} />
                        <MuscleMap view="back" workedSlugs={s.musclesWorked ?? []} height={65} />
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Template options menu — portal (avoids stacking-context clipping from tabPage) */}
      {menuTemplate && menuPos && createPortal(
        <>
          <div className={gymStyles.menuOverlay} onClick={closeTemplateMenu} />
          <div
            className={gymStyles.templateMenu}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
          >
            <button
              className={gymStyles.templateMenuItem}
              style={{ color: "#E4222A" }}
              onClick={() => {
                const t = menuTemplate;
                closeTemplateMenu();
                if (window.confirm(`"${t.name}" verwijderen?`)) deleteGymTemplate(uid, t.id);
              }}
            >
              Verwijderen
            </button>
          </div>
        </>,
        document.body
      )}


      {helpModeEnabled && (
        <button className={gymStyles.helpBtn} onClick={() => setHelpOpen(true)} aria-label="Uitleg">
          <IoInformationCircleOutline size={22} />
        </button>
      )}
      {helpOpen && (
        <HelpOverlay steps={GYM_HELP_STEPS} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  );
}
