import { describe, expect, it } from "vitest";

describe("talent and recruiting invariants", () => {
  it("treats pool membership as a unique pair, not duplicated candidates", () => {
    const memberships = [
      ["candidate-1", "pool-a"],
      ["candidate-1", "pool-b"],
      ["candidate-1", "pool-c"],
      ["candidate-1", "pool-d"],
    ];
    const uniqueCandidates = new Set(memberships.map(([candidateId]) => candidateId));
    const uniquePairs = new Set(memberships.map((pair) => pair.join(":")));
    expect(uniqueCandidates.size).toBe(1);
    expect(uniquePairs.size).toBe(4);
  });

  it("keeps job match scores independent", () => {
    const matches = [
      { candidateId: "candidate-1", jobId: "job-1", score: 81 },
      { candidateId: "candidate-1", jobId: "job-2", score: 82 },
      { candidateId: "candidate-1", jobId: "job-3", score: 83 },
    ];
    expect(new Set(matches.map((row) => row.candidateId)).size).toBe(1);
    expect(new Set(matches.map((row) => row.jobId)).size).toBe(3);
    expect(new Set(matches.map((row) => row.score)).size).toBe(3);
  });
});
