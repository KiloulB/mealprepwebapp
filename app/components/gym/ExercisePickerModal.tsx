"use client";

import React, { useEffect, useMemo, useState } from "react";
import homeStyles from "../../home.module.css";
import modalStyles from "./GymModal.module.css";
import { IoClose, IoSearch, IoImageOutline } from "react-icons/io5";

import {
  loadFreeExerciseDb,
  searchExercises,
  getExercisePreviewImageUrl,
  type FreeExercise,
} from "../../services/freeExerciseDb";

export type PickPayload = {
  exerciseId: string;
  name: string;
  imageUrl?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ExercisePickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (payload: PickPayload) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FreeExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await loadFreeExerciseDb();
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message || "Failed to load exercise database");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => searchExercises(items, query), [items, query]);

  return (
    <div className={homeStyles.modalOverlay} role="dialog" aria-modal="true">
      <div className={cx(homeStyles.modalCard, modalStyles.modalWide)}>
        <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
          <h3 className={homeStyles.modalTitle}>Pick an exercise</h3>
          <button className={homeStyles.iconButton} onClick={onClose} type="button" aria-label="Close">
            <IoClose size={22} />
          </button>
        </div>

        <div className={modalStyles.body}>
          <div className={modalStyles.searchRow}>
            <IoSearch size={18} color="#97969b" />
            <input
              className={modalStyles.searchInput}
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {error ? <div className={modalStyles.muted}>{error}</div> : null}

          {loading && items.length === 0 ? (
            <div className={modalStyles.muted}>Loading exercises...</div>
          ) : (
            <div className={modalStyles.pickList}>
              {filtered.slice(0, 120).map((ex) => {
                const imageUrl = getExercisePreviewImageUrl(ex);

                return (
                  <button
                    key={ex.id}
                    type="button"
                    className={modalStyles.pickItem}
                    onClick={() =>
                      onPick({
                        exerciseId: ex.id,
                        name: ex.name,
                        imageUrl: imageUrl || undefined,
                        primaryMuscles: ex.primaryMuscles || [],
                        secondaryMuscles: ex.secondaryMuscles || [],
                      })
                    }
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={modalStyles.pickImg} src={imageUrl} alt={ex.name} loading="lazy" />
                    ) : (
                      <div className={modalStyles.pickImgPlaceholder}>
                        <IoImageOutline size={18} color="#97969b" />
                      </div>
                    )}

                    <div>
                      <div className={modalStyles.pickTitle}>{ex.name}</div>
                      <div className={modalStyles.pickMeta}>
                        {(ex.primaryMuscles || []).slice(0, 2).join(", ") || "—"}
                        {" • "}
                        {ex.equipment || "—"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
