import { describe, it, expect } from "vitest"
import { hasActiveAccess } from "./access"

describe("hasActiveAccess", () => {
  it("grants access for active, trialing, and past_due", () => {
    expect(hasActiveAccess("active")).toBe(true)
    expect(hasActiveAccess("trialing")).toBe(true)
    expect(hasActiveAccess("past_due")).toBe(true)
  })

  it("denies access for canceled, unpaid, incomplete, and paused", () => {
    expect(hasActiveAccess("canceled")).toBe(false)
    expect(hasActiveAccess("unpaid")).toBe(false)
    expect(hasActiveAccess("incomplete")).toBe(false)
    expect(hasActiveAccess("incomplete_expired")).toBe(false)
    expect(hasActiveAccess("paused")).toBe(false)
  })

  it("denies access when there is no subscription row", () => {
    expect(hasActiveAccess(null)).toBe(false)
    expect(hasActiveAccess(undefined)).toBe(false)
  })

  it("denies access for an unrecognized status string", () => {
    expect(hasActiveAccess("not_a_real_status")).toBe(false)
  })
})
