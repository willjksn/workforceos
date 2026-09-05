import { getIntegrationHubStatus } from "@/lib/integrations/hub";
import { requireCurrentPrincipal } from "@/lib/auth/session";

export default async function IntegrationsAdminPage() {
  await requireCurrentPrincipal();
  const providers = await getIntegrationHubStatus();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Integration Hub</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Provider</th>
            <th>Configured</th>
            <th>Health</th>
            <th>Last sync</th>
            <th>Last error</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr key={provider.provider} className="border-b">
              <td className="py-2">{provider.provider}</td>
              <td>{provider.configured ? "yes" : "no"}</td>
              <td>{provider.connectionHealth}</td>
              <td>{provider.lastSyncAt?.toISOString() ?? "—"}</td>
              <td>{provider.lastError ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
