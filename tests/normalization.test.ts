import { describe, expect, it } from "vitest";
import {
  isSuccessfulStatus,
  isValidIban,
  maskSensitive,
  normalizeArabicDigits,
  normalizePhone,
  normalizeReference,
  normalizeTransferNote,
  parseCairoTimestamp,
  parseDecimalToMinor,
  recipientMatches,
} from "../src/index.js";

describe("normalization", () => {
  it("normalizes Arabic and Persian digits", () => {
    expect(normalizeArabicDigits("١٢٣۴۵")).toBe("12345");
    expect(normalizeReference(" ٦٦٣-٨٨٩ ۰۰۳ ")).toBe("663889003");
  });

  it("normalizes notes without weakening exact comparison", () => {
    expect(normalizeTransferNote("  OneClub   - ١٢٣ ")).toBe("ONECLUB - 123");
  });

  it("compares phones, masked accounts, IBANs, and names", () => {
    expect(normalizePhone("+20 102 221 6020")).toBe("1022216020");
    expect(recipientMatches("phone", "٠١٠٢٢٢١٦٠٢٠", "+201022216020")).toBe(true);
    expect(recipientMatches("account", "******456789", "123456789")).toBe(true);
    expect(recipientMatches("name", "Example  Merchant", "example merchant")).toBe(true);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
  });

  it("parses decimal money without floating point arithmetic", () => {
    expect(parseDecimalToMinor("1,000.05")).toBe(100005n);
    expect(parseDecimalToMinor("١٠٠٠.٥٠")).toBe(100050n);
    expect(parseDecimalToMinor("10.001")).toBeUndefined();
  });

  it("recognizes successful statuses without accepting negative states", () => {
    expect(isSuccessfulStatus("Approved Transaction")).toBe(true);
    expect(isSuccessfulStatus("تمت بنجاح")).toBe(true);
    expect(isSuccessfulStatus("Not successful - failed")).toBe(false);
    expect(isSuccessfulStatus("Pending")).toBe(false);
  });

  it("parses English and Arabic Cairo-local timestamps", () => {
    expect(parseCairoTimestamp("11 Aug 2026 09:32 AM")).toBe(Date.UTC(2026, 7, 11, 6, 32));
    expect(parseCairoTimestamp("١١ أغسطس ٢٠٢٦ ٠٩:٣٢ ص")).toBe(Date.UTC(2026, 7, 11, 6, 32));
    expect(parseCairoTimestamp("not a date")).toBeUndefined();
  });

  it("masks sensitive diagnostics", () => {
    expect(maskSensitive("123456789012", 4)).toBe("********9012");
    expect(maskSensitive("123", 4)).toBe("***");
    expect(maskSensitive()).toBeUndefined();
  });
});
