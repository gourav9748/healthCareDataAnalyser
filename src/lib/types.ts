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

/** A CSV / spreadsheet upload: structured rows and columns. */
export interface TabularDataset {
  kind: "tabular";
  filename: string;
  columns: string[];
  rowCount: number;
  /** A capped preview of parsed rows for display. */
  preview: Record<string, string>[];
  stats: ColumnStats[];
}

export type DocumentFileType = "pdf" | "docx";

/** A PDF / Word upload: unstructured text extracted from the document. */
export interface DocumentDataset {
  kind: "document";
  filename: string;
  fileType: DocumentFileType;
  charCount: number;
  wordCount: number;
  pageCount: number | null;
  /** Whether `text` was truncated from a longer document. */
  truncated: boolean;
  /** Extracted text (capped) — used for the preview and the agent prompt. */
  text: string;
}

export type Analysis = TabularDataset | DocumentDataset;

export type AnalysisType = "summary" | "risk-factors" | "anomalies" | "custom";

/** The trimmed payload the browser sends to /api/agent. */
export type AgentSource =
  | {
      kind: "tabular";
      filename: string;
      columns: string[];
      rowCount: number;
      stats: ColumnStats[];
    }
  | {
      kind: "document";
      filename: string;
      fileType: DocumentFileType;
      wordCount: number;
      charCount: number;
      pageCount: number | null;
      truncated: boolean;
      text: string;
    };

export interface AgentRequest {
  analysisType: AnalysisType;
  source: AgentSource;
  question?: string;
}
