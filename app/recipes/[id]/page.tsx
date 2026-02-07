"use client";

import React, { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  IoChevronBack,
  IoHeart,
  IoHeartOutline,
  IoImageOutline,
} from "react-icons/io5";

import { useUser } from "../../context/UserContext";
import { getRecipeById } from "../../firebase/dataService";
import type { Recipe } from "../../types/user";

import styles from "./recipeDetail.module.css";

function getIngredientEmoji(name: string) {
  const lowerName = (name || "").toLowerCase();

  if (
    lowerName.includes("steak") ||
    lowerName.includes("pork") ||
    lowerName.includes("beef")
  )
    return "🥩";
  if (lowerName.includes("chicken")) return "🍗";
  if (lowerName.includes("shrimp") || lowerName.includes("prawn")) return "🍤";
  if (lowerName.includes("fish") || lowerName.includes("salmon")) return "🐟";
  if (lowerName.includes("pasta") || lowerName.includes("spaghetti"))
    return "🍝";
  if (lowerName.includes("egg")) return "🥚";
  if (lowerName.includes("cheese")) return "🧀";
  if (lowerName.includes("butter")) return "🧈";
  if (lowerName.includes("oil") || lowerName.includes("olive")) return "🫒";
  if (lowerName.includes("onion")) return "🧅";
  if (lowerName.includes("garlic")) return "🧄";
  if (lowerName.includes("tomato")) return "🍅";
  if (lowerName.includes("pepper") || lowerName.includes("chili")) return "🌶️";
  if (lowerName.includes("carrot")) return "🥕";
  if (lowerName.includes("broccoli")) return "🥦";
  if (
    lowerName.includes("lettuce") ||
    lowerName.includes("salad") ||
    lowerName.includes("spinach")
  )
    return "🥬";
  if (lowerName.includes("avocado")) return "🥑";
  if (lowerName.includes("lemon") || lowerName.includes("lime")) return "🍋";
  if (lowerName.includes("salt")) return "🧂";
  if (lowerName.includes("rice")) return "🍚";
  if (lowerName.includes("bread")) return "🍞";
  if (lowerName.includes("milk") || lowerName.includes("cream")) return "🥛";

  return "🍽️";
}

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params); // IMPORTANT: unwrap async params
  const router = useRouter();
  const { authUser, loading } = useUser();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps">(
    "ingredients"
  );

  useEffect(() => {
    if (loading) return;
    if (!authUser) return;
    if (!id) return;

    getRecipeById(authUser.uid, id).then(setRecipe).catch(console.error);
  }, [authUser, loading, id]);

  const description = useMemo(() => {
    if (!recipe) return "";
    return (
      recipe.subtitle ||
      `Geen subtitel toevoegd.`
    );
  }, [recipe]);

  if (!recipe) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>Loading...</div>
      </div>
    );
  }
  

  return (
    <div className={styles.page}>
      {/* HERO */}
      <div className={styles.hero}>
        {recipe.image ? (
          <img className={styles.heroImg} src={recipe.image} alt={recipe.title} />
        ) : (
          <div className={styles.heroPlaceholder}>
            <IoImageOutline size={64} color="#9CA3AF" />
          </div>
        )}

       <button className={styles.backBtn} onClick={() => router.push("/?tab=recepten")}>
          <IoChevronBack size={22} />
        </button>
      </div>

      {/* SHEET */}
      <div className={styles.sheet}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{recipe.title}</h1>

          <button
            className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ""}`}
            onClick={() => setIsFavorite((v) => !v)}
          >
            {isFavorite ? <IoHeart size={20} /> : <IoHeartOutline size={20} />}
          </button>
        </div>

        <p className={styles.desc}>
          <span className={styles.timeInline}>
            {recipe.totalTime || recipe.prepTime || "0 min"}
          </span>{" "}
          — {description}
        </p>

        {/* NUTRITION */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Nutrition</h3>

          <div className={styles.nutritionRow}>
            <div className={styles.nutritionItem}>
              <div className={styles.nutritionLabel}>Kcal</div>
              <div className={styles.nutritionValue}>{recipe.kcal}</div>
            </div>

            <div className={styles.nutritionItem}>
              <div className={styles.nutritionLabel}>Protein</div>
              <div className={styles.nutritionValue}>{recipe.protein}g</div>
            </div>

            <div className={styles.nutritionItem}>
              <div className={styles.nutritionLabel}>Fat</div>
              <div className={styles.nutritionValue}>{recipe.fat}g</div>
            </div>

            <div className={styles.nutritionItem}>
              <div className={styles.nutritionLabel}>Carb</div>
              <div className={styles.nutritionValue}>{recipe.carbs}g</div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === "ingredients" ? styles.tabActive : ""
            }`}
            onClick={() => setActiveTab("ingredients")}
          >
            Ingredients
          </button>

          <button
            className={`${styles.tab} ${
              activeTab === "steps" ? styles.tabActive : ""
            }`}
            onClick={() => setActiveTab("steps")}
          >
            Steps
          </button>
        </div>

        {/* CONTENT */}
        {activeTab === "ingredients" ? (
          <div>
            <div className={styles.servingsRow}>
              <div>Servings</div>
              <div className={styles.servingsValue}>
                {recipe.servings ? String(recipe.servings).padStart(2, "0") : "0"}{" "}
                servings
              </div>
            </div>

            <div className={styles.list}>
              {recipe.ingredients?.length ? (
                recipe.ingredients.map((ing) => (
                  <div key={ing.id} className={styles.ingredientItem}>
                    <div className={styles.ingredientIcon}>
                      {getIngredientEmoji(ing.name)}
                    </div>

                    <div className={styles.ingredientMain}>
                      <div className={styles.ingredientName}>{ing.name}</div>
                      <div className={styles.ingredientAmount}>{ing.amount}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyText}>No ingredients added</div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {recipe.instructions?.length ? (
              recipe.instructions.map((inst, idx) => (
                <div key={inst.id} className={styles.stepItem}>
                  <div className={styles.stepNum}>{idx + 1}</div>
                  <div className={styles.stepText}>{inst.step}</div>
                </div>
              ))
            ) : (
              <div className={styles.emptyText}>No steps added</div>
            )}
          </div>
        )}

        {/* BOTTOM BUTTONS */}

      </div>
    </div>
  );
}
