# Feature: Hello World

> Status: draft
> Version: 1.0.0
> Author: SEED Example
> Created: 2025-12-31

## Overview

A simple greeting script that demonstrates the SEED methodology.

### Purpose
- Demonstrate spec-driven development
- Show the complete SEED workflow
- Provide a minimal working example

### Target Users
- Developers learning SEED methodology
- Teams evaluating mob-seed

## ADDED Requirements

### REQ-001: Default Greeting
The system SHALL output "Hello, World!" when executed without arguments.

**Acceptance Criteria:**
- AC-001: Running `./hello-world.sh` outputs exactly "Hello, World!"

### REQ-002: Custom Greeting
The system SHALL output "Hello, {name}!" when a name argument is provided.

**Acceptance Criteria:**
- AC-002: Running `./hello-world.sh SEED` outputs "Hello, SEED!"
- AC-003: The name can contain spaces when quoted

### REQ-003: Version Display
The system SHALL display version information with --version flag.

**Acceptance Criteria:**
- AC-004: Running `./hello-world.sh --version` outputs "hello-world v1.0.0"
- AC-005: Running `./hello-world.sh -v` has the same behavior

## Constraints

### Technical Constraints
- POSIX-compliant shell script
- No external dependencies
- Exit code 0 on success

### Performance Constraints
- Execution time < 100ms

## Non-Functional Requirements

### NFR-001: Portability
The script SHALL run on macOS and Linux without modification.

### NFR-002: Documentation
The generated documentation SHALL include usage examples.

## Test Plan

| Test ID | Requirement | Input | Expected Output |
|---------|-------------|-------|-----------------|
| T-001 | REQ-001 | (none) | "Hello, World!" |
| T-002 | REQ-002 | "SEED" | "Hello, SEED!" |
| T-003 | REQ-002 | "John Doe" | "Hello, John Doe!" |
| T-004 | REQ-003 | "--version" | "hello-world v1.0.0" |
| T-005 | REQ-003 | "-v" | "hello-world v1.0.0" |

## Implementation Notes

This spec will be used to auto-derive:
1. `src/hello-world.sh` - The main script
2. `test/hello-world.test.js` - Node.js test file
3. `docs/hello-world.md` - Usage documentation
