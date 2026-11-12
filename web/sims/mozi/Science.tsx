import { placeOf } from "../../shell/address";
import type { Catalog } from "./types";

// Where the idea came from, what the machine computes, what was made up
// to build it and how it came out. The model list is drawn from the
// engine's own catalog so it cannot drift from what runs.
export function Science({ catalog }: { catalog: Catalog }) {
  return (
    <main className="page science">
      <p className="back">
        <a href={placeOf("mozi")}>Back to the simulation</a>
      </p>
      <h1>The scene and what is invented</h1>

      <section>
        <h2>A scene from a novel</h2>
        <p>
          This simulation comes from a scene in{" "}
          <cite>The Three-Body Problem</cite>, the first book of Liu Cixin's{" "}
          <cite>Remembrance of Earth's Past</cite> trilogy (English translation
          by Ken Liu, Tor Books, 2014). Inside a virtual-reality game, the
          player Wang Miao meets a man who goes by Mozi. The game's world has a
          sun that cannot be trusted. For a while it rises and sets on a steady
          rhythm and the weather is mild: a Stable Era. Then, without warning,
          it comes up huge or tiny, stays away for days or scorches the ground:
          a Chaotic Era. Whoever can predict the next Stable Era saves a
          civilization.
        </p>
        <p>
          Mozi's answer is a machine. The universe, he says, is a hollow sphere
          floating in a sea of fire, with a large hole for the sun and small
          holes for the stars. Wang objects, and Mozi revises: there are two
          spheres, one inside the other; they swell and shrink; a dark cloud
          sometimes covers the hole. He has built the model in copper, with
          gears to stand in for the currents in the fire and a clerk at the
          center writing down what the sun does. Run ahead of the real sky, the
          clerk's record is a calendar.
        </p>
        <p>
          The scene, the machine and the eras belong to Liu Cixin. This site is
          an unofficial tribute with no connection to the author, translators or
          publishers. It builds the machine Mozi describes and lets you watch
          it, from the clerk's place and from outside. It does not test the
          machine against a real sky. In the novel the forecast fails, and the
          sun's true cause turns out to be something Mozi's shells cannot hold.
        </p>
      </section>

      <section>
        <h2>What the machine computes</h2>
        <p>
          The clerk stands at the center, and the floor is the horizon. The
          outer shell hangs in a ring and turns on an axle once a day, carrying
          the large hole around the sky. With one steady gear that is an
          ordinary sun: it rises once a day, and how long it stays up follows
          from how far the axle leans and where the hole sits, exactly as day
          length on Earth follows from latitude and season.
        </p>
        <p>
          Three more gear trains stand in for the currents in the sea of fire.
          Each speeds and slows the turning and tips the axle on its own period.
          The periods do not match, so the trains drift in and out of step.
          While they cancel one another the days are regular; when they pull
          together the sun runs fast and slow and climbs too high or not at all.
        </p>
        <p>
          Light through the large hole crosses the gap between the shells and
          falls on the inner one as a bright patch: the sun the clerk sees. It
          fans out a little on the way, so a wider gap makes a larger, fainter
          sun. The inner shell, with the small holes that are the stars, turns
          at its own slightly slower pace, so the sun creeps against the stars.
        </p>
        <p>
          The clerk writes down each sunrise and sunset. A day counts as regular
          when its length, its daylight and its sunlight are close to those of a
          standard day, the day the machine would keep with one steady gear. A
          long enough run of regular days is a Stable Era. Everything else is a
          Chaotic Era.
        </p>
      </section>

      <section>
        <h2>What is invented</h2>
        <p>
          Almost all of it. The novel describes the machine in words and gives
          no numbers, and there is no published science of a universe made of
          shells. Every model here is therefore{" "}
          <strong className="spec">speculative</strong>: the gear periods and
          strengths, the sizes of the shells and the hole, how the light
          spreads, how the shells breathe, and the clerk's rule for telling one
          era from the other were all chosen for this site. Only the geometry is
          not made up: turning spheres, a horizon, and where a patch of light
          falls.
        </p>
        <p>
          Nothing was tuned to an outcome in the book, because the book gives
          none to tune to. The gears were set so that the default machine shows
          both kinds of era in a calendar short enough to look through.
        </p>
      </section>

      <section>
        <h2>How it came out</h2>
        <p>
          Over 2,000 days the default machine forecasts 11 Stable Eras, the
          longest 79 days, and is stable about 22% of the time. Its days run
          from 18 to 36 hours. With the currents twice as strong (Rough seas)
          only 2 short Stable Eras are left. With one steady gear (Perfect
          clockwork) the Stable Era never ends.
        </p>
        <p>
          The switches under Models take Mozi's answers back one at a time. With
          one sphere the sun is pinned among the stars, and it cannot change
          size even when the sphere breathes, because the hole swells with the
          sphere. That is why he needed the second shell. The flying stars are
          only dust: they do nothing to the calendar, which is the weakness Wang
          points at.
        </p>
        <p>
          The machine never surprises itself. Its gears repeat, so its calendar
          is certain, whatever the real sky goes on to do.
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
            The clerk's sunlight is one number a day. There is no air, weather
            or temperature, so “mild” means only that the day's sunlight was
            close to a standard day's.
          </li>
          <li>
            The sun is drawn at its true width on the sky map, and the map shows
            the whole sky at once, which no eye does.
          </li>
          <li>
            The dark cloud comes round on a fixed schedule. Mozi called it a
            rare accident.
          </li>
          <li>
            The cutaway shows the light between the shells as a single beam.
            Mozi has it scattered through the whole gap, which is what lights
            the stars.
          </li>
        </ul>
      </section>

      <section>
        <h2>Source</h2>
        <p>
          The novel: Liu Cixin, <cite>The Three-Body Problem</cite>, translated
          by Ken Liu. Tor Books, 2014. First published in Chinese in 2008. No
          scientific paper is cited on this page, because none stands behind the
          machine.
        </p>
      </section>
    </main>
  );
}
