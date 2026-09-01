import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "chayakudikanpooyalo",
    short_name: "chaya",
    description: "A quiet way for late-night chai lovers to share a table.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f2ec",
    theme_color: "#f4f2ec",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
