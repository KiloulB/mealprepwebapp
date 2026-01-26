"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./ThemeSwitcherNav.module.css";

export default function ThemeSwitcherNav({
  defaultValue = "light",
  onChange,
  className = "",
}) {
  const [theme, setTheme] = useState(defaultValue);

  const switcherRef = useRef(null);
  const previousOptionRef = useRef("1");

  // Initialize c-previous on mount (matches the original JS behavior)
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

    // set c-previous BEFORE switching to nextOption
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
        <svg
          className={styles.switcher__icon}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 36 36"
        >
          <path
            fill="var(--c)"
            fillRule="evenodd"
            d="M18 12a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
            clipRule="evenodd"
          />
          <path
            fill="var(--c)"
            d="M17 6.038a1 1 0 1 1 2 0v3a1 1 0 0 1-2 0v-3ZM24.244 7.742a1 1 0 1 1 1.618 1.176L24.1 11.345a1 1 0 1 1-1.618-1.176l1.763-2.427ZM29.104 13.379a1 1 0 0 1 .618 1.902l-2.854.927a1 1 0 1 1-.618-1.902l2.854-.927ZM29.722 20.795a1 1 0 0 1-.619 1.902l-2.853-.927a1 1 0 1 1 .618-1.902l2.854.927ZM25.862 27.159a1 1 0 0 1-1.618 1.175l-1.763-2.427a1 1 0 1 1 1.618-1.175l1.763 2.427ZM19 30.038a1 1 0 0 1-2 0v-3a1 1 0 1 1 2 0v3ZM11.755 28.334a1 1 0 0 1-1.618-1.175l1.764-2.427a1 1 0 1 1 1.618 1.175l-1.764 2.427ZM6.896 22.697a1 1 0 1 1-.618-1.902l2.853-.927a1 1 0 1 1 .618 1.902l-2.853.927ZM6.278 15.28a1 1 0 1 1 .618-1.901l2.853.927a1 1 0 1 1-.618 1.902l-2.853-.927ZM10.137 8.918a1 1 0 0 1 1.618-1.176l1.764 2.427a1 1 0 0 1-1.618 1.176l-1.764-2.427Z"
          />
        </svg>
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
        <svg
          className={styles.switcher__icon}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 36 36"
        >
          <path
            fill="var(--c)"
            d="M12.5 8.473a10.968 10.968 0 0 1 8.785-.97 7.435 7.435 0 0 0-3.737 4.672l-.09.373A7.454 7.454 0 0 0 28.732 20.4a10.97 10.97 0 0 1-5.232 7.125l-.497.27c-5.014 2.566-11.175.916-14.234-3.813l-.295-.483C5.53 18.403 7.13 11.93 12.017 8.77l.483-.297Zm4.234.616a8.946 8.946 0 0 0-2.805.883l-.429.234A9 9 0 0 0 10.206 22.5l.241.395A9 9 0 0 0 22.5 25.794l.416-.255a8.94 8.94 0 0 0 2.167-1.99 9.433 9.433 0 0 1-2.782-.313c-5.043-1.352-8.036-6.535-6.686-11.578l.147-.491c.242-.745.573-1.44.972-2.078Z"
          />
        </svg>
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
        <svg
          className={styles.switcher__icon}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 36 36"
        >
          <path
            fill="var(--c)"
            d="M5 21a1 1 0 0 1 1-1h24a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1ZM12 25a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H13a1 1 0 0 1-1-1ZM15 29a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1ZM18 13a6 6 0 0 1 5.915 7h-2.041A4.005 4.005 0 0 0 18 15a4 4 0 0 0-3.874 5h-2.041A6 6 0 0 1 18 13ZM17 7.038a1 1 0 1 1 2 0v3a1 1 0 0 1-2 0v-3ZM24.244 8.742a1 1 0 1 1 1.618 1.176L24.1 12.345a1 1 0 1 1-1.618-1.176l1.763-2.427ZM29.104 14.379a1 1 0 0 1 .618 1.902l-2.854.927a1 1 0 1 1-.618-1.902l2.854-.927ZM6.278 16.28a1 1 0 1 1 .618-1.901l2.853.927a1 1 0 1 1-.618 1.902l-2.853-.927ZM10.137 9.918a1 1 0 0 1 1.618-1.176l1.764 2.427a1 1 0 0 1-1.618 1.176l-1.764-2.427Z"
          />
        </svg>
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
