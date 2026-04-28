const SAFE_PIPE_REGEX = /^[a-zA-ZÀ-ÿ0-9\s_-]+(\|[a-zA-ZÀ-ÿ0-9\s_-]+)*$/;

export function regexToCsv(regex: string): string {
  if (!regex) return '';
  return regex.split('|').map((s) => s.trim()).filter(Boolean).join(', ');
}

export function csvToRegex(csv: string): string {
  if (!csv) return '';
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('|');
}

export function isSimpleAlternation(regex: string): boolean {
  if (!regex) return true;
  return SAFE_PIPE_REGEX.test(regex);
}
