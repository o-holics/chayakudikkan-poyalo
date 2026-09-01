import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "chayakudikkanpoyalo.in",
    short_name: "chayakudikkanpoyalo",
    description: "A quiet way to share a cup of chai with a few people nearby.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f2ec",
    theme_color: "#f4f2ec",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
