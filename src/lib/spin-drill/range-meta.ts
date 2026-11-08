/** Metadata for ranges shown in the UI next to every chart. */
export type RangeMeta = { updated: string; source: string };

const DEFAULT: RangeMeta = {
  updated: "2026-11-08",
  source: "GTOBase.com",
};

/** Spot id → update date and source. */
const META: Record<string, RangeMeta> = {
  btn: { updated: "2026-11-08", source: "GTOBase.com" },
  sb_raise: { updated: "2026-11-08", source: "GTOBase.com" },
  bb_vs_btn_raise: { updated: "2026-11-08", source: "GTOBase.com" },
  sb_fold: { updated: "2026-11-08", source: "GTOBase.com" },
  hu_sb: { updated: "2026-11-08", source: "GTOBase.com" },
  hu_bb_limp: { updated: "2026-11-08", source: "GTOBase.com" },
  hu_bb_raise: { updated: "2026-11-08", source: "GTOBase.com" },
  hu_bb_jam: { updated: "2026-11-08", source: "GTOBase.com" },
};

export function rangeMeta(spotId: string): RangeMeta {
  return META[spotId] ?? DEFAULT;
}

export function rangeMetaText(spotId: string): string {
  const m = rangeMeta(spotId);
  return `Обновлено ${m.updated} · ${m.source}`;
}
