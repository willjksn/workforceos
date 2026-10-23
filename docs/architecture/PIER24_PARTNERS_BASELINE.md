# Pier 24 Partners baseline

Status: current-state summary after M10. Awaiting founder merge. This is not a historical milestone record.

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

1. Professional & Technical Search
2. Military Talent Opportunity Assessment
3. Talent Acquisition Performance Assessment
4. Fractional Talent Partner
5. Workforce Pipeline Assessment

SkillBridge operations, applicant processing, interviewing, onboarding, military translation, public opportunity discovery, candidate matching, research, sourcing, Scout, and WorkforceOS support delivery. They are not additional public offers.

Primary sectors: Energy & Utilities, Advanced Manufacturing, Infrastructure, and Industrial / Technical Operations. Secondary sectors: Data Centers, Aerospace & Defense, Engineering, and Supply Chain & Logistics. Geography is not hard-coded through the product.

## System capabilities

Talent Network, Transition Talent Profile, Military Capability Translation, Opportunity Discovery, Opportunity Matching, Routing & Outreach, Workforce Pipeline, Command Center, Scout, and Outcome Learning.

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

The live wordmark is the existing P mark plus the text Pier 24 Partners. Legacy PierOne PNG lockups remain in the repo and are not rendered. A designer-exported Pier 24 Partners lockup file is still required.

Stored knowledge rows already in a database are not rewritten. Seed source text is updated for a future seed only.
