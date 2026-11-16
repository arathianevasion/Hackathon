import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed/seed";
import { openStore, type Store } from "./store";

const RUN_DATE = new Date("2026-11-16T15:00:00Z");

describe("store", () => {
  let store: Store;
  afterEach(() => store.close());

  it("starts empty", () => {
    store = openStore(":memory:");
    expect(store.seededOn()).toBeNull();
    expect(store.list("clients")).toEqual([]);
  });

  it("holds exactly the seed after a reset", () => {
    store = openStore(":memory:");
    store.reset(RUN_DATE);
    const seed = buildSeed(RUN_DATE);
    expect(store.agent()).toEqual(seed.agent);
    expect(store.list("clients")).toEqual(seed.clients);
    expect(store.list("dmis")).toEqual(seed.dmis);
    expect(store.list("documents")).toEqual(seed.documents);
    expect(store.list("consentRecords")).toEqual(seed.consentRecords);
    expect(store.list("escalations")).toEqual(seed.escalations);
    expect(store.list("notifications")).toEqual(seed.notifications);
    expect(store.list("actionLog")).toEqual(seed.actionLog);
    expect(store.list("messages")).toEqual([]);
  });

  it("records the run date it was seeded on", () => {
    store = openStore(":memory:");
    expect(store.seededOn()).toBeNull();
    store.reset(RUN_DATE);
    expect(store.seededOn()).toBe("2026-11-16");
  });

  it("replaces whatever was there on reset, with dates from the new run date", () => {
    store = openStore(":memory:");
    store.reset(new Date("2026-10-01T09:00:00Z"));
    store.reset(RUN_DATE);
    expect(store.list("clients")).toHaveLength(20);
    expect(store.list("dmis")).toEqual(buildSeed(RUN_DATE).dmis);
  });
});
