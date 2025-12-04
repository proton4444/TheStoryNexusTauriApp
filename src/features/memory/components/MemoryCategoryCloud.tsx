type Props = {
  entries: Array<{ category?: string | null }>;
};

export function MemoryCategoryCloud({ entries }: Props) {
  const counts = entries.reduce<Record<string, number>>((acc, entry) => {
    const key = (entry.category || "uncategorized").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const items = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([cat, count]) => (
        <span
          key={cat}
          className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground"
        >
          {cat} · {count}
        </span>
      ))}
    </div>
  );
}
