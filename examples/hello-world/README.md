# Hello World Example

A minimal example demonstrating the SEED workflow.

## Getting Started

1. Initialize SEED in this directory:
   ```bash
   /mob-seed-init
   ```

2. Create a spec for the hello-world feature:
   ```bash
   /mob-seed-spec "hello-world"
   ```

3. Auto-derive code, tests, and docs:
   ```bash
   /mob-seed-emit openspec/changes/hello-world/specs/hello-world.fspec.md
   ```

4. Check sync status:
   ```bash
   /mob-seed-status
   ```

## Expected Structure After Init

```
hello-world/
├── openspec/
│   ├── specs/          # Source of truth
│   ├── changes/        # Change proposals
│   │   └── hello-world/
│   │       ├── proposal.md
│   │       └── specs/
│   │           └── hello-world.fspec.md
│   ├── project.md
│   └── AGENTS.md
├── src/
│   └── hello-world.js  # Auto-derived
├── test/
│   └── hello-world.test.js  # Auto-derived
├── docs/
│   └── hello-world.md  # Auto-derived
└── .seed/
    └── config.json
```

## Sample Spec

See `sample.fspec.md` for a complete example specification.
