import { references } from "./references";
import type { Catalog, PaintingCatalog } from "./types";

// Where the idea came from, what is worked out, what was made up to do
// it and how it came out. The model lists are drawn from the engine's
// own catalogs so they cannot drift from what runs.
export function Science({
  catalog,
  painting,
}: {
  catalog: Catalog;
  painting: PaintingCatalog;
}) {
  const slots = [...catalog.slots, ...painting.slots];
  return (
    <main className="page science">
      <p className="back">
        <a href="#/flat">Back to the simulation</a>
      </p>
      <h1>The scene and what is invented</h1>

      <section>
        <h2>A scene from a novel</h2>
        <p>
          This simulation comes from the last part of <cite>Death's End</cite>,
          the third book of Liu Cixin's <cite>Remembrance of Earth's Past</cite>{" "}
          trilogy (English translation by Ken Liu, Tor Books, 2016). A small
          flat thing arrives at the edge of the Solar System. Around it, space
          itself loses a dimension, and the loss spreads. Whatever touches the
          plane becomes part of it: a ship, a city, the planets one by one and
          at last the Sun are laid out flat, every part of them side by side,
          nothing on top of anything else. From Pluto, the characters watch the
          planets become ringed discs like cut trees, the Earth's ocean freeze
          into a rim of giant snow crystals, and the Sun spread into a sea of
          fire and go out. One of them sees a painted night sky in it.
        </p>
        <p>
          Before the plane reaches them they are asked to carry paintings out of
          a museum under Pluto's surface and let them go in open space. A thing
          that falls alone keeps its own shape on the plane, the reasoning goes,
          and someone with the right mathematics might one day work back from
          the flat picture to the thing. A painting that falls inside a planet
          is mixed in with the planet.
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
          <strong>One law.</strong> Nothing overlaps on the plane, so a thing's
          flat area is its volume divided by a thickness. That thickness is the
          one number everything depends on: halve it and every flat picture
          doubles in area. As a choice, the plane can keep mass instead of
          volume, so that dense matter spreads wider.
        </p>
        <p>
          <strong>Two ways to land.</strong> The novel describes the result in
          two ways that do not agree, so both are here. Shell by shell, each
          layer of a round body becomes a ring with the core in the middle,
          which is how the novel's planets look. As a spreading pool, matter
          spreads from where it touches and pushes aside what landed before,
          which is how the novel's first small ship melts onto the plane. Then
          the first part in ends furthest out, and a planet's rings are slices
          in the order they went under.
        </p>
        <p>
          <strong>The pool is a flow.</strong> Flat matter fed in over a
          footprint, pushing the rest aside without squeezing it, is the flow of
          a fluid with a source and no rotation. For a line and for a rectangle
          that flow has an exact form, and while the footprint keeps its shape,
          matter follows fixed paths that keep areas exactly. That is what a
          picture rides when it stands on the plane and sinks: each row leaves
          the line and follows the rows before it, so the picture opens into a
          fan. Face down, the whole picture has to leave from under itself, and
          everything along one path out arrives at the same point of the edge.
        </p>
        <p>
          <strong>Restoring.</strong> Whoever restores a picture is assumed to
          know the rule and run it backwards, but to see the flat picture only
          so sharply. Whatever the fall squeezed finer than that is lost.
        </p>
        <p>
          <strong>Real bodies.</strong> The Sun and planets are layered as
          measured or modeled: the Earth from the reference model seismologists
          use <Cite k="prem" />, the Sun's zones from helioseismology{" "}
          <Cite k="cz" /> <Cite k="models" />, Mercury <Cite k="hauck" />, Mars{" "}
          <Cite k="stahler" />, Jupiter and Saturn <Cite k="guillot" />, Uranus
          and Neptune <Cite k="nettelmann" />, with sizes and masses from NASA{" "}
          <Cite k="nasa" />. Where a boundary is not known, the page says so
          beside it. The snow crystals are grown by a published model of crystal
          growth <Cite k="reiter" />.
        </p>
      </section>

      <section>
        <h2>What is invented</h2>
        <p>
          The law, both ways of landing, the flow and the reader are all this
          site's inventions. The novel gives no mechanism. Each model below is
          marked speculative wherever it is in use.
        </p>
        {slots.map((slot) => (
          <div key={slot.id + slot.label} className="slot-doc">
            <h3>{slot.label}</h3>
            <p>{slot.help}</p>
            <dl>
              {slot.models.map((m) => (
                <div key={m.id}>
                  <dt>
                    {m.label}
                    {m.speculative && (
                      <strong className="spec"> Speculative.</strong>
                    )}
                  </dt>
                  <dd>{m.summary}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p>
          The light, the sparks, the flames at the flat Sun's rim and the brush
          strokes on the sky are drawn from the novel's description and are not
          worked out at all.
        </p>
      </section>

      <section>
        <h2>How it came out</h2>
        <p>
          The novel says four things that each fix the thickness, and they do
          not give the same answer.
        </p>
        <ul>
          <li>
            <strong>The Sun's clock.</strong> The flat Sun is wider than the Sun
            after thirty seconds of a fall that takes an hour. That needs a
            sheet 192 km thick. The rim then grows at 23,200 km/s, close to the
            twenty thousand the novel works out, and the flat Sun ends 0.65 AU
            across. But the flat Earth is only 85,000 km across, its ocean is a
            ring 30 km wide, and a person is a speck under a millimeter.
          </li>
          <li>
            <strong>The snowflakes.</strong> The novel's snow crystals are 4,000
            to 5,000 km across and lie side by side around the Earth. For the
            ocean's ring to be that wide the sheet must be 8.5 m thick. Then the
            flat Earth is 13 million km across, the flat Sun reaches past Pluto,
            and its rim would have to move at more than ten times the speed of
            light.
          </li>
          <li>
            <strong>The painted sky.</strong> For flat Jupiter and Saturn to be
            as wide as the gap between them, the sheet must be 3.3 m thick,
            close to what the snowflakes ask for. Even so the planets cover only
            about 1% of the space inside Neptune's orbit, and all of it lies
            under the flat Sun.
          </li>
          <li>
            <strong>Nothing hidden.</strong> For every particle to lie beside
            every other, the sheet is one atom thick. A person is then 30 km
            across and a painting nearly 3 km, which is what lets a picture be
            restored. The flat Sun would be hundreds of light-years across.
          </li>
        </ul>
        <p>
          So the snowflakes and the sky agree with each other, and neither
          agrees with the clock or with the detail. No single thickness gives
          the novel's whole scene.
        </p>
        <p>
          The two ways of landing split the same way. Shell by shell gives the
          planets' clean rings and a ring for the ocean. The spreading pool
          gives the melting ship, and a planet whose every ring is a blend, with
          no ocean ring for snow to lie in.
        </p>
        <p>
          The museum's reasoning does hold up under the pool. A picture alone
          and edge first opens into a fan that a reader can run backwards: with
          the test picture and a sheet one atom thick, 98% of it comes back.
          Face down, each path out from under it keeps only an average, and
          about half comes back. Buried in Pluto it is drawn out tens of
          thousands of kilometers and is about one part in 600 million of what
          lies there; nothing comes back. On any sheet thicker than the canvas,
          a picture cannot spread at all.
        </p>
      </section>

      <section>
        <h2>Not built</h2>
        <ul>
          <li>
            Shapes that are neither round nor flat: a person, a ship, the space
            city. They need the flow worked out for any footprint.
          </li>
          <li>
            What flat bodies do to each other where they would overlap, and
            anything that happens on the plane afterwards: the flat Sun's
            currents, gravity, the ocean's vapor.
          </li>
          <li>
            The time matter spends getting out from under a body, which the pool
            treats as none. It matters when the sheet is nearly as thick as the
            body.
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
          The sample picture is Vincent van Gogh's <cite>The Starry Night</cite>{" "}
          (1889), which is in the public domain. The planets' faces are NASA's
          maps: the Blue Marble for the Earth, MESSENGER's mosaic for Mercury,
          and NASA's published textures for Venus, Mars, Jupiter, Saturn,
          Neptune and Pluto. Venus is shown as radar sees its surface. The Sun
          and Uranus are drawn, not mapped.
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
