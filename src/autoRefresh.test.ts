import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAutoRefresh } from "./autoRefresh";

describe("startAutoRefresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refreshes on every interval until stopped", () => {
    const refresh = vi.fn();
    const stop = startAutoRefresh(refresh, 2000, () => false);
    vi.advanceTimersByTime(6000);
    expect(refresh).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(6000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("skips a refresh while the page is busy (a half-typed reply, an upload in progress) and resumes after", () => {
    const refresh = vi.fn();
    let busy = true;
    startAutoRefresh(refresh, 2000, () => busy)
    vi.advanceTimersByTime(6000);
    expect(refresh).not.toHaveBeenCalled();
    busy = false;
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
