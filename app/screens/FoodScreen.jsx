"use client";

import React, { useMemo, useRef, useState } from "react";
import homeStyles from "../home.module.css";
import foodStyles from "./FoodScreen.module.css";

import { useUser } from "../context/UserContext";
import { useFont } from "../context/FontContext";
import { addFoodToLog } from "../firebase/dataService";
import { FiPlus } from "react-icons/fi";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const SERVING_PRESETS = [
  { label: "1 tl", grams: 5 },
  { label: "1 el", grams: 15 },
  { label: "50g", grams: 50 },
  { label: "100g", grams: 100 },
  { label: "150g", grams: 150 },
  { label: "200g", grams: 200 },
];

// --- Open Food Facts endpoints ---
// Full-text search: use v1 (/cgi/search.pl + json=1). [web:19][web:23]
// Product details: use v2 product endpoint + fields to limit payload. [web:23][web:33]
const OFF_BASE = "https://world.openfoodfacts.net";
const SEARCH_PAGE_SIZE = 15;

// conservative “anti-burst” to avoid accidental rate limit hits
const MIN_MS_BETWEEN_SEARCHES = 1200;

// In-memory caches
const searchCache = new Map(); // key: normalized query -> products[]
const productCache = new Map(); // key: code -> full product

function normalizeQuery(q) {
  return q.trim().toLowerCase();
}

async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getImageUrl(product) {
  if (!product) return undefined;
  return (
    product.image_front_url ||
    product.image_front_small_url ||
    product.image_url
  );
}

function getKcal(nutriments) {
  if (!nutriments) return undefined;

  if (nutriments.energy_kcal_100g !== undefined)
    return nutriments.energy_kcal_100g;
  if (nutriments["energy-kcal_100g"] !== undefined)
    return nutriments["energy-kcal_100g"];
  if (nutriments["energy-kcal"] !== undefined) return nutriments["energy-kcal"];
  if (nutriments.energy_kcal !== undefined) return nutriments.energy_kcal;

  // If only kJ is available, convert to kcal (1 kcal = 4.184 kJ)
  if (nutriments.energy_100g !== undefined)
    return Math.round(nutriments.energy_100g / 4.184);

  return undefined;
}

function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return String(Math.round(value * 10) / 10);
}

// ---- OFF calls ----

// V1 search: supports full-text via search_terms. [web:19]
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
  // Limit returned fields to what you show in the list. [web:33]
  params.set("fields", "code,product_name,brands,image_front_small_url");

  const url = `${OFF_BASE}/cgi/search.pl?${params.toString()}`;
  const data = await fetchJson(url, { signal });

  const products = Array.isArray(data?.products) ? data.products : [];
  searchCache.set(q, products);
  return products;
}

