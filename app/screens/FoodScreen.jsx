"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import homeStyles from "../home.module.css";
import foodStyles from "./FoodScreen.module.css";

import { useUser } from "../context/UserContext";
import { useFont } from "../context/FontContext";
import { addFoodToLog } from "../firebase/dataService";
import { MealType } from "../types/user";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const SERVING_PRESETS = [
  { label: "1 tsp", grams: 5 },
  { label: "1 tbsp", grams: 15 },
  { label: "50g", grams: 50 },
  { label: "100g", grams: 100 },
  { label: "150g", grams: 150 },
  { label: "200g", grams: 200 },
];

/**
 * Search result products (minimal fields only)
 * We purposely do NOT request nutriments here to speed up list rendering.
 */
export default function FoodScreen() {
  const { authUser } = useUser();
  const { fontFamily, fontFamilyMedium, fontFamilySemiBold, fontFamilyBold } =
    useFont();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected product detail (full fields)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Web barcode modal (manual input)
  const [scannerVisible, setScannerVisible] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);

  // Meal selection modal
  const [mealSelectModalVisible, setMealSelectModalVisible] = useState(false);
  const [addingFood, setAddingFood] = useState(false);

  // Serving size
  const [selectedGrams, setSelectedGrams] = useState(100);
  const [customGramsInput, setCustomGramsInput] = useState("");

  const mealOptions = useMemo(
    () => [
      { id: "breakfast", name: "Breakfast", icon: "🍳" },
      { id: "lunch", name: "Lunch", icon: "🍜" },
      { id: "dinner", name: "Dinner", icon: "🍖" },
      { id: "snacks", name: "Snacks", icon: "🍎" },
    ],
    [],
  );

  const getImageUrl = (product) => {
    if (!product) return undefined;
    return (
      product.image_front_url ||
      product.image_front_small_url ||
      product.image_url
    );
  };

  const getKcal = (nutriments) => {
    if (!nutriments) return undefined;

    if (nutriments.energy_kcal_100g !== undefined)
      return nutriments.energy_kcal_100g;
    if (nutriments["energy-kcal_100g"] !== undefined)
      return nutriments["energy-kcal_100g"];
    if (nutriments["energy-kcal"] !== undefined)
      return nutriments["energy-kcal"];
    if (nutriments.energy_kcal !== undefined) return nutriments.energy_kcal;

    // If only kJ is available, convert to kcal (1 kcal = 4.184 kJ)
    if (nutriments.energy_100g !== undefined) {
      return Math.round(nutriments.energy_100g / 4.184);
    }

    return undefined;
  };

  const formatNumber = (value) => {
    if (value === undefined || value === null || Number.isNaN(value))
      return "-";
    return String(Math.round(value * 10) / 10);
  };

  // ---------- FAST SEARCH (manual trigger only) ----------
  // ---------- FAST SEARCH (v2) ----------
  const searchTimeoutRef = useRef(null);
  const searchCacheRef = useRef(new Map()); // key: normalized query, val: products
  const abortRef = useRef(null);
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();

    // reset UI quickly
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    // debounce
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      // cache hit
      if (searchCacheRef.current.has(q)) {
        setSearchResults(searchCacheRef.current.get(q));
        setIsSearching(false);
        return;
      }

      // cancel previous request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      await searchProducts(q, { signal: abortRef.current.signal, cacheKey: q });
    }, 250); // tweak 150–350ms

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const searchProducts = async (query, { signal, cacheKey } = {}) => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("search_terms", q);
      params.set("search_simple", "1");
      params.set("action", "process");
      params.set("json", "1");
      params.set("page_size", "15");
      params.set("cc", "nl");
      params.set(
        "fields",
        "code,product_name,brands,image_front_small_url,stores,stores_tags",
      );

      const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
      const response = await fetch(url, { signal });
      const data = await response.json();

      const products = data?.products || [];
      setSearchResults(products);

      // store in cache
      if (cacheKey) searchCacheRef.current.set(cacheKey, products);
    } catch (error) {
      // ignore abort errors (user typed again)
      if (error?.name !== "AbortError") {
        console.error("Search error:", error);
        alert("Failed to search products. Please try again.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  // ---------- LOAD FULL PRODUCT ONLY WHEN NEEDED ----------
  const fetchFullProduct = async (code) => {
    if (!code) return null;

    setIsLoadingProduct(true);
    try {
      // Use product-by-code endpoint, and still limit fields for speed. [web:57][web:62]
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
          code,
        )}.json`,
      );
      const data = await response.json();

      if (data?.status === 1 && data?.product) return data.product;

      return null;
    } catch (error) {
      console.error("Product fetch error:", error);
      return null;
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const openProductDetails = async (productFromList) => {
    const code = productFromList?.code;
    setSelectedProduct(null);
    setDetailModalVisible(true);

    const full = await fetchFullProduct(code);
    if (!full) {
      setDetailModalVisible(false);
      alert("Product not found.");
      return;
    }

    setSelectedProduct(full);
  };

  const handleQuickAdd = async (productFromList) => {
    const code = productFromList?.code;
    setSelectedGrams(100);
    setCustomGramsInput("");

    setSelectedProduct(null);
    setMealSelectModalVisible(true);

    const full = await fetchFullProduct(code);
    if (!full) {
      setMealSelectModalVisible(false);
      alert("Product not found.");
      return;
    }

    setSelectedProduct(full);
  };

  // ---------- BARCODE LOOKUP (manual input modal) ----------
  const handleOpenScanner = () => {
    setBarcodeInput("");
    setScannerVisible(true);
  };

  const fetchProductByBarcode = async (barcode) => {
    const code = barcode.trim();
    if (!code) return;

    setIsLookingUpBarcode(true);
    try {
      const full = await fetchFullProduct(code);
      if (!full) {
        alert("This product was not found in the database.");
        return;
      }
      setSelectedProduct(full);
      setDetailModalVisible(true);
    } finally {
      setIsLookingUpBarcode(false);
      setScannerVisible(false);
    }
  };

  // ---------- NUTRITION CALC ----------
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

  const handleCustomGramsChange = (text) => {
    setCustomGramsInput(text);
    const parsed = parseInt(text, 10);
    if (!Number.isNaN(parsed) && parsed > 0) setSelectedGrams(parsed);
  };

  // ---------- ADD TO LOG ----------
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
        name: selectedProduct.product_name || "Unknown Food",
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
        mealType: mealType,
        checked: true,
      });

      setMealSelectModalVisible(false);
      setDetailModalVisible(false);
      setSelectedGrams(100);
      setCustomGramsInput("");

      alert(
        `Added! ${selectedGrams}g of ${selectedProduct.product_name} added to ${mealType}`,
      );
    } catch (error) {
      console.error("Error adding food:", error);
      alert("Failed to add food. Please try again.");
    } finally {
      setAddingFood(false);
    }
  };

  return (
    <div
      className={homeStyles.screen}
      style={{ fontFamily: fontFamily || "inherit" }}
    >
      {/* Header like Home */}
      <div className={homeStyles.headerRow}>
        <div>
          <h1
            className={homeStyles.headerTitle}
            style={{ fontFamily: fontFamilyBold || fontFamily }}
          >
            Food
          </h1>
          <p className={homeStyles.headerSubtitle}>
            Search products (press Enter / Search)
          </p>
        </div>

        <button
          className={homeStyles.headerButton}
          onClick={handleOpenScanner}
          type="button"
          aria-label="Open barcode input"
          title="Barcode"
        >
          <span className={foodStyles.headerBtnIcon} aria-hidden="true">
            ▦
          </span>
        </button>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          {/* Search card */}
          <div className={homeStyles.card}>
            <div className={foodStyles.searchRow}>
              <input
                className={foodStyles.searchInput}
                placeholder="Search products..."
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
                  aria-label="Clear search"
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
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Results card */}
          <div className={homeStyles.card}>
            <div className={foodStyles.resultsHeader}>
              <span
                className={cx(homeStyles.cardTitle, foodStyles.resultsTitle)}
                style={{ fontFamily: fontFamilySemiBold || fontFamily }}
              >
                Results
              </span>
              <span className={foodStyles.muted}>
                {isSearching ? "..." : `${searchResults.length} items`}
              </span>
            </div>

            {isSearching ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.spinner} />
                <div className={foodStyles.stateText}>Searching...</div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.stateText}>
                  Type a query and press Enter (or tap Search).
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
                        title={product.product_name || "Unknown Product"}
                      >
                        {product.product_name || "Unknown Product"}
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
                          Tap for nutrition
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
                      aria-label="Quick add"
                      title="Quick add"
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
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className={foodStyles.modalHint}>
              Web version: paste/enter a barcode (EAN/UPC).
            </p>

            <input
              className={foodStyles.modalInput}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="e.g. 737628064502"
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
              {isLookingUpBarcode ? "Looking up..." : "Lookup"}
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
              <h3 className={homeStyles.modalTitle}>Nutrition Info</h3>
              <button
                className={homeStyles.iconButton}
                onClick={() => setDetailModalVisible(false)}
                type="button"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {!selectedProduct || isLoadingProduct ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.spinner} />
                <div className={foodStyles.stateText}>Loading product...</div>
              </div>
            ) : (
              <>
                <div className={foodStyles.detailTop}>
                  {getImageUrl(selectedProduct) ? (
                    // eslint-disable-next-line @next/next/no-img-element
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

                  <div
                    className={foodStyles.detailName}
                    style={{ fontFamily: fontFamilyBold || fontFamily }}
                  >
                    {selectedProduct.product_name || "Unknown Product"}
                  </div>

                  {selectedProduct.brands && (
                    <div className={foodStyles.detailBrand}>
                      {selectedProduct.brands}
                    </div>
                  )}
                </div>

                <div className={foodStyles.nutriGrid}>
                  <div className={foodStyles.nutriItem}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(getKcal(selectedProduct.nutriments))}
                    </div>
                    <div className={foodStyles.nutriLab}>Kcal / 100g</div>
                  </div>
                  <div className={foodStyles.nutriItem}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(selectedProduct.nutriments?.proteins_100g)}g
                    </div>
                    <div className={foodStyles.nutriLab}>Protein</div>
                  </div>
                  <div className={foodStyles.nutriItem}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(
                        selectedProduct.nutriments?.carbohydrates_100g,
                      )}
                      g
                    </div>
                    <div className={foodStyles.nutriLab}>Carbs</div>
                  </div>
                  <div className={foodStyles.nutriItem}>
                    <div className={foodStyles.nutriVal}>
                      {formatNumber(selectedProduct.nutriments?.fat_100g)}g
                    </div>
                    <div className={foodStyles.nutriLab}>Fat</div>
                  </div>
                </div>

                <div className={foodStyles.dataSource}>
                  Data from Open Food Facts
                </div>

                <button
                  className={foodStyles.modalPrimaryBtn}
                  onClick={() => setMealSelectModalVisible(true)}
                  type="button"
                >
                  Add to Today’s Meal
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Meal select modal + serving size */}
      {mealSelectModalVisible && (
        <div
          className={homeStyles.modalOverlay}
          role="dialog"
          aria-modal="true"
        >
          <div className={homeStyles.modalCard}>
            <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
              <h3 className={homeStyles.modalTitle}>Add to meal</h3>
              <button
                className={homeStyles.iconButton}
                onClick={() => setMealSelectModalVisible(false)}
                type="button"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {!selectedProduct || isLoadingProduct ? (
              <div className={foodStyles.stateBox}>
                <div className={foodStyles.spinner} />
                <div className={foodStyles.stateText}>Loading product...</div>
              </div>
            ) : (
              <>
                {selectedProduct?.product_name && (
                  <div className={foodStyles.servingProduct}>
                    {selectedProduct.product_name}
                  </div>
                )}

                <h4 className={homeStyles.modalSectionTitle}>How much?</h4>

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
                    onChange={(e) => handleCustomGramsChange(e.target.value)}
                    inputMode="numeric"
                    placeholder="Custom amount"
                  />
                  <span className={foodStyles.customUnit}>grams</span>
                </div>

                <div className={foodStyles.previewCard}>
                  <div className={foodStyles.previewTitle}>
                    Nutrition for {selectedGrams}g:
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
                      <div className={foodStyles.previewLab}>Protein</div>
                    </div>
                    <div className={foodStyles.previewItem}>
                      <div className={foodStyles.previewVal}>
                        {calculatedNutrition.carbs}g
                      </div>
                      <div className={foodStyles.previewLab}>Carbs</div>
                    </div>
                    <div className={foodStyles.previewItem}>
                      <div className={foodStyles.previewVal}>
                        {calculatedNutrition.fat}g
                      </div>
                      <div className={foodStyles.previewLab}>Fat</div>
                    </div>
                  </div>
                </div>

                <h4 className={homeStyles.modalSectionTitle}>Add to meal</h4>

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
                    <div className={foodStyles.addingText}>Adding...</div>
                  </div>
                )}

                {!authUser && (
                  <div className={foodStyles.warn}>
                    You’re not logged in. Login is required to add foods.
                  </div>
                )}

                <button
                  className={foodStyles.modalSecondaryBtn}
                  onClick={() => setMealSelectModalVisible(false)}
                  type="button"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
