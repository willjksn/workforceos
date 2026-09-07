import { describe, expect, it } from "vitest";

import { parseResumeText } from "../lib/hiring/resume-parse";

const SAMPLE = `
Will Jackson
Maintenance Electrician
Norfolk, VA
willjackson1914@gmail.com
(757) 555-0100
https://www.linkedin.com/in/willjackson
12 years of experience

Experience
Maintenance Electrician
Harbor Manufacturing
Led a crew of electricians on industrial upgrades.

Electrical Technician
Navy
Shipboard electrical maintenance and troubleshooting.

Skills
PLC, OSHA, Electrical, Troubleshooting, Leadership, Excel
`;

describe("parseResumeText", () => {
  it("extracts contact, title, location, experience, and skills from a sample resume", () => {
    const parsed = parseResumeText(SAMPLE);
    expect(parsed.email).toBe("willjackson1914@gmail.com");
    expect(parsed.phone).toBe("7575550100");
    expect(parsed.linkedinUrl).toBe("https://www.linkedin.com/in/willjackson");
    expect(parsed.city).toBe("Norfolk");
    expect(parsed.region).toBe("VA");
    expect(parsed.yearsExperience).toBe(12);
    expect(parsed.currentTitle).toBe("Maintenance Electrician");
    expect(parsed.currentCompany).toBe("Harbor Manufacturing");
    expect(parsed.experiences).toEqual([
      {
        title: "Maintenance Electrician",
        employer: "Harbor Manufacturing",
        summary: "Led a crew of electricians on industrial upgrades.",
      },
      {
        title: "Electrical Technician",
        employer: "Navy",
        summary: "Shipboard electrical maintenance and troubleshooting.",
      },
    ]);
    expect(parsed.skillNames).toEqual([
      "PLC",
      "OSHA",
      "Electrical",
      "Troubleshooting",
      "Leadership",
      "Excel",
    ]);
    expect(parsed.careerInterests).toContain("PLC");
  });

  it("does not invent contact fields when they are absent", () => {
    const parsed = parseResumeText("Jane Example\nWarehouse Associate\nExperience\nPicker\nAcme Logistics\nMoved freight.");
    expect(parsed.email).toBeNull();
    expect(parsed.phone).toBeNull();
    expect(parsed.linkedinUrl).toBeNull();
    expect(parsed.currentTitle).toBe("Picker");
    expect(parsed.currentCompany).toBe("Acme Logistics");
  });
});
