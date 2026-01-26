"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./context/UserContext";
import { useFont } from "./context/FontContext";
import {
  IoPersonOutline,
  IoAdd,
  IoCheckmark,
  IoCloseCircleOutline,
} from "react-icons/io5";
import {
  subscribeToDailyLog,
  subscribeToRecipes,
  addFoodToLog,
  toggleFoodChecked,
  removeFoodFromLog,
} from "./firebase/dataService";
import type { DailyLog, LoggedFood, Recipe, MealType } from "./types/user";

import ThemeSwitcherNav from "./components/ThemeSwitcherNav";
import styles from "./home.module.css";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clampPercent(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const ActivityRings = ({
  kcal,
  protein,
  fat,
  carbs,
  kcalTarget,
  proteinTarget,
  fatTarget,
  carbsTarget,
}: {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  kcalTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbsTarget: number;
}) => {
  const [animatedProgress, setAnimatedProgress] = useState<[number, number, number, number]>([
    0, 0, 0, 0,
  ]);

  const ringSize = 90;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const rings = [
    {
      targetProgress: Math.min(kcal / kcalTarget, 1),
      color: "#E4222A",
      backgroundColor: "#4A1C1E",
    },
    {
      targetProgress: Math.min(protein / proteinTarget, 1),
      color: "#08B6DC",
      backgroundColor: "#16424C",
    },
    {
      targetProgress: Math.min(fat / fatTarget, 1),
      color: "#F1A500",
      backgroundColor: "#4E4021",
    },
    {
      targetProgress: Math.min(carbs / carbsTarget, 1),
      color: "#8DCF42",
      backgroundColor: "#323C28",
    },
  ];

  useEffect(() => {
    const duration = 1300;
    const delay = 150;

    rings.forEach((ring, index) => {
      const startTime = Date.now() + index * delay;
      const startProgress = animatedProgress[index];
      const targetProgress = ring.targetProgress;
      const progressDiff = targetProgress - startProgress;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        setAnimatedProgress((prev) => {
          const newProgress: [number, number, number, number] = [...prev] as any;
          newProgress[index as 0 | 1 | 2 | 3] = startProgress + progressDiff * easedProgress;
          return newProgress;
        });

        if (progress < 1) requestAnimationFrame(animate);
      };

      setTimeout(animate, index * delay);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kcal, protein, fat, carbs, kcalTarget, proteinTarget, fatTarget, carbsTarget]);

  return (
    <div className={styles.ringsWrap}>
      <svg width={ringSize} height={ringSize}>
        {rings.map((ring, index) => {
          const progress = animatedProgress[index as 0 | 1 | 2 | 3];
          const strokeDashoffset = circumference - progress * circumference;

          return (
            <g key={index}>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius - index * (strokeWidth + 2)}
                stroke={ring.backgroundColor}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius - index * (strokeWidth + 2)}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default function HomeScreen() {
  const { macroTargets, authUser, loading } = useUser();
  useFont();
  const router = useRouter();

  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(-1);

  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [addFoodModalVisible, setAddFoodModalVisible] = useState<boolean>(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast");

  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(new Set());
  const [removingFoods, setRemovingFoods] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !authUser && typeof window !== "undefined") {
      router.push("/auth");
    }
  }, [authUser, loading, router]);

  const getSelectedDate = useCallback((): Date => {
    const today = new Date();
    if (selectedDayIndex === -1) return today;

    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(
      today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7
    );

    const selectedDate = new Date(monday);
    selectedDate.setDate(monday.getDate() + selectedDayIndex);
    return selectedDate;
  }, [selectedDayIndex, weekOffset]);

  useEffect(() => {
    if (!authUser) return;

    const date = getSelectedDate();
    const unsubscribe = subscribeToDailyLog(authUser.uid, date, (log) => {
      setDailyLog(log);
    });

    return () => unsubscribe();
  }, [authUser, getSelectedDate]);

  useEffect(() => {
    if (!authUser) return;

    const unsubscribe = subscribeToRecipes(authUser.uid, (fetchedRecipes) => {
      setRecipes(fetchedRecipes);
    });

    return () => unsubscribe();
  }, [authUser]);

  const currentIntake = useMemo(() => {
    if (!dailyLog?.foods) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };

    const checkedFoods = dailyLog.foods.filter((food) => food.checked);

    return checkedFoods.reduce(
      (totals, food) => ({
        kcal: totals.kcal + food.kcal * food.servings,
        protein: totals.protein + food.protein * food.servings,
        fat: totals.fat + food.fat * food.servings,
        carbs: totals.carbs + food.carbs * food.servings,
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 }
    );
  }, [dailyLog]);

  const kcalTarget = macroTargets ? macroTargets.kcal : 2000;
  const proteinTarget = macroTargets ? macroTargets.protein : 150;
  const fatTarget = macroTargets ? macroTargets.fat : 80;
  const carbsTarget = macroTargets ? macroTargets.carbs : 250;

  const remaining = useMemo(
    () => ({
      kcal: Math.max(0, kcalTarget - currentIntake.kcal),
      protein: Math.max(0, proteinTarget - currentIntake.protein),
      fat: Math.max(0, fatTarget - currentIntake.fat),
      carbs: Math.max(0, carbsTarget - currentIntake.carbs),
    }),
    [currentIntake, kcalTarget, proteinTarget, fatTarget, carbsTarget]
  );

  if (loading) {
    return (
      <div className={styles.centerScreen}>
        <div className={styles.centerText}>Loading...</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className={styles.centerScreen}>
        <div className={styles.centerText}>Redirecting to login...</div>
      </div>
    );
  }

  const getFoodsByMealType = (mealType: MealType): LoggedFood[] => {
    if (!dailyLog) return [];
    return dailyLog.foods.filter((f) => f.mealType === mealType);
  };

  const getMealData = (mealType: MealType) => {
    const foods = getFoodsByMealType(mealType);
    const checkedFoods = foods.filter((f) => f.checked);
    const kcal = checkedFoods.reduce((sum, f) => sum + f.kcal * f.servings, 0);
    return { foods, kcal, items: foods.length };
  };

  const meals: { id: MealType; name: string; icon: string }[] = [
    { id: "breakfast", name: "Breakfast", icon: "🍳" },
    { id: "lunch", name: "Lunch", icon: "🍜" },
    { id: "dinner", name: "Dinner", icon: "🍖" },
    { id: "snacks", name: "Snacks", icon: "🍎" },
  ];

  const handleAddRecipeToLog = async (recipe: Recipe) => {
    if (!authUser) return;

    await addFoodToLog(authUser.uid, getSelectedDate(), {
      type: "recipe",
      sourceId: recipe.id,
      name: recipe.title,
      image: recipe.image,
      kcal: recipe.kcal,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      servings: 1,
      mealType: selectedMealType,
      checked: true,
    });

    setAddFoodModalVisible(false);
  };

  const handleToggleFood = async (foodId: string) => {
    if (!authUser) return;
    await toggleFoodChecked(authUser.uid, getSelectedDate(), foodId);
  };

  const handleRemoveFood = async (foodId: string) => {
    if (!authUser) return;

    setRemovingFoods((prev) => new Set(prev).add(foodId));

    setTimeout(async () => {
      await removeFoodFromLog(authUser.uid, getSelectedDate(), foodId);
      setRemovingFoods((prev) => {
        const newSet = new Set(prev);
        newSet.delete(foodId);
        return newSet;
      });
    }, 300);
  };

  const openAddFoodModal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setAddFoodModalVisible(true);
  };

  const toggleMealExpansion = (mealType: MealType) => {
    const mealData = getMealData(mealType);
    if (mealData.items === 0) return;

    setExpandedMeals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mealType)) newSet.delete(mealType);
      else newSet.add(mealType);
      return newSet;
    });
  };

  const today = new Date();
  const todayDateString = today
    .toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  const kcalPct = clampPercent((currentIntake.kcal / kcalTarget) * 100);
  const progressWidthClass = (styles as any)[`w${kcalPct}`] as string;

  return (
    <div className={styles.screen}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.headerTitle}>Overzicht</h1>
          <p className={styles.headerSubtitle}>{todayDateString}</p>
        </div>

        <button
          className={styles.headerButton}
          onClick={() => router.push("/settings")}
        >
          <IoPersonOutline size={24} color="#9CA3AF" />
        </button>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.section}>
          <div className={styles.card}>
            <div className={cx(styles.flexBetween, styles.cardRowBottom)}>
              <span className={cx(styles.cardTitle, styles.cardTitleActivity)}>
                🔥 Activiteit
              </span>
            </div>

            <div className={cx(styles.flexRow, styles.activityValueRow)}>
              <span className={styles.bigNumber}>4,093</span>
              <span className={cx(styles.unitText, styles.unitTextStrong)}>
                stappen
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <div className={cx(styles.flexBetween, styles.cardRowBottom)}>
              <span className={cx(styles.cardTitle, styles.cardTitleFood)}>
                🥗 Voeding
              </span>
            </div>

            <div className={cx(styles.flexRow, styles.activityValueRow)}>
              <span className={styles.bigNumber}>
                {Math.round(currentIntake.kcal)}
              </span>
              <span className={styles.unitText}>kcal</span>
            </div>

            <div className={styles.progressTrack}>
              <div className={cx(styles.progressFill, progressWidthClass)} />
            </div>

            <p className={styles.remainingText}>{remaining.kcal} kcal remaining</p>

            <div className={cx(styles.flexBetween, styles.macrosRow)}>
              <div className={styles.macroGroup}>
                <div className={styles.macroCol}>
                  <p className={cx(styles.macroLabel, styles.macroLabelProtein)}>
                    Eiwit
                  </p>
                  <p className={styles.macroValue}>
                    {Math.round(currentIntake.protein)}g
                  </p>
                  <p className={styles.macroRemaining}>{remaining.protein}g</p>
                </div>

                <div className={styles.macroDivider} />

                <div className={styles.macroCol}>
                  <p className={cx(styles.macroLabel, styles.macroLabelFat)}>
                    Vet
                  </p>
                  <p className={styles.macroValue}>
                    {Math.round(currentIntake.fat)}g
                  </p>
                  <p className={styles.macroRemaining}>{remaining.fat}g</p>
                </div>

                <div className={styles.macroDivider} />

                <div className={styles.macroCol}>
                  <p className={cx(styles.macroLabel, styles.macroLabelCarbs)}>
                    Carbs
                  </p>
                  <p className={styles.macroValue}>
                    {Math.round(currentIntake.carbs)}g
                  </p>
                  <p className={styles.macroRemaining}>{remaining.carbs}g</p>
                </div>
              </div>

              <ActivityRings
                kcal={currentIntake.kcal}
                protein={currentIntake.protein}
                fat={currentIntake.fat}
                carbs={currentIntake.carbs}
                kcalTarget={kcalTarget}
                proteinTarget={proteinTarget}
                fatTarget={fatTarget}
                carbsTarget={carbsTarget}
              />
            </div>
          </div>
        </div>

        <div className={styles.mealsCard}>
          <h2 className={styles.mealsTitle}>Maaltijden</h2>

          {meals.map((meal, index) => {
            const mealData = getMealData(meal.id);
            const hasItems = mealData.items > 0;
            const isExpanded = expandedMeals.has(meal.id);

            return (
              <div key={meal.id}>
                <div
                  className={cx(
                    styles.mealWrap,
                    isExpanded ? styles.mealWrapExpanded : styles.mealWrapCollapsed,
                    hasItems ? styles.mealWrapEnabled : styles.mealWrapDisabled
                  )}
                >
     <div
  className={cx(
    styles.flexBetween,
    styles.mealHeader,
    isExpanded && styles.mealHeaderExpanded
  )}
  onClick={() => hasItems && toggleMealExpansion(meal.id)}
>
                    <div>
                      <p className={styles.mealName}>{meal.name}</p>
                      {hasItems ? (
                        <p className={cx(styles.mealMeta, styles.mealMetaHas)}>
                          {Math.round(mealData.kcal)} kcal • {mealData.items} item
                          {mealData.items > 1 ? "s" : ""}
                        </p>
                      ) : (
                        <p className={cx(styles.mealMeta, styles.mealMetaEmpty)}>
                          No items yet
                        </p>
                      )}
                    </div>

                    <button
                      className={styles.mealAddBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddFoodModal(meal.id);
                      }}
                    >
                      <IoAdd size={20} color="#FFFFFF" />
                    </button>
                  </div>

                  <div
                    className={cx(
                      styles.mealExpandArea,
                      isExpanded ? styles.mealExpandOpen : styles.mealExpandClosed
                    )}
                  >
                    {mealData.foods.length > 0 && (
                      <div className={styles.mealExpandedInner}>
                        {mealData.foods.map((food) => {
                          const isRemoving = removingFoods.has(food.id);
                          return (
                            <div
                              key={food.id}
                              className={cx(
                                styles.flexRow,
                                styles.foodRow,
                                isRemoving ? styles.foodRemoving : styles.foodNormal
                              )}
                              onClick={() => handleToggleFood(food.id)}
                            >
                              <button
                                className={cx(
                                  styles.checkBtn,
                                  food.checked ? styles.checkBtnChecked : styles.checkBtnUnchecked
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFood(food.id);
                                }}
                              >
                                {food.checked && <IoCheckmark size={16} color="#FFF" />}
                              </button>

                              <div className={styles.foodMain}>
                                <p
                                  className={cx(
                                    styles.foodName,
                                    food.checked ? styles.foodNameChecked : styles.foodNameUnchecked
                                  )}
                                >
                                  {food.name}
                                </p>
                                <p className={styles.foodMeta}>
                                  {Math.round(food.kcal)} kcal •{" "}
                                  {food.type === "food" && food.grams
                                    ? `${food.grams}g`
                                    : `${food.servings} serving${food.servings !== 1 ? "s" : ""}`}
                                </p>
                              </div>

                              <button
                                className={styles.iconButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFood(food.id);
                                }}
                              >
                                <IoCloseCircleOutline size={20} color="#9CA3AF" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {index < meals.length - 1 && <div className={styles.hr} />}
              </div>
            );
          })}
        </div>

    
      </div>

      {addFoodModalVisible && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={cx(styles.flexBetween, styles.modalHeader)}>
              <h3 className={styles.modalTitle}>
                Add to{" "}
                {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
              </h3>
              <button
                className={styles.iconButton}
                onClick={() => setAddFoodModalVisible(false)}
              >
                <IoCloseCircleOutline size={24} color="#6B7280" />
              </button>
            </div>

            <div>
              <h4 className={styles.modalSectionTitle}>Your Recipes</h4>

              {recipes.length === 0 ? (
                <p className={styles.modalEmptyText}>
                  No recipes yet. Create one in the Recipes tab!
                </p>
              ) : (
                recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className={cx(styles.flexRow, styles.recipeRow)}
                    onClick={() => handleAddRecipeToLog(recipe)}
                  >
                    {recipe.image && (
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className={styles.recipeImg}
                      />
                    )}
                    <div className={styles.recipeMain}>
                      <p className={styles.recipeTitle}>{recipe.title}</p>
                      <p className={styles.recipeMeta}>
                        {recipe.kcal} kcal • {recipe.protein}g protein
                      </p>
                    </div>
                    <IoAdd size={24} color="#4A90D9" />
                  </div>
                ))
              )}

              <h4 className={cx(styles.modalSectionTitle, styles.modalSectionTitleSpaced)}>
                Search Foods
              </h4>
              <p className={styles.modalInfoText}>
                Go to the Food tab to search and add foods
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation switcher (reusable component) */}
      <ThemeSwitcherNav
        defaultValue="light"
        onChange={(nextTheme: string) => {
          // Hook into your theme system later
          // Example: document.documentElement.dataset.theme = nextTheme;
        }}
      />
    </div>
  );
}
