"use client";

import React, { useMemo, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import homeStyles from "../../home.module.css";
import MuscleMap from "./muscle-map/MuscleMap";
import type { FreeExercise } from "../../lib/freeExerciseDb";
import {
  buildExerciseTags,
  getExerciseImageUrl,
  searchExercises,
} from "../../lib/freeExerciseDb";
import { musclesToSlugs } from "../../lib/muscleSlugMap";
import type { GymExerciseRef } from "../../types/gym";

function toRef(ex: FreeExercise): GymExerciseRef {
  const imgRel = (ex.images || [])[0] || "";
  return {
    exerciseId: String(ex.id),
    name: ex.name,
    image: imgRel ? getExerciseImageUrl(imgRel) : "",
    primaryMuscles: ex.primaryMuscles || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    tags: buildExerciseTags(ex),
    equipment: ex.equipment ? [String(ex.equipment)] : [],

  };
}

export default function ExercisePickerModal({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (payload: { exercises: GymExerciseRef[]; musclesWorked: string[] }) => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, GymExerciseRef>>({});
  const [info, setInfo] = useState<FreeExercise | null>(null);

  const items = useMemo(() => searchExercises(q), [q]);

  const selectedArr = useMemo(() => Object.values(selected), [selected]);

  const allMusclesWorked = useMemo(() => {
    const slugs = new Set<string>();
    for (const r of selectedArr) {
      musclesToSlugs(r.primaryMuscles, r.secondaryMuscles).forEach((s) => slugs.add(s));
    }
    return [...slugs];
  }, [selectedArr]);

  if (!open) return null;

  return (
    <div className={gymStyles.sheetOverlay} onClick={onClose}>
      <div className={gymStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={gymStyles.sheetHandle} />

        <div className={gymStyles.sheetHeaderRow}>
          <input
            className={gymStyles.searchInput}
            placeholder="Zoek oefeningen..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className={gymStyles.iconBtn}
            type="button"
            onClick={() => {
              onStart({ exercises: selectedArr, musclesWorked: allMusclesWorked });
            }}
            disabled={selectedArr.length === 0}
            title="Add selected"
          >
            Add ({selectedArr.length})
          </button>
        </div>

        <div className={gymStyles.sheetExercise}>
          {items.slice(0, 200).map((ex) => {
            const ref = toRef(ex);
            const isSel = Boolean(selected[ref.exerciseId]);
            const img = ref.image || "";
            const tags = ref.tags.slice(0, 6);

            return (
              <div
                key={ref.exerciseId}
                className={gymStyles.exerciseRow}
                onClick={() => {
                  setSelected((prev) => {
                    const next = { ...prev };
                    if (next[ref.exerciseId]) delete next[ref.exerciseId];
                    else next[ref.exerciseId] = ref;
                    return next;
                  });
                }}
                style={{
                  border: isSel ? "1px solid #ff2d2d" : "1px solid transparent",
                }}
              >
                {img ? <img className={gymStyles.exerciseImg} alt="" src={img} /> : <div className={gymStyles.exerciseImg} />}
                <div className={gymStyles.exerciseMain}>
                  <div className={gymStyles.exerciseName}>{ref.name}</div>
                  <div className={gymStyles.exerciseMeta}>
                    {(ref.primaryMuscles || []).slice(0, 2).join(", ")}
                    {(ref.secondaryMuscles || []).length ? ` • +${ref.secondaryMuscles.length} secondary` : ""}
                  </div>
                  {tags.length ? (
                    <div className={gymStyles.tagRow}>
                      {tags.map((t) => (
                        <span key={t} className={gymStyles.tagChip}>
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  className={gymStyles.infoBtn}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfo(ex);
                  }}
                  title="Info"
                >
                  i
                </button>
              </div>
            );
          })}

          {items.length > 200 ? (
            <div className={homeStyles.modalInfoText} style={{ padding: "12px 0" }}>
              Showing first 200 results. Narrow your search.
            </div>
          ) : null}
        </div>

        <button className={gymStyles.secondaryBtn} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {/* Info sheet */}
      {info ? (
        <div className={gymStyles.sheetOverlay} onClick={() => setInfo(null)}>
          <div className={gymStyles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={gymStyles.sheetHandle} />

            <div className={homeStyles.modalTitle}>{info.name}</div>

            <div className={gymStyles.tagRow}>
              {buildExerciseTags(info).slice(0, 14).map((t) => (
                <span key={t} className={gymStyles.tagChip}>
                  {t}
                </span>
              ))}
            </div>

            <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>Instructions</div>
            {(info.instructions || []).length ? (
              (info.instructions || []).map((line, idx) => (
                <div key={idx} className={homeStyles.normalText} style={{ marginBottom: 8 }}>
                  {line}
                </div>
              ))
            ) : (
              <div className={homeStyles.modalEmptyText}>No instructions available.</div>
            )}

            <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>Muscles</div>
            <div className={homeStyles.normalText} style={{ marginBottom: 10 }}>
              Primary: {(info.primaryMuscles || []).join(", ") || "—"}
              <br />
              Secondary: {(info.secondaryMuscles || []).join(", ") || "—"}
            </div>

            {(() => {
              const slugs = musclesToSlugs(info.primaryMuscles || [], info.secondaryMuscles || []);
              return (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className={homeStyles.modalSectionTitle}>Front</div>
                    <MuscleMap view="front" workedSlugs={slugs} height={260} />
                  </div>
                  <div>
                    <div className={homeStyles.modalSectionTitle}>Back</div>
                    <MuscleMap view="back" workedSlugs={slugs} height={260} />
                  </div>
                </div>
              );
            })()}

            <button className={gymStyles.secondaryBtn} type="button" onClick={() => setInfo(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
