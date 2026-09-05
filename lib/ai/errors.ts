export class AgentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "rbac"
      | "autonomy"
      | "forbidden"
      | "cost_limit"
      | "circuit_open"
      | "prompt"
      | "provider"
      | "approval"
      | "config"
      | "not_found" = "config",
  ) {
    super(message);
    this.name = "AgentError";
  }
}
