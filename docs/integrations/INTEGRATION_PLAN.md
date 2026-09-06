# Integration Plan

Status: Phase 6 operational finance adapters on the Integration Hub  
Requirement: WFOS-INT-001

## Principle

External providers connect through an Integration Hub. They are not systems of record. Provider-specific logic must not contaminate CRM, Talent, Recruiting, Military, Legal, or Finance modules.

## Hub records

- `integration_connections` — whether a provider is configured, health, last sync, last error
- `external_records` — provider record id mapped to a WorkforceOS entity
- `integration_events` — append-style activity for sync/lookup/import/export

## Adapter interface

Each provider adapter may implement:

- `connect`
- `disconnect`
- `healthCheck`
- `sync`
- `lookup`
- `importRecords`
- `exportRecords`

Adapters return a common result type. Missing credentials yield `not_configured` rather than throwing at process startup.

## Placeholder and Phase 6 adapters

| Provider | Intended use | Phase 6 |
| --- | --- | --- |
| Apollo | company/contact discovery | adapter + review-gated enrichment; no silent CRM overwrite |
| O\*NET | occupation/skill reference | importer with source/version; unconfigured imports are labeled fixtures; never live per UI request |
| BLS | labor-market employment/wage reference | Integration Hub adapter; unconfigured lookups return labeled fixtures |
| Census / LEHD / LODES | geographic labor supply | Integration Hub adapter; unconfigured lookups return labeled fixtures |
| LinkedIn Recruiter | recruiter operating source | profile URL and Recruiter IDs only; no scrape; blocked until internal search completes |
| SeekOut | sourcing | preferred Phase 6 adapter; internal Talent Network first; labeled mock if unconfigured |
| hireEZ | sourcing | thin placeholder hook |
| Microsoft | calendar/meeting/email references | workspace references only; not a second Outlook |
| Google | calendar/meeting/email references | workspace references only; not a second Gmail |
| DocuSign | legal execution | adapter + manual execution if unconfigured; never mark executed without confirmation |
| QuickBooks | finance/AR ledger | adapter maps customers/invoices/payments through `external_records`; labeled mock if unconfigured |
| Checkr | background checks | provider adapter; human review required; mock if unconfigured |
| Resend | transactional recruiting/onboarding email | EmailProvider; not a recruiter mailbox |
| Drug screen | pre-employment screening | provider-neutral adapter; NOT CONFIGURED until a vendor is selected |

Do not implement unsupported APIs. Do not require credentials to boot the app.

## Replacement rule

A provider can be added, disabled, or replaced by implementing the adapter contract. Core tables continue to store WorkforceOS records only.
