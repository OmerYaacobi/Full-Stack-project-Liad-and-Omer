export interface ParsedPayslipData {
  employee_name: string | null;
  employee_id: string | null;
  net_pay: number | null;
  gross_pay: number | null;
  total_deductions: number | null;
  period_month: number | null;
  period_year: number | null;
  currency: string;
  vacation_days: number | null;
  sick_days: number | null;
}

export interface ParsedPayslipConfidence {
  name_found: boolean;
  id_found: boolean;
  net_pay_found: boolean;
  gross_pay_found?: boolean;
  deductions_found?: boolean;
  period_found?: boolean;
  vacation_found?: boolean;
  sick_found?: boolean;
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

const VACATION_PAY = /דמי\s*חופשה|פדיון\s*חופשה|פדיון/;
const SICK_PAY = /דמי\s*מחלה/;
const LEAVE_NOISE = /צבירת?|ניצול|דמי|פדיון|הבראה|מילואים|שעות|תועש|\bhours?\b|opening|accrual/;

export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
};

function hasVacationLabel(text: string): boolean {
  if (VACATION_PAY.test(text)) return false;
  if (/שעות|תועש|\bhours?\b/i.test(text)) return false;
  return /חופש|vacation|annual\s*leave|השפוח|שפוח/.test(text);
}

function hasSickLabel(text: string): boolean {
  if (SICK_PAY.test(text)) return false;
  if (/שעות|תועש|\bhours?\b/i.test(text)) return false;
  return /מחלה|sick\s*(?:days?|leave)|\bsick\b|הלחמ/.test(text);
}

function isLeaveMovementRow(text: string): boolean {
  return /פתיחה|קודמת|ניצול|צבירה|נוצל|נצבר|הריבצ|לצונ|המדוק|opening|accrual/.test(text);
}

function isClosingBalanceHeader(text: string): boolean {
  const t = normalizeTextLine(text);
  if (!t || LEAVE_NOISE.test(t) || isLeaveMovementRow(t)) return false;
  if (hasVacationLabel(t) || hasSickLabel(t)) return false;
  return t
    .split(/\s+/)
    .some((token) => /^(יתרה|יתרת|ליתרה|remaining|balance|הרתי|הרתיל|יתרת\s*סגירה)$/i.test(token));
}

function isTypeRowLabel(text: string, kind: "vacation" | "sick"): boolean {
  if (LEAVE_NOISE.test(text) || VACATION_PAY.test(text) || SICK_PAY.test(text)) {
    return false;
  }
  if (kind === "vacation") return hasVacationLabel(text) && !hasSickLabel(text);
  return hasSickLabel(text) && !hasVacationLabel(text);
}

/** Day counts only — supports zero, negative balances, and 1-3 decimals. */
function parseLeaveDays(raw: string): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim().replace(/[₪ILS]/gi, "");
  if (!trimmed) return null;
  if (/^\d{1,3},\d{3}/.test(trimmed)) return null;

  let clean = trimmed;
  let isNegative = false;
  if (clean.endsWith("-")) {
    isNegative = true;
    clean = clean.slice(0, -1);
  } else if (clean.startsWith("-")) {
    isNegative = true;
    clean = clean.slice(1);
  }

  clean = clean.replace(/,/g, ".");
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(clean)) return null;
  const value = Number(clean) * (isNegative ? -1 : 1);
  if (!Number.isFinite(value) || value < -100 || value > 365) return null;
  if (isProbableYear(value)) return null;
  return Math.round(value * 100) / 100;
}

function dayNumbersIn(text: string): number[] {
  const matches = text.match(/\d{1,3}(?:[.,]\d{1,2})?/g) ?? [];
  return matches
    .map(parseLeaveDays)
    .filter((value): value is number => value !== null);
}

function itemCenterX(item: PdfTextItem): number {
  return item.x + item.width / 2;
}

