import { describe, expect, it } from "vitest";
import { parseAddressCsv, toCsv } from "./csv";

describe("parseAddressCsv", () => {
  it("finds the address column by header name", () => {
    const csv = "Owner,Property Address,City\nJane,1234 N 500 E,Lehi\nBob,88 W Willow Creek Dr,Lehi";
    expect(parseAddressCsv(csv)).toEqual([
      { row: 2, street: "1234 N 500 E", unit: "" },
      { row: 3, street: "88 W Willow Creek Dr", unit: "" },
    ]);
  });
  it("reads a separate unit column", () => {
    expect(parseAddressCsv("address,unit\n500 Main St,12")).toEqual([{ row: 2, street: "500 Main St", unit: "12" }]);
  });
  it("accepts a bare list with no header", () => {
    expect(parseAddressCsv("1234 N 500 E\n1300 N 500 E")).toHaveLength(2);
  });
  it("handles quoted commas", () => {
    expect(parseAddressCsv('address\n"1234 N 500 E, Lehi, UT 84043"')[0].street).toBe("1234 N 500 E, Lehi, UT 84043");
  });
});

describe("toCsv", () => {
  it("quotes values with commas", () => {
    expect(toCsv([["a", "b,c"], [1, null]])).toBe('a,"b,c"\r\n1,');
  });
});
