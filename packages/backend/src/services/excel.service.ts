import ExcelJS from "exceljs";
import { logger } from "../utils/logger";
import type { ClientAbbreviation, AdminCredentialRow } from "@signin-sentinel/shared";

/**
 * Read companies.xlsx and extract client abbreviations.
 *
 * Matches the PowerShell logic:
 *   - Worksheet: "Companies"
 *   - Filter: Group == "SLG"
 *   - Always include "BT"
 *   - Column: "Abbrv" for abbreviation, "Company" for name, "Group" for group
 */
export async function readCompaniesFile(filePath: string): Promise<ClientAbbreviation[]> {
  logger.info(`Reading companies file: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.getWorksheet("Companies");
  if (!sheet) {
    throw new Error('Worksheet "Companies" not found in companies file.');
  }

  // Read header row to find column indices
  const headerRow = sheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value ?? "").trim();
    headers[val] = colNumber;
  });

  const abbrvCol = headers["Abbrv"];
  const groupCol = headers["Group"];
  const companyCol = headers["Company"] ?? headers["Name"];

  if (!abbrvCol) {
    throw new Error('Column "Abbrv" not found in Companies worksheet.');
  }
  if (!groupCol) {
    throw new Error('Column "Group" not found in Companies worksheet.');
  }

  const results: ClientAbbreviation[] = [];
  const seen = new Set<string>();

  // Always include BT
  results.push({ abbreviation: "BT", group: "BT" });
  seen.add("BT");

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const group = String(row.getCell(groupCol).value ?? "").trim();
    const abbrv = String(row.getCell(abbrvCol).value ?? "").trim();

    if (!abbrv || seen.has(abbrv)) return;

    if (group === "SLG") {
      const name = companyCol ? String(row.getCell(companyCol).value ?? "").trim() : undefined;
      results.push({
        abbreviation: abbrv,
        name: name || undefined,
        group,
      });
      seen.add(abbrv);
    }
  });

  logger.info(`Parsed ${results.length} client abbreviations from companies file.`);
  return results;
}

/**
 * Read Admin Emails.xlsx and extract credentials for the given abbreviations.
 *
 * Matches the PowerShell logic:
 *   - Default worksheet (first sheet)
 *   - Columns: "Client", "Email", "Password"
 *   - Filter: Client in abbreviations list
 */
export async function readAdminEmailsFile(
  filePath: string,
  abbreviations: string[]
): Promise<AdminCredentialRow[]> {
  logger.info(`Reading admin emails file: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("No worksheets found in admin emails file.");
  }

  // Read header row to find column indices (case-insensitive)
  const headerRow = sheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value ?? "").trim();
    headers[val.toLowerCase()] = colNumber;
  });

  logger.debug(`Admin emails headers found: ${Object.keys(headers).join(", ")}`);

  const clientCol = headers["client"];
  const emailCol = headers["email"];
  const passwordCol = headers["password"];

  const foundHeaders = Object.keys(headers).map((h) => `"${h}"`).join(", ");
  if (!clientCol) throw new Error(`Column "Client" not found in admin emails file. Found headers: ${foundHeaders}`);
  if (!emailCol) throw new Error(`Column "Email" not found in admin emails file. Found headers: ${foundHeaders}`);
  if (!passwordCol) throw new Error(`Column "Password" not found in admin emails file. Found headers: ${foundHeaders}`);

  const abbrvSet = new Set(abbreviations);
  const results: AdminCredentialRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const client = String(row.getCell(clientCol).value ?? "").trim();
    if (!client || !abbrvSet.has(client)) return;

    const email = String(row.getCell(emailCol).value ?? "").trim();
    const password = String(row.getCell(passwordCol).value ?? "").trim();

    if (email) {
      results.push({ client, email, password });
    }
  });

  logger.info(`Parsed ${results.length} admin credentials from admin emails file.`);
  return results;
}