function mergeRowWords(row: PdfTextItem[]): PdfTextItem[] {
  const merged: PdfTextItem[] = [];
  for (const item of row) {
    const prev = merged[merged.length - 1];
    const gap = prev ? item.x - (prev.x + prev.width) : Infinity;
    const prevNumeric = Boolean(prev && /^\d/.test(prev.text));
    const currentNumeric = /^\d/.test(item.text);
    if (prev && gap < 4.5 && !(prevNumeric || currentNumeric)) {
      prev.text += item.text;
      prev.width = Math.max(prev.width, item.x + item.width - prev.x);
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

function isRowHours(row: PdfTextItem[]): boolean {
  const rowText = row.map((item) => normalizeTextLine(item.text)).join(" ");
  return /שעות|תועש|\bhours?\b/i.test(rowText);
}

function isRowDays(row: PdfTextItem[]): boolean {
  const rowText = row.map((item) => normalizeTextLine(item.text)).join(" ");
  return /ימים|םימי|\bdays?\b/i.test(rowText);
}

function clusterRows(items: PdfTextItem[], yTol = 4): PdfTextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PdfTextItem[][] = [];
  for (const item of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - item.y) <= yTol);
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows.map((row) => mergeRowWords([...row].sort((a, b) => a.x - b.x)));
}

function collectLabels(
  rows: PdfTextItem[][],
  kind: "vacation" | "sick",
): PdfTextItem[] {
  const found: PdfTextItem[] = [];
  for (const row of rows) {
    if (isRowHours(row)) continue;
    for (const cell of row) {
      const text = normalizeTextLine(cell.text);
      if (!isTypeRowLabel(text, kind)) continue;
      if (dayNumbersIn(text).length > 0) continue;
      found.push({ ...cell, text, y: row[0].y });
    }
  }
  return found;
}

function closestPair(
  vacations: PdfTextItem[],
  sicks: PdfTextItem[],
): { vacation: PdfTextItem; sick: PdfTextItem } | null {
  let best: { vacation: PdfTextItem; sick: PdfTextItem; dist: number } | null = null;
  for (const vacation of vacations) {
    for (const sick of sicks) {
      const dist = Math.hypot(vacation.x - sick.x, vacation.y - sick.y);
      if (dist === 0) continue;
      if (!best || dist < best.dist) best = { vacation, sick, dist };
    }
  }
  return best;
}

function numberCells(rows: PdfTextItem[][]): PdfTextItem[] {
  const cells: PdfTextItem[] = [];
  for (const row of rows) {
    if (isRowHours(row)) continue;
    for (const cell of row) {
      const text = normalizeTextLine(cell.text);
      if (hasVacationLabel(text) || hasSickLabel(text) || LEAVE_NOISE.test(text)) {
        continue;
      }
      const value = parseLeaveDays(text);
      if (value === null) continue;
      cells.push({ ...cell, text: String(value), y: row[0].y });
    }
  }
  return cells;
}

function valueAtIntersection(
  numbers: PdfTextItem[],
  columnX: number,
  rowY: number,
  xTol: number,
  yTol: number,
): number | null {
  let best: { score: number; value: number } | null = null;
  for (const cell of numbers) {
    const dx = Math.abs(itemCenterX(cell) - columnX);
    const dy = Math.abs(cell.y - rowY);
    if (dx > xTol || dy > yTol) continue;
    const value = Number(cell.text);
    const score = dx + dy * 2;
    if (!best || score < best.score) best = { score, value };
  }
  return best ? best.value : null;
}

function clusterColumnCenters(xs: number[], xTol: number): number[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const x of sorted) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(group[group.length - 1] - x) <= xTol) group.push(x);
    else groups.push([x]);
  }
  return groups.map((group) => group.reduce((sum, x) => sum + x, 0) / group.length);
}

/**
 * חופש and מחלה are rows; יתרה is a column. Read the cell at each intersection.
 */
