import { describe, expect, test } from 'bun:test';
import { Kinship } from '../src';
import type { KinshipPairInput, KinshipParrotInput } from '../src';

describe('Kinship', () => {
  test('returns an empty graph for an empty Parrot collection', () => {
    const result = new Kinship([]).build();

    expect(result).toEqual({
      ok: true,
      graph: {
        schemaVersion: 1,
        nodes: [],
        edges: [],
        components: [],
      },
      issues: [],
    });
  });

  test('builds one family junction for siblings with the same parents', () => {
    const parrots = [
      { id: 'father', gender: 'male' as const, name: 'Father' },
      { id: 'mother', gender: 'female' as const, name: 'Mother' },
      {
        id: 'child-a',
        gender: 'female' as const,
        fatherId: 'father',
        motherId: 'mother',
        name: 'Child A',
      },
      {
        id: 'child-b',
        gender: 'male' as const,
        fatherId: 'father',
        motherId: 'mother',
        name: 'Child B',
      },
    ];

    const result = new Kinship(parrots).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const individuals = result.graph.nodes.filter((node) => node.kind === 'individual');
    const families = result.graph.nodes.filter((node) => node.kind === 'family');

    expect(individuals).toHaveLength(4);
    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({
      kind: 'family',
      pairIds: [],
      origin: 'parentage',
      missingParentRoles: [],
      lineageDepth: 0,
    });
    expect(result.graph.edges.filter((edge) => edge.kind === 'partner')).toEqual([
      expect.objectContaining({
        sourceNodeId: 'individual:"father"',
        targetNodeId: families[0]?.id,
        role: 'male',
      }),
      expect.objectContaining({
        sourceNodeId: 'individual:"mother"',
        targetNodeId: families[0]?.id,
        role: 'female',
      }),
    ]);
    expect(result.graph.edges.filter((edge) => edge.kind === 'child')).toEqual([
      expect.objectContaining({ targetNodeId: 'individual:"child-a"' }),
      expect.objectContaining({ targetNodeId: 'individual:"child-b"' }),
    ]);
    expect(individuals.find((node) => node.individualId === 'child-a')?.lineageDepth).toBe(1);
    expect(result.graph.components).toHaveLength(1);
    expect(result.graph.components[0]?.rootNodeIds).toEqual(['individual:"father"', 'individual:"mother"']);
  });

  test('merges Pair history into an inferred family and keeps childless pairs', () => {
    const parrots = [
      { id: 'charles', gender: 'male' as const },
      { id: 'diana', gender: 'female' as const },
      { id: 'camilla', gender: 'female' as const },
      {
        id: 'william',
        fatherId: 'charles',
        motherId: 'diana',
        gender: 'male' as const,
      },
      {
        id: 'harry',
        fatherId: 'charles',
        motherId: 'diana',
        gender: 'male' as const,
      },
    ];
    const pairs = [
      {
        id: 'pair-charles-diana',
        maleId: 'charles',
        femaleId: 'diana',
        pairedAt: '1981-07-29',
      },
      {
        id: 'pair-charles-camilla',
        maleId: 'charles',
        femaleId: 'camilla',
        pairedAt: '2005-04-09',
      },
    ];

    const result = new Kinship({ parrots, pairs }).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const families = result.graph.nodes.filter((node) => node.kind === 'family');
    const familyWithChildren = families.find((family) => family.pairIds.includes('pair-charles-diana'));
    const childlessFamily = families.find((family) => family.pairIds.includes('pair-charles-camilla'));

    expect(families).toHaveLength(2);
    expect(familyWithChildren).toMatchObject({
      pairIds: ['pair-charles-diana'],
      origin: 'both',
    });
    expect(childlessFamily).toMatchObject({
      pairIds: ['pair-charles-camilla'],
      origin: 'pair',
    });
    expect(
      result.graph.edges
        .filter((edge) => edge.kind === 'child' && edge.sourceNodeId === familyWithChildren?.id)
        .map((edge) => edge.targetNodeId),
    ).toEqual(['individual:"harry"', 'individual:"william"']);
    expect(
      result.graph.edges.filter((edge) => edge.kind === 'child' && edge.sourceNodeId === childlessFamily?.id),
    ).toEqual([]);
  });

  test('keeps Pair history when endpoint Parrots are outside the input', () => {
    const result = new Kinship({
      parrots: [],
      pairs: [
        { id: 'pair-b', maleId: 'external-male', femaleId: 'external-female' },
        { id: 'pair-a', maleId: 'external-male', femaleId: 'external-female' },
      ],
    }).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    expect(result.graph.nodes.filter((node) => node.kind === 'individual')).toEqual([
      expect.objectContaining({
        individualId: 'external-female',
        resolution: 'unresolved',
      }),
      expect.objectContaining({
        individualId: 'external-male',
        resolution: 'unresolved',
      }),
    ]);
    expect(result.graph.nodes.filter((node) => node.kind === 'family')).toEqual([
      expect.objectContaining({
        pairIds: ['pair-a', 'pair-b'],
        origin: 'pair',
      }),
    ]);
    expect(result.issues.filter((issue) => issue.code === 'UNRESOLVED_INDIVIDUAL')).toHaveLength(2);
  });

  test('does not infer topology from Parrot.pairId backlinks', () => {
    const result = new Kinship([
      { id: 'a', pairId: 'pair-1' },
      { id: 'b', pairId: 'pair-1' },
    ]).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    expect(result.graph.nodes.filter((node) => node.kind === 'family')).toEqual([]);
    expect(result.graph.components).toHaveLength(2);
  });

  test('keeps one-known-parent children in separate families', () => {
    const result = new Kinship([
      { id: 'father', gender: 'male' as const },
      { id: 'child-a', fatherId: 'father' },
      { id: 'child-b', fatherId: 'father' },
    ]).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const families = result.graph.nodes.filter((node) => node.kind === 'family');

    expect(families).toHaveLength(2);
    expect(
      families.map((family) => ({
        childNodeIds: result.graph.edges
          .filter((edge) => edge.kind === 'child' && edge.sourceNodeId === family.id)
          .map((edge) => edge.targetNodeId),
        missingParentRoles: family.missingParentRoles,
      })),
    ).toEqual([
      { childNodeIds: ['individual:"child-a"'], missingParentRoles: ['mother'] },
      { childNodeIds: ['individual:"child-b"'], missingParentRoles: ['mother'] },
    ]);
  });

  test('preserves unresolved parent references as nodes', () => {
    const result = new Kinship([{ id: 'child', fatherId: 'external-father' }]).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    expect(
      result.graph.nodes.find((node) => node.kind === 'individual' && node.individualId === 'external-father'),
    ).toMatchObject({
      kind: 'individual',
      individualId: 'external-father',
      resolution: 'unresolved',
      gender: 'unknown',
      lineageDepth: 0,
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        code: 'UNRESOLVED_INDIVIDUAL',
        individualId: 'external-father',
      }),
    );
  });

  test('computes lineage depth and disconnected components', () => {
    const result = new Kinship([
      { id: 'grandfather' },
      { id: 'father', fatherId: 'grandfather' },
      { id: 'child', fatherId: 'father' },
      { id: 'isolated' },
    ]).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const individuals = result.graph.nodes.filter((node) => node.kind === 'individual');

    expect(individuals.map((node) => [node.individualId, node.lineageDepth])).toEqual([
      ['child', 2],
      ['father', 1],
      ['grandfather', 0],
      ['isolated', 0],
    ]);
    expect(result.graph.components).toHaveLength(2);
    expect(result.graph.components.map((component) => [component.minLineageDepth, component.maxLineageDepth])).toEqual([
      [0, 2],
      [0, 0],
    ]);
  });

  test('represents pedigree collapse without duplicating ancestor identity', () => {
    const result = new Kinship([
      { id: 'grandfather', gender: 'male' as const },
      { id: 'grandmother', gender: 'female' as const },
      {
        id: 'father',
        gender: 'male' as const,
        fatherId: 'grandfather',
        motherId: 'grandmother',
      },
      {
        id: 'mother',
        gender: 'female' as const,
        fatherId: 'grandfather',
        motherId: 'grandmother',
      },
      { id: 'child', fatherId: 'father', motherId: 'mother' },
    ]).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const individuals = result.graph.nodes.filter((node) => node.kind === 'individual');
    expect(individuals).toHaveLength(5);
    expect(individuals.filter((node) => node.individualId === 'grandfather')).toHaveLength(1);
    expect(individuals.filter((node) => node.individualId === 'grandmother')).toHaveLength(1);
    expect(individuals.find((node) => node.individualId === 'child')?.lineageDepth).toBe(2);
    expect(result.graph.components).toHaveLength(1);
  });

  test('uses collision-safe opaque ids for families and edges', () => {
    const result = new Kinship([
      { id: 'A-B' },
      { id: 'C' },
      { id: 'A' },
      { id: 'B-C' },
      { id: 'child-1', fatherId: 'A-B', motherId: 'C' },
      { id: 'child-2', fatherId: 'A', motherId: 'B-C' },
    ]).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const families = result.graph.nodes.filter((node) => node.kind === 'family');
    expect(families).toHaveLength(2);
    expect(new Set(families.map((family) => family.id)).size).toBe(2);
    expect(new Set(result.graph.edges.map((edge) => edge.id)).size).toBe(result.graph.edges.length);
  });

  test('is deterministic when Parrot and Pair input order changes', () => {
    const parrots = [
      { id: 'father', gender: 'male' as const },
      { id: 'mother', gender: 'female' as const },
      { id: 'child', fatherId: 'father', motherId: 'mother' },
      { id: 'partner', gender: 'female' as const },
    ];
    const pairs = [
      { id: 'pair-b', maleId: 'father', femaleId: 'partner' },
      { id: 'pair-a', maleId: 'father', femaleId: 'mother' },
    ];

    const first = new Kinship({ parrots, pairs }).build();
    const second = new Kinship({
      parrots: [...parrots].reverse(),
      pairs: [...pairs].reverse(),
    }).build();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('Expected graphs.');
    expect(second.graph).toEqual(first.graph);
    expect(second.issues).toEqual(first.issues);
  });

  test('returns an explainable failure for parentage cycles', () => {
    const result = new Kinship([
      { id: 'a', fatherId: 'b' },
      { id: 'b', motherId: 'c' },
      { id: 'c', fatherId: 'a' },
    ]).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');

    const issue = result.issues.find((candidate) => candidate.code === 'PARENTAGE_CYCLE');
    expect(issue).toBeDefined();
    expect(issue?.path?.[0]).toBe(issue?.path?.at(-1));
    expect(new Set(issue?.path?.slice(0, -1))).toEqual(new Set(['a', 'b', 'c']));
  });

  test('reports each disconnected parentage cycle in one build', () => {
    const result = new Kinship([
      { id: 'a', fatherId: 'b' },
      { id: 'b', fatherId: 'a' },
      { id: 'x', motherId: 'y' },
      { id: 'y', motherId: 'x' },
    ]).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');

    expect(result.issues.filter((issue) => issue.code === 'PARENTAGE_CYCLE').map((issue) => issue.relatedIds)).toEqual([
      ['a', 'b'],
      ['x', 'y'],
    ]);
  });

  test('rejects duplicate ids, self relations, and ambiguous parents', () => {
    const duplicateParrot = new Kinship([{ id: 'same' }, { id: 'same' }]).build();
    const selfParent = new Kinship([{ id: 'self', fatherId: 'self' }]).build();
    const sameParent = new Kinship([{ id: 'child', fatherId: 'parent', motherId: 'parent' }]).build();
    const duplicatePair = new Kinship({
      parrots: [{ id: 'male' }, { id: 'female' }],
      pairs: [
        { id: 'pair', maleId: 'male', femaleId: 'female' },
        { id: 'pair', maleId: 'male', femaleId: 'female' },
      ],
    }).build();
    const selfPair = new Kinship({
      parrots: [{ id: 'same' }],
      pairs: [{ id: 'pair', maleId: 'same', femaleId: 'same' }],
    }).build();

    expect(duplicateParrot).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'DUPLICATE_INDIVIDUAL_ID' })],
    });
    expect(selfParent).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'SELF_PARENT' })],
    });
    expect(sameParent).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'SAME_PARENT' })],
    });
    expect(duplicatePair).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'DUPLICATE_PAIR_ID' })],
    });
    expect(selfPair).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'SELF_PAIR' })],
    });
  });

  test('rejects conflicting father and mother roles across siblings', () => {
    const result = new Kinship([
      { id: 'a' },
      { id: 'b' },
      { id: 'child-a', fatherId: 'a', motherId: 'b' },
      { id: 'child-b', fatherId: 'b', motherId: 'a' },
    ]).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');
    expect(result.issues.filter((issue) => issue.code === 'PARENT_ROLE_CONFLICT')).toEqual([
      expect.objectContaining({ individualId: 'child-b' }),
    ]);
  });

  test('keeps parentage roles when a Pair record is reversed', () => {
    const result = new Kinship({
      parrots: [
        { id: 'father', gender: 'male' as const },
        { id: 'mother', gender: 'female' as const },
        { id: 'child', fatherId: 'father', motherId: 'mother' },
      ],
      pairs: [
        {
          id: 'reversed-pair',
          maleId: 'mother',
          femaleId: 'father',
        },
      ],
    }).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const family = result.graph.nodes.find((node) => node.kind === 'family');
    expect(family?.origin).toBe('both');
    expect(
      result.graph.edges
        .filter((edge) => edge.kind === 'partner')
        .map((edge) => ({ sourceNodeId: edge.sourceNodeId, role: edge.role })),
    ).toEqual([
      { sourceNodeId: 'individual:"father"', role: 'male' },
      { sourceNodeId: 'individual:"mother"', role: 'female' },
    ]);
    expect(result.issues.filter((issue) => issue.code === 'PAIR_ROLE_CONFLICT')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        pairId: 'reversed-pair',
      }),
    ]);
  });

  test('rejects conflicting role declarations between Pair records', () => {
    const result = new Kinship({
      parrots: [{ id: 'a' }, { id: 'b' }],
      pairs: [
        { id: 'pair-1', maleId: 'a', femaleId: 'b' },
        { id: 'pair-2', maleId: 'b', femaleId: 'a' },
      ],
    }).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');

    expect(result.issues.filter((issue) => issue.code === 'PAIR_ROLE_CONFLICT')).toEqual([
      expect.objectContaining({
        severity: 'error',
        pairId: 'pair-2',
      }),
    ]);
  });

  test('keeps Unicode ids deterministic without locale collation', () => {
    const composed = 'é';
    const decomposed = 'e\u0301';
    const parrots = [{ id: composed }, { id: decomposed }, { id: 'child', fatherId: composed, motherId: decomposed }];

    const first = new Kinship(parrots).build();
    const second = new Kinship([...parrots].reverse()).build();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('Expected graphs.');
    expect(second.graph).toEqual(first.graph);
    expect(second.issues).toEqual(first.issues);
    expect(first.graph.nodes.filter((node) => node.kind === 'family')).toHaveLength(1);
  });

  test('rejects Unicode-distinct parents with conflicting roles', () => {
    const composed = 'é';
    const decomposed = 'e\u0301';
    const result = new Kinship([
      { id: composed },
      { id: decomposed },
      { id: 'child-a', fatherId: composed, motherId: decomposed },
      { id: 'child-b', fatherId: decomposed, motherId: composed },
    ]).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');
    expect(result.issues.filter((issue) => issue.code === 'PARENT_ROLE_CONFLICT')).toHaveLength(1);
  });

  test('reports gender-role conflicts without discarding topology', () => {
    const result = new Kinship({
      parrots: [
        { id: 'father', gender: 'female' as const },
        { id: 'mother', gender: 'male' as const },
        {
          id: 'child',
          fatherId: 'father',
          motherId: 'mother',
        },
      ],
      pairs: [{ id: 'pair', maleId: 'father', femaleId: 'mother' }],
    }).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    expect(
      result.issues.filter((issue) => issue.code === 'PARENT_GENDER_CONFLICT' || issue.code === 'PAIR_GENDER_CONFLICT'),
    ).toHaveLength(4);
  });

  test('rejects invalid runtime gender values instead of silently coercing them', () => {
    const result = new Kinship([
      {
        id: 'bird',
        gender: 'MALE',
      },
    ] as unknown as readonly KinshipParrotInput[]).build();

    expect(result).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          severity: 'error',
          code: 'INVALID_GENDER',
          individualId: 'bird',
          field: 'gender',
        }),
      ],
    });
  });

  test('rejects an individual declared globally in both father and mother roles', () => {
    const result = new Kinship([
      { id: 'a', gender: 'unknown' as const },
      { id: 'b' },
      { id: 'c' },
      { id: 'child-a', fatherId: 'a', motherId: 'b' },
      { id: 'child-b', fatherId: 'c', motherId: 'a' },
    ]).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');
    expect(result.issues.filter((issue) => issue.code === 'PARENT_ROLE_CONFLICT')).toEqual([
      expect.objectContaining({
        individualId: 'child-b',
        relatedIds: ['a'],
      }),
    ]);
  });

  test('rejects an individual declared globally in both Pair roles', () => {
    const result = new Kinship({
      parrots: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      pairs: [
        { id: 'pair-a', maleId: 'a', femaleId: 'b' },
        { id: 'pair-b', maleId: 'c', femaleId: 'a' },
      ],
    }).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');
    expect(result.issues.filter((issue) => issue.code === 'PAIR_ROLE_CONFLICT')).toEqual([
      expect.objectContaining({
        severity: 'error',
        pairId: 'pair-b',
        relatedIds: ['a'],
      }),
    ]);
  });

  test('rejects Pair roles that conflict with authoritative parentage in another family', () => {
    const result = new Kinship({
      parrots: [
        { id: 'father' },
        { id: 'mother' },
        { id: 'child', fatherId: 'father', motherId: 'mother' },
        { id: 'other' },
      ],
      pairs: [{ id: 'pair', maleId: 'other', femaleId: 'father' }],
    }).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');
    expect(result.issues.filter((issue) => issue.code === 'PAIR_ROLE_CONFLICT')).toEqual([
      expect.objectContaining({
        severity: 'error',
        pairId: 'pair',
        relatedIds: ['father'],
      }),
    ]);
  });

  test('validates every duplicate record before returning duplicate-id issues', () => {
    const parrotResult = new Kinship([
      { id: 'duplicate' },
      { id: 'duplicate', fatherId: ' padded ' },
    ] as unknown as readonly KinshipParrotInput[]).build();
    const pairResult = new Kinship({
      parrots: [],
      pairs: [
        { id: 'duplicate', maleId: 'male', femaleId: 'female' },
        { id: 'duplicate', maleId: ' padded ', femaleId: 'female' },
      ],
    } as unknown as {
      parrots: readonly KinshipParrotInput[];
      pairs: readonly KinshipPairInput[];
    }).build();

    expect(parrotResult.ok).toBe(false);
    expect(pairResult.ok).toBe(false);
    if (parrotResult.ok || pairResult.ok) throw new Error('Expected failures.');
    expect(parrotResult.issues.map((issue) => issue.code)).toEqual(['DUPLICATE_INDIVIDUAL_ID', 'INVALID_PARENT_ID']);
    expect(pairResult.issues.map((issue) => issue.code)).toEqual(['DUPLICATE_PAIR_ID', 'INVALID_PAIR_ENDPOINT_ID']);
  });

  test('returns validation issues instead of throwing on malformed runtime data', () => {
    const invalidInput = new Kinship(null as unknown as readonly KinshipParrotInput[]).build();
    const invalidRecords = new Kinship({
      parrots: [{ id: 123 }, null],
      pairs: 'not-an-array',
    } as unknown as {
      parrots: readonly KinshipParrotInput[];
      pairs: readonly KinshipPairInput[];
    }).build();

    expect(invalidInput).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'INVALID_INPUT' })],
    });
    expect(invalidRecords.ok).toBe(false);
    if (invalidRecords.ok) throw new Error('Expected a failure.');
    expect(invalidRecords.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['INVALID_INPUT', 'INVALID_INDIVIDUAL_ID', 'INVALID_PARROT']),
    );
  });

  test('rejects sparse runtime arrays instead of silently skipping holes', () => {
    const sparseParrots = Array<KinshipParrotInput>(1_000_000);
    sparseParrots[999_999] = { id: 'bird' };

    const result = new Kinship(sparseParrots).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'INVALID_PARROT',
        inputIndex: 0,
      }),
    ]);
  });

  test('reports malformed Pair records with stable public issue codes', () => {
    const sparsePairs = Array<KinshipPairInput>(1);
    const cases = [
      {
        pairs: sparsePairs,
        code: 'INVALID_PAIR',
      },
      {
        pairs: [null] as unknown as readonly KinshipPairInput[],
        code: 'INVALID_PAIR',
      },
      {
        pairs: [{ id: ' padded ', maleId: 'male', femaleId: 'female' }],
        code: 'INVALID_PAIR_ID',
      },
    ] as const;

    cases.forEach(({ pairs, code }) => {
      const result = new Kinship({ parrots: [], pairs }).build();

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected a failure.');
      expect(result.issues[0]).toEqual(
        expect.objectContaining({
          code,
          inputIndex: 0,
        }),
      );
    });
  });

  test('does not execute custom collection iterators or reducers', () => {
    const parrots: KinshipParrotInput[] = [
      { id: 'male', gender: 'male' },
      { id: 'female', gender: 'female' },
    ];
    const pairs: KinshipPairInput[] = [{ id: 'pair', maleId: 'male', femaleId: 'female' }];

    [parrots, pairs].forEach((records) => {
      Object.defineProperties(records, {
        [Symbol.iterator]: {
          value: () => {
            throw new Error('The collection iterator must not be called.');
          },
        },
        reduce: {
          value: () => {
            throw new Error('The collection reducer must not be called.');
          },
        },
      });
    });

    const result = new Kinship({ parrots, pairs }).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');
    expect(result.graph.nodes).toHaveLength(3);
  });

  test('excludes arbitrary entity fields and always returns JSON-safe topology', () => {
    const circular: { id: string; self?: unknown; counter: bigint } = {
      id: 'father',
      counter: 1n,
    };
    circular.self = circular;
    const pair = {
      id: 'pair',
      maleId: 'father',
      femaleId: 'mother',
      pairedAt: new Date('2026-01-01T00:00:00.000Z'),
      counter: 1n,
    };
    const result = new Kinship({
      parrots: [circular, { id: 'mother' }, { id: 'child', fatherId: 'father', motherId: 'mother' }],
      pairs: [pair],
    }).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    const serialized = JSON.stringify(result.graph);
    const parsed = JSON.parse(serialized) as {
      schemaVersion: number;
      nodes: unknown[];
      edges: unknown[];
      components: unknown[];
    };

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.nodes).toHaveLength(4);
    expect(parsed.edges).toHaveLength(3);
    expect(parsed.components).toHaveLength(1);
    expect(serialized).not.toContain('pairedAt');
    expect(serialized).not.toContain('counter');
    expect(serialized).not.toContain('self');
  });

  test('bounds overlapping cycle diagnostics to one witness per strongly connected component', () => {
    const size = 5_000;
    const ids = Array.from({ length: size }, (_, index) => index.toString().padStart(5, '0'));
    const parrots = ids.map((id, index) => ({
      id,
      ...(index === 0
        ? { fatherId: ids[1]! }
        : index < size - 1
          ? { fatherId: ids[index + 1]!, motherId: ids[0]! }
          : { motherId: ids[0]! }),
    }));

    const result = new Kinship(parrots).build();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failure.');

    const cycleIssues = result.issues.filter((issue) => issue.code === 'PARENTAGE_CYCLE');
    expect(cycleIssues).toHaveLength(1);
    expect(cycleIssues[0]?.relatedIds).toHaveLength(size);
    expect(cycleIssues[0]?.path?.[0]).toBe(cycleIssues[0]?.path?.at(-1));
  });

  test('remains stack-safe for deep pedigrees', () => {
    const depth = 40_000;
    const parrots = Array.from({ length: depth }, (_, index) => ({
      id: `bird-${index.toString().padStart(5, '0')}`,
      ...(index > 0
        ? {
            fatherId: `bird-${(index - 1).toString().padStart(5, '0')}`,
          }
        : {}),
    }));

    const result = new Kinship(parrots).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    expect(
      result.graph.nodes.find(
        (node) => node.kind === 'individual' && node.individualId === `bird-${(depth - 1).toString().padStart(5, '0')}`,
      )?.lineageDepth,
    ).toBe(depth - 1);
  });

  test('does not spread large components onto the JavaScript call stack', () => {
    const childCount = 130_000;
    const parrots = [
      { id: 'father' },
      { id: 'mother' },
      ...Array.from({ length: childCount }, (_, index) => ({
        id: `child-${index.toString().padStart(6, '0')}`,
        fatherId: 'father',
        motherId: 'mother',
      })),
    ];

    const result = new Kinship(parrots).build();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a graph.');

    expect(result.graph.components).toHaveLength(1);
    expect(result.graph.components[0]?.nodeIds).toHaveLength(childCount + 3);
    expect(result.graph.components[0]?.maxLineageDepth).toBe(1);
  });
});
