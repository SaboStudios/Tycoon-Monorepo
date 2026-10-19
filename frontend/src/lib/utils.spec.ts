import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("cn", () => {
  it("omits falsy and conditional inputs", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c")
  })

  it("concatenates plain class strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c")
  })

  it("resolves conflicting Tailwind utilities to the later class only", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("handles object inputs", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe(
      "text-red-500"
    )
  })

  it("handles array inputs", () => {
    expect(cn(["a", "b"])).toBe("a b")
  })
})
