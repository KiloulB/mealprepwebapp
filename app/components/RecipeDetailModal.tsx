"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { IoArrowBack } from "react-icons/io5";
import type { Recipe } from "../types/user";
import styles from "../screens/FoodScreen.module.css";

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

interface Props {
  recipe: Recipe & { instructions?: { id?: string; step?: string }[] };
  onClose: () => void;
}

export default function RecipeDetailModal({ recipe, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps">("ingredients");

  const steps: string[] = recipe.steps?.length
    ? recipe.steps
    : (recipe.instructions ?? []).map((i) => i.step ?? "").filter(Boolean);

  return createPortal(
    <div className={styles.recipeDetailOverlay}>
      <div className={styles.recipeDetailHero}>
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.title} className={styles.recipeDetailHeroImg} />
        ) : (
          <div className={styles.recipeDetailHeroPlaceholder} />
        )}
        <button className={styles.recipeDetailBackBtn} onClick={onClose} aria-label="Terug">
          <IoArrowBack size={20} color="#fff" />
        </button>
      </div>

      <div className={styles.recipeDetailContent}>
        <div className={styles.recipeDetailTitle}>{recipe.title}</div>
        {recipe.portions && (
          <div className={styles.recipeDetailPortions}>{recipe.portions} porties</div>
        )}

        <div className={styles.recipeDetailMacroRow}>
          <div className={styles.recipeDetailMacroItem}>
            <span className={styles.recipeDetailMacroLabel} style={{ color: "var(--accent)" }}>Kcal</span>
            <span className={styles.recipeDetailMacroVal}>{Math.round(recipe.kcal)}</span>
          </div>
          <div className={styles.recipeDetailMacroItem}>
            <span className={styles.recipeDetailMacroLabel} style={{ color: "#C13232" }}>Eiwit</span>
            <span className={styles.recipeDetailMacroVal}>{fmt(recipe.protein)} g</span>
          </div>
          <div className={styles.recipeDetailMacroItem}>
            <span className={styles.recipeDetailMacroLabel} style={{ color: "#C28A00" }}>Vet</span>
            <span className={styles.recipeDetailMacroVal}>{fmt(recipe.fat)} g</span>
          </div>
          <div className={styles.recipeDetailMacroItem}>
            <span className={styles.recipeDetailMacroLabel} style={{ color: "#2A9DB5" }}>Carb</span>
            <span className={styles.recipeDetailMacroVal}>{fmt(recipe.carbs)} g</span>
          </div>
        </div>

        <div className={styles.recipeDetailTabs}>
          <button
            className={[styles.recipeDetailTab, activeTab === "ingredients" ? styles.recipeDetailTabActive : ""].join(" ")}
            onClick={() => setActiveTab("ingredients")}
          >
            Ingrediënten
          </button>
          <button
            className={[styles.recipeDetailTab, activeTab === "steps" ? styles.recipeDetailTabActive : ""].join(" ")}
            onClick={() => setActiveTab("steps")}
          >
            Stappen
          </button>
        </div>

        {activeTab === "ingredients" ? (
          <div className={styles.recipeDetailTabContent}>
            {!recipe.ingredients?.length ? (
              <div className={styles.recipeDetailEmpty}>Geen ingrediënten opgegeven.</div>
            ) : (
              recipe.ingredients.map((ing, idx) => (
                <div key={idx} className={styles.recipeDetailIngredientRow}>
                  <span className={styles.recipeDetailIngredientName}>{ing.name}</span>
                  <span className={styles.recipeDetailIngredientAmount}>{ing.amount}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className={styles.recipeDetailTabContent}>
            {steps.length === 0 ? (
              <div className={styles.recipeDetailEmpty}>Geen stappen opgegeven.</div>
            ) : (
              steps.map((step, idx) => (
                <div key={idx} className={styles.recipeDetailStepRow}>
                  <div className={styles.recipeDetailStepNumber}>{idx + 1}</div>
                  <span className={styles.recipeDetailStepText}>{step}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
