"use client";

import React, { useEffect, useRef } from "react";
import styles from "./BottomNav.module.css";
import { HiHome } from "react-icons/hi2";
import { ImSpoonKnife } from "react-icons/im";
import { IoPersonCircleSharp, IoBookSharp } from "react-icons/io5";
import { IoBarbellSharp } from "react-icons/io5"; // <-- add

export default function BottomNav({
  value = "home",
  onChange,
  className = "",
}) {
  const navRef = useRef(null);
  const previousOptionRef = useRef("1");

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const checked = el.querySelector('input[type="radio"]:checked');
    if (checked) {
      const opt = checked.getAttribute("c-option") || "1";
      el.setAttribute("c-previous", previousOptionRef.current);
      previousOptionRef.current = opt;
    }
  }, [value]);

  const handleNavChange = (e) => {
    const nextValue = e.target.value;
    onChange?.(nextValue);
  };

  return (
    <fieldset
      ref={navRef}
      className={`${styles.switcher} ${className}`}
      aria-label="Bottom nav"
    >
      <legend className={styles["switcher__legend"]}>Navigate</legend>

      <label className={styles["switcher__option"]}>
        <input
          className={styles["switcher__input"]}
          type="radio"
          name="nav"
          value="home"
          c-option="1"
          checked={value === "home"}
          onChange={handleNavChange}
        />
        <span className={styles["switcher__content"]}>
          <HiHome className={styles["switcher__icon"]} aria-hidden="true" />
          <span className={styles["switcher__text"]}>Home</span>
        </span>
      </label>

      <label className={styles["switcher__option"]}>
        <input
          className={styles["switcher__input"]}
          type="radio"
          name="nav"
          value="food"
          c-option="2"
          checked={value === "food"}
          onChange={handleNavChange}
        />
        <span className={styles["switcher__content"]}>
          <ImSpoonKnife
            className={styles["switcher__icon"]}
            aria-hidden="true"
          />
          <span className={styles["switcher__text"]}>Food</span>
        </span>
      </label>

      <label className={styles["switcher__option"]}>
        <input
          className={styles["switcher__input"]}
          type="radio"
          name="nav"
          value="recepten"
          c-option="3"
          checked={value === "recepten"}
          onChange={handleNavChange}
        />
        <span className={styles["switcher__content"]}>
          <IoBookSharp
            className={styles["switcher__icon"]}
            aria-hidden="true"
          />
          <span className={styles["switcher__text"]}>Recepten</span>
        </span>
      </label>

      <label className={styles["switcher__option"]}>
        <input
          className={styles["switcher__input"]}
          type="radio"
          name="nav"
          value="gym"
          c-option="4"
          checked={value === "gym"}
          onChange={handleNavChange}
        />
        <span className={styles["switcher__content"]}>
          <IoBarbellSharp
            className={styles["switcher__icon"]}
            aria-hidden="true"
          />
          <span className={styles["switcher__text"]}>Gym</span>
        </span>
      </label>

      <div className={styles["switcher__filter"]} aria-hidden="true">
        <svg>
          <filter id="switcher" primitiveUnits="objectBoundingBox">
            {/* keep your original filter content here if you had it */}
          </filter>
        </svg>
      </div>
    </fieldset>
  );
}
