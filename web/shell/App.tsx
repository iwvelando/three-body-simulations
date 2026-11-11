import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { Engine } from "./engine";
import { simulations, type SimulationProps } from "./registry";
import { Theme } from "./Theme";

const pages = new Map<string, ComponentType<SimulationProps>>(
  simulations.map((s) => [s.id, lazy(s.load)]),
);

function useHash(): string {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return hash;
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

  const hash = useHash();
  const match = /^#\/([a-z0-9-]+)(.*)$/.exec(hash);
  const sim = match && simulations.find((s) => s.id === match[1]);
  const Page = sim ? pages.get(sim.id)! : null;
  const rest = match ? match[2] : "";
  useEffect(() => {
    document.title = sim
      ? `${sim.title} — Three-Body Simulations`
      : "Three-Body Simulations — Earth without life";
  }, [sim]);

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
    if (Page && engine)
      return (
        <Suspense fallback={<main className="page" aria-busy="true" />}>
          <Page engine={engine} rest={rest} />
        </Suspense>
      );
    return <Home />;
  }, [failure, Page, engine, rest]);

  return (
    <>
      <header className="masthead">
        <a className="wordmark" href="#/">
          Three-Body Simulations
        </a>
        <Theme />
      </header>
      {body}
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

function Home() {
  return (
    <main className="page home">
      <h1>Three-Body Simulations</h1>
      <p className="lede">
        Scenes from the trilogy where someone sits down at a computer and runs
        the universe forward, rebuilt so you can run them too.
      </p>
      <ul className="sims">
        {simulations.map((s) => (
          <li key={s.id}>
            <a href={`#/${s.id}`}>
              <span className="sim-title">{s.title}</span>
              <span className="sim-blurb">{s.blurb}</span>
              <span className="sim-source">
                From <cite>{s.source}</cite>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="more">More simulations will join these.</p>
    </main>
  );
}
