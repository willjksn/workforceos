# Integration Plan

Status: Phase 5 labor-market adapters on the Phase 1 hub  
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

## Placeholder providers

| Provider | Intended use | Phase 1 |
| --- | --- | --- |
| Apollo | company/contact discovery | placeholder |
| O\*NET | occupation/skill reference | placeholder + source fields on occupation/skill tables; labeled fixture observations in Phase 5 |
| BLS | labor-market employment/wage reference | Integration Hub adapter; unconfigured lookups return labeled fixtures, never invented values |
| Census / LEHD / LODES | geographic labor supply | Integration Hub adapter; unconfigured lookups return labeled fixtures, never invented values |
| LinkedIn Recruiter | recruiter operating source | hook only; no scrape; blocked until internal search completes |
| SeekOut | sourcing | placeholder hook |
| hireEZ | sourcing | placeholder hook |
| Microsoft | identity/docs/mail | placeholder |
| Google | identity/docs/mail | placeholder |
| DocuSign | legal execution | placeholder adapter plus manual contract execution |
| QuickBooks | finance/AR | placeholder |
| Checkr | background checks | placeholder |

Do not implement unsupported APIs. Do not require credentials to boot the app.

## Replacement rule

A provider can be added, disabled, or replaced by implementing the adapter contract. Core tables continue to store WorkforceOS records only.
