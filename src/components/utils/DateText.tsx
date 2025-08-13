import { Pencil } from "lucide-react";
const DateText = ({
  publishedAt,
  updatedAt,
}: {
  publishedAt: string;
  updatedAt?: string;
}) => {
  if (publishedAt == updatedAt || updatedAt == null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/30 text-white/90">
        Published: {publishedAt}
      </span>

    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/30 text-white/90">
      Published: {publishedAt} • <Pencil className="w-4 h-4" /> Updated: {updatedAt}
    </span>
  );
};

export default DateText;
