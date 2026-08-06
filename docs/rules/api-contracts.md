# API Contract Rules

These rules govern API contracts and generated API artifacts throughout the repository.

## Source of Truth

- The API specification is the single source of truth for all API contracts.
- Backend implementations, generated clients, validation schemas, and documentation must remain consistent with the API specification.
- Never duplicate API definitions outside their authoritative source.

## Contract First

- Define or update the API contract before implementing backend or frontend changes.
- Backend and frontend development should follow the approved API contract.
- API changes requiring architectural or product decisions must follow `design-decisions.md`.

## Generated Artifacts

- Generated clients, schemas, and related artifacts must be regenerated from the API specification.
- Never manually edit generated files.
- If generated artifacts become outdated, update the specification and regenerate them.

## Compatibility

- Preserve backward compatibility whenever practical.
- Do not introduce breaking API changes without explicit approval.
- Update all affected consumers when contract changes are approved.

## Shared Types

- Request and response models should have a single source of truth.
- Do not manually duplicate API types across packages.
- Reuse generated contracts wherever possible.

## Validation

Before completing API-related work:

- Verify the implementation matches the API contract.
- Ensure generated artifacts are synchronized.
- Confirm documentation reflects the current contract when required.
