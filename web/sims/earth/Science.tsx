import { refNumber, references } from "./references";
import type { Catalog } from "./types";

const Ref = ({ k }: { k: string }) => (
  <a
    className="ref"
    href={`#ref-${k}`}
    onClick={(e) => {
      // Hash routes own the address, so scroll by hand.
      e.preventDefault();
      document.getElementById(`ref-${k}`)?.scrollIntoView({ block: "center" });
    }}
  >
    [{refNumber(k)}]
  </a>
);

// Where the idea came from, what the simulation computes, how it came out
// and every source. The model list is drawn from the engine's own catalog
// so it cannot drift from what runs.
export function Science({ catalog }: { catalog: Catalog }) {
  return (
    <main className="page science">
      <p className="back">
        <a href="#/earth">Back to the simulation</a>
      </p>
      <h1>The science and its sources</h1>

      <section>
        <h2>A scene from a novel</h2>
        <p>
          This simulation comes from a scene early in <cite>Death's End</cite>,
          the third book of Liu Cixin's <cite>Remembrance of Earth's Past</cite>{" "}
          trilogy (English translation by Ken Liu, Tor Books, 2016). A physicist
          argues that the Earth's fitness for life looks designed. A researcher
          the book calls Green Glasses answers by opening a configuration panel,
          unchecking the box marked “life”, and running the planet's history
          again on a supercomputer. The Earth that comes back is orange and dry.
          His point: life did not find a comfortable home, it built one.
        </p>
        <p>
          The scene, the checkbox and the claim belong to Liu Cixin. This site
          is an unofficial tribute with no connection to the author, translators
          or publishers. It takes the claim as a premise and asks what published
          Earth science you would reach for to build that machine. It is not a
          test of whether the claim is true.
        </p>
      </section>

      <section>
        <h2>What the simulation computes</h2>
        <p>
          The planet's surface temperature comes from sunlight, which grows as
          the Sun ages <Ref k="gough" />, and from carbon dioxide. Volcanoes add
          carbon dioxide; the weathering of rock removes it, faster when the
          planet is warm <Ref k="walker" /> <Ref k="kt" />. That balance is the
          thermostat. Life enters through weathering: roots, microbes and the
          acids they make break rock far faster than bare chemistry does{" "}
          <Ref k="sv" /> <Ref k="lvb" /> <Ref k="franck" />, so a lifeless Earth
          must run hotter to remove the same carbon. Life may also have built
          the continents that weather <Ref k="hoening" />.
        </p>
        <p>
          Water leaves a planet as hydrogen. Vapor has to climb past a cold
          layer that freezes most of it out; what passes is split by sunlight
          and its hydrogen drifts to space <Ref k="wp" /> <Ref k="ck" />. A
          hotter surface pushes more vapor past the trap. Oxygen, which only
          life supplies, follows a two-step history <Ref k="lyons" /> and raises
          the ozone shield <Ref k="goldblatt" />; before oxygen, a living Earth
          may have been shielded by organic haze <Ref k="arney" />.
        </p>
      </section>

      <section>
        <h2>The surface up close</h2>
        <p>
          Green Glasses also argues that life decides which mountains last: of
          three, the one without vegetation is soon worn flat. The surface view
          tests that on a patch of land ten kilometers across. Running water
          cuts rock in proportion to the water gathered and the slope; plants
          roughen the ground and take up most of the water's force, and they
          slow the creep of soil <Ref k="schmid" /> <Ref k="ib" />. With the
          published values, full cover makes ground about forty times harder for
          water to cut. The equations are solved as in <Ref k="bw" />{" "}
          <Ref k="barnes" />. Rock worn from slopes settles in closed basins,
          which is how a crater fills. Rain on the patch follows the planet:
          more on a warmer world <Ref k="sv" />, none once the oceans are gone.
        </p>
      </section>

      <section>
        <h2>Was it luck?</h2>
        <p>
          The scene opens on a different question: whether a planet this fit for
          life could be an accident. One published model asks it directly{" "}
          <Ref k="tyrrell" />. Each planet is given climate feedbacks at random,
          some steadying and some not, a slow drift, and its own rate of
          accidents such as impacts and eruptions. It is then run many times to
          see whether its temperature stays between −10 and 60 °C for three
          billion years. In the paper about 9% of 100,000 planets lasted at
          least once in 100 tries and one lasted every time; the version here
          finds 8.6% of 10,000. Its conclusion is that both a planet's makeup
          and its luck matter.
        </p>
        <p>
          That model has no life in it. The page adds a second run of the same
          planets through the same accidents with a pull toward a comfortable
          temperature, standing in for life's hold on the climate. The pull and
          its strength are <strong className="spec">speculative</strong>: this
          site's addition, with no published value behind it.
        </p>
      </section>

      <section>
        <h2>How it came out</h2>
        <p>
          With every published model set to the end of its range where life
          matters most, the lifeless Earth is scalding, near 90 °C under a few
          bars of carbon dioxide, but it keeps its oceans. Thick carbon dioxide
          also keeps the cold trap working, so little water escapes. Published
          physics alone did not produce the book's dry planet here.
        </p>
        <p>
          The default preset, Green Glasses, therefore adds what the character
          himself guesses at: with nothing living to shield the air, ultraviolet
          light and solar wind strip the water away. That term has no published
          basis, some published work argues against it <Ref k="gunell" />, and
          the simulation marks it <strong className="spec">speculative</strong>{" "}
          wherever it is in use. The Skeptic preset leaves it out and lets the
          seafloor weather without life's help <Ref k="kt" />; its lifeless
          Earth stays temperate, in line with a recent whole-planet model of an
          Earth that never had life <Ref k="gj" />.
        </p>
      </section>

      <section>
        <h2>The models you can choose</h2>
        {catalog.slots.map((slot) => (
          <div key={slot.id} className="slot-doc">
            <h3>{slot.label}</h3>
            <p>{slot.help}</p>
            <dl>
              {slot.models.map((m) => (
                <div key={m.id}>
                  <dt>
                    {m.label}
                    {m.speculative && (
                      <strong className="spec"> (speculative)</strong>
                    )}
                  </dt>
                  <dd>
                    {m.summary} <span className="cite">{m.citation}.</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section>
        <h2>Limits</h2>
        <ul>
          <li>
            One number stands for the whole planet's temperature. There are no
            seasons, latitudes, ice sheets or weather.
          </li>
          <li>
            The climate fit is used past the range it was made for when carbon
            dioxide exceeds 10 bar; the page says so when a run goes there. A
            steam atmosphere's own runaway warming is not modeled.
          </li>
          <li>
            Nitrogen is held fixed. Models of its history find large swings need
            life <Ref k="stueken" />.
          </li>
          <li>
            The molten start, ice caps, clouds and vegetation on the globe are
            illustrations, with the cooling time taken from <Ref k="zahnle" />.
          </li>
          <li>
            Parameter ranges are those the cited papers explore. Combining
            models from different papers goes beyond what any one of them
            tested.
          </li>
        </ul>
      </section>

      <section>
        <h2>References</h2>
        <ol className="references">
          {references.map((r) => (
            <li key={r.key} id={`ref-${r.key}`}>
              {r.text}{" "}
              <a href={r.url} rel="noreferrer">
                {r.url.replace("https://", "")}
              </a>
            </li>
          ))}
        </ol>
        <p>
          The novel: Liu Cixin, <cite>Death's End</cite>, translated by Ken Liu.
          Tor Books, 2016. First published in Chinese in 2010.
        </p>
      </section>
    </main>
  );
}
