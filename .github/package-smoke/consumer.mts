import {
  Kinship,
  type BuildKinshipResult,
  type KinshipGraph,
  type KinshipInput,
  type KinshipParrotInput,
} from '@naviary-sanctuary/kinship';

interface ConsumerParrot extends KinshipParrotInput {
  readonly name: string;
}

const input: KinshipInput<ConsumerParrot> = {
  parrots: [
    { id: 'parent', name: 'Parent' },
    { id: 'child', fatherId: 'parent', name: 'Child' },
  ],
};

export const engine: Kinship = new Kinship(input);
export const result: BuildKinshipResult = engine.build();
export const graph: KinshipGraph | undefined = result.ok ? result.graph : undefined;
