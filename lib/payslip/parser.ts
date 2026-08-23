export interface ParsedPayslipData {
  employee_name: string | null;
  employee_id: string | null;
  net_pay: number | null;
  gross_pay: number | null;
  total_deductions: number | null;
  period_month: number | null;
  period_year: number | null;
  currency: string;
}

export interface ParsedPayslipConfidence {
  name_found: boolean;
  id_found: boolean;
  net_pay_found: boolean;
  gross_pay_found?: boolean;
  deductions_found?: boolean;
  period_found?: boolean;
}

export interface ParsedPayslipResponse {
  success: boolean;
  error?: "SCANNED_PDF_NOT_SUPPORTED" | string;
  data?: ParsedPayslipData;
  confidence?: ParsedPayslipConfidence;
}

/**
 * Validates an Israeli National ID number using the standard Luhn/Israeli checksum algorithm.
 */
export function isValidIsraeliId(idStr: string): boolean {
  const cleanId = idStr.trim().replace(/\D/g, "");
  if (cleanId.length < 7 || cleanId.length > 9) return false;

  const padded = cleanId.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = Number(padded[i]);
    const step = digit * ((i % 2) + 1);
    sum += step > 9 ? step - 9 : step;
  }
  return sum % 10 === 0;
}

/**
 * Reverses a Hebrew string (handles visual RTL reversed character streams common in PDF extraction).
 */
export function reverseHebrewString(str: string): string {
  if (!/[\u0590-\u05FF]/.test(str)) {
    return str;
  }
  return str.split("").reverse().join("");
}

/**
 * Normalizes Hebrew text, fixing reversed text, punctuation, and multiple spaces.
 */
export function normalizeTextLine(line: string): string {
  return line
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses numeric amount from text string (handles standard and reversed Israeli PDF formats).
 */
export function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  let clean = amountStr.trim().replace(/[₪ILS]/gi, "").trim();

  // If reversed format like "00.059,21" or "50.005,8"
  if (/^\d{2}\.\d{3},\d+$/.test(clean)) {
    clean = clean.split("").reverse().join("").replace(/,/g, "");
  } else if (/^\d{2}\.\d{3,6}$/.test(clean)) {
    clean = clean.split("").reverse().join("");
  } else {
    clean = clean.replace(/,/g, "").replace(/[^0-9.-]/g, "");
  }

  const val = parseFloat(clean);
  return isNaN(val) ? null : Math.round(val * 100) / 100;
}

function isProbableYear(amt: number): boolean {
  return amt >= 1990 && amt <= 2040 && Number.isInteger(amt);
}

/**
 * Extracts Employee ID (Israeli 9-digit national ID / ת.ז or employee number).
 */
export function extractEmployeeId(text: string, lines: string[], filename?: string): string | null {
  const idLabelPatterns = [
    /(?:ת\.?ז\.?|תעודת\s*זהות|מס(?:פר)?\s*זהות|מ\.?ז\.?|ת\.?זהות|id\s*(?:no|number|#)?|national\s*id)\s*[:.\-]?\s*(\d{7,9})/i,
    /(?:ז\.?ת\.?|תוהז\s*תדועת|תוהז\s*רפסמ|תוהז\s*ת|ז\.?מ\.?)\s*[:.\-]?\s*(\d{7,9})/i,
    /(\d{7,9})\s*[:.\-]?\s*(?:ת\.?ז\.?|תעודת\s*זהות|מספר\s*זהות|ז\.?ת\.?|תוהז\s*רפסמ)/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    for (const pattern of idLabelPatterns) {
      const match = norm.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim().padStart(9, "0");
        return candidate;
      }
    }
  }

  for (const pattern of idLabelPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim().padStart(9, "0");
      return candidate;
    }
  }

  // Standalone 8-9 digit sequence passing checksum
  const digitsMatches = text.match(/\b\d{8,9}\b/g);
  if (digitsMatches) {
    for (const num of digitsMatches) {
      if (isValidIsraeliId(num)) {
        return num.padStart(9, "0");
      }
    }
  }

  // Filename check (e.g. TL_2026_07_012345678_unlocked.pdf)
  if (filename) {
    const fileDigits = filename.match(/\b\d{8,9}\b/g) || filename.match(/_(\d{7,9})_/);
    if (fileDigits) {
      for (const num of fileDigits) {
        const clean = num.replace(/\D/g, "");
        if (isValidIsraeliId(clean)) {
          return clean.padStart(9, "0");
        }
      }
    }
  }

  return null;
}

/**
 * Extracts Employee Name (שם העובד).
 */
