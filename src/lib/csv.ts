/**
 * A small, dependency-free CSV parser that handles quoted fields, escaped
 * quotes ("") and embedded commas / newlines. Good enough for typical
 * healthcare export files; swap for a hardened library if you hit exotic input.
 */
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const records = tokenize(text);
  if (records.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = records[0].map((c) => c.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    // Skip fully empty trailing lines.
    if (record.length === 1 && record[0] === "") continue;

    const row: Record<string, string> = {};
    columns.forEach((col, idx) => {
      row[col] = (record[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { columns, rows };
}

function tokenize(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Flush the final field/record if the file doesn't end with a newline.
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}