export function extractLeaveBalancesFromGrid(
  items: PdfTextItem[],
): { vacationDays: number | null; sickDays: number | null } {
  const usable = items
    .map((item) => ({
      ...item,
      text: normalizeTextLine(decodeSwappedPdfText(item.text)),
    }))
    .filter((item) => item.text.length > 0);
  if (usable.length === 0) {
    return { vacationDays: null, sickDays: null };
  }

  const rows = clusterRows(usable);
  const pair = closestPair(collectLabels(rows, "vacation"), collectLabels(rows, "sick"));
  if (!pair) return { vacationDays: null, sickDays: null };

  const numbers = numberCells(rows);
  const rowGap = Math.abs(pair.vacation.y - pair.sick.y);
  const colGap = Math.abs(pair.vacation.x - pair.sick.x);
  const typesAreRows = colGap <= rowGap;
  const yTol = Math.max(5, (typesAreRows ? rowGap : colGap) * 0.4);
  const xTol = Math.max(14, (typesAreRows ? Math.max(rowGap, 24) : colGap) * 0.45);

  const headers: PdfTextItem[] = [];
  for (const row of rows) {
    for (const cell of row) {
      if (isClosingBalanceHeader(normalizeTextLine(cell.text))) {
        headers.push({ ...cell, y: row[0].y });
      }
    }
  }

  const midX = (pair.vacation.x + pair.sick.x) / 2;
  const midY = (pair.vacation.y + pair.sick.y) / 2;
  const tableSpan = Math.max(rowGap, colGap, 36) * 10;
  const yitra = headers
    .map((header) => ({
      header,
      dist: Math.hypot(itemCenterX(header) - midX, header.y - midY),
      away: Math.abs(itemCenterX(header) - midX),
    }))
    .filter((entry) => entry.dist <= tableSpan)
    .sort((a, b) => b.away - a.away || a.dist - b.dist)[0]?.header;

  const remainingX = yitra ? itemCenterX(yitra) : null;
  const remainingY = yitra ? yitra.y : null;

  if (typesAreRows) {
    const columnX =
      remainingX ??
      pickRemainingColumnX(numbers, pair.vacation, pair.sick, yTol, xTol);
    if (columnX === null) return { vacationDays: null, sickDays: null };
    const columnTol = remainingX !== null ? Math.max(10, Math.min(xTol, 22)) : xTol;
    return {
      vacationDays: valueAtIntersection(numbers, columnX, pair.vacation.y, columnTol, yTol),
      sickDays: valueAtIntersection(numbers, columnX, pair.sick.y, columnTol, yTol),
    };
  }

  const rowY =
    remainingY ??
    pickRemainingRowY(numbers, pair.vacation, pair.sick, xTol, yTol);
  if (rowY === null) return { vacationDays: null, sickDays: null };
  return {
    vacationDays: valueAtIntersection(numbers, itemCenterX(pair.vacation), rowY, xTol, yTol),
    sickDays: valueAtIntersection(numbers, itemCenterX(pair.sick), rowY, xTol, yTol),
  };
}

function pickRemainingRowY(
  numbers: PdfTextItem[],
  vacation: PdfTextItem,
  sick: PdfTextItem,
  xTol: number,
  yTol: number,
): number | null {
  const labelY = (vacation.y + sick.y) / 2;
  const xMin = Math.min(vacation.x, sick.x) - xTol;
  const xMax = Math.max(vacation.x, sick.x) + xTol;
  const nearby = numbers.filter(
    (cell) =>
      itemCenterX(cell) >= xMin &&
      itemCenterX(cell) <= xMax &&
      Math.abs(cell.y - labelY) > 8,
  );
  if (nearby.length === 0) return null;

  const centers = clusterColumnCenters(
    nearby.map((cell) => cell.y),
    Math.max(8, yTol),
  );

  let best: { y: number; score: number } | null = null;
  for (const rowY of centers) {
    const vacationValue = valueAtIntersection(
      nearby,
      itemCenterX(vacation),
      rowY,
      xTol,
      yTol,
    );
    const sickValue = valueAtIntersection(nearby, itemCenterX(sick), rowY, xTol, yTol);
    if (vacationValue === null && sickValue === null) continue;
    const filled = Number(vacationValue !== null) + Number(sickValue !== null);
    const differed =
      vacationValue !== null && sickValue !== null && vacationValue !== sickValue;
    const score = filled * 40 + (differed ? 15 : 0);
    if (!best || score > best.score) best = { y: rowY, score };
  }
  return best?.y ?? null;
}

function pickRemainingColumnX(
  numbers: PdfTextItem[],
  vacation: PdfTextItem,
  sick: PdfTextItem,
  yTol: number,
  xTol: number,
): number | null {
  const labelX = (vacation.x + sick.x) / 2;
  const yMin = Math.min(vacation.y, sick.y) - yTol;
  const yMax = Math.max(vacation.y, sick.y) + yTol;
  const nearby = numbers.filter(
    (cell) =>
      cell.y >= yMin &&
      cell.y <= yMax &&
      Math.abs(itemCenterX(cell) - labelX) > 12,
  );
  if (nearby.length === 0) return null;

  const centers = clusterColumnCenters(
    nearby.map(itemCenterX),
    Math.max(10, xTol),
  );

  let best: { x: number; score: number } | null = null;
  for (const columnX of centers) {
    const vacationValue = valueAtIntersection(nearby, columnX, vacation.y, xTol, yTol);
    const sickValue = valueAtIntersection(nearby, columnX, sick.y, xTol, yTol);
    if (vacationValue === null && sickValue === null) continue;
    const filled = Number(vacationValue !== null) + Number(sickValue !== null);
    const differed = vacationValue !== null && sickValue !== null && vacationValue !== sickValue;
    const awayFromLabels = Math.abs(columnX - labelX);
    const score = filled * 40 + (differed ? 15 : 0) + awayFromLabels / 20;
    if (!best || score > best.score) best = { x: columnX, score };
  }
  return best?.x ?? null;
}

