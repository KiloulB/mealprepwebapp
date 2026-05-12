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

// Preload all screen chunks immediately so tab switches are instant
if (typeof window !== "undefined") {
  void import("./screens/GymScreen");
  void import("./screens/FoodScreen");
  void import("./screens/ProfileScreen");
  void import("./screens/MealPrepScreen");
}

import BottomNav from "./components/BottomNav/BottomNav";
import styles from "./home.module.css";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  const activeTab = searchParams.get("tab") || "gym";
  const { authUser, loading, mealPrepEnabled } = useUser();
  useFont();

  const ANIM_MS = 80;
  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (activeTab === displayedTab) return;
    setIsExiting(true);
    const t = setTimeout(() => {
      setDisplayedTab(activeTab);
      setIsExiting(false);
    }, ANIM_MS);
    return () => clearTimeout(t);
  }, [activeTab, displayedTab]);

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
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextValue);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className={styles.screen}>
      <div className={cx(styles.tabPage, isExiting && styles.tabPageExit)}>
        {displayedTab === "gym" ? (
          <GymScreen />
        ) : displayedTab === "food" ? (
          <FoodScreen />
        ) : displayedTab === "prep" ? (
          <MealPrepScreen />
        ) : (
          <ProfileScreen />
        )}
      </div>
      <BottomNav value={activeTab} onChange={handleTabChange} mealPrepEnabled={mealPrepEnabled} />
    </div>
  );
}
