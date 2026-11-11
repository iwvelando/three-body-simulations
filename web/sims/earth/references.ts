// Every paper the Earth simulation draws on, in the order the science page
// cites them. Each link was checked to resolve to the paper named.
export type Reference = { key: string; text: string; url: string };

export const references: Reference[] = [
  {
    key: "gough",
    text: "Gough, D. O. (1981). Solar interior structure and luminosity variations. Solar Physics 74, 21–34.",
    url: "https://doi.org/10.1007/BF00151270",
  },
  {
    key: "walker",
    text: "Walker, J. C. G., Hays, P. B. & Kasting, J. F. (1981). A negative feedback mechanism for the long-term stabilization of Earth's surface temperature. Journal of Geophysical Research 86, 9776–9782.",
    url: "https://doi.org/10.1029/JC086iC10p09776",
  },
  {
    key: "kt",
    text: "Krissansen-Totton, J., Arney, G. N. & Catling, D. C. (2018). Constraining the climate and ocean pH of the early Earth with a geological carbon cycle model. PNAS 115, 4105–4110.",
    url: "https://doi.org/10.1073/pnas.1721296115",
  },
  {
    key: "sv",
    text: "Schwartzman, D. W. & Volk, T. (1989). Biotic enhancement of weathering and the habitability of Earth. Nature 340, 457–460.",
    url: "https://doi.org/10.1038/340457a0",
  },
  {
    key: "lvb",
    text: "Lenton, T. M. & von Bloh, W. (2001). Biotic feedback extends the life span of the biosphere. Geophysical Research Letters 28, 1715–1718.",
    url: "https://doi.org/10.1029/2000GL012198",
  },
  {
    key: "franck",
    text: "Franck, S., Bounama, C. & von Bloh, W. (2006). Causes and timing of future biosphere extinctions. Biogeosciences 3, 85–92.",
    url: "https://doi.org/10.5194/bg-3-85-2006",
  },
  {
    key: "hoening",
    text: "Höning, D., Hansen-Goos, H., Airo, A. & Spohn, T. (2014). Biotic vs. abiotic Earth: A model for mantle hydration and continental coverage. Planetary and Space Science 98, 5–13.",
    url: "https://doi.org/10.1016/j.pss.2013.10.004",
  },
  {
    key: "wp",
    text: "Wordsworth, R. & Pierrehumbert, R. (2014). Abiotic oxygen-dominated atmospheres on terrestrial habitable zone planets. The Astrophysical Journal Letters 785, L20.",
    url: "https://doi.org/10.1088/2041-8205/785/2/L20",
  },
  {
    key: "ck",
    text: "Catling, D. C. & Kasting, J. F. (2017). Atmospheric Evolution on Inhabited and Lifeless Worlds. Cambridge University Press. Equation 5.57.",
    url: "https://doi.org/10.1017/9781139020558",
  },
  {
    key: "lyons",
    text: "Lyons, T. W., Reinhard, C. T. & Planavsky, N. J. (2014). The rise of oxygen in Earth's early ocean and atmosphere. Nature 506, 307–315.",
    url: "https://doi.org/10.1038/nature13068",
  },
  {
    key: "goldblatt",
    text: "Goldblatt, C., Lenton, T. M. & Watson, A. J. (2006). Bistability of atmospheric oxygen and the Great Oxidation. Nature 443, 683–686.",
    url: "https://doi.org/10.1038/nature05169",
  },
  {
    key: "arney",
    text: "Arney, G. et al. (2016). The Pale Orange Dot: The spectrum and habitability of hazy Archean Earth. Astrobiology 16, 873–899.",
    url: "https://doi.org/10.1089/ast.2015.1422",
  },
  {
    key: "stueken",
    text: "Stüeken, E. E. et al. (2016). Modeling pN2 through geological time: Implications for planetary climates and atmospheric biosignatures. Astrobiology 16, 949–963.",
    url: "https://doi.org/10.1089/ast.2016.1537",
  },
  {
    key: "gunell",
    text: "Gunell, H. et al. (2018). Why an intrinsic magnetic field does not protect a planet against atmospheric escape. Astronomy & Astrophysics 614, L3.",
    url: "https://doi.org/10.1051/0004-6361/201832934",
  },
  {
    key: "zahnle",
    text: "Zahnle, K. et al. (2007). Emergence of a habitable planet. Space Science Reviews 129, 35–78.",
    url: "https://doi.org/10.1007/s11214-007-9225-z",
  },
  {
    key: "schmid",
    text: "Schmid, M., Ehlers, T. A., Werner, C., Hickler, T. & Fuentes-Espoz, J.-P. (2018). Effect of changing vegetation and precipitation on denudation, part 2: Predicted landscape response to transient climate and vegetation cover over millennial to million-year timescales. Earth Surface Dynamics 6, 859–881.",
    url: "https://doi.org/10.5194/esurf-6-859-2018",
  },
  {
    key: "ib",
    text: "Istanbulluoglu, E. & Bras, R. L. (2005). Vegetation-modulated landscape evolution: Effects of vegetation on landscape processes, drainage density, and topography. Journal of Geophysical Research: Earth Surface 110.",
    url: "https://doi.org/10.1029/2004JF000249",
  },
  {
    key: "bw",
    text: "Braun, J. & Willett, S. D. (2013). A very efficient O(n), implicit and parallel method to solve the stream power equation governing fluvial incision and landscape evolution. Geomorphology 180–181, 170–179.",
    url: "https://doi.org/10.1016/j.geomorph.2012.10.008",
  },
  {
    key: "barnes",
    text: "Barnes, R. (2018). Accelerating a fluvial incision and landscape evolution model with parallelism. arXiv:1803.02977.",
    url: "https://arxiv.org/abs/1803.02977",
  },
  {
    key: "tyrrell",
    text: "Tyrrell, T. (2020). Chance played a role in determining whether Earth stayed habitable. Communications Earth & Environment 1, 61.",
    url: "https://doi.org/10.1038/s43247-020-00057-8",
  },
  {
    key: "gj",
    text: "Gilbert-Janizek, S. et al. (2026). A whole-planet model of the Earth without life for terrestrial exoplanet studies. arXiv:2602.02267.",
    url: "https://arxiv.org/abs/2602.02267",
  },
];

export const refNumber = (key: string) =>
  references.findIndex((r) => r.key === key) + 1;
