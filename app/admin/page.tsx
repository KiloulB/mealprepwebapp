"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import styles from "./admin.module.css";

import {
  IoGridOutline,
  IoPeopleOutline,
  IoFitnessOutline,
  IoRestaurantOutline,
  IoAddOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoSearchOutline,
  IoClose,
  IoLogOutOutline,
  IoDownloadOutline,
} from "react-icons/io5";

import {
  subscribeToUserRegistry,
  subscribeToGlobalExercises,
  subscribeToGlobalRecipes,
  createGlobalExercise,
  updateGlobalExercise,
  deleteGlobalExercise,
  createGlobalRecipe,
  updateGlobalRecipe,
  deleteGlobalRecipe,
  deleteUserFirestoreData,
  seedBuiltinRecipes,
  type UserRegistryEntry,
  type GlobalExercise,
  type GlobalRecipe,
} from "../firebase/adminService";

import { builtinRecipes } from "../data/builtinRecipes";

// Optional: set NEXT_PUBLIC_ADMIN_UID in .env.local to restrict access
const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID ?? "";

type Tab = "overview" | "users" | "exercises" | "recipes";

type ExerciseForm = {
  name: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  equipment: string;
  category: string;
  description: string;
};

type RecipeForm = {
  title: string;
  category: string;
  portions: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  ingredients: string;
  steps: string;
};

const EMPTY_EX_FORM: ExerciseForm = {
  name: "", primaryMuscles: "", secondaryMuscles: "",
  equipment: "", category: "", description: "",
};

