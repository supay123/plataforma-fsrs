import { invokeFunction } from "../../lib/api/functions";
import type { AppRole, CredentialsResponse, SecurityQuestionResponse } from "../../types/contracts";

export function getRecoveryQuestion(code: string, expectedRole: AppRole) {
  return invokeFunction<SecurityQuestionResponse, { action: string; code: string; expected_role: AppRole }>(
    "recover-password",
    { action: "get_question", code, expected_role: expectedRole },
  );
}

export function recoverPassword(code: string, expectedRole: AppRole, answer: string) {
  return invokeFunction<CredentialsResponse, { action: string; code: string; expected_role: AppRole; answer: string }>(
    "recover-password",
    { action: "reset_password", code, expected_role: expectedRole, answer },
  );
}

export function saveRecoveryQuestion(securityQuestion: string, securityAnswer: string) {
  return invokeFunction<SecurityQuestionResponse, { action: string; security_question: string; security_answer: string }>(
    "account-security",
    { action: "save_recovery", security_question: securityQuestion, security_answer: securityAnswer },
  );
}

export function resetOwnCredentials() {
  return invokeFunction<CredentialsResponse, { action: string }>(
    "account-security",
    { action: "reset_credentials" },
  );
}
