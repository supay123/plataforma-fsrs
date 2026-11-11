import { describe, expect, it } from "vitest";
import { isValidIdentityDocument, isValidPassword, isValidPhone, passwordChecks } from "./rules";

describe("registration rules", () => {
  it("requires six characters with lowercase, uppercase and a digit", () => {
    expect(isValidPassword("Abcde1")).toBe(true);
    expect(isValidPassword("Secreta9")).toBe(true);
    expect(isValidPassword("Abcd1")).toBe(false);
    expect(isValidPassword("secreta9")).toBe(false);
    expect(isValidPassword("482731")).toBe(false);
    expect(isValidPassword(`Aa1${"x".repeat(70)}`)).toBe(false);
    expect(passwordChecks("abcD")).toEqual({ length: false, lowercase: true, uppercase: true, digit: false });
  });

  it("validates the identity document length by type", () => {
    expect(isValidIdentityDocument("DNI", "12345678")).toBe(true);
    expect(isValidIdentityDocument("DNI", "1234567")).toBe(false);
    expect(isValidIdentityDocument("RUC", "20123456789")).toBe(true);
    expect(isValidIdentityDocument("RUC", "30123456789")).toBe(false);
    expect(isValidIdentityDocument("CE", "001234567")).toBe(true);
    expect(isValidIdentityDocument("PASAPORTE", "ab-1234")).toBe(true);
    expect(isValidIdentityDocument("PASAPORTE", "AB12")).toBe(false);
  });

  it("validates phones", () => {
    expect(isValidPhone("987 654 321")).toBe(true);
    expect(isValidPhone("+51 987 654 321")).toBe(true);
    // Solo celulares de Perú: 9 dígitos que empiezan con 9.
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("887654321")).toBe(false);
    expect(isValidPhone("+1 987654321")).toBe(false);
  });
});
