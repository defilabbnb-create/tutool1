import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type NotifyInsertStatus = "inserted" | "duplicate";

export type NotifySaveResult = {
  status: NotifyInsertStatus;
};

export type NotifyRepository = {
  insertEmail: (email: string, source: string) => Promise<NotifyInsertStatus>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const testEmailStore = new Set<string>();

function canUseLocalTestFallback() {
  return process.env.PLAYWRIGHT_TEST_LOCAL === "1";
}

function getMissingNotifyEnvNames() {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

function logNotifyDiagnostic(message: string, details?: Record<string, unknown>) {
  console.error("[notify]", message, details ?? {});
}

function createSupabaseNotifyRepository(): NotifyRepository {
  if (
    (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    canUseLocalTestFallback()
  ) {
    return {
      async insertEmail(email: string) {
        if (testEmailStore.has(email)) {
          return "duplicate";
        }

        testEmailStore.add(email);
        return "inserted";
      },
    };
  }

  return {
    async insertEmail(email: string, source: string) {
      const missingEnvNames = getMissingNotifyEnvNames();

      if (missingEnvNames.length > 0) {
        logNotifyDiagnostic("Missing Supabase env vars", {
          missingEnvNames,
        });
        throw new Error("Notify storage is missing required Supabase env vars.");
      }

      let supabase;

      try {
        supabase = getSupabaseAdminClient();
      } catch (error) {
        logNotifyDiagnostic("Supabase client init failed", {
          errorMessage: error instanceof Error ? error.message : "unknown",
        });
        throw error;
      }

      const { error } = await supabase
        .from("notify_emails")
        .insert(
          {
            email,
            source,
          }
        );

      if (error) {
        if ("code" in error && error.code === "23505") {
          console.info("[notify] Duplicate email ignored", {
            source,
          });
          return "duplicate";
        }

        logNotifyDiagnostic("Supabase insert failed", {
          source,
          code: "code" in error ? error.code : undefined,
          message: "message" in error ? error.message : undefined,
          details: "details" in error ? error.details : undefined,
          hint: "hint" in error ? error.hint : undefined,
          tableMissing:
            "code" in error ? error.code === "42P01" : false,
          permissionMismatch:
            "code" in error ? error.code === "42501" : false,
          authMismatchSuspected:
            "message" in error
              ? /jwt|service role|api key|not allowed|permission/i.test(
                  String(error.message)
                )
              : false,
        });

        throw error;
      }

      console.info("[notify] Email inserted", { source });
      return "inserted";
    },
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidNotifyEmail(email: string) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export async function saveNotifyEmail(
  email: string,
  source = "website",
  repository: NotifyRepository = createSupabaseNotifyRepository()
): Promise<NotifySaveResult> {
  const normalizedEmail = normalizeEmail(email);
  const status = await repository.insertEmail(normalizedEmail, source);

  return { status };
}