export function extractEmployeeName(text: string, lines: string[]): string | null {
  const namePatterns = [
    /(?:שם\s*ה?עובד|שם\s*ה?מועסק|שם\s*פרטי\s*ומשפחה|employee\s*name)\s*[:.\-]?\s*([^\d\n\r:;,\/\(\)]{2,40})/i,
    /(?:דבוע[ה]?\s*םש|קסעומ[ה]?\s*םש|דבוע\s*:\s*|:דבוע)\s*([^\d\n\r:;,\/\(\)]{2,40})/i,
    /([^\d\n\r:;,\/\(\)]{2,40})\s*[:.\-]?\s*(?:שם\s*ה?עובד|דבוע[ה]?\s*םש)/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeTextLine(lines[i]);
    // Check line for reversed name next to ID
    const reversedNameMatch = norm.match(/^([א-ת\s]{3,30})\s+(\d{8,9})/);
    if (reversedNameMatch) {
      return reverseHebrewString(reversedNameMatch[1].trim());
    }

    for (const pattern of namePatterns) {
      const match = norm.match(pattern);
      if (match && match[1]) {
        let nameCandidate = match[1].trim();

        nameCandidate = nameCandidate
          .replace(/^(לכבוד|מר|גב|מר\/גב|עובד|לכבוד:)\s*/g, "")
          .replace(/\s*(ת\.ז|תוהז|מספר|דבוע|מחלקה|תפקיד).*$/, "")
          .trim();

        if (nameCandidate.length >= 2 && !/^\d+$/.test(nameCandidate)) {
          if (/דבוע\s*םש|:דבוע/.test(norm)) {
            nameCandidate = reverseHebrewString(nameCandidate);
          }
          return nameCandidate;
        }
      }
    }
  }

  return null;
}

/**
 * Parses Israeli Michpal / Har-Gal table components layout:
 * Payment components total (םולשתל םיביכרמ) and Mandatory deductions (םיביכרמ כ"הס).
 */
function extractHarGalMichpalSalary(lines: string[]): { gross: number; deductions: number; net: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/םיביכרמ\s*כ["״]?הס|מרכיבים\s*כ["״]?הס|סה["״]?כ\s*מרכיבים|םייוכינ\s*כ["״]?הס/.test(line)) {
      // 1. Total deductions is the currency amount directly above this line
      let totalDeductions: number | null = null;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        if (/^\d{1,5}\.\d{2}$/.test(lines[j])) {
          totalDeductions = parseAmount(lines[j]);
          break;
        }
      }

      // 2. Gross is the first main payment components total
      let grossPay: number | null = null;
      for (let j = 0; j < i; j++) {
        if (/^\d{3,6}\.\d{2}$/.test(lines[j])) {
          const amt = parseAmount(lines[j]);
          if (amt !== null && amt >= 500 && amt < 100000) {
            // Pick first primary payment component (filter out cumulative tax bases like 16173)
            grossPay = amt;
            break;
          }
        }
      }

      if (grossPay && totalDeductions) {
        const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;
        return { gross: grossPay, deductions: totalDeductions, net: netPay };
      }
    }
  }
  return null;
}

/**
 * Extracts Net Pay from labels.
 */
