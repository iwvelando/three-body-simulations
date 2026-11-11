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
    "\n\nThe climate fit coefficients are those published with Krissansen-Totton, Arney & Catling (2018), PNAS 115, 4105. See docs/models.md in the source for every model's citation.\n\nThe sample picture, starry-night.jpg, is Vincent van Gogh, The Starry Night (1889), which is in the public domain; the scan is the Google Art Project's, from Wikimedia Commons.\n\nThe planet maps in planets/ are NASA's: Venus, Mars, Jupiter, Saturn, Neptune and Pluto from NASA 3D Resources (free and without copyright); Earth is the Blue Marble, NASA Goddard Space Flight Center (Visible Earth 57730; the copy used is from Wikimedia Commons, which labels it CC BY-SA 3.0); Mercury is MESSENGER's global mosaic, NASA/Johns Hopkins APL/Carnegie Institution (PIA17230).\n",
);
