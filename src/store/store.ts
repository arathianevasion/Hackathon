import { DatabaseSync } from "node:sqlite";
import type { Agent, IsoDate } from "../contract";
import { toIsoDate } from "../dates";
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
  "portalLinks",
  "documentFiles",
];

/** The demo's SQLite database: the Agent and the entity collections. */
export interface Store {
  /** The run date of the last reset, or null while the store is empty. */
  seededOn(): IsoDate | null;
  /** Wipes everything and writes a fresh seed dated from `runDate`. */
  reset(runDate: Date): void;
  agent(): Agent | null;
  list<C extends Collection>(collection: C): Row<C>[];
  /** Appends a row to the end of a collection. */
  add<C extends Collection>(collection: C, row: Row<C>): void;
  /** Replaces the row with the same id; throws when there is none. */
  update<C extends Collection>(collection: C, row: Row<C>): void;
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
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  for (const c of COLLECTIONS) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${c} (seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, data TEXT NOT NULL)`);
  }

  const insert = (table: string, row: { id: string }) =>
    db.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?)`).run(row.id, JSON.stringify(row));
  const read = (table: string) =>
    (db.prepare(`SELECT data FROM ${table} ORDER BY seq`).all() as { data: string }[]).map((r) => JSON.parse(r.data));

  return {
    seededOn: () =>
      (db.prepare(`SELECT value FROM meta WHERE key = 'seeded_on'`).get() as { value: string } | undefined)?.value ?? null,
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
        db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_on', ?)`).run(toIsoDate(runDate));
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    agent: () => read("agents")[0] ?? null,
    list: (collection) => read(collection),
    add: (collection, row) => {
      insert(collection, row);
    },
    update(collection, row) {
      const { changes } = db.prepare(`UPDATE ${collection} SET data = ? WHERE id = ?`).run(JSON.stringify(row), row.id);
      if (changes === 0) throw new Error(`No ${collection} row with id ${row.id}`);
    },
    close: () => db.close(),
  };
}
