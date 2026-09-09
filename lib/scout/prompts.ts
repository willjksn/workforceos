export function suggestedScoutPrompts(module: string, entityType: string | null) {
  if (entityType === "candidate" || module === "talent") {
    return [
      "Find matching jobs",
      "Draft follow-up",
      "Show communication history",
      "Summarize this candidate",
      "Find employer opportunities for this transitioning service member",
    ];
  }
  if (entityType === "job" || module === "recruiting") {
    return [
      "Find internal candidates",
      "Find transitioning service members",
      "Show military matches",
      "Draft outreach",
      "Show pipeline risks",
    ];
  }
  if (module === "skillbridge") {
    return [
      "Who needs follow-up?",
      "Show my Military Talent queue",
      "Show military talent with a SkillBridge window in the next 90 days",
      "Show transitioning service members who need an employer match",
      "Show SkillBridge-eligible employer opportunities",
      "Show military placements likely to convert",
    ];
  }
  if (module === "academy") {
    return [
      "Open the Academy",
      "How do I use Scout?",
      "How do I run a professional search?",
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
    "Show transitioning service members who do not have an employer match",
    "Show unmatched military talent",
    "Today's priorities",
  ];
}
