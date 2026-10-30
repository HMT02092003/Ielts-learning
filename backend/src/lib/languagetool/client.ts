// Minimal LanguageTool HTTP client (POST /v2/check, form-encoded). Offsets in the response are UTF-16 code units,
// the same unit JavaScript strings use, so they map straight onto the essay text (emoji included).
import { env } from '../../config/env';

export interface LtMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; issueType?: string; category: { id: string; name: string } };
}

export class LanguageToolUnavailable extends Error {}

export async function checkText(
  text: string,
  opts: { language?: string; baseUrl?: string; timeoutMs?: number } = {},
): Promise<LtMatch[]> {
  const body = new URLSearchParams({ text, language: opts.language ?? env.LANGUAGETOOL_LANG });
  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl ?? env.LANGUAGETOOL_URL}/v2/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? env.LANGUAGETOOL_TIMEOUT_MS),
    });
  } catch (e) {
    throw new LanguageToolUnavailable(e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) throw new LanguageToolUnavailable(`LanguageTool HTTP ${res.status}`);
  const json = (await res.json()) as { matches?: LtMatch[] };
  return json.matches ?? [];
}
