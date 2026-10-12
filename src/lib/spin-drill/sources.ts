export type SourceId = "deepsolver" | "snowie" | "deepfold";

export type SourceConfig = {
  on: boolean;
  token: string;
};

const KEY = "spin-sources-v1";

const EMPTY: Record<SourceId, SourceConfig> = {
  deepsolver: { on: false, token: "" },
  snowie: { on: false, token: "" },
  deepfold: { on: false, token: "" },
};

export function readSources(): Record<SourceId, SourceConfig> {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Record<SourceId, SourceConfig>>;
    return {
      deepsolver: { ...EMPTY.deepsolver, ...parsed.deepsolver },
      snowie: { ...EMPTY.snowie, ...parsed.snowie },
      deepfold: { ...EMPTY.deepfold, ...parsed.deepfold },
    };
  } catch {
    return EMPTY;
  }
}

export function writeSources(next: Record<SourceId, SourceConfig>) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
