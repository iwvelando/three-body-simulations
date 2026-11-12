import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Engine } from "./engine";
import { simulations, type SimulationProps } from "./registry";
import { Theme } from "./Theme";

const pages = new Map<string, ComponentType<SimulationProps>>(
  simulations.map((s) => [s.id, lazy(s.load)]),
);

// The address, and how many times the visitor has arrived at one. A view
// rewrites its own address as its settings change, which is not an
// arrival; following a link, pasting one or going back is, even when it
// leads to an address this page last saw.
function useHash(): { hash: string; arrival: number } {
  const [at, setAt] = useState(() => ({ hash: location.hash, arrival: 0 }));
  useEffect(() => {
    const update = () =>
      setAt((was) => ({ hash: location.hash, arrival: was.arrival + 1 }));
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return at;
}

export function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const e = new Engine();
    let live = true;
    setFailure("");
    setEngine(e);
    e.ready.then(
      () => live && (document.documentElement.dataset.engine = "ready"),
      (error: Error) => live && setFailure(error.message),
    );
    return () => {
      live = false;
      delete document.documentElement.dataset.engine;
      e.dispose();
    };
  }, [attempt]);

  // The list of simulations names scenes from all three books, so it
  // waits for a visitor to say they do not mind. Asked once a visit:
  // nothing but the theme is stored.
  const [warned, setWarned] = useState(false);
  const { hash, arrival } = useHash();
  const match = /^#\/([a-z0-9-]+)(.*)$/.exec(hash);
  const sim = match && simulations.find((s) => s.id === match[1]);
  const Page = sim ? pages.get(sim.id)! : null;
  const rest = match ? match[2] : "";
  useEffect(() => {
    document.title = sim
      ? `${sim.title} — Three-Body Simulations`
      : "Three-Body Simulations";
  }, [sim]);

  // A page the visitor has not been to starts at its top, with the
  // keyboard and a screen reader at its start too. Going back or forward
  // is left to the browser, which remembers where the visitor was: each
  // history entry is marked once it has been seen.
  const view = useRef<HTMLDivElement>(null);
  const path = hash.split("?")[0];
  const first = useRef(true);
  useEffect(() => {
    const seen = history.state?.seen === true;
    if (!seen)
      history.replaceState({ ...history.state, seen: true }, "", location.href);
    if (first.current) {
      first.current = false;
      return;
    }
    if (seen) return;
    scrollTo(0, 0);
    view.current?.focus({ preventScroll: true });
  }, [path]);

  const body = useMemo(() => {
    if (failure)
      return (
        <main className="page notice-page">
          <p role="alert">{failure}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Start the engine again
          </button>
        </main>
      );
    // The engine is made a moment after the first paint; a simulation
    // asked for by its address waits for it rather than show the list.
    if (Page && !engine) return <main className="page" aria-busy="true" />;
    if (Page && engine)
      return (
        <Suspense fallback={<main className="page" aria-busy="true" />}>
          <Page engine={engine} rest={rest} arrival={arrival} />
        </Suspense>
      );
    return <Home warned={warned} onWarned={() => setWarned(true)} />;
  }, [failure, Page, engine, rest, arrival, warned]);

  return (
    <>
      <header className="masthead">
        <a className="wordmark" href="#/">
          Three-Body Simulations
        </a>
        <Theme />
      </header>
      <div className="view" ref={view} tabIndex={-1}>
        {body}
      </div>
      <footer className="colophon">
        <p>
          An unofficial fan project. Simulations inspired by scenes in Liu
          Cixin's <cite>Remembrance of Earth's Past</cite> trilogy, built from
          published science. Everything runs in your browser.
        </p>
        <p>
          <a href="./THIRD-PARTY-NOTICES.txt">Open-source notices</a>
        </p>
      </footer>
    </>
  );
}

const source = "https://github.com/iwvelando/three-body-simulations";

function Home({ warned, onWarned }: { warned: boolean; onWarned: () => void }) {
  return (
    <main className="page home">
      <h1>Three-Body Simulations</h1>
      <p className="lede">
        Scenes from Liu Cixin's trilogy that turn on an idea you can work
        through, rebuilt as simulations you can run and change.
      </p>
      {warned ? (
        <ul className="sims">
          {simulations.map((s) => (
            <li key={s.id}>
              <a href={`#/${s.id}`}>
                <span className="sim-words">
                  <span className="sim-title">{s.title}</span>
                  <span className="sim-blurb">{s.blurb}</span>
                  <span className="sim-source">
                    From <cite>{s.source}</cite>
                  </span>
                </span>
                <s.icon />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <section className="spoilers" aria-labelledby="spoilers-title">
          <h2 id="spoilers-title">Before you go on</h2>
          <p>
            These pages contain spoilers for all three books of{" "}
            <cite>Remembrance of Earth's Past</cite>:{" "}
            <cite>The Three-Body Problem</cite>, <cite>The Dark Forest</cite>{" "}
            and <cite>Death's End</cite>, including how the last one ends. Even
            the names of the simulations give things away.
          </p>
          <button type="button" className="primary" onClick={onWarned}>
            I understand, show the simulations
          </button>
        </section>
      )}
      <section className="about" aria-labelledby="about-title">
        <h2 id="about-title">About this site</h2>
        <p>
          An unofficial fan project, with no connection to the author, his
          translators or his publishers. Each simulation says which parts come
          from published science and which were invented to fill in what the
          novels leave out. Everything runs in your browser.
        </p>
        <p>
          The site is open source. The code, the models and their sources are{" "}
          <a href={source}>on GitHub</a>.
        </p>
      </section>
    </main>
  );
}
