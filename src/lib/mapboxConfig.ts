// Mapbox public access token — safe to expose in frontend code.
// Token is restricted to public scopes (pk.*) and rate-limited by Mapbox.
export const MAPBOX_PUBLIC_TOKEN =
  "pk.eyJ1IjoibWlmZm8yMDA4IiwiYSI6ImNtbzRzNWwzaTB5dHUyc3F3a2FkaGNzOTYifQ.gdg_tkmwuccoVwKWy04tWw";

export const MAPBOX_STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

export type MapboxStyleKey = keyof typeof MAPBOX_STYLES;
