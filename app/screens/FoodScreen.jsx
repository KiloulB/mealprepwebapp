"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./FoodScreen.module.css";
import { useUser } from "../context/UserContext";
import {
  addFoodToLog,
  removeFoodFromLog,
  subscribeToDailyLog,
  subscribeToRecipes,
} from "../firebase/dataService";
import {
  IoClose,
  IoSearchOutline,
  IoBarcodeOutline,
  IoChevronDown,
  IoChevronForward,
  IoChevronBack,
  IoAdd,
  IoArrowBack,
  IoCreateOutline,
  IoTrashOutline,
  IoBookSharp,
  IoCalendarOutline,
  IoInformationCircleOutline,
} from "react-icons/io5";
import CameraBarcodeModal from "../components/CameraBarcodeModal";
import RecipeAddModal from "../components/food/RecipeAddModal";
import HelpOverlay from "../components/HelpOverlay";

// ─── Open Food Facts ────────────────────────────────────────────────────────

const OFF_BASE = "https://world.openfoodfacts.net";
const SEARCH_PAGE_SIZE = 15;
const MIN_MS_BETWEEN_SEARCHES = 1200;
const searchCache = new Map();
const productCache = new Map();

function normalizeQuery(q) { return q.trim().toLowerCase(); }
async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
function getImageUrl(product) {
  if (!product) return undefined;
  return product.image_front_url || product.image_front_small_url || product.image_url;
}
function getKcal(nutriments) {
  if (!nutriments) return undefined;
  if (nutriments.energy_kcal_100g !== undefined) return nutriments.energy_kcal_100g;
  if (nutriments["energy-kcal_100g"] !== undefined) return nutriments["energy-kcal_100g"];
  if (nutriments["energy-kcal"] !== undefined) return nutriments["energy-kcal"];
  if (nutriments.energy_kcal !== undefined) return nutriments.energy_kcal;
  if (nutriments.energy_100g !== undefined) return Math.round(nutriments.energy_100g / 4.184);
  return undefined;
}
function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return String(Math.round(value * 10) / 10).replace(".", ",");
}
async function offSearchV1(query, { signal } = {}) {
  const q = normalizeQuery(query);
  if (q.length < 2) return [];
  if (searchCache.has(q)) return searchCache.get(q);
  const params = new URLSearchParams();
  params.set("search_terms", q);
  params.set("search_simple", "1");
  params.set("action", "process");
  params.set("json", "1");
  params.set("page_size", String(SEARCH_PAGE_SIZE));
  params.set("cc", "nl");
  params.set("fields", "code,product_name,brands,image_front_small_url");
  const data = await fetchJson(`${OFF_BASE}/cgi/search.pl?${params}`, { signal });
  const products = Array.isArray(data?.products) ? data.products : [];
  searchCache.set(q, products);
  return products;
}
async function offProductV2(code, { signal } = {}) {
  const key = String(code || "").trim();
  if (!key) return null;
  if (productCache.has(key)) return productCache.get(key);
  const fields = "code,product_name,brands,image_front_url,image_front_small_url,nutriments";
  const data = await fetchJson(
    `${OFF_BASE}/api/v2/product/${encodeURIComponent(key)}?fields=${encodeURIComponent(fields)}`,
    { signal }
  );
  const product = data?.product ?? null;
  if (product) productCache.set(key, product);
  return product;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clampPercent(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const SERVING_PRESETS = [
  { label: "1 tl", grams: 5 },
  { label: "1 el", grams: 15 },
  { label: "50g", grams: 50 },
  { label: "100g", grams: 100 },
  { label: "200g", grams: 200 },
];

const MEALS = [
  { id: "breakfast", name: "Ontbijt",   emoji: "🌅" },
  { id: "lunch",     name: "Lunch",     emoji: "☀️" },
  { id: "dinner",    name: "Avondeten", emoji: "🌙" },
  { id: "snacks",    name: "Snacks",    emoji: "🍎" },
];


// ─── ActivityRings ───────────────────────────────────────────────────────────

function ActivityRings({ kcal, protein, fat, carbs, kcalTarget, proteinTarget, fatTarget, carbsTarget }) {
  const [animatedProgress, setAnimatedProgress] = useState([0, 0, 0, 0]);
  const ringSize = 90;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const rings = [
    { targetProgress: Math.min(kcal / kcalTarget, 1), color: "#C13232",    backgroundColor: "#4A1C1E" },
    { targetProgress: Math.min(protein / proteinTarget, 1), color: "#2A9DB5", backgroundColor: "#16424C" },
    { targetProgress: Math.min(fat / fatTarget, 1), color: "#C28A00",    backgroundColor: "#4E4021" },
    { targetProgress: Math.min(carbs / carbsTarget, 1), color: "#72A82C", backgroundColor: "#323C28" },
  ];
  useEffect(() => {
    const duration = 1300;
    const delay = 150;
    rings.forEach((ring, index) => {
      const startTime = Date.now() + index * delay;
      const startProgress = animatedProgress[index];
      const diff = ring.targetProgress - startProgress;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setAnimatedProgress((prev) => {
          const next = [...prev];
          next[index] = startProgress + diff * eased;
          return next;
        });
        if (p < 1) requestAnimationFrame(animate);
      };
      setTimeout(animate, index * delay);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kcal, protein, fat, carbs, kcalTarget, proteinTarget, fatTarget, carbsTarget]);

  return (
    <svg width={ringSize} height={ringSize}>
      {rings.map((ring, index) => {
        const progress = animatedProgress[index];
        const dashOffset = circumference - progress * circumference;
        return (
          <g key={index}>
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius - index * (strokeWidth + 2)}
              stroke={ring.backgroundColor} strokeWidth={strokeWidth} fill="none" />
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius - index * (strokeWidth + 2)}
              stroke={ring.color} strokeWidth={strokeWidth} fill="none"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayLabel(date) {
  const today = startOfDay(new Date());
  const d = startOfDay(date);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === -1) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

export default function FoodScreen() {
  const { authUser, macroTargets, mealPrepPlan, helpModeEnabled } = useUser();

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const isToday = startOfDay(selectedDate).getTime() === startOfDay(new Date()).getTime();

  // Daily log + recipes
  const [dailyLog, setDailyLog] = useState(null);
  const [recipes, setRecipes] = useState([]);

  // Meal UI
  const [expandedMeal, setExpandedMeal] = useState(null);

  // Which meal the user is adding to
  const [activeMealType, setActiveMealType] = useState("breakfast");

  // Meals header "+" modal (choose Handmatig or Vanuit recept)
  const [mealChoiceModalOpen, setMealChoiceModalOpen] = useState(false);

  // Search modal
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Recipe picker
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);

  // Product detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [productError, setProductError] = useState("");
  const [selectedGrams, setSelectedGrams] = useState(100);
  const [customGramsInput, setCustomGramsInput] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("breakfast");
  const [addingFood, setAddingFood] = useState(false);

  // Barcode
  const [scannerVisible, setScannerVisible] = useState(false);

  // Meal prep picker
  const [mealPrepPickerOpen, setMealPrepPickerOpen] = useState(false);

  // Saved recipes section
  const [recipeAddModalOpen, setRecipeAddModalOpen] = useState(false);
  const [recipeEditOpen, setRecipeEditOpen] = useState(false);
  const [recipeDetailOpen, setRecipeDetailOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetailTab, setRecipeDetailTab] = useState("ingredients");

  const lastSearchAtRef = useRef(0);
  const searchAbortRef = useRef(null);
  const productAbortRef = useRef(null);

  // ── Subscriptions ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authUser) return;
    setDailyLog(null);
    return subscribeToDailyLog(authUser.uid, selectedDate, setDailyLog);
  }, [authUser, selectedDate]);

  useEffect(() => {
    if (!authUser) return;
    return subscribeToRecipes(authUser.uid, setRecipes);
  }, [authUser]);

  // ── Macros ─────────────────────────────────────────────────────────────────

  const kcalTarget = macroTargets?.kcal ?? 2000;
  const proteinTarget = macroTargets?.protein ?? 150;
  const fatTarget = macroTargets?.fat ?? 80;
  const carbsTarget = macroTargets?.carbs ?? 250;

  const currentIntake = useMemo(() => {
    if (!dailyLog?.foods) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    const checked = dailyLog.foods.filter((f) => f.checked);
    return checked.reduce(
      (t, f) => ({
        kcal: t.kcal + f.kcal * f.servings,
        protein: t.protein + f.protein * f.servings,
        fat: t.fat + f.fat * f.servings,
        carbs: t.carbs + f.carbs * f.servings,
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 }
    );
  }, [dailyLog]);

  const kcalRemaining = Math.max(0, Math.round(kcalTarget - currentIntake.kcal));
  const kcalPct = clampPercent((currentIntake.kcal / kcalTarget) * 100);

  // ── Meal helpers ───────────────────────────────────────────────────────────

  function getMealItems(mealId) {
    return (dailyLog?.foods || []).filter((f) => f.mealType === mealId && f.checked);
  }
  function getMealKcal(mealId) {
    return Math.round(getMealItems(mealId).reduce((s, f) => s + f.kcal * f.servings, 0));
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  const searchProducts = async (query) => {
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); setSearchError(""); return; }
    const now = Date.now();
    if (now - lastSearchAtRef.current < MIN_MS_BETWEEN_SEARCHES) return;
    lastSearchAtRef.current = now;
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setIsSearching(true);
    setSearchError("");
    try {
      const products = await offSearchV1(q, { signal: ac.signal });
      setSearchResults(products);
    } catch (e) {
      if (e?.name !== "AbortError") setSearchError("Zoeken mislukt. Probeer het opnieuw.");
    } finally {
      setIsSearching(false);
    }
  };

  const fetchFullProduct = async (code) => {
    const c = String(code || "").trim();
    if (!c) return null;
    if (productAbortRef.current) productAbortRef.current.abort();
    const ac = new AbortController();
    productAbortRef.current = ac;
    setIsLoadingProduct(true);
    setProductError("");
    try {
      const full = await offProductV2(c, { signal: ac.signal });
      if (!full) setProductError("Product niet gevonden.");
      return full;
    } catch (e) {
      if (e?.name !== "AbortError") setProductError("Product laden mislukt.");
      return null;
    } finally {
      setIsLoadingProduct(false);
    }
  };

  // ── Open search / recipes for a specific meal ──────────────────────────────

  const openSearch = (mealId) => {
    setActiveMealType(mealId);
    setExpandedMeal(null);
    setMealChoiceModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchModalOpen(true);
  };

  const openRecipes = (mealId) => {
    setActiveMealType(mealId);
    setExpandedMeal(null);
    setMealChoiceModalOpen(false);
    setRecipePickerOpen(true);
  };

  // ── Open product detail ────────────────────────────────────────────────────

  const openProductDetail = async (product) => {
    setSelectedMealType(activeMealType);
    setSelectedGrams(100);
    setCustomGramsInput("");
    setSelectedProduct(null);
    setProductError("");
    setSearchModalOpen(false);
    setDetailModalOpen(true);
    const full = await fetchFullProduct(product.code);
    if (full) setSelectedProduct(full);
  };

  const fetchProductByBarcode = async (barcode) => {
    const code = barcode.trim();
    if (!code) return;
    setSelectedMealType(activeMealType);
    setSelectedGrams(100);
    setCustomGramsInput("");
    setSelectedProduct(null);
    setProductError("");
    setSearchModalOpen(false);
    setScannerVisible(false);
    setDetailModalOpen(true);
    const full = await fetchFullProduct(code);
    if (full) setSelectedProduct(full);
  };

  // ── Nutrition preview ──────────────────────────────────────────────────────

  const calculatedNutrition = useMemo(() => {
    if (!selectedProduct?.nutriments) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const factor = selectedGrams / 100;
    const n = selectedProduct.nutriments;
    return {
      kcal: Math.round((getKcal(n) || 0) * factor),
      protein: Math.round((n.proteins_100g || 0) * factor * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g || 0) * factor * 10) / 10,
      fat: Math.round((n.fat_100g || 0) * factor * 10) / 10,
    };
  }, [selectedProduct, selectedGrams]);

  // ── Add food to log ────────────────────────────────────────────────────────

  const handleAddToMeal = async () => {
    if (!selectedProduct || !authUser) return;
    setAddingFood(true);
    try {
      const n = selectedProduct.nutriments;
      await addFoodToLog(authUser.uid, selectedDate, {
        type: "food",
        sourceId: selectedProduct.code,
        name: selectedProduct.product_name || "Onbekend product",
        image: getImageUrl(selectedProduct) || undefined,
        kcal: calculatedNutrition.kcal,
        protein: calculatedNutrition.protein,
        carbs: calculatedNutrition.carbs,
        fat: calculatedNutrition.fat,
        kcalPer100g: getKcal(n) || 0,
        proteinPer100g: n?.proteins_100g || 0,
        carbsPer100g: n?.carbohydrates_100g || 0,
        fatPer100g: n?.fat_100g || 0,
        grams: selectedGrams,
        servings: 1,
        mealType: selectedMealType,
        checked: true,
      });
      setDetailModalOpen(false);
      setSelectedGrams(100);
      setCustomGramsInput("");
    } catch {
      // silent
    } finally {
      setAddingFood(false);
    }
  };

  const handleAddMealPrepMeal = async (meal) => {
    if (!authUser) return;
    await addFoodToLog(authUser.uid, selectedDate, {
      type: "recipe",
      sourceId: meal.recipeId,
      name: meal.recipeTitle,
      kcal: meal.kcal,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      servings: 1,
      mealType: activeMealType,
      checked: true,
    });
    setMealPrepPickerOpen(false);
  };

  const handleAddRecipe = async (recipe) => {
    if (!authUser) return;
    await addFoodToLog(authUser.uid, selectedDate, {
      type: "recipe",
      sourceId: recipe.id,
      name: recipe.title,
      image: recipe.image,
      kcal: recipe.kcal,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      servings: 1,
      mealType: activeMealType,
      checked: true,
    });
    setRecipePickerOpen(false);
  };

  // ── Delete food item ───────────────────────────────────────────────────────

  const handleDeleteFood = (foodId) => {
    if (!authUser) return;
    removeFoodFromLog(authUser.uid, selectedDate, foodId);
  };

  // ── Help steps ─────────────────────────────────────────────────────────────

  const FOOD_HELP_STEPS = [
    {
      title: "Dagelijkse macros",
      description: (
        <>
          <p><strong>De ringen bovenaan</strong><br />Je ziet vier gekleurde ringen: calorieën, eiwitten, vetten en koolhydraten. Elke ring vult zich naarmate je meer logt. Het getal linksonder de ring is je huidige inname; het getal rechtsonder is je dagdoel.</p>
          <p><strong>Doelen aanpassen</strong><br />Je macro-doelen stel je in via het Profiel-scherm. Ga naar Instellingen en vervolgens naar je plan om je calorie- en macrodoelen te wijzigen.</p>
          <p><strong>Over of onder?</strong><br />Als je je doel overschrijdt kleurt het getal rood. Zo zie je direct of je op schema zit voor de dag.</p>
        </>
      ),
    },
    {
      title: "Datum wisselen",
      description: (
        <>
          <p><strong>Navigeren tussen dagen</strong><br />Gebruik de pijltjes links en rechts naast de datum om naar een andere dag te gaan. Tik op de datumtekst zelf om snel terug te gaan naar vandaag.</p>
          <p><strong>Vergeten te loggen?</strong><br />Geen probleem. Ga terug naar de dag waarop je iets bent vergeten en voeg het alsnog toe. Elke dag heeft zijn eigen log die apart wordt opgeslagen.</p>
        </>
      ),
    },
    {
      title: "Voeding loggen",
      description: (
        <>
          <p><strong>Hoe voeg je iets toe?</strong><br />Tik op de + knop naast een maaltijdmoment — Ontbijt, Lunch, Avondeten of Snack. Er opent een scherm met drie opties.</p>
          <p><strong>Optie 1 — Zoeken</strong><br />Zoek op productnaam in de voedingsdatabank. Voer daarna in hoeveel gram je hebt gegeten. De macro&apos;s worden automatisch berekend.</p>
          <p><strong>Optie 2 — Eigen recept</strong><br />Kies een recept dat je eerder zelf hebt aangemaakt. De macro&apos;s per portie worden direct ingevuld.</p>
          <p><strong>Optie 3 — Meal Prep</strong><br />Als je een actief Meal Prep plan hebt, kun je de geplande maaltijd voor die dag direct toevoegen.</p>
        </>
      ),
    },
    {
      title: "Eigen recepten",
      description: (
        <>
          <p><strong>Recept aanmaken</strong><br />Scroll naar de receptenlijst onderaan en tik op het + icoontje. Je vult een naam in en kiest welke velden je wilt invullen: macrowaarden, porties, ingrediënten en bereidingsstappen. Alles behalve de naam is optioneel.</p>
          <p><strong>Foto toevoegen</strong><br />Tik op het fotovak bovenaan het aanmaakscherm om een foto te kiezen uit je bibliotheek. De foto wordt automatisch verkleind.</p>
          <p><strong>Bewerken of verwijderen</strong><br />Tik op een bestaand recept om de details te zien. Tik op het potlood-icoontje om het te bewerken, of op het prullenbak-icoontje om het te verwijderen.</p>
        </>
      ),
    },
  ];

  const [helpOpen, setHelpOpen] = useState(false);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.foodPage}>
      <div className={styles.foodTitleRow}>
        <h1 className={styles.foodTitle}>Voeding</h1>
        <div className={styles.dateNav}>
          <button
            className={styles.dateNavBtn}
            onClick={() => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}
            aria-label="Vorige dag"
          >
            <IoChevronBack size={18} />
          </button>
          <span className={styles.dateNavLabel}>{formatDayLabel(selectedDate)}</span>
          <button
            className={styles.dateNavBtn}
            onClick={() => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}
            disabled={isToday}
            aria-label="Volgende dag"
          >
            <IoChevronForward size={18} />
          </button>
        </div>
      </div>

      {/* ── Macros card ──────────────────────────────────────────────────── */}
      <div className={styles.macrosCard}>
        <span className={styles.macrosLabel}>Macros</span>
        <div className={styles.kcalRow}>
          <span className={styles.kcalValue}>{Math.round(currentIntake.kcal)}</span>
          <span className={styles.kcalUnit}> kcal</span>
        </div>
        <div className={styles.kcalBarTrack}>
          <div className={styles.kcalBarFill} style={{ width: `${kcalPct}%` }} />
        </div>
        <div className={styles.kcalOver}>{kcalRemaining} kcal over</div>
        <div className={styles.macroBreakdownRow}>
          <div className={styles.macroItems}>
            <div className={styles.macroItem}>
              <span className={styles.macroLabel} style={{ color: "#C13232" }}>Eiwit</span>
              <span className={styles.macroVal}>{Math.round(currentIntake.protein)} g</span>
              <span className={styles.macroTarget}>{proteinTarget} g</span>
            </div>
            <div className={styles.macroItem}>
              <span className={styles.macroLabel} style={{ color: "#C28A00" }}>Vet</span>
              <span className={styles.macroVal}>{Math.round(currentIntake.fat)} g</span>
              <span className={styles.macroTarget}>{fatTarget} g</span>
            </div>
            <div className={styles.macroItem}>
              <span className={styles.macroLabel} style={{ color: "#2A9DB5" }}>Carb</span>
              <span className={styles.macroVal}>{Math.round(currentIntake.carbs)} g</span>
              <span className={styles.macroTarget}>{carbsTarget} g</span>
            </div>
          </div>
          <ActivityRings
            kcal={currentIntake.kcal} protein={currentIntake.protein}
            fat={currentIntake.fat} carbs={currentIntake.carbs}
            kcalTarget={kcalTarget} proteinTarget={proteinTarget}
            fatTarget={fatTarget} carbsTarget={carbsTarget}
          />
        </div>
      </div>

      {/* ── Maaltijden card ───────────────────────────────────────────────── */}
      <div className={styles.mealsCard}>
        <div className={styles.mealsHeader}>
          <span className={styles.mealsTitle}>Maaltijden door de dag</span>
          <button
            className={styles.mealsAddBtn}
            aria-label="Maaltijd toevoegen"
            onClick={() => setMealChoiceModalOpen(true)}
          >
            <IoAdd size={20} />
          </button>
        </div>
        {MEALS.map((meal) => {
          const items = getMealItems(meal.id);
          const kcal = getMealKcal(meal.id);
          const hasItems = items.length > 0;
          const isExpanded = expandedMeal === meal.id;
          return (
            <div key={meal.id}>
              <div
                className={styles.mealRow}
                onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setExpandedMeal(isExpanded ? null : meal.id); }}
              >
                <span className={styles.mealName}>{meal.name}</span>
                <div className={styles.mealRight}>
                  {hasItems
                    ? <span className={styles.mealKcalBadge}>{kcal} kcal</span>
                    : <span className={styles.mealMeta}>Leeg</span>
                  }
                  <IoChevronDown
                    size={16}
                    color="#888"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                  />
                </div>
              </div>
              {isExpanded && items.length > 0 && (
                <div className={styles.mealExpandedContent}>
                  <div className={styles.mealItemsList}>
                    {items.map((item) => (
                      <div key={item.id} className={styles.mealItemRow}>
                        <span className={styles.mealItemName}>{item.name}</span>
                        <span className={styles.mealItemKcal}>{Math.round(item.kcal * item.servings)} kcal</span>
                        <button
                          className={styles.mealItemDeleteBtn}
                          aria-label={`${item.name} verwijderen`}
                          onClick={(e) => { e.stopPropagation(); handleDeleteFood(item.id); }}
                        >
                          <IoTrashOutline size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Opgeslagen recepten card ──────────────────────────────────────── */}
      <div className={styles.mealsCard}>
        <div className={styles.mealsHeader}>
          <span className={styles.mealsTitle}>Opgeslagen recepten</span>
          <button
            className={styles.mealsAddBtn}
            aria-label="Recept toevoegen"
            onClick={() => setRecipeAddModalOpen(true)}
          >
            <IoAdd size={20} />
          </button>
        </div>
        {recipes.length === 0 ? (
          <div className={styles.mealRow} style={{ borderTop: "1px solid var(--border-sep)", cursor: "default" }}>
            <span className={styles.mealMeta}>Nog geen recepten opgeslagen.</span>
          </div>
        ) : (
          recipes.map((recipe) => (
            <div
              key={recipe.id}
              className={styles.recipeRow}
              role="button"
              tabIndex={0}
              onClick={() => { setSelectedRecipe(recipe); setRecipeDetailTab("ingredients"); setRecipeDetailOpen(true); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setSelectedRecipe(recipe); setRecipeDetailTab("ingredients"); setRecipeDetailOpen(true); } }}
            >
              <div className={styles.recipeRowMain}>
                <div className={styles.mealName}>{recipe.title}</div>
                <div className={styles.recipeMacroGrid}>
                  <span className={styles.recipeMacroCell}>{Math.round(recipe.kcal)} kcal</span>
                  <span className={styles.recipeMacroCell}>{formatNumber(recipe.protein)}g eiwit</span>
                  <span className={styles.recipeMacroCell}>{formatNumber(recipe.carbs)}g koolhydraten</span>
                  <span className={styles.recipeMacroCell}>{formatNumber(recipe.fat)}g vet</span>
                </div>
              </div>
              <IoChevronForward size={16} color="var(--text-muted)" />
            </div>
          ))
        )}
      </div>

      {/* ── Meals header choice modal ─────────────────────────────────────── */}
      {mealChoiceModalOpen && createPortal(
        <div className={styles.modalOverlay} onClick={() => setMealChoiceModalOpen(false)}>
          <div className={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Toevoegen aan maaltijd</span>
              <button className={styles.modalCloseBtn} onClick={() => setMealChoiceModalOpen(false)}>
                <IoClose size={20} />
              </button>
            </div>
            <div className={styles.mealPills} style={{ marginBottom: 20 }}>
              {MEALS.map((meal) => (
                <button
                  key={meal.id}
                  className={activeMealType === meal.id ? `${styles.mealPill} ${styles.mealPillActive}` : styles.mealPill}
                  onClick={() => setActiveMealType(meal.id)}
                >
                  {meal.name}
                </button>
              ))}
            </div>

            <div className={styles.choiceList}>
              <button className={styles.choiceRow} onClick={() => openSearch(activeMealType)}>
                <span className={styles.choiceIcon} style={{ background: "rgba(var(--accent-rgb),0.15)" }}>
                  <IoSearchOutline size={20} style={{ color: "var(--accent)" }} />
                </span>
                <span className={styles.choiceText}>
                  <span className={styles.choiceTitle}>Zoeken</span>
                  <span className={styles.choiceSub}>Producten zoeken op naam of barcode</span>
                </span>
                <IoChevronForward size={16} color="var(--text-muted)" />
              </button>

              <button className={styles.choiceRow} onClick={() => openRecipes(activeMealType)}>
                <span className={styles.choiceIcon} style={{ background: "rgba(42,157,181,0.15)" }}>
                  <IoBookSharp size={18} color="#2A9DB5" />
                </span>
                <span className={styles.choiceText}>
                  <span className={styles.choiceTitle}>Vanuit recept</span>
                  <span className={styles.choiceSub}>Gebruik een opgeslagen recept</span>
                </span>
                <IoChevronForward size={16} color="var(--text-muted)" />
              </button>

              {mealPrepPlan?.status === "active" && (mealPrepPlan?.meals?.length ?? 0) > 0 && (
                <button
                  className={styles.choiceRow}
                  onClick={() => { setMealChoiceModalOpen(false); setMealPrepPickerOpen(true); }}
                >
                  <span className={styles.choiceIcon} style={{ background: "rgba(141,207,66,0.15)" }}>
                    <IoCalendarOutline size={20} color="#72A82C" />
                  </span>
                  <span className={styles.choiceText}>
                    <span className={styles.choiceTitle}>Meal prep plan</span>
                    <span className={styles.choiceSub}>Voeg je geplande maaltijd toe</span>
                  </span>
                  <IoChevronForward size={16} color="var(--text-muted)" />
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Search modal ─────────────────────────────────────────────────── */}
      {searchModalOpen && createPortal(
        <div className={styles.modalOverlay} onClick={() => setSearchModalOpen(false)}>
          <div className={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Zoek producten</span>
              <button className={styles.modalCloseBtn} onClick={() => setSearchModalOpen(false)}>
                <IoClose size={20} />
              </button>
            </div>
            <div className={styles.searchBar}>
              <button
                className={styles.barcodeBtn}
                onClick={() => { setScannerVisible(true); setSearchModalOpen(false); }}
                aria-label="Barcode scannen"
              >
                <IoBarcodeOutline size={20} />
              </button>
              <input
                className={styles.searchInput}
                placeholder="Zoek producten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") searchProducts(searchQuery); }}
                autoFocus
              />
              <button
                className={styles.searchBtn}
                onClick={() => searchProducts(searchQuery)}
                disabled={isSearching}
                aria-label="Zoeken"
              >
                <IoSearchOutline size={18} color="#fff" />
              </button>
            </div>
            {searchError && <div className={styles.searchError}>{searchError}</div>}
            {isSearching && (
              <div className={styles.searchState}>
                <div className={styles.spinner} />
              </div>
            )}
            {!isSearching && searchResults.length > 0 && (
              <div className={styles.resultsList}>
                {searchResults.map((product, i) => (
                  <div
                    key={`${product.code || "x"}-${i}`}
                    className={styles.resultRow}
                    role="button"
                    tabIndex={0}
                    onClick={() => openProductDetail(product)}
                    onKeyDown={(e) => { if (e.key === "Enter") openProductDetail(product); }}
                  >
                    <div className={styles.resultMain}>
                      <div className={styles.resultName}>{product.product_name || "Onbekend product"}</div>
                      {product.brands && <div className={styles.resultBrand}>{product.brands}</div>}
                      <div className={styles.resultHint}>Tik voor voedingswaarden</div>
                    </div>
                    <button
                      className={styles.resultAddBtn}
                      onClick={(e) => { e.stopPropagation(); openProductDetail(product); }}
                      aria-label="Toevoegen"
                    >
                      <IoAdd size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Product detail modal ─────────────────────────────────────────── */}
      {detailModalOpen && createPortal(
        <div className={styles.modalOverlay} onClick={() => setDetailModalOpen(false)}>
          <div className={styles.detailSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {selectedProduct?.product_name || (isLoadingProduct ? "Laden..." : "Product")}
              </span>
              <button className={styles.modalCloseBtn} onClick={() => setDetailModalOpen(false)}>
                <IoClose size={20} />
              </button>
            </div>

            {isLoadingProduct && !selectedProduct ? (
              <div className={styles.searchState}><div className={styles.spinner} /></div>
            ) : productError && !selectedProduct ? (
              <div className={styles.searchError}>{productError}</div>
            ) : selectedProduct ? (
              <>
                <h4 className={styles.sectionLabel}>Hoeveel?</h4>
                <div className={styles.presetWrap}>
                  {SERVING_PRESETS.map((preset) => {
                    const active = selectedGrams === preset.grams && !customGramsInput;
                    return (
                      <button
                        key={preset.label}
                        className={active ? `${styles.presetBtn} ${styles.presetBtnActive}` : styles.presetBtn}
                        onClick={() => { setSelectedGrams(preset.grams); setCustomGramsInput(""); }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.customRow}>
                  <input
                    className={styles.customInput}
                    value={customGramsInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setCustomGramsInput(v);
                      const parsed = parseInt(v, 10);
                      if (!Number.isNaN(parsed) && parsed > 0) setSelectedGrams(parsed);
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={String(selectedGrams)}
                  />
                  <span className={styles.customUnit}>gram</span>
                </div>
                <div className={styles.previewCard}>
                  <div className={styles.previewTitle}>Voedingswaarden voor {selectedGrams} g:</div>
                  <div className={styles.previewGrid}>
                    <div className={styles.previewItem}>
                      <div className={styles.previewVal}>{calculatedNutrition.kcal}</div>
                      <div className={styles.previewLab}>kcal</div>
                    </div>
                    <div className={styles.previewItem}>
                      <div className={styles.previewVal}>{formatNumber(calculatedNutrition.protein)} g</div>
                      <div className={styles.previewLab}>eiwit</div>
                    </div>
                    <div className={styles.previewItem}>
                      <div className={styles.previewVal}>{formatNumber(calculatedNutrition.carbs)} g</div>
                      <div className={styles.previewLab}>koolhydraten</div>
                    </div>
                    <div className={styles.previewItem}>
                      <div className={styles.previewVal}>{formatNumber(calculatedNutrition.fat)} g</div>
                      <div className={styles.previewLab}>vet</div>
                    </div>
                  </div>
                </div>
                <h4 className={styles.sectionLabel}>Toevoegen aan</h4>
                <div className={styles.mealPills}>
                  {MEALS.map((meal) => (
                    <button
                      key={meal.id}
                      className={selectedMealType === meal.id ? `${styles.mealPill} ${styles.mealPillActive}` : styles.mealPill}
                      onClick={() => setSelectedMealType(meal.id)}
                    >
                      {meal.name}
                    </button>
                  ))}
                </div>
                <button
                  className={styles.addBtn}
                  onClick={handleAddToMeal}
                  disabled={addingFood || !authUser}
                >
                  {addingFood ? "Toevoegen..." : "Toevoegen"}
                </button>
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {/* ── Recipe picker modal ──────────────────────────────────────────── */}
      {recipePickerOpen && createPortal(
        <div className={styles.modalOverlay} onClick={() => setRecipePickerOpen(false)}>
          <div className={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Kies een recept</span>
              <button className={styles.modalCloseBtn} onClick={() => setRecipePickerOpen(false)}>
                <IoClose size={20} />
              </button>
            </div>
            {recipes.length === 0 ? (
              <div className={styles.searchState}>
                <span className={styles.emptyText}>Nog geen recepten opgeslagen.</span>
              </div>
            ) : (
              <div className={styles.resultsList}>
                {recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className={styles.resultRow}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAddRecipe(recipe)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddRecipe(recipe); }}
                  >
                    <div className={styles.resultMain}>
                      <div className={styles.resultName}>{recipe.title}</div>
                      <div className={styles.resultBrand}>{Math.round(recipe.kcal)} kcal</div>
                    </div>
                    <button className={styles.resultAddBtn} aria-label="Toevoegen">
                      <IoAdd size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Meal prep picker modal ──────────────────────────────────────── */}
      {mealPrepPickerOpen && createPortal(
        <div className={styles.modalOverlay} onClick={() => setMealPrepPickerOpen(false)}>
          <div className={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Meal prep plan</span>
              <button className={styles.modalCloseBtn} onClick={() => setMealPrepPickerOpen(false)}>
                <IoClose size={20} />
              </button>
            </div>
            <div className={styles.resultsList}>
              {(mealPrepPlan?.meals ?? []).map((meal) => (
                <div
                  key={meal.id}
                  className={styles.resultRow}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleAddMealPrepMeal(meal)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddMealPrepMeal(meal); }}
                >
                  <div className={styles.resultMain}>
                    <div className={styles.resultName}>{meal.recipeTitle}</div>
                    <div className={styles.resultBrand}>
                      {meal.kcal > 0 ? `${meal.kcal} kcal${meal.protein > 0 ? ` · ${meal.protein}g eiwit` : ""}` : ""}
                    </div>
                  </div>
                  <button className={styles.resultAddBtn} aria-label="Toevoegen">
                    <IoAdd size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add recipe modal ─────────────────────────────────────────────── */}
      {recipeAddModalOpen && (
        <RecipeAddModal
          authUser={authUser}
          onClose={() => setRecipeAddModalOpen(false)}
        />
      )}

      {/* ── Edit recipe modal ────────────────────────────────────────────── */}
      {recipeEditOpen && selectedRecipe && (
        <RecipeAddModal
          authUser={authUser}
          initialRecipe={selectedRecipe}
          recipeId={selectedRecipe.id}
          onClose={() => setRecipeEditOpen(false)}
        />
      )}

      {/* ── Recipe detail modal (full screen) ───────────────────────────── */}
      {recipeDetailOpen && selectedRecipe && createPortal(
        <div className={styles.recipeDetailOverlay}>
          {/* Hero image */}
          <div className={styles.recipeDetailHero}>
            {selectedRecipe.image ? (
              <img src={selectedRecipe.image} alt={selectedRecipe.title} className={styles.recipeDetailHeroImg} />
            ) : (
              <div className={styles.recipeDetailHeroPlaceholder} />
            )}
            <button
              className={styles.recipeDetailBackBtn}
              onClick={() => setRecipeDetailOpen(false)}
              aria-label="Terug"
            >
              <IoArrowBack size={20} color="#fff" />
            </button>
            <button
              className={styles.recipeDetailEditBtn}
              aria-label="Bewerken"
              onClick={() => { setRecipeDetailOpen(false); setRecipeEditOpen(true); }}
            >
              <IoCreateOutline size={20} color="#fff" />
            </button>
          </div>

          {/* Content */}
          <div className={styles.recipeDetailContent}>
            <div className={styles.recipeDetailTitle}>{selectedRecipe.title}</div>
            {selectedRecipe.portions && (
              <div className={styles.recipeDetailPortions}>{selectedRecipe.portions} porties</div>
            )}

            {/* Macro row */}
            <div className={styles.recipeDetailMacroRow}>
              <div className={styles.recipeDetailMacroItem}>
                <span className={styles.recipeDetailMacroLabel} style={{ color: "var(--accent)" }}>Kcal</span>
                <span className={styles.recipeDetailMacroVal}>{Math.round(selectedRecipe.kcal)} g</span>
              </div>
              <div className={styles.recipeDetailMacroItem}>
                <span className={styles.recipeDetailMacroLabel} style={{ color: "#C13232" }}>Eiwit</span>
                <span className={styles.recipeDetailMacroVal}>{formatNumber(selectedRecipe.protein)} g</span>
              </div>
              <div className={styles.recipeDetailMacroItem}>
                <span className={styles.recipeDetailMacroLabel} style={{ color: "#C28A00" }}>Vet</span>
                <span className={styles.recipeDetailMacroVal}>{formatNumber(selectedRecipe.fat)} g</span>
              </div>
              <div className={styles.recipeDetailMacroItem}>
                <span className={styles.recipeDetailMacroLabel} style={{ color: "#2A9DB5" }}>Carb</span>
                <span className={styles.recipeDetailMacroVal}>{formatNumber(selectedRecipe.carbs)} g</span>
              </div>
            </div>

            {/* Tabs */}
            <div className={styles.recipeDetailTabs}>
              <button
                className={recipeDetailTab === "ingredients" ? `${styles.recipeDetailTab} ${styles.recipeDetailTabActive}` : styles.recipeDetailTab}
                onClick={() => setRecipeDetailTab("ingredients")}
              >
                Ingrediënten
              </button>
              <button
                className={recipeDetailTab === "steps" ? `${styles.recipeDetailTab} ${styles.recipeDetailTabActive}` : styles.recipeDetailTab}
                onClick={() => setRecipeDetailTab("steps")}
              >
                Stappen
              </button>
            </div>

            {/* Tab content */}
            {recipeDetailTab === "ingredients" ? (
              <div className={styles.recipeDetailTabContent}>
                {(!selectedRecipe.ingredients || selectedRecipe.ingredients.length === 0) ? (
                  <div className={styles.recipeDetailEmpty}>Geen ingrediënten opgegeven.</div>
                ) : (
                  selectedRecipe.ingredients.map((ing, idx) => (
                    <div key={idx} className={styles.recipeDetailIngredientRow}>
                      <span className={styles.recipeDetailIngredientName}>{ing.name}</span>
                      <span className={styles.recipeDetailIngredientAmount}>{ing.amount}</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className={styles.recipeDetailTabContent}>
                {(!selectedRecipe.steps || selectedRecipe.steps.length === 0) ? (
                  <div className={styles.recipeDetailEmpty}>Geen stappen opgegeven.</div>
                ) : (
                  selectedRecipe.steps.map((step, idx) => (
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
      )}

      {/* ── Barcode scanner ──────────────────────────────────────────────── */}
      {scannerVisible && createPortal(
        <CameraBarcodeModal
          open={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onDetected={(code) => fetchProductByBarcode(code)}
        />,
        document.body
      )}

      {helpModeEnabled && (
        <button className={styles.helpBtn} onClick={() => setHelpOpen(true)} aria-label="Uitleg">
          <IoInformationCircleOutline size={22} />
        </button>
      )}
      {helpOpen && (
        <HelpOverlay steps={FOOD_HELP_STEPS} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  );
}
