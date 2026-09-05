import { describe, expect, it } from "vitest";

import { militaryBranchEnum, militaryClassificationTypeEnum } from "../db/schema/enums";

describe("military schema support", () => {
  it("supports all required branches and classification types", () => {
    expect(militaryBranchEnum.enumValues).toEqual([
      "army",
      "navy",
      "air_force",
      "marine_corps",
      "coast_guard",
      "space_force",
    ]);
    expect(militaryClassificationTypeEnum.enumValues).toEqual([
      "mos",
      "rating",
      "afsc",
      "specialty",
    ]);
  });

  it("treats reverse search as civilian-to-military, not a universal score", () => {
    const hits = [
      { civilianTitle: "Electrical Technician", militaryCode: "EM" },
      { civilianTitle: "Maintenance Electrician", militaryCode: "EM" },
    ];
    expect(new Set(hits.map((hit) => hit.militaryCode)).size).toBe(1);
    expect(new Set(hits.map((hit) => hit.civilianTitle)).size).toBe(2);
  });
});
