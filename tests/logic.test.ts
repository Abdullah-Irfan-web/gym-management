import { test } from "node:test";
import assert from "node:assert/strict";
import { computeExpiry, computeStatus, addDaysStr, todayIn } from "../utils/dates";
import { renewalStart } from "../services/membership";
import { signToken, verifyToken } from "../lib/auth/tokens";
import { normPhone } from "../utils/misc";

process.env.RENEWAL_LINK_SECRET = "unit-test-secret-1234567890";

test("expiry is inclusive and handles month-ends", () => {
  assert.equal(computeExpiry("2026-01-01", 1, "month"), "2026-01-31");
  assert.equal(computeExpiry("2026-01-31", 1, "month"), "2026-02-27"); // Jan31+1mo clamps to Feb 28, minus 1 day
  assert.equal(computeExpiry("2026-03-31", 1, "month"), "2026-04-29");
});
test("leap years", () => {
  assert.equal(computeExpiry("2028-01-31", 1, "month"), "2028-02-28"); // Feb 29 2028 - 1
  assert.equal(computeExpiry("2028-02-01", 1, "month"), "2028-02-29");
  assert.equal(computeExpiry("2027-03-01", 12, "month"), "2028-02-29");
});
test("status: Active / Expired / Inactive with 20-day grace", () => {
  assert.equal(computeStatus("2026-11-14", "2026-11-14", 20), "Active");
  assert.equal(computeStatus("2026-11-14", "2026-11-15", 20), "Expired");
  assert.equal(computeStatus("2026-11-14", "2026-12-04", 20), "Expired"); // day 20
  assert.equal(computeStatus("2026-11-14", "2026-12-05", 20), "Inactive"); // day 21
});
test("renewal start: active -> day after expiry; lapsed -> today", () => {
  assert.equal(renewalStart("2026-11-20", "2026-11-14"), "2026-11-21");
  assert.equal(renewalStart("2026-11-14", "2026-11-14"), "2026-11-15"); // expires today, still active
  assert.equal(renewalStart("2026-11-10", "2026-11-14"), "2026-11-14");
  assert.equal(renewalStart("2026-01-01", "2026-11-14"), "2026-11-14"); // inactive -> reactivate from today
});
test("timezone-aware today", () => {
  const t = new Date("2026-11-14T20:00:00Z"); // 01:30 next day in IST
  assert.equal(todayIn("Asia/Kolkata", t), "2026-11-15");
  assert.equal(todayIn("UTC", t), "2026-11-14");
  assert.equal(addDaysStr("2026-02-28", 1), "2026-03-01");
});
test("tokens: valid, tampered, wrong kind, expired", () => {
  const t = signToken("renew", "GYM-1", 60);
  assert.equal(verifyToken("renew", t), "GYM-1");
  assert.equal(verifyToken("receipt", t), null);
  assert.equal(verifyToken("renew", t.slice(0, -2) + "xx"), null);
  assert.equal(verifyToken("renew", signToken("renew", "GYM-1", -1)), null);
});
test("phone normalisation", () => { assert.equal(normPhone("+91 98765-43210"), "9876543210"); });
