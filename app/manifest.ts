import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peak",
    short_name: "Peak",
    description: "Eat. Train. Peak.",
    start_url: "/",
    display: "standalone",
    background_color: "#18181A",
    theme_color: "#18181A",
    orientation: "portrait",
  };
}
