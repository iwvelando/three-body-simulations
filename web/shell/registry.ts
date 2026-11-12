import type { ComponentType } from "react";
import type { Engine } from "./engine";
import { DiazIcon, EarthIcon, FlatIcon, MoziIcon } from "./icons";

// A simulation is a page of its own, loaded only when opened. To add one:
// write its engine package in Go (engine/<id>), register it in
// engine/api.go, and add an entry here, with a picture in icons.tsx.
export type SimulationProps = {
  engine: Engine;
  // The part of the address after "#/<id>", such as "/models" or "?c=…".
  rest: string;
  // Counts the visitor's arrivals at an address. A view that reads the
  // address once is keyed by it, so a link followed, pasted or gone back
  // to is read afresh, and the view's own rewriting of the address is not.
  arrival: number;
};
export type Simulation = {
  id: string;
  title: string;
  // Where in the trilogy the simulation appears.
  source: string;
  blurb: string;
  // A small picture for the home page's list (icons.tsx).
  icon: ComponentType;
  load: () => Promise<{ default: ComponentType<SimulationProps> }>;
};

// Listed in the order their scenes come up in the books.
export const simulations: Simulation[] = [
  {
    id: "mozi",
    title: "Mozi's machine",
    source: "The Three-Body Problem",
    blurb:
      "The universe as two copper shells in a sea of fire. Stand where the clerk stands and read the calendar of Stable and Chaotic Eras.",
    icon: MoziIcon,
    load: () => import("../sims/mozi/MoziPage"),
  },
  {
    id: "diaz",
    title: "Mercury into the Sun",
    source: "The Dark Forest",
    blurb:
      "A Wallfacer's plan: bomb Mercury into the Sun and let the Sun's spiral of gas drag every planet in after it. Run it as the novel tells it, or with published physics alone.",
    icon: DiazIcon,
    load: () => import("../sims/diaz/DiazPage"),
  },
  {
    id: "earth",
    title: "Earth without life",
    source: "Death's End",
    blurb:
      "Uncheck Life and run the planet's four and a half billion years again. Does it keep its oceans?",
    icon: EarthIcon,
    load: () => import("../sims/earth/EarthPage"),
  },
  {
    id: "flat",
    title: "Into two dimensions",
    source: "Death's End",
    blurb:
      "Space loses a dimension and everything falls flat. Drop in the Sun, a planet or a picture of your own, and see what is left.",
    icon: FlatIcon,
    load: () => import("../sims/flat/FlatPage"),
  },
];
