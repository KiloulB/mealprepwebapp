"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import homeStyles from "../home.module.css";
import recipeStyles from "./RecipeScreen.module.css";

import {
  IoAdd,
  IoBookOutline,
  IoCameraOutline,
  IoChevronForward,
  IoClose,
  IoCreateOutline,
  IoImageOutline,
  IoNutritionOutline,
  IoPersonOutline,
  IoRestaurantOutline,
  IoTrashOutline,
} from "react-icons/io5";

import { useUser } from "../context/UserContext";
import {
  subscribeToRecipes,
  saveRecipe,
  updateRecipe,
  deleteRecipe,
} from "../firebase/dataService";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const initialFormState = {
  image: null,
  title: "",
  subtitle: "",
  servings: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  prepTime: "",
  cookTime: "",
  totalTime: "",
  ingredients: [{ id: "1", name: "", amount: "" }],
  instructions: [{ id: "1", step: "" }],
};

export default function RecipeScreen() {
  const router = useRouter();
  const { authUser } = useUser();

  const [recipes, setRecipes] = useState([]);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectRecipeModalVisible, setSelectRecipeModalVisible] =
    useState(false);

  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    if (!authUser) return;
    const unsub = subscribeToRecipes(authUser.uid, setRecipes);
    return () => unsub && unsub();
  }, [authUser]);

  const fabMenuItems = useMemo(
    () => [
      {
        id: "recipes",
        label: "New Recipes",
        icon: <IoBookOutline size={18} />,
      },
      { id: "edit", label: "Edit Recipe", icon: <IoCreateOutline size={18} /> },
    ],
    [],
  );

  const openAddModal = () => {
    setEditingRecipeId(null);
    setForm(initialFormState);
    setModalVisible(true);
  };

  const openSelectToEdit = () => {
    if (!recipes.length) return;
    setSelectRecipeModalVisible(true);
  };

  const handleFabItemPress = (id) => {
    setFabMenuOpen(false);
    if (id === "recipes") openAddModal();
    if (id === "edit") openSelectToEdit();
  };

  const onPickImage = async (file) => {
    const url = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, image: url }));
  };

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { id: String(prev.ingredients.length + 1), name: "", amount: "" },
      ],
    }));
  };

  const updateIngredient = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === id ? { ...ing, [field]: value } : ing,
      ),
    }));
  };

  const removeIngredient = (id) => {
    setForm((prev) => {
      if (prev.ingredients.length <= 1) return prev;
      return {
        ...prev,
        ingredients: prev.ingredients.filter((i) => i.id !== id),
      };
    });
  };

  const addInstruction = () => {
    setForm((prev) => ({
      ...prev,
      instructions: [
        ...prev.instructions,
        { id: String(prev.instructions.length + 1), step: "" },
      ],
    }));
  };

  const updateInstruction = (id, value) => {
    setForm((prev) => ({
      ...prev,
      instructions: prev.instructions.map((inst) =>
        inst.id === id ? { ...inst, step: value } : inst,
      ),
    }));
  };

  const removeInstruction = (id) => {
    setForm((prev) => {
      if (prev.instructions.length <= 1) return prev;
      return {
        ...prev,
        instructions: prev.instructions.filter((i) => i.id !== id),
      };
    });
  };

  const handleSave = async () => {
    if (!authUser) return;
    if (!form.title.trim()) return;

    const recipeData = {
      image: form.image,
      title: form.title,
      subtitle: form.subtitle,
      servings: form.servings,
      kcal: parseInt(form.kcal || "0", 10) || 0,
      protein: parseInt(form.protein || "0", 10) || 0,
      carbs: parseInt(form.carbs || "0", 10) || 0,
      fat: parseInt(form.fat || "0", 10) || 0,
      prepTime: form.prepTime,
      cookTime: form.cookTime,
      totalTime: form.totalTime,
      ingredients: (form.ingredients || []).filter((i) =>
        (i.name || "").trim(),
      ),
      instructions: (form.instructions || []).filter((s) =>
        (s.step || "").trim(),
      ),
    };

    if (editingRecipeId) {
      await updateRecipe(authUser.uid, editingRecipeId, recipeData);
    } else {
      await saveRecipe(authUser.uid, recipeData);
    }

    setModalVisible(false);
    setEditingRecipeId(null);
    setForm(initialFormState);
  };

  const handleEditRecipe = (recipe) => {
    setEditingRecipeId(recipe.id);
    setForm({
      image: recipe.image || null,
      title: recipe.title || "",
      subtitle: recipe.subtitle || "",
      servings: recipe.servings || "",
      kcal: String(recipe.kcal ?? ""),
      protein: String(recipe.protein ?? ""),
      carbs: String(recipe.carbs ?? ""),
      fat: String(recipe.fat ?? ""),
      prepTime: recipe.prepTime || "",
      cookTime: recipe.cookTime || "",
      totalTime: recipe.totalTime || "",
      ingredients:
        recipe.ingredients && recipe.ingredients.length
          ? recipe.ingredients
          : [{ id: "1", name: "", amount: "" }],
      instructions:
        recipe.instructions && recipe.instructions.length
          ? recipe.instructions
          : [{ id: "1", step: "" }],
    });

    setSelectRecipeModalVisible(false);
    setModalVisible(true);
  };

  const handleDelete = async () => {
    if (!authUser || !editingRecipeId) return;
    await deleteRecipe(authUser.uid, editingRecipeId);
    setModalVisible(false);
    setEditingRecipeId(null);
    setForm(initialFormState);
  };

  return (
    <div className={homeStyles.screen}>
      {/* Header (same as Food) */}
      <div className={homeStyles.headerRow}>
        <div>
          <h1 className={homeStyles.headerTitle}>Recepten</h1>
          <p className={homeStyles.headerSubtitle}>
            Maak, bewerk en bekijk je recepten
          </p>
        </div>

        <button
          className={homeStyles.headerButton}
          onClick={() => router.push("/settings")}
          type="button"
          aria-label="Settings"
        >
          <IoPersonOutline size={24} color="#9CA3AF" />
        </button>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          <div className={homeStyles.card}>
            {/* Grid inside a home card */}
            {recipes.length === 0 ? (
              <div className={recipeStyles.emptyState}>
                <IoBookOutline size={44} color="#97969b" />
                <div className={recipeStyles.emptyTitle}>Nog geen recepten</div>
                <div className={recipeStyles.emptySub}>
                  Tik op + om er één toe te voegen
                </div>
              </div>
            ) : (
              <div className={recipeStyles.grid}>
                {recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    className={recipeStyles.cardBtn}
                    onClick={() =>
                      router.push(`/recipes/${recipe.id}?tab=recepten`)
                    }
                    type="button"
                  >
                    {recipe.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={recipeStyles.cardImg}
                        src={recipe.image}
                        alt={recipe.title}
                      />
                    ) : (
                      <div className={recipeStyles.cardImgPlaceholder}>
                        <IoImageOutline size={22} color="#97969b" />
                      </div>
                    )}

                    <div className={recipeStyles.cardMain}>
                      <div className={recipeStyles.cardName}>
                        {recipe.title}
                      </div>
                      <div className={recipeStyles.cardMeta}>
                        <span className={recipeStyles.kcal}>
                          {recipe.kcal} kcal
                        </span>
                        <span className={recipeStyles.dot}>•</span>
                        <span className={recipeStyles.muted}>
                          P {recipe.protein}g / C {recipe.carbs}g / F{" "}
                          {recipe.fat}g
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={homeStyles.bottomSpacer} />
        </div>
      </div>

      {/* FAB overlay/menu (keep your current behavior, but use recipeStyles colors) */}
      {fabMenuOpen && (
        <button
          className={recipeStyles.fabOverlay}
          onClick={() => setFabMenuOpen(false)}
          type="button"
          aria-label="Close menu"
        />
      )}

      {fabMenuOpen && (
        <div className={recipeStyles.fabMenu}>
          {fabMenuItems.map((item) => (
            <button
              key={item.id}
              className={recipeStyles.fabMenuItem}
              onClick={() => handleFabItemPress(item.id)}
              type="button"
            >
              <span className={recipeStyles.fabIcon}>{item.icon}</span>
              <span className={recipeStyles.fabLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <button
        className={recipeStyles.fab}
        onClick={() => setFabMenuOpen((v) => !v)}
        type="button"
        aria-label="Add"
      >
        <IoAdd size={26} color="#000" />
      </button>

      {/* Add/Edit modal: reuse home modal wrapper + card like Food */}
      {modalVisible && (
        <div
          className={homeStyles.modalOverlay}
          role="dialog"
          aria-modal="true"
        >
          <div className={cx(homeStyles.modalCard, recipeStyles.modalWide)}>
            <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
              <h3 className={homeStyles.modalTitle}>
                {editingRecipeId ? "Recept bewerken" : "Nieuw recept"}
              </h3>

              <div className={recipeStyles.modalHeaderRight}>
                {editingRecipeId && (
                  <button
                    className={recipeStyles.trashBtn}
                    onClick={handleDelete}
                    type="button"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <IoTrashOutline size={20} />
                  </button>
                )}

                <button
                  className={homeStyles.iconButton}
                  onClick={() => {
                    setModalVisible(false);
                    setEditingRecipeId(null);
                  }}
                  type="button"
                  aria-label="Close"
                >
                  <IoClose size={22} />
                </button>
              </div>
            </div>

            <div className={recipeStyles.modalBody}>
              <label className={recipeStyles.imagePicker}>
                {form.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={recipeStyles.pickedImg}
                    src={form.image}
                    alt="Recipe"
                  />
                ) : (
                  <div className={recipeStyles.imagePlaceholder}>
                    <IoCameraOutline size={30} color="#97969b" />
                    <div className={recipeStyles.imagePlaceholderText}>
                      Foto toevoegen
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className={recipeStyles.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPickImage(file);
                  }}
                />
              </label>

              <div className={recipeStyles.formGrid}>
                <div>
                  <div className={recipeStyles.label}>Title</div>
                  <input
                    className={recipeStyles.input}
                    value={form.title}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Recipe name"
                  />
                </div>

                <div>
                  <div className={recipeStyles.label}>Subtitle</div>
                  <input
                    className={recipeStyles.input}
                    value={form.subtitle}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, subtitle: e.target.value }))
                    }
                    placeholder="Short description"
                  />
                </div>

                <div>
                  <div className={recipeStyles.label}>Servings</div>
                  <input
                    className={recipeStyles.input}
                    value={form.servings}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, servings: e.target.value }))
                    }
                    placeholder="Number of servings"
                    inputMode="numeric"
                  />
                </div>

                <div className={recipeStyles.box}>
                  <div className={recipeStyles.boxTitle}>
                    Nutrition per serving
                  </div>
                  <div className={recipeStyles.nutriRow}>
                    {[
                      ["Kcal", "kcal"],
                      ["Protein", "protein"],
                      ["Carbs", "carbs"],
                      ["Fat", "fat"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <div className={recipeStyles.smallLabel}>{label}</div>
                        <input
                          className={recipeStyles.smallInput}
                          value={form[key]}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, [key]: e.target.value }))
                          }
                          inputMode="numeric"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className={recipeStyles.box}>
                  <div className={recipeStyles.boxTitle}>Time</div>
                  <div className={recipeStyles.timeRow}>
                    {[
                      ["Prep", "prepTime"],
                      ["Cook", "cookTime"],
                      ["Total", "totalTime"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <div className={recipeStyles.smallLabel}>{label}</div>
                        <input
                          className={recipeStyles.smallInput}
                          value={form[key]}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, [key]: e.target.value }))
                          }
                          placeholder="0 min"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* NOW these are also grid items, so gap becomes consistent */}
                <div className={recipeStyles.box}>
                  <div className={recipeStyles.boxHeader}>
                    <div className={recipeStyles.boxTitle}>Ingredients</div>
                    <button
                      className={recipeStyles.circleBtn}
                      onClick={addIngredient}
                      type="button"
                    >
                      <IoAdd size={18} />
                    </button>
                  </div>

                  {form.ingredients.map((ing) => (
                    <div key={ing.id} className={recipeStyles.row}>
                      <input
                        className={recipeStyles.amountInput}
                        value={ing.amount}
                        onChange={(e) =>
                          updateIngredient(ing.id, "amount", e.target.value)
                        }
                        placeholder="Amount"
                      />
                      <input
                        className={recipeStyles.nameInput}
                        value={ing.name}
                        onChange={(e) =>
                          updateIngredient(ing.id, "name", e.target.value)
                        }
                        placeholder="Ingredient name"
                      />
                      <button
                        className={recipeStyles.removeBtn}
                        onClick={() => removeIngredient(ing.id)}
                        type="button"
                        aria-label="Remove"
                      >
                        <IoClose size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className={recipeStyles.box}>
                  <div className={recipeStyles.boxHeader}>
                    <div className={recipeStyles.boxTitle}>Instructions</div>
                    <button
                      className={recipeStyles.circleBtn}
                      onClick={addInstruction}
                      type="button"
                    >
                      <IoAdd size={18} />
                    </button>
                  </div>

                  {form.instructions.map((inst, idx) => (
                    <div key={inst.id} className={recipeStyles.stepRow}>
                      <div className={recipeStyles.stepNum}>{idx + 1}</div>
                      <textarea
                        className={recipeStyles.textarea}
                        value={inst.step}
                        onChange={(e) =>
                          updateInstruction(inst.id, e.target.value)
                        }
                        placeholder="Describe this step..."
                        rows={3}
                      />
                      <button
                        className={recipeStyles.removeBtn}
                        onClick={() => removeInstruction(inst.id)}
                        type="button"
                        aria-label="Remove"
                      >
                        <IoClose size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className={recipeStyles.primaryBtn}
                onClick={handleSave}
                type="button"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select-to-edit modal (reuse home modal wrapper) */}
      {selectRecipeModalVisible && (
        <div
          className={homeStyles.modalOverlay}
          role="dialog"
          aria-modal="true"
        >
          <div className={cx(homeStyles.modalCard, recipeStyles.modalNarrow)}>
            <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
              <h3 className={homeStyles.modalTitle}>Selecteer recept</h3>
              <button
                className={homeStyles.iconButton}
                onClick={() => setSelectRecipeModalVisible(false)}
                type="button"
                aria-label="Close"
              >
                <IoClose size={22} />
              </button>
            </div>

            <div className={recipeStyles.selectList}>
              {recipes.map((r) => (
                <button
                  key={r.id}
                  className={recipeStyles.selectItem}
                  onClick={() => handleEditRecipe(r)}
                  type="button"
                >
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={recipeStyles.selectImg}
                      src={r.image}
                      alt={r.title}
                    />
                  ) : (
                    <div className={recipeStyles.selectImgPlaceholder}>
                      <IoImageOutline size={18} color="#97969b" />
                    </div>
                  )}

                  <div className={recipeStyles.selectMain}>
                    <div className={recipeStyles.selectTitle}>{r.title}</div>
                    <div className={recipeStyles.selectMeta}>{r.kcal} kcal</div>
                  </div>

                  <IoChevronForward size={18} color="#97969b" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
