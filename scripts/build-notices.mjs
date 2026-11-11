import { readFileSync, writeFileSync } from "node:fs";
const sections = [
  ["Three-Body Simulations — MIT", "LICENSE"],
  ["Go runtime — BSD", "public/GO-LICENSE"],
  ...[
    "react",
    "react-dom",
    "scheduler",
    "three",
    "@fontsource/ibm-plex-sans",
    "@fontsource/ibm-plex-serif",
  ].map((n) => [n, `node_modules/${n}/LICENSE`]),
];
writeFileSync(
  "public/THIRD-PARTY-NOTICES.txt",
  sections
    .map(
      ([name, path]) =>
        `${name}\n${"=".repeat(60)}\n${readFileSync(path, "utf8")}`,
    )
    .join("\n\n") +
    "\n\nThe climate fit coefficients are those published with Krissansen-Totton, Arney & Catling (2018), PNAS 115, 4105. See docs/models.md in the source for every model's citation.\n",
);
