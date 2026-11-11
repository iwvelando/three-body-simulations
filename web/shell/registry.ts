import type { ComponentType } from "react";
import type { Engine } from "./engine";

// A simulation is a page of its own, loaded only when opened. To add one:
// write its engine package in Go (engine/<id>), register it in
// engine/api.go, and add an entry here.
export type SimulationProps = {
  engine: Engine;
  // The part of the address after "#/<id>", such as "/models" or "?c=…".
  rest: string;
};
export type Simulation = {
  id: string;
  title: string;
  // Where in the trilogy the simulation appears.
  source: string;
  blurb: string;
  load: () => Promise<{ default: ComponentType<SimulationProps> }>;
};

export const simulations: Simulation[] = [
  {
    id: "earth",
    title: "Earth without life",
    source: "Death's End",
    blurb:
      "Uncheck Life and run the planet's four and a half billion years again. Does it keep its oceans?",
    load: () => import("../sims/earth/EarthPage"),
  },
];
