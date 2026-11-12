// Every source this simulation draws on. Each link was checked to
// resolve to the work named.
export type Reference = { key: string; text: string; url: string };

export const references: Reference[] = [
  {
    key: "jpl",
    text: "Standish, E. M. & Williams, J. G. Approximate Positions of the Planets: Keplerian elements for 1800 AD to 2050 AD. Jet Propulsion Laboratory, Solar System Dynamics. The planets' orbits.",
    url: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  },
  {
    key: "nasa",
    text: "Williams, D. R. Planetary Fact Sheets. NASA Space Science Data Coordinated Archive. Masses and radii, the Sun's turn and tilt, the Earth's air and water.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
  },
  {
    key: "ahrens",
    text: "Ahrens, T. J. & Harris, A. W. (1992). Near Earth asteroid orbit perturbation and fragmentation. NASA-CR-190116. The report behind their paper in Nature 360, 429–433, Deflection and fragmentation of near-Earth asteroids. Only what is thrown off faster than escape speed moves a body; how much of a bomb's energy reaches rock.",
    url: "https://ntrs.nasa.gov/citations/19920011112",
  },
  {
    key: "brown",
    text: "Brown, J. C., Carlson, R. W. & Toner, M. P. (2015). Destruction and observational signatures of Sun-impacting comets. The Astrophysical Journal 807, 165. How the Sun's gas slows a body plunging into it.",
    url: "https://doi.org/10.1088/0004-637X/807/2/165",
  },
  {
    key: "models",
    text: "Christensen-Dalsgaard, J. et al. (1996). The current state of solar modeling. Science 272, 1286–1292. Its Model S gives the Sun's density at every depth.",
    url: "https://doi.org/10.1126/science.272.5266.1286",
  },
  {
    key: "cz",
    text: "Christensen-Dalsgaard, J., Gough, D. O. & Thompson, M. J. (1991). The depth of the solar convection zone. The Astrophysical Journal 378, 413–437.",
    url: "https://doi.org/10.1086/170441",
  },
  {
    key: "adachi",
    text: "Adachi, I., Hayashi, C. & Nakazawa, K. (1976). The gas drag effect on the elliptic motion of a solid body in the primordial solar nebula. Progress of Theoretical Physics 56, 1756–1771. The drag of gas on a body, and its coefficient far above the speed of sound.",
    url: "https://doi.org/10.1143/PTP.56.1756",
  },
  {
    key: "ostriker",
    text: "Ostriker, E. C. (1999). Dynamical friction in a gaseous medium. The Astrophysical Journal 513, 252–258. The pull of a body's own wake.",
    url: "https://doi.org/10.1086/306858",
  },
  {
    key: "de",
    text: "De, K. et al. (2023). An infrared transient from a star engulfing a planet. Nature 617, 55–60. A star seen swallowing a planet; cited for context, and no number here is taken from it.",
    url: "https://doi.org/10.1038/s41586-023-05842-x",
  },
];
