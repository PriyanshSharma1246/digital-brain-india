import { logEvent } from "@/lib/logger";

const requiredProductionVariables = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;

export type EnvironmentValidation = {
  valid: boolean;
  missing: string[];
};

export function validateProductionEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): EnvironmentValidation {
  const missing = requiredProductionVariables.filter((name) => !environment[name]?.trim());
  return { valid: missing.length === 0, missing: [...missing] };
}

export function reportEnvironmentValidation(): EnvironmentValidation {
  const result = validateProductionEnvironment();
  logEvent(result.valid ? "info" : "warn", "Production environment validation", {
    valid: result.valid,
    missing: result.missing,
  });
  return result;
}
