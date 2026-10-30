import { describe, expect, it } from "vitest";
import { addressKey, normalizeAddress, routeSortKey } from "./address";

describe("normalizeAddress: Utah grid addresses", () => {
  const expected = "1234 N 500 E";
  it.each([
    "1234 N 500 E",
    "1234 North 500 East",
    "1234 n. 500 e.",
    "  1234   NORTH   500   EAST  ",
    "1234 N 500 E, Lehi, UT 84043",
    "1234 N 500 E Lehi UT",
    "1234 N 500 East St",
    "1234 N 500 E 84043",
  ])("%s", (input) => {
    expect(normalizeAddress(input)?.street).toMatch(new RegExp(`^${expected}`));
  });

  it("matches the common variants to the same key", () => {
    expect(addressKey("1234 North 500 East")).toBe(addressKey("1234 n 500 e."));
    expect(addressKey("1234 N 500 E, Lehi, UT 84043")).toBe("1234 N 500 E");
  });

  it("does not confuse different directions or numbers", () => {
    expect(addressKey("1234 N 500 E")).not.toBe(addressKey("1234 S 500 E"));
    expect(addressKey("1234 N 500 E")).not.toBe(addressKey("1243 N 500 E"));
  });

  it("strips ordinal suffixes on grid numbers", () => {
    expect(addressKey("450 W 1100th N")).toBe("450 W 1100 N");
  });
});

describe("normalizeAddress: named streets", () => {
  it("abbreviates suffixes and directions", () => {
    expect(addressKey("88 West Willow Creek Drive")).toBe("88 W WILLOW CRK DR");
    expect(addressKey("88 W. Willow Crk Dr")).toBe("88 W WILLOW CRK DR");
    expect(addressKey("2201 Sage Hollow Lane")).toBe("2201 SAGE HOLW LN");
  });

  it("keeps a street named after a direction word intact in position", () => {
    expect(addressKey("10 North Street")).toBe("10 N ST");
  });
});

describe("normalizeAddress: units", () => {
  it("pulls units off the street line", () => {
    expect(normalizeAddress("500 Main St Apt 12")).toEqual({ street: "500 MAIN ST", unit: "12", key: "500 MAIN ST #12" });
    expect(addressKey("500 Main St #12")).toBe("500 MAIN ST #12");
    expect(addressKey("500 Main St Unit B-3")).toBe("500 MAIN ST #B-3");
  });
  it("accepts a separate unit field", () => {
    expect(addressKey("500 Main St", "12")).toBe("500 MAIN ST #12");
    expect(addressKey("500 Main St", "Apt 12")).toBe("500 MAIN ST #12");
    expect(addressKey("500 Main St", "#12")).toBe("500 MAIN ST #12");
  });
  it("treats with and without unit as different homes", () => {
    expect(addressKey("500 Main St")).not.toBe(addressKey("500 Main St #12"));
  });
});

describe("normalizeAddress: rejects unusable input", () => {
  it.each(["", "Main Street", "PO", "   "])("%j", (input) => {
    expect(normalizeAddress(input)).toBeNull();
  });
});

describe("routeSortKey", () => {
  it("groups by street, then house number", () => {
    const keys = ["1300 N 500 E", "1234 N 500 E", "88 W WILLOW CRK DR"];
    const sorted = [...keys].sort((a, b) => {
      const [sa, na] = routeSortKey(a);
      const [sb, nb] = routeSortKey(b);
      return sa === sb ? na - nb : sa.localeCompare(sb);
    });
    expect(sorted).toEqual(["1234 N 500 E", "1300 N 500 E", "88 W WILLOW CRK DR"]);
  });
});
