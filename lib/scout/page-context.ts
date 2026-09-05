export type ScoutPageContext = {
  pathname: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTITY_ROUTES: Array<{ prefix: string; entityType: string; module: string }> = [
  { prefix: "/app/military/skillbridge/", entityType: "skillbridge_profile", module: "skillbridge" },
  { prefix: "/app/talent/", entityType: "candidate", module: "talent" },
  { prefix: "/app/jobs/", entityType: "job", module: "recruiting" },
  { prefix: "/app/companies/", entityType: "company", module: "crm" },
  { prefix: "/app/contacts/", entityType: "contact", module: "crm" },
  { prefix: "/app/opportunities/", entityType: "opportunity", module: "crm" },
  { prefix: "/app/projects/", entityType: "project", module: "projects" },
  { prefix: "/app/military/occupations/", entityType: "military_occupation", module: "military" },
];

function moduleFromPath(pathname: string) {
  if (pathname.startsWith("/app/military/skillbridge")) return "skillbridge";
  if (pathname.startsWith("/app/military")) return "military";
  if (pathname.startsWith("/app/talent")) return "talent";
  if (pathname.startsWith("/app/jobs") || pathname.startsWith("/app/pipeline") || pathname.startsWith("/app/search-projects")) {
    return "recruiting";
  }
  if (pathname.startsWith("/app/companies") || pathname.startsWith("/app/contacts") || pathname.startsWith("/app/opportunities")) {
    return "crm";
  }
  if (pathname.startsWith("/app/workforce")) return "workforce";
  if (pathname.startsWith("/app/projects")) return "projects";
  if (pathname.startsWith("/app/finance")) return "finance";
  if (pathname.startsWith("/app/reports")) return "reports";
  if (pathname === "/app") return "command_center";
  return "app";
}

export function parseScoutPageContext(pathname: string | null | undefined): ScoutPageContext {
  const path = pathname && pathname.startsWith("/") ? pathname : "/app";
  for (const route of ENTITY_ROUTES) {
    if (!path.startsWith(route.prefix)) continue;
    const rest = path.slice(route.prefix.length).split("/")[0] ?? "";
    if (UUID.test(rest)) {
      return {
        pathname: path,
        module: route.module,
        entityType: route.entityType,
        entityId: rest,
      };
    }
  }
  return {
    pathname: path,
    module: moduleFromPath(path),
    entityType: null,
    entityId: null,
  };
}