export function extractNetPayFromLabels(text: string, lines: string[]): number | null {
  const directPatterns = [
    /(?:נטו\s*לתשלום|סה["״]?כ\s*לתשלום|שכר\s*נטו|הסכום\s*לתשלום|נטו\s*בבנק|נטו\s*סופי|סה["״]?כ\s*נטו|שכר\s*לתשלום|העברה\s*ל?בנק|הועבר\s*ל?חשבון|net\s*pay|total\s*net|total\s*to\s*pay)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.?\d{0,2})/i,
    /(?:[םמ]ולשתל\s*וט[נן]|וט[נן]\s*[םמ]ולשתל|[םמ]ולשתל\s*כ["״]?הס|וט[נן]\s*רכש|קנבב\s*וט[נן]|קנבל\s*הרבעה|[םמ]ולשתל\s*רכש)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.?\d{0,2})/i,
    /([\d,]+\.?\d{0,2})\s*(?:₪|ILS)?\s*(?:נטו\s*לתשלום|סה["״]?כ\s*לתשלום|שכר\s*נטו|[םמ]ולשתל\s*וט[נן]|[םמ]ולשתל\s*כ["״]?הס)/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    for (const pattern of directPatterns) {
      const match = norm.match(pattern);
      if (match && match[1]) {
        const amt = parseAmount(match[1]);
        if (amt !== null && amt >= 200 && !isProbableYear(amt) && amt < 1000000) {
          return amt;
        }
      }
    }
  }

  return null;
}

/**
 * Extracts Gross Pay from labels.
 */
export function extractGrossPayFromLabels(text: string, lines: string[]): number | null {
  const directPatterns = [
    /(?:סה["״]?כ\s*תשלומים|שכר\s*ברוטו|ברוטו\s*לתשלום|ברוטו\s*חייב|ברוטו\s*למס|סך\s*הכל\s*תשלומים|סך\s*תשלומים|שכר\s*משולב|gross\s*pay|total\s*gross)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.?\d{0,2})/i,
    /(?:[םמ]ימולשת\s*כ["״]?הס|וטורב\s*רכש|וטורב|סמל\s*וטורב|[םמ]ימולשת\s*ךס|בלושמ\s*רכש)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.?\d{0,2})/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    for (const pattern of directPatterns) {
      const match = norm.match(pattern);
      if (match && match[1]) {
        const amt = parseAmount(match[1]);
        if (amt !== null && amt >= 500 && !isProbableYear(amt) && amt < 1000000) {
          return amt;
        }
      }
    }
  }

  return null;
}

/**
 * Extracts Total Deductions from labels.
 */
export function extractTotalDeductionsFromLabels(text: string, lines: string[]): number | null {
  const directPatterns = [
    /(?:סה["״]?כ\s*ניכויים|סה["״]?כ\s*ניכויי\s*חובה|סך\s*הכל\s*ניכויים|סך\s*ניכויים|total\s*deductions|deductions)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.?\d{0,2})/i,
    /(?:[םמ]ייוכינ\s*כ["״]?הס|הבוח\s*ייוכינ\s*כ["״]?הס|[םמ]ייוכינ\s*ךס|[םמ]ייוכינ)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.?\d{0,2})/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    for (const pattern of directPatterns) {
      const match = norm.match(pattern);
      if (match && match[1]) {
        const amt = parseAmount(match[1]);
        if (amt !== null && amt >= 0 && !isProbableYear(amt) && amt < 1000000) {
          return amt;
        }
      }
    }
  }

  return null;
}

/**
 * Extracts Month and Year (e.g. 07/2026, July 2026, or from filename TL_2026_07_...).
 */
export function extractPeriod(
  text: string,
  lines: string[],
  filename?: string
): { month: number | null; year: number | null } {
  if (filename) {
    const yrMatch = filename.match(/20\d{2}/);
    const moMatch = filename.match(/[_\-\/.](0?[1-9]|1[0-2])[_\-\/.]/);
    if (yrMatch && moMatch) {
      return {
        year: parseInt(yrMatch[0], 10),
        month: parseInt(moMatch[1], 10),
      };
    }
  }

  const periodPatterns = [
    /(?:חודש|תקופת\s*שכר|שכר\s*חודש|לתקופה|תלוש\s*שכר\s*ל?חודש|month|period)\s*[:.\-]?\s*(0?[1-9]|1[0-2])[\/\-.](20\d{2})/i,
    /(?:חודש|תקופת\s*שכר|שכר\s*חודש|לתקופה|תלוש\s*שכר\s*ל?חודש|month|period)\s*[:.\-]?\s*(20\d{2})[\/\-.](0?[1-9]|1[0-2])/i,
    /\b(0?[1-9]|1[0-2])[\/\-.](20\d{2})\b/,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    for (const pattern of periodPatterns) {
      const match = norm.match(pattern);
      if (match) {
        if (match[2].length === 4) {
          return {
            month: parseInt(match[1], 10),
            year: parseInt(match[2], 10),
          };
        } else if (match[1].length === 4) {
          return {
            year: parseInt(match[1], 10),
            month: parseInt(match[2], 10),
          };
        }
      }
    }
  }

  return { month: null, year: null };
}

/**
 * Extracts clean decoded Hebrew text from pdf2json page structures.
 */
function extractWithPdf2Json(pdfBuffer: Buffer): Promise<string> {
  return new Promise((resolve) => {
    try {
      const PDFParser = require("pdf2json");
      const parser = new PDFParser(null, 1);

      parser.on("pdfParser_dataError", () => resolve(""));
      parser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          let fullText = "";
          if (pdfData && pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (!page.Texts) continue;
              let lastY: number | null = null;
              for (const textItem of page.Texts) {
                const y = textItem.y;
                if (lastY !== null && Math.abs(y - lastY) > 0.3) {
                  fullText += "\n";
                } else if (fullText.length > 0 && !fullText.endsWith("\n") && !fullText.endsWith(" ")) {
                  fullText += " ";
                }
                if (textItem.R) {
                  for (const r of textItem.R) {
                    try {
                      fullText += decodeURIComponent(r.T || "");
                    } catch {
                      fullText += r.T || "";
                    }
                  }
                }
                lastY = y;
              }
              fullText += "\n";
            }
          }
          resolve(fullText);
        } catch {
          resolve("");
        }
      });

      parser.parseBuffer(pdfBuffer);
    } catch {
      resolve("");
    }
  });
}

