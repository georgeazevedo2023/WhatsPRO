import { toast } from 'sonner';

/**
 * Standardized error handler for catch blocks.
 * Logs to console and shows a user-facing toast with the error message
 * or a fallback string when unavailable.
 *
 * @param err   The caught error (unknown type for type-safety)
 * @param fallbackMsg  Message shown when err has no `.message`
 * @param prefix  Optional console prefix for easier grep (e.g. 'Send audio error')
 */
export function handleError(
  err: unknown,
  fallbackMsg = 'Ocorreu um erro',
  prefix?: string,
): void {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : fallbackMsg;

  if (prefix) {
    console.error(`${prefix}:`, err);
  } else {
    console.error(err);
  }

  toast.error(message || fallbackMsg);
}
