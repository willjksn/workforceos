import { canonicalHttpUrl, compensationBounds } from "./content-hash";
import type { NormalizedEmployerJob } from "./types";

export type CsvIssue = { row: number; message: string };

const CLOSED = new Set(["false", "no", "n", "closed", "0", "inactive"]);
const OPEN = new Set(["true", "yes", "y", "open", "1", "active", ""]);

export function parseJobCsv(text: string, companyName: string) {
  const table = parseCsv(text);
  const errors: CsvIssue[] = [];
  if (!table.length) return { jobs: [] as NormalizedEmployerJob[], errors: [{ row: 1, message: "CSV is empty." }] };
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const columns = {
    externalKey: indexOf(header, ["external_id", "external_key", "external id", "id", "job_id"]),
    title: indexOf(header, ["title", "job_title", "job title"]),
    company: indexOf(header, ["company", "company_name", "company name"]),
    location: indexOf(header, ["location", "location_label", "location label"]),
    description: indexOf(header, ["description", "job_description"]),
    sourceUrl: indexOf(header, ["source_url", "source url", "url"]),
    open: indexOf(header, ["open", "status", "closed", "is_open"]),
    compensation: indexOf(header, ["compensation", "salary", "public_compensation"]),
  };
  if (columns.externalKey < 0 || columns.title < 0 || columns.sourceUrl < 0) {
    return {
      jobs: [],
      errors: [{ row: 1, message: "CSV needs external id, title, and source URL columns." }],
    };
  }
  const jobs: NormalizedEmployerJob[] = [];
  const seen = new Set<string>();
  const rows = table.slice(1).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length > 200) {
    return { jobs, errors: [{ row: 1, message: "CSV is limited to 200 jobs per import." }] };
  }
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const externalKey = cell(row, columns.externalKey);
    const title = cell(row, columns.title);
    const sourceRaw = cell(row, columns.sourceUrl);
    const company = columns.company >= 0 ? cell(row, columns.company) : "";
    if (!externalKey || !title || !sourceRaw) {
      errors.push({ row: rowNumber, message: "External id, title, and source URL are required." });
      return;
    }
    if (seen.has(externalKey)) {
      errors.push({ row: rowNumber, message: "Duplicate external key in this file." });
      return;
    }
    if (company && company.toLowerCase() !== companyName.trim().toLowerCase()) {
      errors.push({ row: rowNumber, message: "Company does not match this career source." });
      return;
    }
    let sourceUrl = "";
    try {
      sourceUrl = canonicalHttpUrl(sourceRaw);
    } catch (error) {
      errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Source URL is invalid." });
      return;
    }
    const openRaw = columns.open >= 0 ? cell(row, columns.open).toLowerCase() : "";
    const headerName = columns.open >= 0 ? header[columns.open] : "";
    const explicitlyClosed = headerName === "closed"
      ? OPEN.has(openRaw) && openRaw !== ""
      : CLOSED.has(openRaw);
    if (openRaw && !CLOSED.has(openRaw) && !OPEN.has(openRaw)) {
      errors.push({ row: rowNumber, message: "Open/close indicator must be open or closed." });
      return;
    }
    seen.add(externalKey);
    const compensation = columns.compensation >= 0 ? textOrNull(cell(row, columns.compensation)) : null;
    const salary = compensationBounds(compensation);
    jobs.push({
      externalKey: externalKey.slice(0, 200),
      title: title.slice(0, 200),
      location: columns.location >= 0 ? textOrNull(cell(row, columns.location)) : null,
      description: columns.description >= 0 ? textOrNull(cell(row, columns.description), 20_000) : null,
      sourceUrl,
      department: null,
      employmentType: null,
      workplaceType: null,
      publicSalaryText: compensation,
      compensationMin: salary.min,
      compensationMax: salary.max,
      qualifications: null,
      certifications: null,
      education: null,
      experience: null,
      explicitlyClosed,
    });
  });
  return { jobs, errors };
}

function indexOf(header: string[], names: string[]) {
  return header.findIndex((column) => names.includes(column));
}

function cell(row: string[], index: number) {
  return (row[index] ?? "").trim();
}

function textOrNull(value: string, max = 300) {
  return value ? value.slice(0, max) : null;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
