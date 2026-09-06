# Pre-employment checks

Jobs may declare `pre_employment_requirements`. Applications get `application_pre_employment_checks`.

## Background checks

`BackgroundCheckProvider` is provider-neutral. Phase 10 ships the **manual** workflow only.

Checkr is the preferred future provider. It is **not sandbox-ready** and **not live**. Setting `CHECKR_API_KEY` does not call Checkr. See [CHECKR.md](../integrations/CHECKR.md).

Statuses stay provider-neutral. Humans review. `applyBackgroundResult` rejects `autoReject`. Do not store full third-party reports when provider-hosted access is enough. Legal disclosure/adverse-action text must come from counsel, not product copy.

## Drug screens

`DrugScreenProvider` is provider-neutral. **No vendor is selected.** Runtime always uses `ManualDrugScreenProvider`, labeled NOT CONFIGURED. Store status, not lab/PHI detail. `drug_screens.read` is required; read-only users do not receive it. `DRUG_SCREEN_API_KEY` is reserved and unused.

Recruiters request a manual drug-screen row from the application page. Collection instructions stay outside WorkforceOS until a vendor is chosen.

## References

Manual `reference_checks` rows on the application.