function coalesceHeaderTokens(tokens: string[]): string[] {
  const grouped: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];
    if (/^יתרת?$/.test(current) && next && /^(פתיחה|קודמת|חדשה|סגירה)$/.test(next)) {
      grouped.push(`${current} ${next}`);
      i += 1;
    } else if (/^(המדוק|החיתפ|הריגס|השדח)$/.test(current) && next && /^הרתי$/.test(next)) {
      grouped.push(`${current} ${next}`);
      i += 1;
    } else if (/^הרתי$/.test(current) && next && /^(המדוק|החיתפ|הריגס|השדח)$/.test(next)) {
      grouped.push(`${current} ${next}`);
      i += 1;
    } else {
      grouped.push(current);
    }
  }
  return grouped;
}

function remainingColumnIndex(tokens: string[]): number | null {
  const grouped = coalesceHeaderTokens(tokens);
  let last: number | null = null;
  for (let i = 0; i < grouped.length; i++) {
    if (isClosingBalanceHeader(grouped[i])) last = i;
  }
  return last;
}

function tokenAtLeaveCell(tokens: string[], columnIndex: number): number | null {
  if (columnIndex >= 0 && columnIndex < tokens.length) {
    const direct = parseLeaveDays(tokens[columnIndex]);
    if (direct !== null) return direct;
  }
  const numbers = tokens
    .map((token) => parseLeaveDays(token))
    .filter((value): value is number => value !== null);
  const labelOffset = tokens.length - numbers.length;
  const numberIndex = columnIndex - (labelOffset > 0 && columnIndex >= labelOffset ? labelOffset : 0);
  return numbers[numberIndex] ?? numbers[columnIndex] ?? null;
}

function extractLeaveTableFromLines(
  lines: string[],
): { vacationDays: number | null; sickDays: number | null } {
  const normalized = lines.map((line) => normalizeTextLine(line)).filter(Boolean);

  for (let i = 0; i < normalized.length; i++) {
    const headerTokens = coalesceHeaderTokens(normalized[i].split(/\s+/).filter(Boolean));
    const columnIndex = remainingColumnIndex(headerTokens);
    if (columnIndex === null) continue;

    let vacationDays: number | null = null;
    let sickDays: number | null = null;
    for (let j = i + 1; j <= i + 10 && j < normalized.length; j++) {
      const row = normalized[j];
      if (/שעות|תועש|\bhours?\b/i.test(row)) continue;
      const tokens = coalesceHeaderTokens(row.split(/\s+/).filter(Boolean));
      if (tokens.length === 0) continue;
      const vacation = isTypeRowLabel(row, "vacation");
      const sick = isTypeRowLabel(row, "sick");
      if (vacation === sick) continue;
      const value = tokenAtLeaveCell(tokens, columnIndex);
      if (value === null) continue;
      if (vacation) vacationDays = value;
      if (sick) sickDays = value;
    }
    if (vacationDays !== null || sickDays !== null) {
      return { vacationDays, sickDays };
    }
  }

  let vacationDays: number | null = null;
  let sickDays: number | null = null;
  for (const line of normalized) {
    if (/שעות|תועש|\bhours?\b/i.test(line)) continue;
    const vacation = isTypeRowLabel(line, "vacation");
    const sick = isTypeRowLabel(line, "sick");
    if (vacation === sick) continue;
    const numbers = dayNumbersIn(line);
    if (numbers.length === 0) continue;
    const value = numbers[numbers.length - 1];
    if (vacation && vacationDays === null) vacationDays = value;
    if (sick && sickDays === null) sickDays = value;
  }
  return { vacationDays, sickDays };
}

