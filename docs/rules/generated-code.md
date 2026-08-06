# Generated Code Rules

These rules apply to all generated code and generated artifacts in the repository.

## Source of Truth

- Generated code is never the source of truth.
- Always modify the original source and regenerate the affected artifacts.
- Do not duplicate generated logic elsewhere in the repository.

## Generated Files

- Never manually edit generated files.
- Treat generated artifacts as read-only outputs.
- If generated code is incorrect, fix the generator input rather than the generated result.

## Synchronization

- Keep generated artifacts synchronized with their source.
- Regenerate affected outputs after approved changes to the source.
- Do not leave generated packages in a partially updated state.

## Repository Consistency

- Generated artifacts must remain compatible with the repository architecture.
- Do not move, rename, or reorganize generated outputs unless the generation process changes.
- Preserve existing generation workflows.

## Validation

Before completing work involving generated code:

- Verify generated artifacts are up to date.
- Confirm generated outputs remain consistent with their source.
- Ensure generated code is not manually modified.
