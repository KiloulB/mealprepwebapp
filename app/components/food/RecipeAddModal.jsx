"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft } from "react-icons/fi";
import { FaRegTrashAlt } from "react-icons/fa";
import { IoAdd, IoCamera, IoClose } from "react-icons/io5";
import { saveRecipe, updateRecipe } from "../../firebase/dataService";
import styles from "./RecipeAddModal.module.css";

const SECTION_OPTIONS = [
  { id: "macros",       emoji: "📊", label: "Macrowaarden" },
  { id: "portions",     emoji: "🍽️", label: "Porties" },
  { id: "ingredients",  emoji: "📝", label: "Ingrediënten" },
  { id: "steps",        emoji: "👨‍🍳", label: "Stappen" },
];

const MACRO_FIELDS = [
  { key: "kcal",    label: "Kcal",   unit: "kcal", color: "var(--accent)" },
  { key: "protein", label: "Eiwit",  unit: "g",    color: "#C13232" },
  { key: "fat",     label: "Vet",    unit: "g",    color: "#72A82C" },
  { key: "carbs",   label: "Koolh.", unit: "g",    color: "#2A9DB5" },
];

function emptyForm() {
  return {
    title: "",
    imagePreview: "",
    kcal: "", protein: "", fat: "", carbs: "",
    portions: "",
    ingredients: [{ name: "", amount: "" }],
    steps: [""],
  };
}

function recipeToForm(recipe) {
  return {
    title: recipe.title || "",
    imagePreview: recipe.image || "",
    kcal: recipe.kcal != null ? String(recipe.kcal) : "",
    protein: recipe.protein != null ? String(recipe.protein) : "",
    fat: recipe.fat != null ? String(recipe.fat) : "",
    carbs: recipe.carbs != null ? String(recipe.carbs) : "",
    portions: recipe.portions != null ? String(recipe.portions) : "",
    ingredients: recipe.ingredients?.length ? recipe.ingredients : [{ name: "", amount: "" }],
    steps: recipe.steps?.length ? recipe.steps : [""],
  };
}

function initialSections(recipe) {
  const s = [];
  if (recipe.kcal || recipe.protein || recipe.fat || recipe.carbs) s.push("macros");
  if (recipe.portions) s.push("portions");
  if (recipe.ingredients?.length) s.push("ingredients");
  if (recipe.steps?.length) s.push("steps");
  return s.length > 0 ? s : ["macros"];
}