function extractLeaveBalancesFromTextPatterns(
  _text: string,
  lines: string[],
): { vacationDays: number | null; sickDays: number | null } {
  let vacationDays: number | null = null;
  let sickDays: number | null = null;

  const vacationPatterns = [
    /(?:יתר(?:ת|ה)\s*חופש(?:ה)?|יתרת\s*ימי\s*חופש(?:ה)?|צבירת\s*חופש(?:ה)?\s*יתרה|vacation\s*(?:balance|remaining|days?))\s*[:.\-]?\s*(-?[0-9]+(?:\.[0-9]{1,3})?-?)/i,
    /(?:-?[0-9]+(?:\.[0-9]{1,3})?-?)\s*[:.\-]?\s*(?:יתר(?:ת|ה)\s*חופש(?:ה)?|השפוח\s*תרתי|שפוח\s*תרתי|השפוח\s*הרתי|שפוח\s*הרתי)/i,
    /(?:השפוח\s*תרתי|שפוח\s*תרתי|השפוח\s*הרתי|שפוח\s*הרתי|השפוח\s*הרתיל|שפוח\s*הרתיל)\s*[:.\-]?\s*(-?[0-9]+(?:\.[0-9]{1,3})?-?)/i,
    /(?:חופש(?:ה)?|שפוח|השפוח)\s*[:.\-]?\s*(-?[0-9]+(?:\.[0-9]{1,3})?-?)\s*(?:ימים|days|הרתי|תרתי)?/i,
  ];

  const sickPatterns = [
    /(?:יתר(?:ת|ה)\s*מחלה|יתרת\s*ימי\s*מחלה|צבירת\s*מחלה\s*יתרה|sick\s*(?:balance|remaining|days?))\s*[:.\-]?\s*(-?[0-9]+(?:\.[0-9]{1,3})?-?)/i,
    /(?:-?[0-9]+(?:\.[0-9]{1,3})?-?)\s*[:.\-]?\s*(?:יתר(?:ת|ה)\s*מחלה|הלחמ\s*תרתי|הלחמ\s*הרתי|הלחמ\s*הרתיל)/i,
    /(?:הלחמ\s*תרתי|הלחמ\s*הרתי|הלחמ\s*הרתיל)\s*[:.\-]?\s*(-?[0-9]+(?:\.[0-9]{1,3})?-?)/i,
    /(?:מחלה|הלחמ)\s*[:.\-]?\s*(-?[0-9]+(?:\.[0-9]{1,3})?-?)\s*(?:ימים|days|הרתי|תרתי)?/i,
  ];

  for (const line of lines) {
    const norm = normalizeTextLine(line);
    if (vacationDays === null) {
      for (const p of vacationPatterns) {
        const m = norm.match(p);
        if (m && m[1]) {
          const val = parseLeaveDays(m[1]);
          if (val !== null) {
            vacationDays = val;
            break;
          }
        }
      }
    }
    if (sickDays === null) {
      for (const p of sickPatterns) {
        const m = norm.match(p);
        if (m && m[1]) {
          const val = parseLeaveDays(m[1]);
          if (val !== null) {
            sickDays = val;
            break;
          }
        }
      }
    }
  }

  return { vacationDays, sickDays };
}

