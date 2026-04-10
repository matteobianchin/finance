import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { WatchlistProvider, useWatchlist } from "@/components/providers/WatchlistProvider";

const STORAGE_KEY = "openbb_watchlist";

// Wrap every renderHook call with WatchlistProvider (hook requires context)
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WatchlistProvider>{children}</WatchlistProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe("useWatchlist", () => {
  it("returns default watchlist when localStorage is empty", () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    expect(result.current.tickers).toEqual(["AAPL", "MSFT", "NVDA", "GOOGL"]);
  });

  it("loads persisted watchlist from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["TSLA", "AMZN"]));
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    expect(result.current.tickers).toEqual(["TSLA", "AMZN"]);
  });

  it("add() appends a new ticker and persists to localStorage", () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });

    act(() => {
      result.current.add("TSLA");
    });

    expect(result.current.tickers).toContain("TSLA");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toContain("TSLA");
  });

  it("add() normalizes ticker to uppercase", () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });

    act(() => {
      result.current.add("tsla");
    });

    expect(result.current.tickers).toContain("TSLA");
    expect(result.current.tickers).not.toContain("tsla");
  });

  it("add() does not add duplicate tickers", () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });

    act(() => {
      result.current.add("AAPL"); // già nel default
    });

    const count = result.current.tickers.filter((t: string) => t === "AAPL").length;
    expect(count).toBe(1);
  });

  it("add() ignores empty string", () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    const initialLength = result.current.tickers.length;

    act(() => {
      result.current.add("   ");
    });

    expect(result.current.tickers.length).toBe(initialLength);
  });

  it("remove() elimina un ticker e persiste", () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });

    act(() => {
      result.current.remove("AAPL");
    });

    expect(result.current.tickers).not.toContain("AAPL");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).not.toContain("AAPL");
  });

  it("remove() su ticker inesistente non causa errori", () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    const initialLength = result.current.tickers.length;

    act(() => {
      result.current.remove("NONEXISTENT");
    });

    expect(result.current.tickers.length).toBe(initialLength);
  });
});
