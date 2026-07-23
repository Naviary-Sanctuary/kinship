# Interoperability and biological scope

Reviewed against the referenced public standards on 2026-07-23.

`kinship` is a canonical pedigree topology projection for Naviary. It is not an
authoritative animal registry, parentage-verification system, genetic-analysis
engine, or standards-file parser.

## Recommended data flow

```text
authoritative registry
  -> domain quality validation
  -> standard or Naviary adapter
  -> kinship topology
  -> explicit public metadata DTO
  -> renderer
```

Adapters should normalize external identifiers and missing-value conventions
before construction. Domain validation should preserve provenance and reject
biologically impossible records before the topology is used for scientific or
breeding decisions.

## GA4GH Phenopackets

[Phenopackets Pedigree 2.0](https://phenopacket-schema.readthedocs.io/en/latest/pedigree.html)
models family and individual IDs, paternal and maternal IDs, sex, and affected
status. A future adapter must:

- create a collision-safe canonical ID from the source family ID and individual
  ID;
- map paternal/maternal IDs to `fatherId`/`motherId`;
- keep affected status and phenotype data in a separate DTO; and
- preserve the original IDs for lossless export.

The Naviary source property is named `gender` for compatibility with its Parrot
model. Inside this package it is only a recorded male/female/unknown
reproductive-sex marker. It must not be interpreted as GA4GH gender identity,
karyotypic sex, or taxonomy.

## PLINK

The [PLINK 2 `.fam` format](https://www.cog-genomics.org/plink/2.0/formats)
uses FID, IID, paternal IID, maternal IID, sex, and phenotype. Direct ingestion
is intentionally unsupported:

- IID is not globally unique without its FID namespace;
- the PLINK missing-parent sentinel `0` must become an absent parent, not the
  literal individual ID `"0"`; and
- phenotype values do not belong in renderer topology.

A PLINK adapter should retain the original six fields beside the graph mapping
so round trips do not lose family or phenotype meaning.

## ICAR and animal parentage

ICAR guidance covers permanent animal identity, historical cross-references,
service and birth records, parentage evidence, and cases such as embryo
transfer with genetic and recipient dams. See the
[ICAR General Rules](https://www.icar.org/Guidelines/01-General-Rules.pdf) and
[parentage-recording guidance](https://wiki.icar.org/index.php/General_Rules%3A_Parentage_recording_methods).

Those concerns are deliberately outside this graph contract. In particular:

- a father/mother ID is a supplied assertion, not DNA verification;
- Pair records do not identify the mating, clutch, or service that produced an
  offspring;
- several Pair records with the same endpoints are merged into one visual
  family while their Pair IDs are retained;
- genetic versus recipient parentage, clones, and embryo splits are not
  represented; and
- species, hatch/birth time, laboratory evidence, verification status,
  confidence, genotype consistency, and identity history are not validated.

Do not describe `kinship` output as ICAR-compliant or parentage-verified.

## Analysis boundary

The package does not calculate relationship degree, a kinship matrix,
inbreeding coefficients, Mendelian consistency, or parentage probability.
These require separate versioned scientific methods and evidence models. The
topology can be an input to such systems only after their own validation.