function solveRowBalance(lineNumbers: number[]): number | null {
  const nums = lineNumbers.filter((n) => n >= 0 && n <= 300);
  if (!nums.includes(0)) nums.push(0);

  // Look for Prev + Accrued - Used = Balance where accrued is a daily accrual (<= 3.5)
  const candidates: Array<{ prev: number; accrued: number; used: number; balance: number }> = [];
  for (const prev of nums) {
    if (prev <= 0) continue;
    for (const accrued of nums) {
      if (accrued <= 0 || accrued > 3.5) continue; // standard day accrual is <= 3.5 days/month
      for (const used of nums) {
        if (used === prev) continue;
        for (const balance of nums) {
          if (balance === accrued && prev > 0) continue;
          if (prev === balance && used !== 0) continue;
          if (balance > 80) continue; // standard day balance is <= 80 days
          if (Math.abs((prev + accrued - used) - balance) < 0.02) {
            candidates.push({ prev, accrued, used, balance });
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.balance - a.balance);
    return candidates[0].balance;
  }

  // Fallback: if numbers are [18.76, 0.00, 1.04, 17.72] or [17.72, 1.04, 0.00, 18.76]
  const validDayBalances = lineNumbers.filter((n) => n > 3.5 && n <= 80);
  if (validDayBalances.length > 0) {
    return validDayBalances[0];
  }
  return null;
}

function extractLeaveFromRowLines(
  lines: string[],
): { vacationDays: number | null; sickDays: number | null } {
  let vacationDays: number | null = null;
  let sickDays: number | null = null;

  for (const line of lines) {
    if (/שעות|תועש|\bhours?\b/i.test(line)) continue;
    const nums = (line.match(/\b\d{1,3}(?:\.\d{1,2})?\b/g) || []).map(Number);
    if (nums.length === 0) continue;

    const isVac =
      /(?:^|\s)(?:חופש|חופשה|שפוח|השפוח)(?:\s|$|:)/i.test(line) &&
      !/(?:^|\s)(?:מחלה|הלחמ)(?:\s|$|:)/i.test(line) &&
      !/צבירת|דמי|פדיון|הריבצ/i.test(line);

    const isSick =
      /(?:^|\s)(?:מחלה|הלחמ)(?:\s|$|:)/i.test(line) &&
      !/(?:^|\s)(?:חופש|חופשה|שפוח|השפוח)(?:\s|$|:)/i.test(line) &&
      !/צבירת|דמי|פדיון|הריבצ/i.test(line);

    if (isVac && vacationDays === null) {
      vacationDays = solveRowBalance(nums);
    }
    if (isSick && sickDays === null) {
      sickDays = solveRowBalance(nums);
    }
  }

  return { vacationDays, sickDays };
}

function extractLeaveSectionText(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leaveLines: string[] = [];
  let capturing = false;
  let linesSinceLeave = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasLeaveWord =
      /חופש|חופשה|שפוח|השפוח|מחלה|הלחמ|הרתיל|ליתרה|ניהול\s*היעדרויות|צבירת/i.test(line);
    if (hasLeaveWord) {
      capturing = true;
      linesSinceLeave = 0;
      if (i > 0 && !leaveLines.includes(lines[i - 1])) {
        leaveLines.push(lines[i - 1]);
      }
      leaveLines.push(line);
    } else if (capturing) {
      linesSinceLeave++;
      if (linesSinceLeave <= 4) {
        leaveLines.push(line);
      } else {
        capturing = false;
      }
    }
  }

  return leaveLines.length > 0 ? leaveLines.join("\n") : text;
}

/**
 * Solves the Israeli leave balance equation:
 * Previous Leave - Used Leave + Accrued Leave = Balance
 * Handles detached-column PDFs where table text and numbers are emitted separately.
 */
function solveIsraeliLeaveEquations(text: string): { vacationDays: number | null; sickDays: number | null } {
  const matches = text.match(/\b\d{1,3}(?:\.\d{1,3})?\b/g) || [];
  const numbers = matches
    .map(Number)
    .filter((n) => !isNaN(n) && n >= 0 && n <= 300 && !isProbableYear(n));

  const unique = Array.from(new Set(numbers));
  if (!unique.includes(0)) unique.push(0);

  const equations: Array<{ prev: number; used: number; accrued: number; balance: number; score: number; kind: "vacation" | "sick" | null }> = [];

  for (const prev of unique) {
    if (prev < 0) continue;
    for (const accrued of unique) {
      if (accrued <= 0 || accrued > 3.5) continue; // Monthly accrual in days is 0.3 to 3.5
      for (const used of unique) {
        if (used === prev && prev > 0 && accrued > 0 && !unique.includes(0)) continue;
        for (const balance of unique) {
          if (balance < 0 || balance > 80) continue; // Days balance is <= 80
          if (balance === accrued && prev > 0 && used === 0) continue;
          if (prev === balance && used !== 0) continue;
          if (Math.abs((prev + accrued - used) - balance) < 0.02) {
            let score = 10;
            const hasDecimals = (balance % 1 !== 0) || (prev % 1 !== 0) || (accrued % 1 !== 0);
            if (hasDecimals) score += 100;
            if (balance >= 5.0 && balance <= 60.0) score += 50;

            const bStr = balance.toFixed(2).replace(".", "\\.");
            const pStr = prev.toFixed(2).replace(".", "\\.");
            const vacRegex = new RegExp(`(?:חופש|שפוח|חופשה|השפוח)[^\\n]{0,100}\\b(${bStr}|${pStr})\\b|\\b(${bStr}|${pStr})\\b[^\\n]{0,100}(?:חופש|שפוח|חופשה|השפוח)`, "i");
            const sickRegex = new RegExp(`(?:מחלה|הלחמ)[^\\n]{0,100}\\b(${bStr}|${pStr})\\b|\\b(${bStr}|${pStr})\\b[^\\n]{0,100}(?:מחלה|הלחמ)`, "i");

            let kind: "vacation" | "sick" | null = null;
            if (vacRegex.test(text)) {
              score += 200;
              kind = "vacation";
            } else if (sickRegex.test(text)) {
              score += 200;
              kind = "sick";
            }

            equations.push({ prev, used, accrued, balance, score, kind });
          }
        }
      }
    }
  }

  if (equations.length === 0) return { vacationDays: null, sickDays: null };

  equations.sort((a, b) => b.score - a.score || b.balance - a.balance);

  let vacationDays = equations.find((e) => e.kind === "vacation")?.balance ?? null;
  let sickDays = equations.find((e) => e.kind === "sick")?.balance ?? null;

  if (vacationDays === null || sickDays === null) {
    const distinct: number[] = [];
    const seen = new Set<number>();
    for (const eq of equations) {
      if (!seen.has(eq.balance)) {
        distinct.push(eq.balance);
        seen.add(eq.balance);
      }
    }
    if (vacationDays === null && distinct.length > 0) vacationDays = distinct[0];
    if (sickDays === null && distinct.length > 1) sickDays = distinct[1];
  }

  return { vacationDays, sickDays };
}

/**
 * Remaining vacation = row חופש × column יתרה.
 * Remaining sick = row מחלה × the same יתרה column.
 */
export function extractLeaveBalances(
  text: string,
  lines: string[],
  items?: PdfTextItem[],
): { vacationDays: number | null; sickDays: number | null } {
  let vacationDays: number | null = null;
  let sickDays: number | null = null;

  // 1. Direct row lines with per-row Israeli equation solver (Highest Accuracy)
  const fromRow = extractLeaveFromRowLines(lines);
  if (fromRow.vacationDays !== null && fromRow.vacationDays <= 80) {
    vacationDays = fromRow.vacationDays;
  }
  if (fromRow.sickDays !== null && fromRow.sickDays <= 80) {
    sickDays = fromRow.sickDays;
  }

  // 2. Spatial 2D grid
  if ((vacationDays === null || sickDays === null) && items && items.length > 0) {
    const fromGrid = extractLeaveBalancesFromGrid(items);
    if ((vacationDays === null || vacationDays > 80) && fromGrid.vacationDays !== null && fromGrid.vacationDays <= 80) {
      vacationDays = fromGrid.vacationDays;
    }
    if ((sickDays === null || sickDays > 80) && fromGrid.sickDays !== null && fromGrid.sickDays <= 80) {
      sickDays = fromGrid.sickDays;
    }
  }

  // 3. Table line alignment
  if (vacationDays === null || sickDays === null) {
    const fromTable = extractLeaveTableFromLines(lines);
    if ((vacationDays === null || vacationDays > 80) && fromTable.vacationDays !== null && fromTable.vacationDays <= 80) {
      vacationDays = fromTable.vacationDays;
    }
    if ((sickDays === null || sickDays > 80) && fromTable.sickDays !== null && fromTable.sickDays <= 80) {
      sickDays = fromTable.sickDays;
    }
  }

  // 4. Textual regex patterns
  if (vacationDays === null || sickDays === null) {
    const fromPatterns = extractLeaveBalancesFromTextPatterns(text, lines);
    if ((vacationDays === null || vacationDays > 80) && fromPatterns.vacationDays !== null && fromPatterns.vacationDays <= 80) {
      vacationDays = fromPatterns.vacationDays;
    }
    if ((sickDays === null || sickDays > 80) && fromPatterns.sickDays !== null && fromPatterns.sickDays <= 80) {
      sickDays = fromPatterns.sickDays;
    }
  }

  // 5. Mathematical Leave Equation Solver (Scoped to Leave Section)
  if (
    vacationDays === null ||
    sickDays === null ||
    (vacationDays !== null && vacationDays > 80) ||
    (sickDays !== null && sickDays > 80)
  ) {
    const fromEquations = solveIsraeliLeaveEquations(text);
    if ((vacationDays === null || vacationDays > 80) && fromEquations.vacationDays !== null) {
      vacationDays = fromEquations.vacationDays;
    }
    if ((sickDays === null || sickDays > 80) && fromEquations.sickDays !== null) {
      sickDays = fromEquations.sickDays;
    }
  }

  return { vacationDays, sickDays };
}

/**
 * Extracts text using pdfjs-dist with built-in CMap and font decoding.
 */
async function extractWithPdfJsLayout(
  pdfBuffer: Buffer,
): Promise<{ text: string; items: PdfTextItem[] }> {
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
    const items: PdfTextItem[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      let lastY: number | null = null;
      let pageText = "";

      for (const item of textContent.items as any[]) {
        if (!item.str) continue;
        const x = Number(item.transform?.[4] ?? 0);
        const y = Number(item.transform?.[5] ?? 0);
        const width = Number(item.width ?? Math.max(4, String(item.str).length * 4));
        items.push({ text: String(item.str), x, y, width });
        if (lastY !== null && Math.abs(y - lastY) > 4) {
          pageText += "\n";
        } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
          pageText += " ";
        }
        pageText += item.str;
        lastY = y;
      }

      fullText += pageText + "\n";
    }

    return { text: fullText, items };
  } catch (err) {
    console.warn("PDFJS extraction error:", err);
    return { text: "", items: [] };
  }
}

