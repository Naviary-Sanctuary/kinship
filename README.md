# kinship

A deterministic pedigree graph engine for TypeScript.

## Overview

`kinship` is a TypeScript toolkit for modeling and analyzing pedigree data as a structured graph.

It focuses on turning raw pedigree records into an indexed, validated model that can be reliably queried and transformed into render-ready subgraphs.

This library does **not** provide visualization or layout algorithms.  
Instead, it provides the core logic required to:

- Normalize pedigree records into an indexed graph model
- Validate structural consistency (e.g. cycles, invalid parent references)
- Produce explainable diagnostics
- Extract render-ready subgraphs (ancestors, families, relationship paths)
- Export subgraphs to DOT (Graphviz) or Mermaid

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
