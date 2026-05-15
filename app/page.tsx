"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "./context/UserContext";
import { useFont } from "./context/FontContext";
import { checkOnboardingComplete } from "./firebase/profileService";

import dynamicImport from "next/dynamic";
const GymScreen = dynamicImport(() => import("./screens/GymScreen"), { ssr: false });
const FoodScreen = dynamicImport(() => import("./screens/FoodScreen"), { ssr: false });
const ProfileScreen = dynamicImport(() => import("./screens/ProfileScreen"), { ssr: false });
const MealPrepScreen = dynamicImport(() => import("./screens/MealPrepScreen"), { ssr: false });

// Kick off all chunk downloads immediately — tabs are ready before the user taps them
if (typeof window !== "undefined") {
  void import("./screens/GymScreen");
  void import("./screens/FoodScreen");
  void import("./screens/ProfileScreen");
  void import("./screens/MealPrepScreen");
}

import BottomNav from "./components/BottomNav/BottomNav";
import styles from "./home.module.css";

export default function HomeScreenWrapper() {
  return (
    <Suspense>
      <HomeScreen />
    </Suspense>
  );
}

function HomeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authUser, loading, mealPrepEnabled } = useUser();
  useFont();

  const initialTab = searchParams.get("tab") || "gym";

  // Local state is the source of truth — no router round-trip on every tap
  const [activeTab, setActiveTab] = useState(initialTab);

  // Track which tabs have been visited so we keep them mounted (never re-render)
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set([initialTab]));

  useEffect(() => {
    if (loading) return;
    if (!authUser) {
      router.push("/auth");
      return;
    }
    checkOnboardingComplete(authUser.uid).then((done) => {
      if (!done) router.push("/onboarding");
    });
  }, [authUser, loading, router]);

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

  const handleTabChange = (nextValue: string) => {
    setActiveTab(nextValue);
    setMountedTabs(prev => new Set([...prev, nextValue]));
    // Update URL without triggering a Next.js navigation or re-render
    window.history.replaceState(null, "", `/?tab=${nextValue}`);
  };

  const hide = (tab: string): React.CSSProperties | undefined =>
    activeTab !== tab ? { display: "none" } : undefined;

  return (
    <div className={styles.screen}>
      {mountedTabs.has("gym") && (
        <div style={hide("gym")}><GymScreen /></div>
      )}
      {mountedTabs.has("food") && (
        <div style={hide("food")}><FoodScreen /></div>
      )}
      {mealPrepEnabled && mountedTabs.has("prep") && (
        <div style={hide("prep")}><MealPrepScreen /></div>
      )}
      {mountedTabs.has("profile") && (
        <div style={hide("profile")}><ProfileScreen /></div>
      )}
      <BottomNav value={activeTab} onChange={handleTabChange} mealPrepEnabled={mealPrepEnabled} />
    </div>
  );
}
