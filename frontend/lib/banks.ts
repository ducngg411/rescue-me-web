export type BankOption = {
  code: string;
  label: string;
  supported?: boolean;
};

export const BANK_CUSTOM_CODE = '__CUSTOM__';

type BankcodeJson = {
  no_banks?: string;
  data?: Array<{
    name?: string;
    code?: string;
    bin?: string;
    short_name?: string;
    supported?: boolean;
  }>;
};

let bankOptionsCache: BankOption[] | null = null;
let bankOptionsInFlight: Promise<BankOption[]> | null = null;

function toLabel(b: { short_name?: string; name?: string; code?: string }) {
  const short = (b.short_name ?? '').trim();
  const full = (b.name ?? '').trim();
  if (short && full && short.toLowerCase() !== full.toLowerCase()) return `${short} — ${full}`;
  return short || full || (b.code ?? '');
}

export async function getBankOptions(): Promise<BankOption[]> {
  if (bankOptionsCache) return bankOptionsCache;
  if (bankOptionsInFlight) return bankOptionsInFlight;

  bankOptionsInFlight = (async () => {
    try {
      const res = await fetch('/bankcode.json', { cache: 'force-cache' });
      if (!res.ok) throw new Error('Failed to fetch /bankcode.json');
      const json = (await res.json()) as BankcodeJson;

      const raw = Array.isArray(json.data) ? json.data : [];
      const mapped: BankOption[] = raw
        .filter((b) => (b.code ?? '').trim())
        .map((b) => ({
          code: String(b.code).trim(),
          label: toLabel(b),
          supported: !!b.supported,
        }));

      // Stable-ish ordering: supported first, then label A→Z
      mapped.sort((a, b) => {
        const sup = Number(!!b.supported) - Number(!!a.supported);
        if (sup !== 0) return sup;
        return a.label.localeCompare(b.label, 'vi', { sensitivity: 'base' });
      });

      bankOptionsCache = mapped;
      return mapped;
    } finally {
      bankOptionsInFlight = null;
    }
  })();

  return bankOptionsInFlight;
}

export function getBankLabel(code?: string, options?: BankOption[]) {
  if (!code) return '';
  const list = options ?? bankOptionsCache ?? [];
  return list.find((b) => b.code === code)?.label ?? '';
}

