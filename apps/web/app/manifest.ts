import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vyb",
    short_name: "Vyb",
    description: "Vyb is the installable campus operating system for communities, notes, and social momentum.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "portrait",
    categories: ["education", "social", "productivity"],
    icons: [
      {
        src: "/icons/icon.png",
        sizes: "1254x1254",
        type: "image/png"
      },
      {
        src: "/icons/maskable-icon.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
