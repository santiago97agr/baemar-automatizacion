import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  isLoginBlocked,
  recordFailedLogin,
  clearLoginAttempts,
  getRemainingBlockSeconds,
  __resetRateLimitForTests,
} from "@/lib/auth-rate";

describe("Login rate limit", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it("permite hasta 5 intentos fallidos", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i += 1) {
      recordFailedLogin(ip);
    }
    assert.equal(isLoginBlocked(ip), true);
  });

  it("limpia el contador tras login exitoso", () => {
    const ip = "1.2.3.4";
    recordFailedLogin(ip);
    recordFailedLogin(ip);
    clearLoginAttempts(ip);
    assert.equal(isLoginBlocked(ip), false);
  });

  it("reporta segundos restantes cuando está bloqueado", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i += 1) recordFailedLogin(ip);
    const remaining = getRemainingBlockSeconds(ip);
    assert.ok(remaining > 0);
    assert.ok(remaining <= 15 * 60);
  });
});
