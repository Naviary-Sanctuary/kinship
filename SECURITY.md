# Security Policy

## Supported versions

Security fixes are applied to the latest `0.x` release line. Older minor lines
are unsupported once a replacement is published because pre-1.0 releases can
contain intentional breaking contract changes.

| Version           | Supported |
| ----------------- | --------- |
| Latest `0.x`      | Yes       |
| Older minor lines | No        |

## Reporting a vulnerability

Please use a
[private GitHub Security Advisory](https://github.com/Naviary-Sanctuary/kinship/security/advisories/new)
or email `window95pill@gmail.com`. Do not disclose an unpatched vulnerability
in a public issue.

Include the affected version, a minimal synthetic reproduction, impact, and any
known mitigations. Do not send real animal-owner, customer, clinical, or
laboratory data.

## Security boundary

`kinship` is a synchronous, in-memory topology projection. It performs no
network, filesystem, database, telemetry, or dynamic-code operations and has no
runtime dependencies. It allowlists structural fields instead of copying input
entities into its output.

Deployers remain responsible for:

- accepting plain records from a validated trust boundary;
- limiting request/body size, record counts, and identifier length before
  calling the engine;
- moving very large builds off a latency-sensitive server event loop;
- treating identifiers and issue messages as potentially sensitive data; and
- validating species, dates, identity provenance, and parentage evidence before
  treating a graph as authoritative.

The package does not verify DNA parentage, calculate kinship or inbreeding
coefficients, or provide clinical/genetic decision support.
