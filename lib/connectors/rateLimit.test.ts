import { availableTokens, resetRateLimit, tryAcquire } from "./rateLimit";

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("uses the configured capacity and refill rate per connector", () => {
    const options = { capacity: 2, refillRate: 0.01, timeoutMs: 10 };

    expect(tryAcquire("weather", options)).toBe(true);
    expect(tryAcquire("weather", options)).toBe(true);
    expect(tryAcquire("weather", options)).toBe(false);
    expect(availableTokens("weather", options)).toBeLessThan(1);
  });
});
