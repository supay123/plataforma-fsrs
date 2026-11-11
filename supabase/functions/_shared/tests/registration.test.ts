import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import {
  generateEmailCode,
  hashEmailCode,
  verifyEmailCode,
} from "../email-code.ts";
import {
  identityDocumentNumber,
  maskEmail,
  normalizePhone,
  parseNewPassword,
  parseStudentProfile,
  parseStudentRegistration,
  USER_CODE_PATTERN,
  userCodeBaseFromEmail,
  userCodeCandidates,
} from "../registration.ts";

const validBody = {
  teacher_id: "a51ec034-3e1b-4fa2-9e7a-8bc641de87d1",
  given_names: "  Ana   María ",
  family_names: "Quispe Huamán",
  email: " Ana.Quispe@Example.com ",
  phone: "987 654 321",
  identity_document_type: "DNI",
  identity_document_number: "12345678",
  password: "Secreta9",
  accepted_terms: true,
};

function fieldOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof AppError);
    return (error.details as { field?: string } | undefined)?.field;
  }
  assert.fail("Expected an AppError.");
}

Deno.test("normalizes a valid student registration", () => {
  const parsed = parseStudentRegistration(validBody);
  assert.equal(parsed.given_names, "Ana María");
  assert.equal(parsed.email, "ana.quispe@example.com");
  assert.equal(parsed.phone, "987654321");
  assert.equal(parsed.identity_document_number, "12345678");
  assert.doesNotThrow(() =>
    parseStudentRegistration({ ...validBody, password: "Abcde1" })
  );
});

Deno.test("reports the invalid registration field", () => {
  assert.equal(
    fieldOf(() => parseStudentRegistration({ ...validBody, password: "abc" })),
    "password",
  );
  // El registro no acepta PIN: siempre exige mayúscula, minúscula y número.
  assert.equal(
    fieldOf(() =>
      parseStudentRegistration({ ...validBody, password: "482731" })
    ),
    "password",
  );
  assert.equal(
    fieldOf(() =>
      parseStudentRegistration({ ...validBody, email: "ana@example" })
    ),
    "email",
  );
  assert.equal(
    fieldOf(() =>
      parseStudentRegistration({ ...validBody, given_names: "Ana2" })
    ),
    "given_names",
  );
  assert.equal(
    fieldOf(() =>
      parseStudentRegistration({ ...validBody, accepted_terms: false })
    ),
    "accepted_terms",
  );
  assert.equal(
    fieldOf(() =>
      parseStudentRegistration({ ...validBody, password: "Aa1".repeat(25) })
    ),
    "password",
  );
});

Deno.test("validates identity document lengths by type", () => {
  assert.equal(identityDocumentNumber("DNI", "12345678"), "12345678");
  assert.throws(() => identityDocumentNumber("DNI", "1234567"), AppError);
  assert.equal(identityDocumentNumber("RUC", "10123456789"), "10123456789");
  assert.throws(() => identityDocumentNumber("RUC", "30123456789"), AppError);
  assert.equal(identityDocumentNumber("CE", "001234567"), "001234567");
  assert.throws(() => identityDocumentNumber("CE", "12345678"), AppError);
  assert.equal(identityDocumentNumber("PASAPORTE", "ab-12 34"), "AB1234");
  assert.throws(() => identityDocumentNumber("PASAPORTE", "AB123"), AppError);
});

Deno.test("validates phones", () => {
  assert.equal(normalizePhone("+51 (987) 654-321"), "987654321");
  assert.equal(normalizePhone("51987654321"), "987654321");
  assert.equal(normalizePhone("987 654 321"), "987654321");
  // Solo celulares de Perú: 9 dígitos que empiezan con 9.
  for (
    const invalidPhone of ["12345", "887654321", "98765432", "+1 987654321"]
  ) {
    assert.throws(() => normalizePhone(invalidPhone), AppError);
  }
});

Deno.test("derives generated user codes from the email", () => {
  assert.equal(userCodeBaseFromEmail("Ana.Quispe@example.com"), "ana.quispe");
  assert.equal(userCodeBaseFromEmail("josé+pe@example.com"), "josepe");
  assert.equal(userCodeBaseFromEmail("a@example.com"), "esta");
  assert.ok(
    userCodeBaseFromEmail(`${"x".repeat(60)}@example.com`).length <= 24,
  );
  assert.ok(
    userCodeCandidates(userCodeBaseFromEmail("a@example.com")).every((code) =>
      USER_CODE_PATTERN.test(code)
    ),
  );
});

Deno.test("suggests distinct valid user codes within the length limit", () => {
  let seed = 0;
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const candidates = userCodeCandidates("juanp", 10, random);
  assert.equal(candidates.length, 10);
  assert.equal(new Set(candidates).size, 10);
  assert.ok(candidates.every((candidate) => candidate.startsWith("juanp")));
  assert.ok(candidates.every((candidate) => USER_CODE_PATTERN.test(candidate)));

  const long = userCodeCandidates("x".repeat(30), 5, random);
  assert.ok(long.every((candidate) => candidate.length <= 30));
});

Deno.test("masks emails without hiding the domain", () => {
  assert.equal(maskEmail("ana.quispe@example.com"), "an********@example.com");
  assert.equal(maskEmail("a@example.com"), "a***@example.com");
});

Deno.test("email codes only verify for their own registration", async () => {
  const code = generateEmailCode();
  assert.match(code, /^\d{6}$/);
  const hash = await hashEmailCode("registration-1", code);
  assert.equal(await verifyEmailCode("registration-1", code, hash), true);
  assert.equal(await verifyEmailCode("registration-2", code, hash), false);
  const other = code === "000000" ? "000001" : "000000";
  assert.equal(await verifyEmailCode("registration-1", other, hash), false);
});

Deno.test("parses the editable profile without group, email or password", () => {
  const {
    email: _email,
    password: _password,
    teacher_id: _teacherId,
    ...profileBody
  } = validBody;
  const profile = parseStudentProfile(profileBody);
  assert.deepEqual(profile, {
    given_names: "Ana María",
    family_names: "Quispe Huamán",
    phone: "987654321",
    identity_document_type: "DNI",
    identity_document_number: "12345678",
  });
  assert.equal(
    fieldOf(() => parseStudentProfile({ ...profileBody, phone: "12" })),
    "phone",
  );
});

Deno.test("new passwords follow the sign-up rule", () => {
  assert.equal(parseNewPassword("Abcde1"), "Abcde1");
  for (const weak of ["Abcd1", "abcdef1", "ABCDEF1", "Abcdefg", "482731"]) {
    assert.equal(fieldOf(() => parseNewPassword(weak)), "password");
  }
});
