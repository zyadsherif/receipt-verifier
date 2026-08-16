const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  يناير: 1,
  feb: 2,
  february: 2,
  فبراير: 2,
  mar: 3,
  march: 3,
  مارس: 3,
  apr: 4,
  april: 4,
  أبريل: 4,
  ابريل: 4,
  may: 5,
  مايو: 5,
  jun: 6,
  june: 6,
  يونيو: 6,
  jul: 7,
  july: 7,
  يوليو: 7,
  aug: 8,
  august: 8,
  أغسطس: 8,
  اغسطس: 8,
  sep: 9,
  sept: 9,
  september: 9,
  سبتمبر: 9,
  oct: 10,
  october: 10,
  أكتوبر: 10,
  اكتوبر: 10,
  nov: 11,
  november: 11,
  نوفمبر: 11,
  dec: 12,
  december: 12,
  ديسمبر: 12,
};

export function normalizeArabicDigits(value?: string | null): string {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

export function normalizeReference(value?: string | null): string | undefined {
  const normalized = normalizeArabicDigits(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return normalized.length >= 6 ? normalized : undefined;
}

export function normalizeTransferNote(value?: string | null): string {
  return normalizeArabicDigits(value).normalize("NFKC").replace(/\s+/g, " ").trim().toUpperCase();
}

export function normalizeComparableText(value?: string | null): string {
  return normalizeArabicDigits(value)
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizePhone(value?: string | null): string {
  const digits = normalizeArabicDigits(value).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function normalizeAccount(value?: string | null): string {
  return normalizeArabicDigits(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeIban(value?: string | null): string {
  return normalizeAccount(value);
}

export function isValidIban(value?: string | null): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const numeric = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export function recipientMatches(
  type: "phone" | "iban" | "account" | "name",
  visible: string | undefined,
  expected: string,
): boolean {
  if (!visible) return false;
  if (type === "phone") return normalizePhone(visible) === normalizePhone(expected);
  if (type === "name")
    return normalizeComparableText(visible) === normalizeComparableText(expected);

  const normalizedVisible = normalizeAccount(visible);
  const normalizedExpected = normalizeAccount(expected);
  if (normalizedVisible === normalizedExpected) return true;
  const visibleSuffix = normalizedVisible.replace(/^X+/, "").replace(/^\*+/, "");
  const digits = visibleSuffix.replace(/\D/g, "");
  const expectedDigits = normalizedExpected.replace(/\D/g, "");
  return digits.length >= 6 && expectedDigits.endsWith(digits);
}

export function parseDecimalToMinor(value: string | number, scale = 2): bigint | undefined {
  const normalized = normalizeArabicDigits(String(value)).replace(/,/g, "").trim();
  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return undefined;
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2];
  const fraction = match[3] ?? "";
  if (!whole || fraction.length > scale) return undefined;
  return sign * (BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0") || "0"));
}

export function isSuccessfulStatus(value?: string | null): boolean {
  const status = String(value ?? "");
  if (
    /failed|declined|rejected|cancelled|canceled|pending|فشل|مرفوض|ملغ|قيد\s*الانتظار/i.test(status)
  ) {
    return false;
  }
  return /approved|success(?:ful)?|completed|مقبول|مقبولة|ناجح|ناجحة|تمت\s+بنجاح|تم\s+بنجاح/i.test(
    status,
  );
}

function to24Hour(hour: number, meridiem?: string): number {
  const normalized = String(meridiem ?? "")
    .trim()
    .toLowerCase();
  const isPm = normalized === "pm" || normalized === "م" || normalized === "مساء";
  const isAm =
    normalized === "am" || normalized === "ص" || normalized === "صباحا" || normalized === "صباحًا";
  if (!isPm && !isAm) return hour;
  if (hour < 1 || hour > 12) return Number.NaN;
  if (isPm) return hour === 12 ? 12 : hour + 12;
  return hour === 12 ? 0 : hour;
}

function cairoParts(epochMs: number): Record<string, number> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    formatter
      .formatToParts(new Date(epochMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function cairoLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = targetAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = cairoParts(candidate);
    const representedAsUtc = Date.UTC(
      parts.year ?? 0,
      (parts.month ?? 1) - 1,
      parts.day ?? 1,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    );
    candidate += targetAsUtc - representedAsUtc;
  }
  const final = cairoParts(candidate);
  if (
    final.year !== year ||
    final.month !== month ||
    final.day !== day ||
    final.hour !== hour ||
    final.minute !== minute
  ) {
    return Number.NaN;
  }
  return candidate;
}

export function parseCairoTimestamp(value?: string | null): number | undefined {
  const normalized = normalizeArabicDigits(value).replace(/[،,]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  const named = normalized.match(
    /(\d{1,2})\s+([A-Za-z\u0600-\u06ff]+)\s+(\d{4})\s+(\d{1,2})[:.]([0-5]\d)(?:\s*(AM|PM|ص|م|صباحا|صباحًا|مساء))?/i,
  );
  const numeric = normalized.match(
    /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s+(\d{1,2})[:.]([0-5]\d)(?:\s*(AM|PM|ص|م|صباحا|صباحًا|مساء))?/i,
  );
  const match = named ?? numeric;
  if (!match) return undefined;

  const day = Number(match[1]);
  const monthName = named?.[2]?.toLowerCase();
  const month = named ? MONTHS[monthName ?? ""] : Number(numeric?.[2]);
  const year = Number(match[3]);
  const hour = to24Hour(Number(match[4]), match[6]);
  const minute = Number(match[5]);
  if (
    !month ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 2020 ||
    year > 2100 ||
    !Number.isFinite(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    return undefined;
  }
  const epoch = cairoLocalToUtc(year, month, day, hour, minute);
  return Number.isFinite(epoch) ? epoch : undefined;
}

export function maskSensitive(value?: string | null, visible = 4): string | undefined {
  if (!value) return undefined;
  const normalized = String(value);
  if (normalized.length <= visible) return "*".repeat(normalized.length);
  return `${"*".repeat(Math.min(8, normalized.length - visible))}${normalized.slice(-visible)}`;
}
