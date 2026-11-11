// Every source the flat simulation draws on. Each link was checked to
// resolve to the work named.
export type Reference = { key: string; text: string; url: string };

export const references: Reference[] = [
  {
    key: "nasa",
    text: "Williams, D. R. Planetary Fact Sheets. NASA Space Science Data Coordinated Archive. Radii, masses, mean densities and distances from the Sun.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
  },
  {
    key: "prem",
    text: "Dziewonski, A. M. & Anderson, D. L. (1981). Preliminary reference Earth model. Physics of the Earth and Planetary Interiors 25, 297–356.",
    url: "https://doi.org/10.1016/0031-9201(81)90046-7",
  },
  {
    key: "cz",
    text: "Christensen-Dalsgaard, J., Gough, D. O. & Thompson, M. J. (1991). The depth of the solar convection zone. The Astrophysical Journal 378, 413–437.",
    url: "https://doi.org/10.1086/170441",
  },
  {
    key: "models",
    text: "Christensen-Dalsgaard, J. et al. (1996). The current state of solar modeling. Science 272, 1286–1292. Its Model S gives the Sun's density at every depth.",
    url: "https://doi.org/10.1126/science.272.5266.1286",
  },
  {
    key: "hauck",
    text: "Hauck, S. A. et al. (2013). The curious case of Mercury's internal structure. Journal of Geophysical Research: Planets 118, 1204–1220.",
    url: "https://doi.org/10.1002/jgre.20091",
  },
  {
    key: "stahler",
    text: "Stähler, S. C. et al. (2021). Seismic detection of the martian core. Science 373, 443–448.",
    url: "https://doi.org/10.1126/science.abi7730",
  },
  {
    key: "guillot",
    text: "Guillot, T. (1999). A comparison of the interiors of Jupiter and Saturn. Planetary and Space Science 47, 1183–1200.",
    url: "https://doi.org/10.1016/S0032-0633(99)00043-4",
  },
  {
    key: "nettelmann",
    text: "Nettelmann, N., Helled, R., Fortney, J. J. & Redmer, R. (2013). New indication for a dichotomy in the interior structure of Uranus and Neptune from the application of modified shape and rotation data. Planetary and Space Science 77, 143–151.",
    url: "https://doi.org/10.1016/j.pss.2012.06.019",
  },
  {
    key: "reiter",
    text: "Reiter, C. A. (2005). A local cellular model for snow crystal growth. Chaos, Solitons & Fractals 23, 1111–1119.",
    url: "https://doi.org/10.1016/j.chaos.2004.06.071",
  },
];
