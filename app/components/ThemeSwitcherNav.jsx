"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./ThemeSwitcherNav.module.css";

import { HiHome } from "react-icons/hi2";
import { ImSpoonKnife } from "react-icons/im";
import { IoPersonCircleSharp } from "react-icons/io5";

export default function ThemeSwitcherNav({
  defaultValue = "light",
  onChange,
  className = "",
}) {
  const [theme, setTheme] = useState(defaultValue);

  const switcherRef = useRef(null);
  const previousOptionRef = useRef("1");

  useEffect(() => {
    const el = switcherRef.current;
    if (!el) return;

    const checked = el.querySelector('input[type="radio"]:checked');
    if (checked) {
      const opt = checked.getAttribute("c-option") || "1";
      previousOptionRef.current = opt;
      el.setAttribute("c-previous", opt);
    }
  }, []);

  const handleThemeChange = (e) => {
    const nextTheme = e.target.value;
    const nextOption = e.target.getAttribute("c-option") || "";

    if (switcherRef.current) {
      switcherRef.current.setAttribute("c-previous", previousOptionRef.current);
    }

    previousOptionRef.current = nextOption;
    setTheme(nextTheme);
    onChange?.(nextTheme);
  };

  return (
    <fieldset
      ref={switcherRef}
      className={`${styles.switcher} ${className}`}
      aria-label="Theme switcher"
    >
      <legend className={styles.switcher__legend}>Choose theme</legend>

      <label className={styles.switcher__option}>
        <input
          className={styles.switcher__input}
          type="radio"
          name="theme"
          value="light"
          c-option="1"
          checked={theme === "light"}
          onChange={handleThemeChange}
        />
        <span className={styles.switcher__content}>
          <HiHome className={styles.switcher__icon} aria-hidden="true" />
          <span className={styles.switcher__text}>Home</span>
        </span>
      </label>

      <label className={styles.switcher__option}>
        <input
          className={styles.switcher__input}
          type="radio"
          name="theme"
          value="dark"
          c-option="2"
          checked={theme === "dark"}
          onChange={handleThemeChange}
        />
        <span className={styles.switcher__content}>
          <ImSpoonKnife className={styles.switcher__icon} aria-hidden="true" />
          <span className={styles.switcher__text}>Food</span>
        </span>
      </label>

      <label className={styles.switcher__option}>
        <input
          className={styles.switcher__input}
          type="radio"
          name="theme"
          value="dim"
          c-option="3"
          checked={theme === "dim"}
          onChange={handleThemeChange}
        />
        <span className={styles.switcher__content}>
          <IoPersonCircleSharp
            className={styles.switcher__icon}
            aria-hidden="true"
          />
          <span className={styles.switcher__text}>Profile</span>
        </span>
      </label>

      {/* Needed for backdrop-filter: url(#switcher) */}
      <div className={styles.switcher__filter} aria-hidden="true">
        <svg>
          <filter id="switcher" primitiveUnits="objectBoundingBox">
            <feImage
              result="map"
              width="1"
              height="1"
              x="0"
              y="0"
              href="data:image/webp;base64,UklGRq4vAABXRUJQVlA4WAoAAAAQAAAA5wEAhwAAQUxQSOYWAAABHAVpGzCrf9t7EiJCYdIGTDpvURGm9n7KYS32rZ1W8q0LSSEBCQgAQlIwEGGA3CQOAAHSEDCJSEk4KDvUmL31vrYkSX3ufgXEb4gSbKt2LatxlqIgNBBzbM3ikHVkvUvq7btKpaOBCQgIRIiAQeNg46DwgE4oB1QDuKgS0IcXBykXieHkwdjX4iAhZtK3ErSBYGEelp4aM5z14jLlzsXr4kl9C8Ns8DaajUlPX74viveWxOXsOeHL388ut2b0zref99evjX8NLmNt1fP7178ejJcw9k3GXP49Iy2qaa7328Xkk9ZnWx0VUj3bcyCY4Pi7C6reeEagEohnRCbQQwFmUp9ggYQj8MChjTSI0Ck7Gbh6P5ykNU9yP10G8I2UAwXeQ96DQwNjqyPuc4tK5CtGOK0oM7AH5f767lHpotXVYYI66BHjMhHj43C5wok3YDH4vZFZRkB7rNnEfC39WS2Q3K78y525wFNTPf5ffN9YI1YyDvjuzV5rQtsfn1Ez1ka3PkeGxOZ6IODxDJqCLpF7vdb9Z3sufLr6jf55zbW3LodwwVVg7Lmaop3eGcqDFDGuuKnlBZAPSbnkYtTXmZl2y57Gq85F3tDv7m7yzpjXHoVA3YUObsHz80W3IUK1E8yRqggxTMzD4If2230ys7RDxWrLu9o9GdSWNwNRC2yMIgHkTVT3BOZER49XLBMdljemLFMjw8VwZ8OdBti4lWdt7c7dzaSc5yILtztsTMT1GFGntysM23nF3xbOsnheQGKkxhWGEalljCvWZLDE9t97uqEfb08rdYwZGhheLzG2SJzKS77OIAVgPDjf9jHt6c0mjinSv13iz9RV3vsPdmbNG1EnD6s83jBrBEnlBiTojuJogGJNtzxtsIoD2CFuXYipzhGWHhWqCBSqd7l7GMrnuHzH6910FOXYwgcDxoFRJNk2GUcpQ6IGhLmqisuBS6uSFpfAz3Yb9Yatyed7r781ZYfr33FfXs1MykSbVcg4GiOKX19SZ9xFRwhGUZGiROjsXhePVu12fCZTJ3CJ4Z3uXnyxz28RutHa5yCKG6jgfTBPuA9jHL7YdlAa2trNEr7BLANd3qNYcWZqnkvlDe8F5Q9k8jCFk17ObrIf0O5UiDnqcqA70mURr8FUN5pmQEzDcxuWvOPd1KrbO4fd0vXK5OTtYEy5C2TA5L4ok6Y31WHR9ZR9lQr6IjwruSd775W6NVa2zz1fir2k1GWnT573Eu3mfMjIikYZkM4MDCnTWbmLrpKHs0KD5C8rZ3n0tnw0j76WuU8P1YBIjsvcESbnOQMYgGCsdgGhKKtDijJHhrcSjGHaFZ8oGLXeLx1IWcgU8pqD0PzMzU3oG5lQZaDPDMYqaAPSEmHNJiVIp0haHTvPt77732z5ed2K7NHs9FtCIk4BdNkKLRLvOKlFcwUiovM4OB5sGgepyMLa4TEuI29dFtjJulojJR4Tg71ybApEdca0TSnaumNJyCWH2pjENASlQSNIXMWtiPV9CHsvuftev08lemYIcUnHSu6XEMvaBq41tqfm0siLj7xeXsnBmhxY5znCwX4Iu4euTPaE4EQorgogisHrBtsAMdXHuje7nlx3hMpKovdfYftDQqytChXfEh7D5nyC8rzNTICINmpK5Ni0ngcAMzpmiYDwOMtmUTiCjvx2S2dIeSguPQHZ3xYIeGhTt1CsCOIiEuVw8pGjVznDJppuojl30i9RvXccXzmXGj2b3H3XM38cPZseyeOdplXhFekzZMZ2fUGuIBsKCcgQg4Ikqt4PDTkQiWQtMUBFAEhUH8vuvoAvnvGMCEP4vMmZA2PnkmAJsQsHeFAIk"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      </div>
    </fieldset>
  );
}
