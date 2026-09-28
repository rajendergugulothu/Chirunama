import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chirunama",
    short_name: "Chirunama",
    description: "Verified property listings in Warangal, Hanamkonda and Kazipet.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#0f5132",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