// V2 product: limit payload via fields. [web:23][web:33]
async function offProductV2(code, { signal } = {}) {
  const key = String(code || "").trim();
  if (!key) return null;

  if (productCache.has(key)) return productCache.get(key);

  const fields = [
    "code",
    "product_name",
    "brands",
    "image_front_url",
    "image_front_small_url",
    "nutriments",
  ].join(",");

  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(
    key,
  )}?fields=${encodeURIComponent(fields)}`;

  const data = await fetchJson(url, { signal });
  const product = data?.product ?? null;

  if (product) productCache.set(key, product);
  return product;
}

export default function FoodScreen() {
  const { authUser } = useUser();
  const { fontFamily, fontFamilyMedium, fontFamilySemiBold, fontFamilyBold } =
    useFont();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [mealSelectModalVisible, setMealSelectModalVisible] = useState(false);

  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [productError, setProductError] = useState("");

  // Barcode modal (manual input)
  const [scannerVisible, setScannerVisible] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);

  // Serving size
  const [selectedGrams, setSelectedGrams] = useState(100);
  const [customGramsInput, setCustomGramsInput] = useState("");

  // Add to log
  const [addingFood, setAddingFood] = useState(false);

  const mealOptions = useMemo(
    () => [
      { id: "breakfast", name: "Ontbijt", icon: "🍳" },
      { id: "lunch", name: "Lunch", icon: "🍜" },
      { id: "dinner", name: "Avondeten", icon: "🍖" },
      { id: "snacks", name: "Snacks", icon: "🍎" },
    ],
    [],
  );

  const mealLabelById = useMemo(() => {
    return Object.fromEntries(mealOptions.map((m) => [m.id, m.name]));
  }, [mealOptions]);

  // Abort + throttle refs
  const lastSearchAtRef = useRef(0);
  const searchAbortRef = useRef(null);
  const productAbortRef = useRef(null);

  const calculatedNutrition = useMemo(() => {
    if (!selectedProduct?.nutriments)
      return { kcal: 0, protein: 0, carbs: 0, fat: 0 };

    const factor = selectedGrams / 100;
    const n = selectedProduct.nutriments;

    return {
      kcal: Math.round((getKcal(n) || 0) * factor),
      protein: Math.round((n.proteins_100g || 0) * factor * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g || 0) * factor * 10) / 10,
      fat: Math.round((n.fat_100g || 0) * factor * 10) / 10,
    };
  }, [selectedProduct, selectedGrams]);

  const searchProducts = async (query) => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    // avoid double click bursts
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
      if (e?.name !== "AbortError")
        setSearchError("Zoeken mislukt. Probeer het opnieuw.");
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
      if (e?.name !== "AbortError")
        setProductError("Product laden mislukt. Probeer opnieuw.");
      return null;
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const openProductDetails = async (productFromList) => {
    const code = productFromList?.code;

    setSelectedProduct(null);
    setProductError("");
    setDetailModalVisible(true);

    const full = await fetchFullProduct(code);
    if (full) setSelectedProduct(full);
  };

  const handleQuickAdd = async (productFromList) => {
    const code = productFromList?.code;

    setSelectedGrams(100);
    setCustomGramsInput("");

    setSelectedProduct(null);
    setProductError("");
    setMealSelectModalVisible(true);

    const full = await fetchFullProduct(code);
    if (full) setSelectedProduct(full);
  };

  const handleOpenScanner = () => {
    setBarcodeInput("");
    setScannerVisible(true);
  };

  const fetchProductByBarcode = async (barcode) => {
    const code = barcode.trim();
    if (!code) return;

    setIsLookingUpBarcode(true);
    try {
      setSelectedProduct(null);
      setProductError("");
      setDetailModalVisible(true);

      const full = await fetchFullProduct(code);
      if (full) setSelectedProduct(full);
    } finally {
      setIsLookingUpBarcode(false);
      setScannerVisible(false);
    }
  };

  const handleCustomGramsChange = (text) => {
    setCustomGramsInput(text);
    if (text === "") return;
    const parsed = parseInt(text, 10);
    if (!Number.isNaN(parsed) && parsed > 0) setSelectedGrams(parsed);
  };

  const handleAddToMeal = async (mealType) => {
    if (!selectedProduct || !authUser) return;

    setAddingFood(true);
    try {
      const nutriments = selectedProduct.nutriments;
      const kcalPer100g = getKcal(nutriments) || 0;
      const proteinPer100g = nutriments?.proteins_100g || 0;
      const carbsPer100g = nutriments?.carbohydrates_100g || 0;
      const fatPer100g = nutriments?.fat_100g || 0;

      await addFoodToLog(authUser.uid, new Date(), {
        type: "food",
        sourceId: selectedProduct.code,
        name: selectedProduct.product_name || "Onbekend product",
        image: getImageUrl(selectedProduct) || undefined,

        kcal: calculatedNutrition.kcal,
        protein: calculatedNutrition.protein,
        carbs: calculatedNutrition.carbs,
        fat: calculatedNutrition.fat,

        kcalPer100g,
        proteinPer100g,
        carbsPer100g,
        fatPer100g,

        grams: selectedGrams,
        servings: 1,
        mealType,
        checked: true,
      });

      setMealSelectModalVisible(false);
      setDetailModalVisible(false);
      setSelectedGrams(100);
      setCustomGramsInput("");

      const mealLabel = mealLabelById[mealType] ?? mealType;
      alert(
        `${selectedGrams}g van ${selectedProduct.product_name} is toegevoegd aan je ${mealLabel}`,
      );
    } catch {
      alert("Toevoegen van eten is mislukt. Probeer het opnieuw.");
    } finally {
      setAddingFood(false);
    }
  };

  return (
    <div
      className={homeStyles.screen}
      style={{ fontFamily: fontFamily || "inherit" }}
    >
      <div className={homeStyles.headerRow}>
        <div>
          <h1
            className={homeStyles.headerTitle}
            style={{ fontFamily: fontFamilyBold || fontFamily }}
          >
            Voeding
          </h1>
          <p className={homeStyles.headerSubtitle}>
            Zoek producten (Enter / Zoeken)
          </p>
        </div>

        <button
          className={homeStyles.headerButton}
          onClick={handleOpenScanner}
          type="button"
          aria-label="Barcode-invoer openen"
          title="Barcode"
        >
          <span className={foodStyles.headerBtnIcon} aria-hidden="true">
            ▦
          </span>
        </button>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          <div className={homeStyles.card}>
            <div className={foodStyles.searchRow}>
              <input
                className={foodStyles.searchInput}
                placeholder="Zoek producten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchProducts(searchQuery);
                }}
              />

              {searchQuery.length > 0 && (
                <button
                  className={foodStyles.clearBtn}
                  onClick={() => setSearchQuery("")}
                  type="button"
                  aria-label="Zoekopdracht wissen"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              className={foodStyles.searchBtn}
              onClick={() => searchProducts(searchQuery)}
              type="button"
              style={{ fontFamily: fontFamilySemiBold || fontFamily }}
              disabled={isSearching}
            >
              {isSearching ? "Bezig met zoeken..." : "Zoeken"}
            </button>

            {searchError && (
              <div className={foodStyles.muted}>{searchError}</div>
            )}
          </div>

          <div className={homeStyles.card}>
            <div className={foodStyles.resultsHeader}>
              <span
                className={cx(homeStyles.cardTitle, foodStyles.resultsTitle)}
                style={{ fontFamily: fontFamilySemiBold || fontFamily }}
              >
                Resultaten
              </span>
              <span className={foodStyles.muted}>
                {isSearching ? "..." : `${searchResults.length} items`}
              </span>
            </div>

            {isSearching ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.spinner} />
                <div className={foodStyles.stateText}>Bezig met zoeken...</div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.stateText}>
                  Typ een zoekopdracht en druk op Enter (of tik op Zoeken).
                </div>
              </div>
            ) : (
              <div className={foodStyles.list}>
                {searchResults.map((product, index) => (
                  <div
                    key={`${product.code || "no-code"}-${index}`}
                    className={foodStyles.row}
                    role="button"
                    tabIndex={0}
                    onClick={() => openProductDetails(product)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openProductDetails(product);
                    }}
                  >
                    <div className={foodStyles.thumbWrap}>
                      {getImageUrl(product) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={foodStyles.thumb}
                          src={getImageUrl(product)}
                          alt=""
                        />
                      ) : (
                        <div
                          className={cx(foodStyles.thumb, foodStyles.thumbPh)}
                          aria-hidden="true"
                        >
                          📦
                        </div>
                      )}
                    </div>

                    <div className={foodStyles.main}>
                      <div
                        className={foodStyles.name}
                        style={{ fontFamily: fontFamilySemiBold || fontFamily }}
                        title={product.product_name || "Onbekend product"}
                      >
                        {product.product_name || "Onbekend product"}
                      </div>

                      {product.brands && (
                        <div
                          className={foodStyles.brand}
                          title={product.brands}
                        >
                          {product.brands}
                        </div>
                      )}

                      <div className={foodStyles.meta}>
                        <span className={foodStyles.protein}>
                          Tik voor voedingswaarden
                        </span>
                      </div>
                    </div>

                    <button
                      className={foodStyles.quickAdd}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAdd(product);
                      }}
                      type="button"
                      aria-label="Snel toevoegen"
                      title="Snel toevoegen"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={homeStyles.bottomSpacer} />
        </div>
      </div>

      {/* Barcode input modal */}
      {scannerVisible && (
        <div
          className={homeStyles.modalOverlay}
          role="dialog"
          aria-modal="true"
        >
          <div className={homeStyles.modalCard}>
            <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
              <h3 className={homeStyles.modalTitle}>Barcode</h3>
              <button
                className={homeStyles.iconButton}
                onClick={() => setScannerVisible(false)}
                type="button"
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>

            <p className={foodStyles.modalHint}>
              Webversie: plak/voer een barcode in (EAN/UPC).
            </p>

            <input
              className={foodStyles.modalInput}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="bijv. 737628064502"
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchProductByBarcode(barcodeInput);
              }}
            />

            <button
              className={foodStyles.modalPrimaryBtn}
              onClick={() => fetchProductByBarcode(barcodeInput)}
              type="button"
              disabled={isLookingUpBarcode}
            >
              {isLookingUpBarcode ? "Bezig met opzoeken..." : "Opzoeken"}
            </button>
          </div>
        </div>
      )}

      {/* Product detail modal */}
      {detailModalVisible && (
        <div
          className={homeStyles.modalOverlay}
          role="dialog"
          aria-modal="true"
        >
          <div className={cx(homeStyles.modalCard, foodStyles.detailModalCard)}>
            <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
              <h3 className={homeStyles.modalTitle}>Voedingswaarden</h3>
              <button
                className={homeStyles.iconButton}
                onClick={() => setDetailModalVisible(false)}
                type="button"
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>

            {!selectedProduct || isLoadingProduct ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.spinner} />
                <div className={foodStyles.stateText}>Product laden...</div>
                {productError && (
                  <div className={foodStyles.muted}>{productError}</div>
                )}
              </div>
            ) : (
              <>
                <div className={foodStyles.detailTop}>
                  <div className={foodStyles.detailHeader}>
                    {getImageUrl(selectedProduct) ? (
                      <img
                        className={foodStyles.detailImg}
                        src={getImageUrl(selectedProduct)}
                        alt=""
                      />
                    ) : (
                      <div
                        className={cx(foodStyles.detailImg, foodStyles.thumbPh)}
                        aria-hidden="true"
                      >
                        📦
                      </div>
                    )}

                    <div className={foodStyles.detailText}>
                      <div
                        className={foodStyles.detailName}
                        style={{ fontFamily: fontFamilyBold || fontFamily }}
                      >
                        {selectedProduct.product_name || "Onbekend product"}
                      </div>

                      {selectedProduct.brands && (
                        <div className={foodStyles.detailBrand}>
                          {selectedProduct.brands}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className={foodStyles.per100Label}>Per 100 gram:</div>
                <div className={foodStyles.nutriGrid}>
                  <div className={foodStyles.nutriCell}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(getKcal(selectedProduct.nutriments))}
                    </div>
                    <div className={foodStyles.nutriLabel}>kcal</div>
                  </div>

                  <div className={foodStyles.nutriCell}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(selectedProduct.nutriments?.proteins_100g)}g
                    </div>
                    <div className={foodStyles.nutriLabel}>eiwit</div>
                  </div>

                  <div className={foodStyles.nutriCell}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(
                        selectedProduct.nutriments?.carbohydrates_100g,
                      )}
                      g
                    </div>
                    <div className={foodStyles.nutriLabel}>koolhydraten</div>
                  </div>

                  <div className={foodStyles.nutriCell}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(selectedProduct.nutriments?.fat_100g)}g
                    </div>
                    <div className={foodStyles.nutriLabel}>vet</div>
                  </div>
                </div>

                <button
                  className={foodStyles.modalPrimaryBtn}
                  onClick={() => setMealSelectModalVisible(true)}
                  type="button"
                >
                  <FiPlus aria-hidden="true" />
                  Toevoegen
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Meal select modal */}
      {mealSelectModalVisible && (
        <div
          className={homeStyles.modalOverlay}
          role="dialog"
          aria-modal="true"
        >
          <div className={homeStyles.modalCard}>
            <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
              <h3 className={homeStyles.modalTitle}>Toevoegen aan maaltijd</h3>
              <button
                className={homeStyles.iconButton}
                onClick={() => setMealSelectModalVisible(false)}
                type="button"
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>

            {!selectedProduct || isLoadingProduct ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.spinner} />
                <div className={foodStyles.stateText}>Product laden...</div>
                {productError && (
                  <div className={foodStyles.muted}>{productError}</div>
                )}
              </div>
            ) : (
              <>
                {selectedProduct?.product_name && (
                  <div className={foodStyles.servingProduct}>
                    {selectedProduct.product_name}
                  </div>
                )}

                <h4 className={homeStyles.modalSectionTitle}>Hoeveel?</h4>

                <div className={foodStyles.presetWrap}>
                  {SERVING_PRESETS.map((preset) => {
                    const active =
                      selectedGrams === preset.grams && !customGramsInput;
                    return (
                      <button
                        key={preset.label}
                        className={cx(
                          foodStyles.presetBtn,
                          active && foodStyles.presetBtnActive,
                        )}
                        onClick={() => {
                          setSelectedGrams(preset.grams);
                          setCustomGramsInput("");
                        }}
                        type="button"
                      >
                        <span
                          className={cx(
                            foodStyles.presetText,
                            active && foodStyles.presetTextActive,
                          )}
                          style={{ fontFamily: fontFamilyMedium || fontFamily }}
                        >
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={foodStyles.customRow}>
                  <input
                    className={foodStyles.customInput}
                    value={customGramsInput}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                      handleCustomGramsChange(digitsOnly);
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    type="text"
                    placeholder="Aangepaste hoeveelheid"
                  />
                  <span className={foodStyles.customUnit}>gram</span>
                </div>

                <div className={foodStyles.previewCard}>
                  <div className={foodStyles.previewTitle}>
                    Voedingswaarden voor {selectedGrams}g:
                  </div>
                  <div className={foodStyles.previewGrid}>
                    <div className={foodStyles.previewItem}>
                      <div className={foodStyles.previewVal}>
                        {calculatedNutrition.kcal}
                      </div>
                      <div className={foodStyles.previewLab}>kcal</div>
                    </div>
                    <div className={foodStyles.previewItem}>
                      <div className={foodStyles.previewVal}>
                        {calculatedNutrition.protein}g
                      </div>
                      <div className={foodStyles.previewLab}>Eiwit</div>
                    </div>
                    <div className={foodStyles.previewItem}>
                      <div className={foodStyles.previewVal}>
                        {calculatedNutrition.carbs}g
                      </div>
                      <div className={foodStyles.previewLab}>Koolhydraten</div>
                    </div>
                    <div className={foodStyles.previewItem}>
                      <div className={foodStyles.previewVal}>
                        {calculatedNutrition.fat}g
                      </div>
                      <div className={foodStyles.previewLab}>Vet</div>
                    </div>
                  </div>
                </div>

                <h4 className={homeStyles.modalSectionTitle}>
                  Toevoegen aan maaltijd
                </h4>

                <div className={foodStyles.mealRow}>
                  {mealOptions.map((meal) => (
                    <button
                      key={meal.id}
                      className={foodStyles.mealBtn}
                      onClick={() => handleAddToMeal(meal.id)}
                      disabled={addingFood || !authUser}
                      type="button"
                    >
                      <div className={foodStyles.mealEmoji} aria-hidden="true">
                        {meal.icon}
                      </div>
                      <div
                        className={foodStyles.mealName}
                        style={{ fontFamily: fontFamilyMedium || fontFamily }}
                      >
                        {meal.name}
                      </div>
                    </button>
                  ))}
                </div>

                {addingFood && (
                  <div className={foodStyles.addingRow}>
                    <div className={foodStyles.smallSpinner} />
                    <div className={foodStyles.addingText}>
                      Bezig met toevoegen...
                    </div>
                  </div>
                )}

                {!authUser && (
                  <div className={foodStyles.warn}>
                    Je bent niet ingelogd. Inloggen is vereist om eten toe te
                    voegen.
                  </div>
                )}

                <button
                  className={foodStyles.modalSecondaryBtn}
                  onClick={() => setMealSelectModalVisible(false)}
                  type="button"
                >
                  Annuleren
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