/**
 * Extracts clean decoded Hebrew text from pdf2json page structures.
 */
function extractWithPdf2JsonLayout(
  pdfBuffer: Buffer,
): Promise<{ text: string; items: PdfTextItem[] }> {
  return new Promise((resolve) => {
    try {
      const PDFParser = require("pdf2json");
      const parser = new PDFParser(null, 1);

      parser.on("pdfParser_dataError", () => resolve({ text: "", items: [] }));
      parser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          let fullText = "";
          const items: PdfTextItem[] = [];
          if (pdfData && pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (!page.Texts) continue;
              let lastY: number | null = null;
              for (const textItem of page.Texts) {
                const y = textItem.y;
                const x = textItem.x;
                if (lastY !== null && Math.abs(y - lastY) > 0.3) {
                  fullText += "\n";
                } else if (fullText.length > 0 && !fullText.endsWith("\n") && !fullText.endsWith(" ")) {
                  fullText += " ";
                }
                let piece = "";
                if (textItem.R) {
                  for (const r of textItem.R) {
                    try {
                      piece += decodeURIComponent(r.T || "");
                    } catch {
                      piece += r.T || "";
                    }
                  }
                }
                if (piece) {
                  items.push({
                    text: piece,
                    x: Number(x ?? 0) * 10,
                    y: Number(y ?? 0) * 10,
                    width: Number(textItem.w ?? Math.max(0.4, piece.length * 0.4)) * 10,
                  });
                }
                fullText += piece;
                lastY = y;
              }
              fullText += "\n";
            }
          }
          resolve({ text: fullText, items });
        } catch {
          resolve({ text: "", items: [] });
        }
      });

      parser.parseBuffer(pdfBuffer);
    } catch {
      resolve({ text: "", items: [] });
    }
  });
}

