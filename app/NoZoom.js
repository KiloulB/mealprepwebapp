"use client";
import { useEffect } from "react";

export default function NoZoom() {
  useEffect(() => {
    const onTouchMove = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };

    const onGesture = (e) => e.preventDefault();

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("gesturestart", onGesture, { passive: false });
    document.addEventListener("gesturechange", onGesture, { passive: false });
    document.addEventListener("gestureend", onGesture, { passive: false });

    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("gestureend", onGesture);
    };
  }, []);

  return null;
}
