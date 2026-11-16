import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openStore, type Store } from "./store";

const DATA_DIR = join(process.cwd(), ".data");

let demo: Store | undefined;

/** The app's one store, seeded from today the first time it is opened empty. */
export function demoStore(): Store {
  if (!demo) {
    mkdirSync(DATA_DIR, { recursive: true });
    demo = openStore(join(DATA_DIR, "demo.sqlite"));
    if (demo.isEmpty()) demo.reset(new Date());
  }
  return demo;
}
