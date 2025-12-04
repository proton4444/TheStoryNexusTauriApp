type Props = {
  count: number;
};

export function LorebookImportSummary({ count }: Props) {
  if (count <= 0) return null;
  const message =
    count === 1
      ? "Imported 1 lorebook entry into memory"
      : `Imported ${count} lorebook entries into memory`;
  return <p className="text-xs text-muted-foreground">{message}</p>;
}
