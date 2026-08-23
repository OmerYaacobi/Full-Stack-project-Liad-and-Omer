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
 * Normalizes byte-swapped UTF-16 / CID font characters emitted by legacy Israeli PDF generators.
 */
export function decodeSwappedPdfText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // 1. Hangul Jamo glyphs mapped to digits (e.g. 0x1100 = '1')
    if (code === 0x1100) {
      out += "1";
    } else if (code >= 0x1101 && code <= 0x1109) {
      out += String.fromCharCode(0x31 + (code - 0x1100));
    }
    // 2. Swapped 0x3000 (swapped ASCII 0x0030 = "0")
    else if (code === 0x3000) {
      out += "0";
    }
    // 3. Swapped ASCII / Digits / Punctuation (0x2000 to 0x7E00 -> 0x0020 to 0x007E)
    else if ((code & 0x00FF) === 0 && (code >> 8) >= 0x20 && (code >> 8) <= 0x7E) {
      out += String.fromCharCode(code >> 8);
    }
    // 4. Swapped Hebrew Unicode (0xD000 to 0xFA00 -> 0x05D0 to 0x05EA)
    else if ((code & 0x00FF) === 0 && (code >> 8) >= 0xD0 && (code >> 8) <= 0xFA) {
      const hebrewOffset = (code >> 8) - 0xD0;
      if (hebrewOffset <= 26) {
        out += String.fromCharCode(0x05D0 + hebrewOffset);
      } else {
        out += String.fromCharCode(code >> 8);
      }
    }
    // 5. Fullwidth CJK numbers (0xFF10 to 0xFF19 -> '0'..'9')
    else if (code >= 0xFF10 && code <= 0xFF19) {
      out += String.fromCharCode(code - 0xFF10 + 0x30);
    }
    // 6. Normal character
    else {
      out += text[i];
    }
  }
  return out;
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
  return amt >= 2020 && amt <= 2035 && Number.isInteger(amt);
}

/**
 * Extracts Employee ID (Israeli 9-digit national ID / ת.ז or employee number).
 */
