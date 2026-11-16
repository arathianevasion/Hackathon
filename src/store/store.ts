import { DatabaseSync } from "node:sqlite";
import type { Agent } from "../contract";
import { buildSeed, type SeedData } from "../seed/seed";

/** The entity collections the store holds, named as in `SeedData`. */
export type Collection = Exclude<keyof SeedData, "agent" | "scenarioOf">;
type Row<C extends Collection> = SeedData[C][number];

const COLLECTIONS: readonly Collection[] = [
  "clients",
  "households",
  "enrollments",
  "dmis",
  "documents",
  "consentRecords",
  "messages",
  "escalations",
  "notifications",
  "actionLog",
];

/** The demo's SQLite database: the Agent and the entity collections. */
export interface Store {
  isEmpty(): boolean;
  /** Wipes everything and writes a fresh seed dated from `runDate`. */
  reset(runDate: Date): void;
  agent(): Agent | null;
  list<C extends Collection>(collection: C): Row<C>[];
  close(): void;
}

/**
 * Opens (and creates, if needed) the store at `path`, or `:memory:`.
 * Each entity is one row of its contract type as JSON, keyed by id and kept
 * in insertion order; the contract types are the schema.
 */
export function openStore(path: string): Store {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS agents (seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, data TEXT NOT NULL)`);
  for (const c of COLLECTIONS) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${c} (seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, data TEXT NOT NULL)`);
  }

  const insert = (table: string, row: { id: string }) =>
    db.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?)`).run(row.id, JSON.stringify(row));
  const read = (table: string) =>
    (db.prepare(`SELECT data FROM ${table} ORDER BY seq`).all() as { data: string }[]).map((r) => JSON.parse(r.data));

  return {
    isEmpty: () => read("agents").length === 0,
    reset(runDate) {
      const seed = buildSeed(runDate);
      db.exec("BEGIN");
      try {
        db.exec("DELETE FROM agents");
        insert("agents", seed.agent);
        for (const c of COLLECTIONS) {
          db.exec(`DELETE FROM ${c}`);
          for (const row of seed[c]) insert(c, row);
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    agent: () => read("agents")[0] ?? null,
    list: (collection) => read(collection),
    close: () => db.close(),
  };
}
