import type { MetadataRoute } from "next";

import { SERVICES, siteUrl } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const paths = [
    "",
    "/what-we-do",
    "/military-talent",
    "/workforce-development",
    "/industries",
    "/careers",
    "/about",
    "/insights",
    "/contact",
    "/skillbridge",
    "/skillbridge/join",
    "/military-talent/join",
    "/privacy",
    "/candidate-privacy",
    "/terms",
    ...SERVICES.map((service) => `/services/${service.slug}`),
  ];
  return paths.map((path) => ({
    url: `${base}${path || "/"}`,
    changeFrequency: path === "/careers" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
