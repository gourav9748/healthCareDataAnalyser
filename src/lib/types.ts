export type ColumnType = "numeric" | "categorical" | "empty";

export interface NumericStats {
  type: "numeric";
  name: string;
  count: number;
  missing: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  std: number;
}

export interface CategoricalStats {
  type: "categorical";
  name: string;
  count: number;
  missing: number;
  unique: number;
  top: { value: string; count: number }[];
}

export type ColumnStats = NumericStats | CategoricalStats;

export interface Dataset {
  filename: string;
  columns: string[];
  rowCount: number;
  /** A capped preview of parsed rows for display. */
  preview: Record<string, string>[];
  stats: ColumnStats[];
}

export type AnalysisType = "summary" | "risk-factors" | "anomalies" | "custom";

export interface AgentRequest {
  analysisType: AnalysisType;
  dataset: {
    filename: string;
    columns: string[];
    rowCount: number;
    stats: ColumnStats[];
  };
  question?: string;
}
