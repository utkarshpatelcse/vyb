const SENSITIVE_RUNTIME_ERROR_PATTERNS = [
  /\bENOENT\b/i,
  /\bEACCES\b/i,
  /\bEPERM\b/i,
  /\b\/var\/task\b/i,
  /\b\/tmp\b/i,
  /[A-Za-z]:\\/,
  /\\Users\\/i,
  /\bFIREBASE_STORAGE_BUCKET\b/i,
  /\bNEXT_PUBLIC_FIREBASE_STORAGE_BUCKET\b/i,
  /\bmkdir\b/i,
  /\bno such file or directory\b/i,
  /\bpermission denied\b/i
];

export function toSafeApiErrorMessage(error: unknown, fallbackMessage: string) {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const message = error.message.trim();
  if (!message) {
    return fallbackMessage;
  }

  if (SENSITIVE_RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallbackMessage;
  }

  return message;
}
