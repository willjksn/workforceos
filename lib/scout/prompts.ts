export function suggestedScoutPrompts(module: string, entityType: string | null) {
  if (entityType === "candidate" || module === "talent") {
    return [
      "Find matching jobs",
      "Draft follow-up",
      "Show communication history",
      "Summarize this candidate",
      "Find similar candidates",
    ];
  }
  if (entityType === "job" || module === "recruiting") {
    return [
      "Find internal candidates",
      "Find SkillBridge candidates",
      "Show military matches",
      "Draft outreach",
      "Show pipeline risks",
    ];
  }
  if (module === "skillbridge") {
    return [
      "Who needs follow-up?",
      "Windows opening in 90 days",
      "Candidates without opportunities",
      "Draft check-in messages",
      "Employer feedback overdue",
    ];
  }
  if (entityType === "company" || module === "crm") {
    return [
      "Summarize workforce activity",
      "Show open roles",
      "Show military talent opportunities",
      "Show active projects",
      "Show outstanding follow-ups",
    ];
  }
  return [
    "Who needs my attention today?",
    "Show SkillBridge candidates with no opportunity",
    "Show SkillBridge windows opening in 90 days",
    "Today's priorities",
  ];
}
