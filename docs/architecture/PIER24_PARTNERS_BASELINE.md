# Pier 24 Partners baseline

Status: post-modernization baseline. M1–M10 are complete. M10 is on `main` at `9c6462747ca5ebf412150ef7d89c0b5fb239e86c` (PR #11, approved head `5a71e1fea88e0e0482cbb9611bfdca698756852f`). This file is the current-state architecture summary. It is not a historical milestone record. Do not open M11, M12, or M13 as a continuation of this program.

## Commercial architecture

```
PIER 24
├─ Pier 24 Partners — Workforce & Talent Solutions
└─ Pier24 Solutions — AI & Business Technology
```

Pier 24 Partners and Pier24 Solutions are sibling companies. They are not one product. WorkforceOS is the internal operating platform for Pier 24 Partners. Preferred product line: WorkforceOS by Pier 24 Partners.

Pier 24 Partners is a workforce and talent solutions firm. It is not positioned as an AI company, a recruiting software company, a SkillBridge company, a staffing agency, or a military-only recruiting firm.

Core statement: we help organizations build the workforce they need today and prepare for the workforce they will need tomorrow.

Operating model, where public and service copy describes how the firm works:

SOLVE — understand the workforce problem.  
BUILD — create the talent and pipeline solution.  
OPERATE — run and improve the solution.

## Commercial offers

The public site leads with:

1. Professional & Technical Search
2. Military Talent Opportunity Assessment
3. Workforce Pipeline Assessment

Talent Acquisition Performance Assessment and Fractional Talent Partner remain in the catalog and at their existing URLs. They are not featured in public navigation.

SkillBridge operations, applicant processing, interviewing, onboarding, military translation, public opportunity discovery, candidate matching, research, sourcing, Scout, and WorkforceOS support delivery. They are not additional public offers.

Primary sectors: Energy & Utilities, Advanced Manufacturing, Infrastructure, Industrial / Technical Operations, and Technology. Do not name a company as an industry. Secondary sectors: Data Centers, Aerospace & Defense, Engineering, and Supply Chain & Logistics. Geography is not hard-coded through the product.

## System capabilities

Talent Network, Military Talent Network, Transition Talent Profile, Military Capability Translation, Opportunity Discovery, Opportunity Matching, Routing & Outreach, Workforce Pipeline, Command Center, Scout, and Outcome Learning.

`jobs` remain employer demand. CRM opportunities remain commercial pursuits. A monitored public job is a Public opportunity. SkillBridge is one pathway. Direct hire remains equally valid. Public copy does not guarantee placement, interview, employer response, SkillBridge approval, employment, or conversion.

## What M10 changed

User-facing company naming, the app-shell wordmark, public-site positioning, email and notification copy, metadata, and current product documentation.

## What M10 left in place

- Repository `willjksn/workforceos`
- Vercel project `pierone-public` and hosts `pieronepartners.com` and `app.pieronepartners.com`
- Directory `sites/pierone`
- HMAC headers `x-pierone-site-timestamp` and `x-pierone-site-signature`
- Inquiry source value `pierone_public_website`
- Package name `@pierone/public-api-contracts`
- Database table names, including `skillbridge_profiles`
- Drizzle migration filenames and snapshots
- Historical decision-log entries, changelog entries, and ledger evidence
- Sender domain, Resend configuration, and DNS
- M1 through M9 business logic, permissions, Scout command ids, and outcome-learning thresholds

No M10 database migration. Migrations `0025`, `0026`, and `0027` were not applied to production by this work.

The live wordmark is the existing P mark plus the text Pier 24 Partners. Legacy PierOne PNG lockups remain in the repo and are not rendered.

Stored knowledge rows already in a database are not rewritten. Seed source text is updated for a future seed only.

## Milestone map

M1 canonical employer demand. M2 Transition Talent Profile. M3 Military Capability Translation. M4 Opportunity Discovery. M5 bidirectional opportunity matching. M6 routing, outreach, and response accountability. M7 workforce pipeline integration. M8 Command Center, Scout, and navigation consolidation. M9 advisory outcome learning. M10 Pier 24 Partners brand migration.

## Normal backlog

These are not modernization phases and they did not block M10:

- Designer-exported Pier 24 Partners lockup
- Founder-approved About and founder bios
- Counsel-approved privacy and legal-entity wording
- Optional cleanup of stored display rows that still show older PierOne branding
- Technical names that stay until a separate decision: Vercel project `pierone-public`, directory `sites/pierone`, `pieronepartners.com` hosts, `x-pierone-site-*` headers, and package or source keys

Production migration activation for `0025`, `0026`, and `0027` is a separate founder-controlled operation. This merge did not apply them.
