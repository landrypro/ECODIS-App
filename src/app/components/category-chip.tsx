import { useState } from "react";

interface CategoryChipProps {
  categories: string[];
  onSelect?: (category: string) => void;
}

export function CategoryChips({ categories, onSelect }: CategoryChipProps) {
  const [selected, setSelected] = useState(categories[0]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => {
            setSelected(cat);
            onSelect?.(cat);
          }}
          className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] transition-colors ${
            selected === cat
              ? "bg-[#152a6b] text-white"
              : "bg-[#eceef5] text-[#152a6b]"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}