/**
 * A small generic result type for functions that want to return success or failure explicitly.
 *
 * This is intentionally app-agnostic so modules outside the Cacoo API client can reuse it without
 * depending on domain-specific files.
 */
export type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

/**
 * Constructs a successful `Result`.
 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/**
 * Constructs a failed `Result`.
 */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
