import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vyb",
    short_name: "Vyb",
    description: "Vyb is the installable campus operating system for communities, notes, and social momentum.",
    start_url: "/",
    display: "standalone",
    background_color: "#08101b",
    theme_color: "#08101b",
    orientation: "portrait",
    categories: ["education", "social", "productivity"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
