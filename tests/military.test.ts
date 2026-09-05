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
});
