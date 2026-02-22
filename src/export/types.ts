/**
 * Options to control the generated Mermaid flowchart.
 */
export interface MermaidExportOptions {
  /**
   * Graph orientation.
   * TD = Top-Down (default, natural for family trees)
   * LR = Left-Right
   */
  orientation?: 'TD' | 'LR';

  /**
   * Whether to include partner (mating) relationships in the output.
   * Setting this to false is useful when strictly visualizing biological descent.
   * @default true
   */
  includePartners?: boolean;
}