const EMPTY_REC_FORM: RecipeForm = {
  title: "", category: "", portions: "4",
  kcal: "", protein: "", carbs: "", fat: "",
  ingredients: "", steps: "",
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AdminPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  // Data
  const [users, setUsers] = useState<UserRegistryEntry[]>([]);
  const [exercises, setExercises] = useState<GlobalExercise[]>([]);
  const [recipes, setRecipes] = useState<GlobalRecipe[]>([]);

  // Search
  const [userSearch, setUserSearch] = useState("");
  const [exSearch, setExSearch] = useState("");
  const [recSearch, setRecSearch] = useState("");

  // Exercise modal
  const [exModal, setExModal] = useState<{ mode: "add" | "edit"; item?: GlobalExercise } | null>(null);
  const [exForm, setExForm] = useState<ExerciseForm>(EMPTY_EX_FORM);
  const [exBusy, setExBusy] = useState(false);

  // Recipe modal
  const [recModal, setRecModal] = useState<{ mode: "add" | "edit"; item?: GlobalRecipe } | null>(null);
  const [recForm, setRecForm] = useState<RecipeForm>(EMPTY_REC_FORM);
  const [recBusy, setRecBusy] = useState(false);

  // Confirm delete / action
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "exercise" | "recipe" | "user";
    id: string;
    name: string;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Seed state
  const [seeding, setSeeding] = useState(false);

  // Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthLoading(false);
    });
  }, []);

  // Firestore subscriptions
  useEffect(() => {
    if (!authUser) return;
    const unsubs = [
      subscribeToUserRegistry(setUsers),
      subscribeToGlobalExercises(setExercises),
      subscribeToGlobalRecipes(setRecipes),
    ];
    return () => unsubs.forEach((u) => u());
  }, [authUser]);

  // â”€â”€ Exercise modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openExModal = useCallback((mode: "add" | "edit", item?: GlobalExercise) => {
    setExForm(
      mode === "edit" && item
        ? {
            name: item.name,
            primaryMuscles: (item.primaryMuscles ?? []).join(", "),
            secondaryMuscles: (item.secondaryMuscles ?? []).join(", "),
            equipment: (item.equipment ?? []).join(", "),
            category: item.category ?? "",
            description: item.description ?? "",
          }
        : EMPTY_EX_FORM
    );
    setExModal({ mode, item });
  }, []);

  const handleExSave = async () => {
    if (!exForm.name.trim() || exBusy) return;
    setExBusy(true);
    try {
      const payload = {
        name: exForm.name.trim(),
        primaryMuscles: splitList(exForm.primaryMuscles),
        secondaryMuscles: splitList(exForm.secondaryMuscles),
        equipment: splitList(exForm.equipment),
        category: exForm.category.trim(),
        description: exForm.description.trim(),
      };
      if (exModal?.mode === "edit" && exModal.item) {
        await updateGlobalExercise(exModal.item.id, payload);
      } else {
        await createGlobalExercise(payload);
      }
      setExModal(null);
    } finally {
      setExBusy(false);
    }
  };

  // â”€â”€ Recipe modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openRecModal = useCallback((mode: "add" | "edit", item?: GlobalRecipe) => {
    setRecForm(
      mode === "edit" && item
        ? {
            title: item.title,
            category: item.category ?? "",
            portions: String(item.portions ?? 4),
            kcal: String(item.kcal),
            protein: String(item.protein),
            carbs: String(item.carbs),
            fat: String(item.fat),
            ingredients: (item.ingredients ?? []).map((i) => `${i.name}: ${i.amount}`).join("\n"),
            steps: (item.steps ?? []).join("\n"),
          }
        : EMPTY_REC_FORM
    );
    setRecModal({ mode, item });
  }, []);

  const handleRecSave = async () => {
    if (!recForm.title.trim() || recBusy) return;
    setRecBusy(true);
    try {
      const payload = {
        title: recForm.title.trim(),
        category: recForm.category.trim(),
        portions: parseInt(recForm.portions) || 4,
        kcal: parseInt(recForm.kcal) || 0,
        protein: parseInt(recForm.protein) || 0,
        carbs: parseInt(recForm.carbs) || 0,
        fat: parseInt(recForm.fat) || 0,
        ingredients: recForm.ingredients
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const colonIdx = line.indexOf(":");
            if (colonIdx === -1) return { name: line.trim(), amount: "" };
            return {
              name: line.slice(0, colonIdx).trim(),
              amount: line.slice(colonIdx + 1).trim(),
            };
          }),
        steps: recForm.steps.split("\n").filter(Boolean),
      };
      if (recModal?.mode === "edit" && recModal.item) {
        await updateGlobalRecipe(recModal.item.id, payload);
      } else {
        await createGlobalRecipe(payload);
      }
      setRecModal(null);
    } finally {
      setRecBusy(false);
    }
  };

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleConfirmDelete = async () => {
    if (!confirmDelete || deleteBusy) return;
    setDeleteBusy(true);
    try {
      if (confirmDelete.type === "exercise") await deleteGlobalExercise(confirmDelete.id);
      if (confirmDelete.type === "recipe") await deleteGlobalRecipe(confirmDelete.id);
      if (confirmDelete.type === "user") await deleteUserFirestoreData(confirmDelete.id);
      setConfirmDelete(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  // â”€â”€ Seed built-in recipes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      await seedBuiltinRecipes(
        builtinRecipes.map(({ id: _id, ...rest }) => rest as Parameters<typeof seedBuiltinRecipes>[0][number])
      );
    } finally {
      setSeeding(false);
    }
  };

  // â”€â”€ Filtered lists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const filteredUsers = users.filter(
    (u) =>
      (u.username ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.uid ?? "").includes(userSearch)
  );

  const filteredExercises = exercises.filter(
    (e) =>
      (e.name ?? "").toLowerCase().includes(exSearch.toLowerCase()) ||
      (e.primaryMuscles ?? []).some((m) => m.toLowerCase().includes(exSearch.toLowerCase())) ||
      (e.category ?? "").toLowerCase().includes(exSearch.toLowerCase())
  );

  const filteredRecipes = recipes.filter(
    (r) =>
      (r.title ?? "").toLowerCase().includes(recSearch.toLowerCase()) ||
      (r.category ?? "").toLowerCase().includes(recSearch.toLowerCase())
  );

  // â”€â”€ Auth guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (authLoading) {
    return <div className={styles.loading}>Ladenâ€¦</div>;
  }

  if (!authUser) {
    return (
      <div className={styles.denied}>
        <span>Niet ingelogd.</span>
        <a href="/auth">Ga naar inlogpagina</a>
      </div>
    );
  }

  if (ADMIN_UID && authUser.uid !== ADMIN_UID) {
    return <div className={styles.denied}>Geen toegang tot het admin dashboard.</div>;
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const navItems: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: "overview", icon: <IoGridOutline />, label: "Overzicht" },
    { key: "users", icon: <IoPeopleOutline />, label: "Gebruikers" },
    { key: "exercises", icon: <IoFitnessOutline />, label: "Oefeningen" },
    { key: "recipes", icon: <IoRestaurantOutline />, label: "Recepten" },
  ];

  return (
    <div className={styles.page}>
      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.sidebarLogoIcon}>âš™ï¸</span>
          <span className={styles.sidebarLogoText}>Peak Admin</span>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map(({ key, icon, label }) => (
            <button
              key={key}
              className={`${styles.navItem} ${tab === key ? styles.navItemActive : ""}`}
              onClick={() => setTab(key)}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser}>
            <span className={styles.sidebarUserEmail}>
              {authUser.email?.replace("@mealprep.local", "") ?? authUser.uid}
            </span>
          </div>
          <button className={styles.logoutBtn} onClick={() => signOut(auth)}>
            <IoLogOutOutline size={15} /> Uitloggen
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main â”€â”€ */}
      <main className={styles.main}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className={styles.section}>
            <h1 className={styles.sectionTitle}>Overzicht</h1>

            <div className={styles.statsGrid}>
              <StatCard label="Gebruikers" value={users.length} icon={<IoPeopleOutline />} color="#FC9158" />
              <StatCard label="Oefeningen" value={exercises.length} icon={<IoFitnessOutline />} color="#72A82C" />
              <StatCard label="Recepten" value={recipes.length} icon={<IoRestaurantOutline />} color="#2A9DB5" />
            </div>

            {users.length > 0 && (
              <>
                <h2 className={styles.subTitle}>Recente aanmeldingen</h2>
                <div className={styles.card}>
                  {users.slice(0, 8).map((u) => (
                    <div key={u.uid} className={styles.listRow}>
                      <div>
                        <div className={styles.listRowName}>{u.username || "â€“"}</div>
                        <div className={styles.listRowMeta}>{u.uid}</div>
                      </div>
                      <div className={styles.listRowDate}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("nl-NL") : "â€“"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* USERS */}
        {tab === "users" && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.sectionTitle}>Gebruikers ({users.length})</h1>
            </div>

            <div className={styles.searchBar}>
              <IoSearchOutline className={styles.searchIcon} size={16} />
              <input
                className={styles.searchInput}
                placeholder="Zoek op gebruikersnaam of UIDâ€¦"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className={styles.card}>
              {filteredUsers.length === 0 && (
                <div className={styles.empty}>
                  {users.length === 0
                    ? "Nog geen gebruikers in de registry. Ze worden automatisch toegevoegd bij registratie."
                    : "Geen gebruikers gevonden voor deze zoekopdracht."}
                </div>
              )}
              {filteredUsers.map((u) => (
                <div key={u.uid} className={styles.listRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.listRowName}>
                      {u.username || "â€“"}
                      {u.isAdmin && <span className={styles.badge} style={{ marginLeft: 8 }}>admin</span>}
                    </div>
                    <div className={styles.listRowMeta}>{u.uid}</div>
                    <div className={styles.listRowMeta}>
                      Aangemeld: {u.createdAt ? new Date(u.createdAt).toLocaleDateString("nl-NL") : "onbekend"}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.deleteRowBtn}
                      onClick={() =>
                        setConfirmDelete({ type: "user", id: u.uid, name: u.username || u.uid })
                      }
                      aria-label="Verwijder gebruikersdata"
                    >
                      <IoTrashOutline size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXERCISES */}
        {tab === "exercises" && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.sectionTitle}>Oefeningen ({exercises.length})</h1>
              <button className={styles.primaryBtn} onClick={() => openExModal("add")}>
                <IoAddOutline size={16} /> Toevoegen
              </button>
            </div>

            <div className={styles.searchBar}>
              <IoSearchOutline className={styles.searchIcon} size={16} />
              <input
                className={styles.searchInput}
                placeholder="Zoek op naam, spiergroep of categorieâ€¦"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
              />
            </div>

            <div className={styles.card}>
              {filteredExercises.length === 0 && (
                <div className={styles.empty}>
                  {exercises.length === 0
                    ? "Nog geen oefeningen. Voeg er een toe of importeer uit de globale bibliotheek."
                    : "Geen oefeningen gevonden."}
                </div>
              )}
              {filteredExercises.map((ex) => (
                <div key={ex.id} className={styles.listRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.listRowName}>{ex.name}</div>
                    <div className={styles.listRowMeta}>
                      {[...(ex.primaryMuscles ?? []), ...(ex.secondaryMuscles ?? [])]
                        .slice(0, 5)
                        .join(", ") || "â€“"}
                    </div>
                    {(ex.equipment ?? []).length > 0 && (
                      <div className={styles.listRowMeta}>
                        {(ex.equipment ?? []).join(", ")}
                        {ex.category ? ` Â· ${ex.category}` : ""}
                      </div>
                    )}
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.editRowBtn}
                      onClick={() => openExModal("edit", ex)}
                      aria-label="Bewerken"
                    >
                      <IoPencilOutline size={15} />
                    </button>
                    <button
                      className={styles.deleteRowBtn}
                      onClick={() =>
                        setConfirmDelete({ type: "exercise", id: ex.id, name: ex.name })
                      }
                      aria-label="Verwijderen"
                    >
                      <IoTrashOutline size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECIPES */}
        {tab === "recipes" && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.sectionTitle}>Recepten ({recipes.length})</h1>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={styles.secondaryBtn}
                  onClick={handleSeed}
                  disabled={seeding}
                  title="Importeer alle ingebouwde recepten naar Firestore"
                >
                  <IoDownloadOutline size={15} />
                  {seeding ? "Importerenâ€¦" : "Import ingebouwd"}
                </button>
                <button className={styles.primaryBtn} onClick={() => openRecModal("add")}>
                  <IoAddOutline size={16} /> Toevoegen
                </button>
              </div>
            </div>

            <div className={styles.searchBar}>
              <IoSearchOutline className={styles.searchIcon} size={16} />
              <input
                className={styles.searchInput}
                placeholder="Zoek op naam of categorieâ€¦"
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
              />
            </div>

            <div className={styles.card}>
              {filteredRecipes.length === 0 && (
                <div className={styles.empty}>
                  {recipes.length === 0
                    ? 'Nog geen recepten. Klik "Import ingebouwd" om de standaardrecepten te laden.'
                    : "Geen recepten gevonden."}
                </div>
              )}
              {filteredRecipes.map((r) => (
                <div key={r.id} className={styles.listRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.listRowName}>{r.title}</div>
                    <div className={styles.listRowMeta}>
                      {r.category ? `${r.category} Â· ` : ""}{r.portions} porties
                    </div>
                    <div className={styles.listRowMeta}>
                      {r.kcal} kcal Â· {r.protein}g eiwit Â· {r.carbs}g koolh. Â· {r.fat}g vet
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.editRowBtn}
                      onClick={() => openRecModal("edit", r)}
                      aria-label="Bewerken"
                    >
                      <IoPencilOutline size={15} />
                    </button>
                    <button
                      className={styles.deleteRowBtn}
                      onClick={() =>
                        setConfirmDelete({ type: "recipe", id: r.id, name: r.title })
                      }
                      aria-label="Verwijderen"
                    >
                      <IoTrashOutline size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* â”€â”€ Exercise modal â”€â”€ */}
      {exModal && (
        <div className={styles.modalOverlay} onClick={() => setExModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {exModal.mode === "add" ? "Oefening toevoegen" : "Oefening bewerken"}
              </h2>
              <button className={styles.modalCloseBtn} onClick={() => setExModal(null)}>
                <IoClose size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Naam *</label>
                <input
                  className={styles.formInput}
                  value={exForm.name}
                  onChange={(e) => setExForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Bijv. Bench Press"
                  autoFocus
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Primaire spieren (kommagescheiden)</label>
                  <input
                    className={styles.formInput}
                    value={exForm.primaryMuscles}
                    onChange={(e) => setExForm((f) => ({ ...f, primaryMuscles: e.target.value }))}
                    placeholder="chest, shoulders"
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Secundaire spieren</label>
                  <input
                    className={styles.formInput}
                    value={exForm.secondaryMuscles}
                    onChange={(e) => setExForm((f) => ({ ...f, secondaryMuscles: e.target.value }))}
                    placeholder="triceps"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Benodigdheden</label>
                  <input
                    className={styles.formInput}
                    value={exForm.equipment}
                    onChange={(e) => setExForm((f) => ({ ...f, equipment: e.target.value }))}
                    placeholder="barbell, bench"
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Categorie</label>
                  <input
                    className={styles.formInput}
                    value={exForm.category}
                    onChange={(e) => setExForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="strength"
                  />
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Beschrijving</label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  value={exForm.description}
                  onChange={(e) => setExForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optionele uitleg of instructiesâ€¦"
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setExModal(null)}>
                Annuleren
              </button>
              <button
                className={styles.saveBtn}
                disabled={!exForm.name.trim() || exBusy}
                onClick={handleExSave}
              >
                {exBusy ? "Opslaanâ€¦" : "Opslaan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Recipe modal â”€â”€ */}
      {recModal && (
        <div className={styles.modalOverlay} onClick={() => setRecModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {recModal.mode === "add" ? "Recept toevoegen" : "Recept bewerken"}
              </h2>
              <button className={styles.modalCloseBtn} onClick={() => setRecModal(null)}>
                <IoClose size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formField} style={{ flex: 2 }}>
                  <label className={styles.formLabel}>Naam *</label>
                  <input
                    className={styles.formInput}
                    value={recForm.title}
                    onChange={(e) => setRecForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Bijv. Pasta Bolognese"
                    autoFocus
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Categorie</label>
                  <input
                    className={styles.formInput}
                    value={recForm.category}
                    onChange={(e) => setRecForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="pasta"
                  />
                </div>
                <div className={styles.formField} style={{ flex: "0 0 80px" }}>
                  <label className={styles.formLabel}>Porties</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={recForm.portions}
                    onChange={(e) => setRecForm((f) => ({ ...f, portions: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
                  <div key={key} className={styles.formField}>
                    <label className={styles.formLabel}>
                      {key === "kcal" ? "Kcal" : key === "protein" ? "Eiwit (g)" : key === "carbs" ? "Koolh. (g)" : "Vet (g)"}
                    </label>
                    <input
                      className={styles.formInput}
                      type="number"
                      value={recForm[key]}
                      onChange={(e) => setRecForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>
                  IngrediÃ«nten (Ã©Ã©n per regel â€” formaat: Naam: hoeveelheid)
                </label>
                <textarea
                  className={styles.formTextarea}
                  rows={7}
                  value={recForm.ingredients}
                  onChange={(e) => setRecForm((f) => ({ ...f, ingredients: e.target.value }))}
                  placeholder={"Gehakt: 500g\nPasta: 400g\nTomatensaus: 500ml"}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Bereiding (Ã©Ã©n stap per regel)</label>
                <textarea
                  className={styles.formTextarea}
                  rows={6}
                  value={recForm.steps}
                  onChange={(e) => setRecForm((f) => ({ ...f, steps: e.target.value }))}
                  placeholder={"Kook de pasta gaar.\nBak de ui en knoflook glazig.\nVoeg gehakt toeâ€¦"}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setRecModal(null)}>
                Annuleren
              </button>
              <button
                className={styles.saveBtn}
                disabled={!recForm.title.trim() || recBusy}
                onClick={handleRecSave}
              >
                {recBusy ? "Opslaanâ€¦" : "Opslaan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Confirm delete â”€â”€ */}
      {confirmDelete && (
        <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Verwijderen?</h3>
            <p className={styles.confirmText}>
              Weet je zeker dat je <strong>{confirmDelete.name}</strong> wil verwijderen?
              {confirmDelete.type === "user" && (
                <> Dit verwijdert alle Firestore-data van deze gebruiker. Het Firebase Auth-account blijft bestaan.</>
              )}
              {" "}Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>
                Annuleren
              </button>
              <button
                className={styles.dangerBtn}
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
              >
                {deleteBusy ? "Verwijderenâ€¦" : "Verwijderen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: `${color}1a`, color }}>
        {icon}
      </div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
