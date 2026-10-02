/**
 * Console errors minus the app's known baseline (recorded at preflight from the setup-check).
 * An error is baseline if it contains any non-blank baseline entry; blank entries are ignored
 * so an empty string can never hide every error.
 */
export function withoutBaseline(errors, baseline = []) {
  const known = baseline.map((b) => String(b)).filter((b) => b.trim() !== "");
  return errors.filter((e) => !known.some((b) => String(e).includes(b)));
}
