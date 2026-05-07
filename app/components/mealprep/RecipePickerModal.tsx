"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IoClose, IoSearch } from "react-icons/io5";
import { useUser } from "../../context/UserContext";
import { subscribeToRecipes } from "../../firebase/dataService";
import { builtinRecipes } from "../../data/builtinRecipes";
import type { BuiltinRecipe } from "../../data/builtinRecipes";
import type { Recipe } from "../../types/user";
import styles from "./RecipePickerModal.module.css";

interface Props {
  onSelect: (recipe: Recipe & { id: string }) => void;
  onClose: () => void;
}

export default function RecipePickerModal({ onSelect, onClose }: Props) {
  const { authUser } = useUser();
  const [tab, setTab] = useState<"builtin" | "eigen">("builtin");
  const [query, setQuery] = useState("");
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    if (!authUser) return;
    return subscribeToRecipes(authUser.uid, setUserRecipes);
  }, [authUser]);

  const builtinFiltered = builtinRecipes.filter((r: BuiltinRecipe) =>
    r.title.toLowerCase().includes(query.toLowerCase())
  );

  const userFiltered = userRecipes.filter((r: Recipe) =>
    r.title.toLowerCase().includes(query.toLowerCase())
  );

  const list: (Recipe & { id: string })[] = tab === "builtin" ? builtinFiltered : userFiltered;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Recept kiezen</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <IoClose size={20} />
          </button>
        </div>

        <div className={styles.searchWrap}>
          <IoSearch size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Zoeken…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${tab === "builtin" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("builtin")}
          >
            Ingebouwd
          </button>
          <button
            className={`${styles.tabBtn} ${tab === "eigen" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("eigen")}
          >
            Eigen
          </button>
        </div>

        <div className={styles.list}>
          {list.length === 0 ? (
            <div className={styles.empty}>Geen recepten gevonden.</div>
          ) : (
            list.map((recipe) => (
              <button
                key={recipe.id}
                className={styles.recipeRow}
                onClick={() => onSelect(recipe)}
              >
                <div className={styles.recipeInfo}>
                  <span className={styles.recipeTitle}>{recipe.title}</span>
                  <span className={styles.recipeMeta}>
                    {recipe.kcal} kcal · {recipe.protein}g eiwit
                    {recipe.portions ? ` · ${recipe.portions} port.` : ""}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