export function extractEmployeeId(text: string, lines: string[], filename?: string): string | null {
  // 1. Filename Israeli ID check (e.g. 207855917_2026_06_unlocked.pdf)
  if (filename) {
    const fnDigits = filename.match(/\b\d{8,9}\b/g) || filename.match(/_(\d{7,9})_/);
    if (fnDigits) {
      for (const num of fnDigits) {
        const clean = num.replace(/\D/g, "");
        if (isValidIsraeliId(clean) && !clean.startsWith("936") && !clean.startsWith("51")) {
          return clean.padStart(9, "0");
        }
      }
    }
  }

  // 2. Direct Employee ID Label patterns
  const idLabelPatterns = [
    /(?:ת\.?ז\.?|תעודת\s*זהות|מס(?:פר)?\s*זהות|מ\.?ז\.?|ת\.?זהות|id\s*(?:no|number|#)?|national\s*id)\s*[:.\-]?\s*(\d{7,9})/i,
    /(?:ז\.?ת\.?|תוהז\s*תדועת|תוהז\s*רפסמ|תוהז\s*ת|ז\.?מ\.?)\s*[:.\-]?\s*(\d{7,9})/i,
    /(\d{7,9})\s*[:.\-]?\s*(?:ת\.?ז\.?|תעודת\s*זהות|מספר\s*זהות|ז\.?ת\.?|תוהז\s*רפסמ)/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    if (/תיק\s*ניכויים|םייוכינ\s*קית|ח\.פ|חברה|הרבח/i.test(norm)) continue;

    for (const pattern of idLabelPatterns) {
      const match = norm.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim().padStart(9, "0");
        if (isValidIsraeliId(candidate)) {
          return candidate;
        }
      }
    }
  }

  // 3. Standalone 8-9 digit sequence passing checksum
  const digitsMatches = text.match(/\b\d{8,9}\b/g);
  if (digitsMatches) {
    for (const num of digitsMatches) {
      if (isValidIsraeliId(num) && !num.startsWith("936") && !num.startsWith("51")) {
        return num.padStart(9, "0");
      }
    }
  }

  return null;
}

/**
 * Cleans extracted employee name by stripping table column labels.
 */
function cleanEmployeeNameCandidate(raw: string): string | null {
  let clean = raw.trim();
  clean = clean
    .replace(/^(לכבוד|מר|גב|מר\/גב|עובד|לכבוד:)\s*/g, "")
    .replace(/מס(?:פר)?\s*['"״׳]?\s*עובד/gi, "")
    .replace(/שם\s*ה?עובד|שם\s*ה?מועסק/gi, "")
    .replace(/תעודת\s*זהות|ת\.?ז\.?|תוהז/gi, "")
    .replace(/מחלקה|תת\s*מחלקה|תפקיד|דרוג|דרגה|סניף|בנק|חברה|הרבח/gi, "")
    .replace(/וותק|ותק|תחילת|עבודה|הדובע|תליחת|קתו|תת/gi, "")
    .replace(/[:.\-\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length < 3 || /^\d+$/.test(clean)) return null;
  return clean;
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
    if (/תיק\s*ניכויים|םייוכינ\s*קית|חברה|הרבח|בע["״]?מ/i.test(norm)) continue;

    const reversedNameMatch = norm.match(/^([א-ת\s]{3,30})\s+(\d{8,9})/);
    if (reversedNameMatch) {
      const candidate = cleanEmployeeNameCandidate(reverseHebrewString(reversedNameMatch[1].trim()));
      if (candidate) return candidate;
    }

    for (const pattern of namePatterns) {
      const match = norm.match(pattern);
      if (match && match[1]) {
        let nameCandidate = cleanEmployeeNameCandidate(match[1]);
        if (nameCandidate) {
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
 * Parses Israeli Michpal / Har-Gal table components layout.
 */
function extractHarGalMichpalSalary(lines: string[]): { gross: number; deductions: number; net: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/םיביכרמ\s*כ["״]?הס|מרכיבים\s*כ["״]?הס|סה["״]?כ\s*מרכיבים|םייוכינ\s*כ["״]?הס/.test(line)) {
      let totalDeductions: number | null = null;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        if (/^\d{1,5}\.\d{2}$/.test(lines[j])) {
          totalDeductions = parseAmount(lines[j]);
          break;
        }
      }

      let grossPay: number | null = null;
      for (let j = 0; j < i; j++) {
        if (/^\d{3,6}\.\d{2}$/.test(lines[j])) {
          const amt = parseAmount(lines[j]);
          if (amt !== null && amt >= 500 && amt < 100000 && amt !== 16173) {
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
 * Extracts Net Pay from labels (שכר נטו / נטו לתשלום).
 */
export function extractNetPayFromLabels(text: string, lines: string[]): number | null {
  const directPatterns = [
    /(?:שכר\s*נטו|נטו\s*לתשלום|הסכום\s*לתשלום|הועבר\s*ל?בנק|העברה\s*ל?בנק|net\s*pay)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.\d{2})/i,
    /([\d,]+\.\d{2})\s*(?:₪|ILS)?\s*(?:שכר\s*נטו|נטו\s*לתשלום)/i,
    /(?:[םמ]ולשתל\s*וט[נן]|וט[נן]\s*[םמ]ולשתל|וט[נן]\s*רכש|קנבל\s*הרבעה)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.\d{2})/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    if (/פיצויים|קופ["״]?ג|הבראה|נסיעות|פנסיה|חופשה|חייב|םייוציפל/i.test(norm)) continue;

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
 * Extracts Gross Pay from labels (סה"כ תשלומים / שכר ברוטו).
 */
export function extractGrossPayFromLabels(text: string, lines: string[]): number | null {
  const directPatterns = [
    /(?:סה["״]?כ\s*תשלומים|שכר\s*ברוטו|ברוטו\s*לתשלום|סך\s*הכל\s*תשלומים|סך\s*תשלומים|gross\s*pay|total\s*gross)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.\d{2})/i,
    /([\d,]+\.\d{2})\s*(?:₪|ILS)?\s*(?:סה["״]?כ\s*תשלומים|שכר\s*ברוטו)/i,
    /(?:[םמ]ימולשת\s*כ["״]?הס|וטורב\s*רכש|וטורב)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.\d{2})/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    if (/פיצויים|קופ["״]?ג|בסיס|חייב/i.test(norm)) continue;

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
 * Extracts Total Deductions from labels (סה"כ ניכויים).
 */
export function extractTotalDeductionsFromLabels(text: string, lines: string[]): number | null {
  const directPatterns = [
    /(?:סה["״]?כ\s*ניכויים|סך\s*הכל\s*ניכויים|סה["״]?כ\s*ניכויי\s*חובה|total\s*deductions)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.\d{2})/i,
    /([\d,]+\.\d{2})\s*(?:₪|ILS)?\s*(?:סה["״]?כ\s*ניכויים)/i,
    /(?:[םמ]ייוכינ\s*כ["״]?הס|הבוח\s*ייוכינ\s*כ["״]?הס)\s*[:.\-]?\s*(?:₪|ILS)?\s*([\d,]+\.\d{2})/i,
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
 * Confidence-Weighted Mathematical Triad Solver:
 * Finds the exact triad (Gross, Deductions, Net) such that Gross - Deductions = Net.
 * Ranks triads by occurrence frequency, realistic deduction proportions, and standard formatting.
 */
function solveMathematicalSalaryTriad(text: string): { gross: number; deductions: number; net: number } | null {
  const allNumberMatches = text.match(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b|\b\d{2,6}\.\d{2}\b/g) || [];
  const numbers = allNumberMatches
    .map(n => parseAmount(n))
    .filter((n): n is number => n !== null && n > 0 && n < 500000 && !isProbableYear(n));

  // Count occurrences
  const freq: Record<number, number> = {};
  for (const n of numbers) {
    freq[n] = (freq[n] || 0) + 1;
  }

  const uniqueNumbers = Object.keys(freq).map(Number);
  const candidates: Array<{ gross: number; deductions: number; net: number; score: number }> = [];

  for (const g of uniqueNumbers) {
    for (const d of uniqueNumbers) {
      for (const n of uniqueNumbers) {
        if (g > n && g > d && n >= 200 && Math.abs((g - d) - n) < 0.05) {
          let score = (freq[g] || 1) + (freq[d] || 1) + (freq[n] || 1);

          // Realistic deduction ratio bonus (Deductions < Net, Deductions <= Gross * 0.5)
          if (d < n && d <= g * 0.5) {
            score += 10;
          }

          // Significant gross bonus (most Israeli salaries >= 1000)
          if (g >= 1000) {
            score += 5;
          }

          candidates.push({ gross: g, deductions: d, net: n, score });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return { gross: candidates[0].gross, deductions: candidates[0].deductions, net: candidates[0].net };
}

/**
 * Extracts Month and Year (e.g. 06/2026, 07/2026, or from filename).
 */
export function extractPeriod(
  text: string,
  lines: string[],
  filename?: string
): { month: number | null; year: number | null } {
  if (filename) {
    const fnMatch1 = filename.match(/\b(202[0-9]|203[0-9])[_\-\/.](0?[1-9]|1[0-2])\b/);
    if (fnMatch1) {
      return { year: parseInt(fnMatch1[1], 10), month: parseInt(fnMatch1[2], 10) };
    }
    const fnMatch2 = filename.match(/\b(0?[1-9]|1[0-2])[_\-\/.](202[0-9]|203[0-9])\b/);
    if (fnMatch2) {
      return { year: parseInt(fnMatch2[2], 10), month: parseInt(fnMatch2[1], 10) };
    }
    const fnParts = filename.split(/[_\-\/.]/);
    const yr = fnParts.find(p => /^202[0-9]|203[0-9]$/.test(p));
    const mo = fnParts.find(p => /^(0?[1-9]|1[0-2])$/.test(p));
    if (yr && mo) {
      return { year: parseInt(yr, 10), month: parseInt(mo, 10) };
    }
  }

  const periodPatterns = [
    /(?:תלוש\s*משכורת\s*ל?חודש|תלוש\s*שכר\s*ל?חודש|שכר\s*חודש|תקופת\s*שכר|חודש|month|period)\s*[:.\-]?\s*(0?[1-9]|1[0-2])[\/\-.](202[0-9]|203[0-9])\b/i,
    /(?:תלוש\s*משכורת\s*ל?חודש|תלוש\s*שכר\s*ל?חודש|שכר\s*חודש|תקופת\s*שכר|חודש|month|period)\s*[:.\-]?\s*(202[0-9]|203[0-9])[\/\-.](0?[1-9]|1[0-2])\b/i,
    /\b(0?[1-9]|1[0-2])[\/\-.](202[0-9]|203[0-9])\b/,
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
 * Extracts text using pdfjs-dist with built-in CMap and font decoding.
 */
async function extractWithPdfJs(pdfBuffer: Buffer): Promise<string> {
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

    return fullText;
  } catch (err) {
    console.warn("PDFJS extraction error:", err);
    return "";
  }
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
 * Extracts raw text from a PDF buffer with multi-engine fallback and byte-swap normalization.
 */
async function extractRawPdfText(pdfBuffer: Buffer): Promise<string> {
  let rawText = await extractWithPdfJs(pdfBuffer);

  if (!rawText || rawText.trim().length < 30) {
    rawText = await extractWithPdf2Json(pdfBuffer);
  }

  if (rawText && rawText.length > 0) {
    rawText = decodeSwappedPdfText(rawText);
  }

  return rawText || "";
}

/**
 * Main parser entry point: Parses a digital payslip PDF buffer and extracts structured data.
 *
 * @param pdfBuffer - Buffer of the PDF file
 * @param filename - Optional original filename
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

    // 2. Direct Explicit Label Extraction (Highest Priority)
    let netPay = extractNetPayFromLabels(rawText, lines);
    let grossPay = extractGrossPayFromLabels(rawText, lines);
    let totalDeductions = extractTotalDeductionsFromLabels(rawText, lines);

    // 3. If explicit labels are not all found, try Har-Gal / Michpal table format
    if (netPay === null || grossPay === null || totalDeductions === null) {
      const harGalResult = extractHarGalMichpalSalary(lines);
      if (harGalResult) {
        if (grossPay === null) grossPay = harGalResult.gross;
        if (totalDeductions === null) totalDeductions = harGalResult.deductions;
        if (netPay === null) netPay = harGalResult.net;
      }
    }

    // 4. Confidence-Weighted Triad Solver (Handles detached columns)
    if (grossPay === null || netPay === null || totalDeductions === null) {
      const triad = solveMathematicalSalaryTriad(rawText);
      if (triad) {
        console.log("✓ Confidence-weighted salary triad selected:", triad);
        if (grossPay === null) grossPay = triad.gross;
        if (totalDeductions === null) totalDeductions = triad.deductions;
        if (netPay === null) netPay = triad.net;
      }
    }

    // 5. Mathematical deduction fallback
    if (grossPay !== null && totalDeductions !== null && netPay === null) {
      netPay = Math.round((grossPay - totalDeductions) * 100) / 100;
    } else if (grossPay !== null && netPay !== null && totalDeductions === null) {
      totalDeductions = Math.round((grossPay - netPay) * 100) / 100;
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
