import type { DuplicateLevel } from '../../shared/duplicateDetection';

export interface DuplicatePairDto {
  a: string;
  b: string;
  score: number;
  title: number;
  content: number;
  overlap: number;
  sameSource: boolean;
  level: DuplicateLevel;
  reasons: string[];
}

export interface DuplicateSectionInfoDto {
  id: string;
  title: string;
  department: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  sourceFileName?: string;
  excerpt: string;
  wordCount: number;
}

export interface DuplicateReportDto {
  pairs: DuplicatePairDto[];
  groups: Array<{ ids: string[]; pairs: DuplicatePairDto[]; maxScore: number }>;
  sections: Record<string, DuplicateSectionInfoDto>;
  scanned: number;
  threshold: number;
  durationMs: number;
}

async function readJson(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || fallback);
  return data;
}

export const duplicatesApi = {
  scan: async (threshold?: number): Promise<DuplicateReportDto> => {
    const qs = threshold ? `?threshold=${encodeURIComponent(String(threshold))}` : '';
    return readJson(await fetch(`/api/v2/tools/duplicates${qs}`), 'Не вдалося виконати пошук дублів');
  },

  check: async (sectionIds: string[]): Promise<DuplicateReportDto> =>
    readJson(await fetch('/api/v2/tools/duplicates/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionIds })
    }), 'Не вдалося перевірити інструкції на дублі'),

  /** «Це не дубль» — пара більше не показуватиметься. */
  dismiss: async (a: string, b: string): Promise<void> => {
    await readJson(await fetch('/api/v2/tools/duplicates/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a, b })
    }), 'Не вдалося зберегти рішення');
  },

  deleteInstruction: async (id: string): Promise<void> => {
    await readJson(await fetch('/api/admin/instructions/' + encodeURIComponent(id), { method: 'DELETE' }), 'Не вдалося видалити інструкцію');
  },

  /** Вимкнути інструкцію: вона лишається в базі, але співробітники її не бачать. */
  deactivateInstruction: async (info: DuplicateSectionInfoDto): Promise<void> => {
    await readJson(await fetch('/api/admin/instructions/' + encodeURIComponent(info.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: info.title, department: info.department, isActive: false })
    }), 'Не вдалося вимкнути інструкцію');
  }
};
