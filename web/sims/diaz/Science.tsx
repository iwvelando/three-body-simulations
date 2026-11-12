import { placeOf } from "../../shell/address";
import { references } from "./references";
import type { Catalog } from "./types";

// Where the idea came from, what is worked out, what was made up to do
// it and how it came out. The model list is drawn from the engine's own
// catalog so it cannot drift from what runs.
export function Science({ catalog }: { catalog: Catalog }) {
  return (
    <main className="page science">
      <p className="back">
        <a href={placeOf("diaz")}>Back to the simulation</a>
      </p>
      <h1>The scene and what is invented</h1>

      <section>
        <h2>A scene from a novel</h2>
        <p>
          This simulation comes from <cite>The Dark Forest</cite>, the second
          book of Liu Cixin's <cite>Remembrance of Earth's Past</cite> trilogy
          (English translation by Joel Martinsen, Tor Books, 2015). Humanity has
          named four Wallfacers, each to prepare a secret plan against an
          invasion four centuries away. One of them, Rey Diaz, asks for the
          largest hydrogen bombs that can be built, a million or more, and has
          them stored on Mercury. The man sent to work out his real purpose
          tells him what it is.
        </p>
        <p>
          Astronomers in the story have watched a small planet fall into a star
          like the Sun, and seen a spiral of the star's own matter unwind from
          the place it struck, three times as far out as the Earth is from the
          Sun. The plan is to do the same here. The bombs slow Mercury until it
          falls. The Sun's spiral grows past Mars. Venus, the Earth and Mars
          plough through it, lose speed and fall in turn, each impact feeding
          the spiral, until it reaches Jupiter and then the outer planets. With
          the Solar System gone the invaders have nowhere to go, so the threat
          of it is the weapon. The same man then tells him it cannot work: there
          will never be enough bombs.
        </p>
        <p>
          The scene belongs to Liu Cixin. This site is an unofficial tribute
          with no connection to the author, translators or publishers. It is a
          simulation built on the scene's premise, not a test of whether such a
          thing could happen.
        </p>
      </section>

      <section>
        <h2>What is worked out</h2>
        <p>
          <strong>The orbits.</strong> The planets move on the orbits the Jet
          Propulsion Laboratory publishes for the years around 2000{" "}
          <Cite k="jpl" />, with NASA's masses and sizes <Cite k="nasa" />.
          Mercury is pushed at its farthest point from the Sun, where the least
          slowing is needed, and then follows the new orbit that Newton's laws
          give it.
        </p>
        <p>
          <strong>The bombs.</strong> A bomb moves a planet only by what it
          throws off for good <Cite k="ahrens" />. Rock that leaves Mercury
          keeps only part of its speed, so for a given energy there is a best
          speed to throw it at, and the most momentum the energy can buy is the
          energy divided by Mercury's escape speed. That is a ceiling, worked
          out here from the bookkeeping of energy and momentum. Real bombs fall
          far short of it.
        </p>
        <p>
          <strong>The impact.</strong> A body plunging into the Sun is slowed by
          the gas it meets <Cite k="brown" />, and is stopped once it has met
          about its own mass. A table of the Sun's density at every depth{" "}
          <Cite k="models" /> says where that is, against the depth of the
          convection zone <Cite k="cz" />. A planet arrives at close to the
          speed needed to leave the Sun, so its energy can lift out its own mass
          and no more.
        </p>
        <p>
          <strong>The gas.</strong> Gas thrown off the Sun follows the same
          paths as a thrown stone. Slower than escape speed, it is back within
          hours or days. Faster, it never returns. To hang three times the
          Earth's distance out and stay, it would have to leave within a
          thousandth of escape speed, and even then it would fall back.
        </p>
        <p>
          <strong>The drag.</strong> A planet in gas is slowed by what it runs
          into <Cite k="adachi" /> and by the pull of the wake that gathers
          behind it <Cite k="ostriker" />. Losing energy, its orbit shrinks. A
          planet has to meet about its own mass in gas to be brought down.
        </p>
      </section>

      <section>
        <h2>What is invented</h2>
        <p>
          Three steps of the plan are not allowed by any of that, so each has a
          second rule made up for this site, marked{" "}
          <strong className="spec">Speculative</strong> wherever it is in use.
          The first starting point uses all three; the others use fewer or none.
        </p>
        <dl className="models">
          {catalog.slots.flatMap((slot) =>
            slot.models.map((m) => (
              <div key={`${slot.id}.${m.id}`}>
                <dt>
                  {slot.label}: {m.label}
                  {m.speculative && (
                    <strong className="spec"> Speculative.</strong>
                  )}
                </dt>
                <dd>
                  {m.summary} <span className="cite">{m.citation}</span>
                </dd>
              </div>
            )),
          )}
        </dl>
        <p>
          The invented spiral reaches three times the Earth's distance for the
          planet in the novel's example, 4% of the Earth's mass, and further for
          a larger impact in proportion to the cube root of its energy. Its gas
          stands still, thinning with the square of the distance. Nothing in the
          novel says how much gas there is, so the strength of the eruption is a
          setting. It decides how long everything takes.
        </p>
      </section>

      <section>
        <h2>How it came out</h2>
        <p>
          <strong>Published physics only.</strong> Mercury must lose 32.7 km/s.
          A million bombs of 200 megatons, at the very most they could do, take
          off 0.57 millimeters a second. The fall would need 57 trillion of
          them. The novel's own verdict is the same.
        </p>
        <p>
          <strong>Grant only the fall.</strong> Mercury reaches the Sun in 21
          days at 615 km/s. If it held together it would stop at 0.64 of the
          Sun's radius, under the convection zone, as the novel says; the bodies
          studied so far burst near the surface instead. Its energy can lift
          0.99 of its own mass. Half of that leaves the Solar System and half
          falls back within days. No spiral forms. The most the passing gas
          could slow the Earth is 0.04 millimeters a second.
        </p>
        <p>
          <strong>The Wallbreaker's telling.</strong> With an eruption a
          thousand times what the impact pays for, the spiral reaches 3.3 times
          the Earth's distance, past Mars. Within three years the Earth has met
          its own air's mass in gas. Venus falls after 167,000 years, and that
          one impact carries the gas past Jupiter. Jupiter is then next, not the
          Earth: the pull of its own wake counts for far more than friction, and
          it falls after 195,000 years, the Earth and Mars just behind it.
          Neptune is last, after 209,000 years. By then two thirds of the Sun's
          mass is outside the Sun.
        </p>
        <p>
          Two of the novel's reasons do not survive. A planet that spirals in
          arrives more slowly than Mercury's plunge, not faster. And the gas
          that barely touches Jupiter in the novel takes it before the Earth
          here. The novel's sums are also generous: Venus, the Earth and Mars
          are 35 times Mercury's mass, not forty, and Jupiter is 161 times the
          four inner planets, not six hundred.
        </p>
      </section>

      <section>
        <h2>Not built</h2>
        <ul>
          <li>
            The Earth as a comet, Jupiter's moons, and what the Sun is like
            afterwards. A star has been seen swallowing a planet <Cite k="de" />
            , and that is as far as observation goes.
          </li>
          <li>
            The Sun growing lighter as it loses gas, which would loosen every
            orbit, and the planets' pull on one another.
          </li>
          <li>
            Mercury breaking up on the way in, and the weeks or years the bombs
            would take. The push is counted as one moment.
          </li>
          <li>
            Orbits becoming rounder as they shrink. Each keeps its shape and
            tilt.
          </li>
        </ul>
      </section>

      <section>
        <h2>Sources</h2>
        <ol className="references">
          {references.map((r) => (
            <li key={r.key} id={`ref-${r.key}`}>
              {r.text} <a href={r.url}>{r.url}</a>
            </li>
          ))}
        </ol>
        <p>
          The planets' faces are NASA's maps: the Blue Marble for the Earth,
          MESSENGER's mosaic for Mercury, and NASA's published textures for
          Venus, Mars, Jupiter, Saturn and Neptune. Venus is shown as radar sees
          its surface. The Sun and Uranus are drawn, not mapped.
        </p>
      </section>
    </main>
  );
}

function Cite({ k }: { k: string }) {
  const n = references.findIndex((r) => r.key === k) + 1;
  return (
    <a
      className="ref"
      href={`#ref-${k}`}
      onClick={(e) => {
        // Hash links are routes here; scroll instead.
        e.preventDefault();
        document.getElementById(`ref-${k}`)?.scrollIntoView();
      }}
    >
      [{n}]
    </a>
  );
}