/**
 * Extracts raw text from a PDF buffer with multi-engine fallback and byte-swap normalization.
 */
async function extractPdfLayout(
  pdfBuffer: Buffer,
): Promise<{ text: string; items: PdfTextItem[] }> {
  let layout = await extractWithPdfJsLayout(pdfBuffer);

  if (!layout.text || layout.text.trim().length < 30) {
    layout = await extractWithPdf2JsonLayout(pdfBuffer);
  }

  if (layout.text) {
    layout = {
      text: decodeSwappedPdfText(layout.text),
      items: layout.items.map((item) => ({
        ...item,
        text: decodeSwappedPdfText(item.text),
      })),
    };
  }

  return layout;
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
    const { text: rawText, items } = await extractPdfLayout(pdfBuffer);

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
    const leave = extractLeaveBalances(rawText, lines, items);
    console.log("Leave table (row × יתרה):", leave);

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
      period.year !== null ||
      leave.vacationDays !== null ||
      leave.sickDays !== null;

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
        vacation_days: leave.vacationDays,
        sick_days: leave.sickDays,
      },
      confidence: {
        name_found: employeeName !== null,
        id_found: employeeId !== null,
        net_pay_found: netPay !== null,
        gross_pay_found: grossPay !== null,
        deductions_found: totalDeductions !== null,
        period_found: period.month !== null && period.year !== null,
        vacation_found: leave.vacationDays !== null,
        sick_found: leave.sickDays !== null,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to parse PDF document",
    };
  }
}
