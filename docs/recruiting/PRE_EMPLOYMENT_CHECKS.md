# Pre-employment checks

Jobs may declare `pre_employment_requirements`. Applications get `application_pre_employment_checks`.

## Background checks

`BackgroundCheckProvider` — Checkr when `CHECKR_API_KEY` is set, otherwise manual/mock. Statuses are provider-neutral. Humans review. Results must not auto-reject. Do not store full third-party reports when provider-hosted access is enough. Legal disclosure/adverse-action text must come from counsel, not product copy.

## Drug screens

`DrugScreenProvider` is provider-neutral. No vendor is selected. Status: **NOT CONFIGURED**. Store status, not lab/PHI detail. `drug_screens.read` is required; read-only users do not receive it.

## References

Manual `reference_checks` rows on the application.
