import { Logo } from "@/components/brand/logo";
import { SERVICES } from "@/lib/content";

const columns = [
  {
    title: "Solutions",
    links: [
      ...SERVICES.map((service) => ({ href: `/services/${service.slug}`, label: service.name })),
      { href: "/workforce-development", label: "Workforce Development" },
    ],
  },
  {
    title: "Talent",
    links: [
      { href: "/military-talent", label: "Military Talent" },
      { href: "/skillbridge", label: "SkillBridge" },
      { href: "/careers", label: "Careers" },
      { href: "/skillbridge/join", label: "Join the network" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/industries", label: "Industries" },
      { href: "/insights", label: "Insights" },
      { href: "/contact", label: "Work With PierOne" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/candidate-privacy", label: "Candidate privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto w-full shrink-0 bg-navy text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="shrink-0">
            <Logo variant="horizontal" tone="onNavy" />
          </div>
          <div className="grid w-full flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">{column.title}</div>
                <ul className="mt-2 space-y-1 text-[13px] leading-6 text-white/80">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.href}-${link.label}`}>
                      <a href={link.href} className="hover:text-white">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2 border-t border-white/15 pt-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PierOne Partners. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="/privacy" className="hover:text-white">
              Privacy
            </a>
            <a href="/candidate-privacy" className="hover:text-white">
              Candidate privacy
            </a>
            <a href="/terms" className="hover:text-white">
              Terms
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