/**
 * Extracts raw text from a PDF buffer with multi-engine fallback.
 */
async function extractRawPdfText(pdfBuffer: Buffer): Promise<string> {
  // 1. pdf2json with URI decoded Hebrew
  try {
    const text2json = await extractWithPdf2Json(pdfBuffer);
    if (text2json && text2json.trim().length > 30) {
      return text2json;
    }
  } catch (err) {
    console.warn("pdf2json extraction error:", err);
  }

  // 2. pdfjs-dist with preloaded worker
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    try {
      // @ts-ignore
      await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    } catch {}

    const uint8 = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
    const loadingTask = pdfjs.getDocument({
      data: uint8,
      useSystemFonts: true,
      disableFontFace: true,
      stopAtErrors: false,
    });
    const doc = await loadingTask.promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      let lastY: number | null = null;
      let pageText = "";

      for (const item of textContent.items as any[]) {
        if (!item.str) continue;
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 4) {
          pageText += "\n";
        } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
          pageText += " ";
        }
        pageText += item.str;
        lastY = item.transform[5];
      }

      fullText += pageText + "\n";
    }

    if (fullText.trim().length > 0) {
      return fullText;
    }
  } catch (err) {
    console.warn("PDFJS extraction error:", err);
  }

  return "";
}

/**
 * Main parser entry point: Parses a digital payslip PDF buffer and extracts structured data.
 *
 * @param pdfBuffer - Buffer of the PDF file
 * @param filename - Optional original filename (e.g. payslip_sample.pdf)
 * @returns ParsedPayslipResponse
 */
export async function parseDigitalPayslipPdf(
  pdfBuffer: Buffer,
  filename?: string
): Promise<ParsedPayslipResponse> {
  try {
    const rawText = await extractRawPdfText(pdfBuffer);

    console.log("=== PAYSIP PDF PARSE DEBUG ===");
    console.log("Extracted raw text length:", rawText.length);
    console.log(rawText.slice(0, 800));
    console.log("===============================");

    const alphanumericCount = (rawText.match(/[\p{L}\p{N}]/gu) || []).length;
    const lines: string[] = rawText
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter(Boolean);

    // 1. Extract identification & period
    const employeeId = extractEmployeeId(rawText, lines, filename);
    const employeeName = extractEmployeeName(rawText, lines);
    const period = extractPeriod(rawText, lines, filename);

    // 2. Try Har-Gal / Michpal table components layout first
    const harGalResult = extractHarGalMichpalSalary(lines);

    let grossPay: number | null = null;
    let totalDeductions: number | null = null;
    let netPay: number | null = null;

    if (harGalResult) {
      grossPay = harGalResult.gross;
      totalDeductions = harGalResult.deductions;
      netPay = harGalResult.net;
    } else {
      // 3. Fallback to standard labels
      netPay = extractNetPayFromLabels(rawText, lines);
      grossPay = extractGrossPayFromLabels(rawText, lines);
      totalDeductions = extractTotalDeductionsFromLabels(rawText, lines);

      if (grossPay !== null && totalDeductions !== null && netPay === null) {
        netPay = Math.round((grossPay - totalDeductions) * 100) / 100;
      } else if (grossPay !== null && netPay !== null && totalDeductions === null) {
        totalDeductions = Math.round((grossPay - netPay) * 100) / 100;
      }
    }

    const hasAnyExtractedData =
      employeeId !== null ||
      employeeName !== null ||
      netPay !== null ||
      period.month !== null ||
      period.year !== null;

    if (alphanumericCount < 20 && !hasAnyExtractedData) {
      return {
        success: false,
        error: "SCANNED_PDF_NOT_SUPPORTED",
      };
    }

    return {
      success: true,
      data: {
        employee_name: employeeName,
        employee_id: employeeId,
        net_pay: netPay,
        gross_pay: grossPay,
        total_deductions: totalDeductions,
        period_month: period.month,
        period_year: period.year,
        currency: "ILS",
      },
      confidence: {
        name_found: employeeName !== null,
        id_found: employeeId !== null,
        net_pay_found: netPay !== null,
        gross_pay_found: grossPay !== null,
        deductions_found: totalDeductions !== null,
        period_found: period.month !== null && period.year !== null,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to parse PDF document",
    };
  }
}
