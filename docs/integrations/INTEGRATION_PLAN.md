# Integration Plan

Status: Phase 1 abstraction only  
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
| O\*NET | occupation/skill reference | placeholder + source fields on occupation/skill tables |
| LinkedIn Recruiter | recruiter operating source | placeholder |
| SeekOut | sourcing | placeholder |
| hireEZ | sourcing | placeholder |
| Microsoft | identity/docs/mail | placeholder |
| Google | identity/docs/mail | placeholder |
| DocuSign | legal execution | placeholder |
| QuickBooks | finance/AR | placeholder |
| Checkr | background checks | placeholder |

Do not implement unsupported APIs. Do not require credentials to boot the app.

## Replacement rule

A provider can be added, disabled, or replaced by implementing the adapter contract. Core tables continue to store WorkforceOS records only.