// Compress image via canvas to keep Firestore doc under limit (~60KB target)
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 480;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function RecipeAddModal({ authUser, onClose, initialRecipe, recipeId }) {
  const isEdit = !!initialRecipe;
  const [step, setStep]         = useState(1);
  const [form, setForm]         = useState(() => isEdit ? recipeToForm(initialRecipe) : emptyForm());
  const [sections, setSections] = useState(() => isEdit ? initialSections(initialRecipe) : ["macros"]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const imageInputRef           = useRef(null);

  /* â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const toggleSection = (id) =>
    setSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setForm((f) => ({ ...f, imagePreview: compressed }));
  };

  const clearImage = (e) => {
    e.stopPropagation();
    setForm((f) => ({ ...f, imagePreview: "" }));
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const updateIngredient = (idx, field, val) =>
    setForm((f) => {
      const ing = [...f.ingredients];
      ing[idx] = { ...ing[idx], [field]: val };
      return { ...f, ingredients: ing };
    });

  const addIngredient = () =>
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: "", amount: "" }] }));

  const removeIngredient = (idx) =>
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.length > 1
        ? f.ingredients.filter((_, i) => i !== idx)
        : [{ name: "", amount: "" }],
    }));

  const updateStep = (idx, val) =>
    setForm((f) => {
      const s = [...f.steps];
      s[idx] = val;
      return { ...f, steps: s };
    });

  const addStep = () =>
    setForm((f) => ({ ...f, steps: [...f.steps, ""] }));

  const removeStep = (idx) =>
    setForm((f) => ({
      ...f,
      steps: f.steps.length > 1 ? f.steps.filter((_, i) => i !== idx) : [""],
    }));

  /* â”€â”€ save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const handleSave = async () => {
    if (!authUser || !form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        title:   form.title.trim(),
        image:   form.imagePreview || undefined,
        kcal:    sections.includes("macros") ? (parseFloat(form.kcal)    || 0) : 0,
        protein: sections.includes("macros") ? (parseFloat(form.protein) || 0) : 0,
        fat:     sections.includes("macros") ? (parseFloat(form.fat)     || 0) : 0,
        carbs:   sections.includes("macros") ? (parseFloat(form.carbs)   || 0) : 0,
        portions: sections.includes("portions") && form.portions
          ? (parseInt(form.portions, 10) || undefined)
          : undefined,
        ingredients: sections.includes("ingredients")
          ? form.ingredients.filter((i) => i.name.trim())
          : [],
        steps: sections.includes("steps")
          ? form.steps.filter((s) => s.trim())
          : [],
      };
      if (isEdit && recipeId) {
        await updateRecipe(authUser.uid, recipeId, payload);
      } else {
        await saveRecipe(authUser.uid, payload);
      }
      onClose();
    } catch {
      setError("Opslaan mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  const canNext = form.title.trim().length > 0;
  const canSave = canNext && !saving;

  /* â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  return createPortal(
    <div className={styles.overlay}>
      {/* â”€â”€ Top bar â”€â”€ */}
      <div className={styles.topBar}>
        {step === 1 ? (
          <button className={styles.cancelBtn} onClick={onClose}>
            Annuleren
          </button>
        ) : (
          <button className={styles.backBtn} onClick={() => setStep(1)}>
            <FiChevronLeft size={16} style={{ verticalAlign: "middle" }} /> Terug
          </button>
        )}

        <span className={styles.topTitle}>
          {step === 1 ? (isEdit ? "Recept bewerken" : "Nieuw recept") : "Velden invullen"}
        </span>

        {step === 1 ? (
          <button className={styles.nextBtn} disabled={!canNext} onClick={() => setStep(2)}>
            Volgende →
          </button>
        ) : (
          <button className={styles.saveBtn} disabled={!canSave} onClick={handleSave}>
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        )}
      </div>

      {/* â”€â”€ Step dots â”€â”€ */}
      <div className={styles.stepDots}>
        <div className={`${styles.dot} ${step === 1 ? styles.dotActive : ""}`} />
        <div className={`${styles.dot} ${step === 2 ? styles.dotActive : ""}`} />
      </div>

      {/* â”€â”€ Body â”€â”€ */}
      <div className={styles.body}>

        {/* â•â•â•â• STEP 1 â•â•â•â• */}
        {step === 1 && (
          <>
            {/* Photo picker */}
            <div
              className={styles.photoPicker}
              onClick={() => imageInputRef.current?.click()}
            >
              {form.imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imagePreview}
                    alt="preview"
                    className={styles.photoPreview}
                  />
                  <button className={styles.photoClearBtn} onClick={clearImage}>
                    <IoClose size={16} />
                  </button>
                </>
              ) : (
                <div className={styles.photoPlaceholder}>
                  <IoCamera size={26} color="var(--text-muted)" />
                  <span className={styles.photoPlaceholderText}>Foto toevoegen</span>
                  <span className={styles.photoPlaceholderHint}>Optioneel</span>
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageChange}
              />
            </div>

            {/* Title */}
            <input
              className={styles.nameInput}
              placeholder="Naam recept (bijv. Pasta Bolognese)"
              value={form.title}
              onChange={setField("title")}
              autoFocus
            />

            <div className={styles.sectionLabel}>Wat wil je invullen?</div>
            <p className={styles.sectionHint}>
              Kies de velden die relevant zijn. Alles is optioneel.
            </p>

            <div className={styles.chipGrid}>
              {SECTION_OPTIONS.map((opt) => {
                const active = sections.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    onClick={() => toggleSection(opt.id)}
                  >
                    <span className={styles.chipEmoji}>{opt.emoji}</span>
                    <span className={styles.chipLabel}>{opt.label}</span>
                    {active && <span className={styles.chipCheck}>âœ“</span>}
                  </button>
                );
              })}
            </div>

            {sections.length === 0 && (
              <p className={styles.noFieldsHint}>
                Je kunt ook opslaan met alleen een naam.
              </p>
            )}
          </>
        )}

        {/* â•â•â•â• STEP 2 â•â•â•â• */}
        {step === 2 && (
          <>
            {/* Name + optional photo thumb */}
            <div className={styles.step2Header}>
              {form.imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imagePreview}
                  alt=""
                  className={styles.step2Thumb}
                />
              )}
              <span className={styles.recipeNameBadge}>{form.title}</span>
            </div>

            {/* â”€â”€ Macrowaarden â”€â”€ */}
            {sections.includes("macros") && (
              <div className={styles.section}>
                <div className={styles.sectionRow}>
                  <span className={styles.sectionTitle}>Macrowaarden</span>
                  <span className={styles.perPortie}>per portie</span>
                </div>
                <div className={styles.macroGrid}>
                  {MACRO_FIELDS.map(({ key, label, unit, color }) => (
                    <div key={key} className={styles.macroCell}>
                      <span className={styles.macroCellLabel} style={{ color }}>
                        {label}
                      </span>
                      <div className={styles.macroCellInput}>
                        <input
                          className={styles.macroInput}
                          value={form[key]}
                          onChange={setField(key)}
                          inputMode="decimal"
                          placeholder="0"
                        />
                        <span className={styles.macroUnit}>{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* â”€â”€ Porties â”€â”€ */}
            {sections.includes("portions") && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Porties</span>
                <span className={styles.fieldHint}>
                  Hoeveel porties maakt dit recept?
                </span>
                <div className={styles.fieldInputRow}>
                  <input
                    className={styles.fieldInput}
                    value={form.portions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        portions: e.target.value.replace(/[^\d]/g, ""),
                      }))
                    }
                    inputMode="numeric"
                    placeholder="4"
                  />
                  <span className={styles.fieldUnit}>porties</span>
                </div>
              </div>
            )}

            {/* â”€â”€ Ingrediënten â”€â”€ */}
            {sections.includes("ingredients") && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Ingrediënten</span>
                {form.ingredients.map((ing, idx) => (
                  <div key={idx} className={styles.listRow}>
                    <input
                      className={styles.listInputMain}
                      placeholder="Naam"
                      value={ing.name}
                      onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                    />
                    <input
                      className={styles.listInputSub}
                      placeholder="500 g"
                      value={ing.amount}
                      onChange={(e) => updateIngredient(idx, "amount", e.target.value)}
                    />
                    <button className={styles.removeBtn} onClick={() => removeIngredient(idx)}>
                      <FaRegTrashAlt size={13} />
                    </button>
                  </div>
                ))}
                <button className={styles.addRowBtn} onClick={addIngredient}>
                  <IoAdd size={15} /> Ingrediënt toevoegen
                </button>
              </div>
            )}

            {/* â”€â”€ Stappen â”€â”€ */}
            {sections.includes("steps") && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Bereidingsstappen</span>
                {form.steps.map((s, idx) => (
                  <div key={idx} className={styles.listRow}>
                    <div className={styles.stepNum}>{idx + 1}</div>
                    <input
                      className={styles.listInputFull}
                      placeholder={`Stap ${idx + 1}…`}
                      value={s}
                      onChange={(e) => updateStep(idx, e.target.value)}
                    />
                    <button className={styles.removeBtn} onClick={() => removeStep(idx)}>
                      <FaRegTrashAlt size={13} />
                    </button>
                  </div>
                ))}
                <button className={styles.addRowBtn} onClick={addStep}>
                  <IoAdd size={15} /> Stap toevoegen
                </button>
              </div>
            )}

            {sections.length === 0 && (
              <p className={styles.noFieldsHint}>
                Geen velden geselecteerd — er wordt alleen een naam opgeslagen.
              </p>
            )}

            {error && <div className={styles.errorMsg}>{error}</div>}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
