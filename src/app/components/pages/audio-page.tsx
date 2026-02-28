import { Search } from "lucide-react";
import { useState } from "react";
import { MessageCard } from "../message-card";
import { CategoryChips } from "../category-chip";

const categories = ["Tout", "Prédications", "Enseignements", "Louanges", "Témoignages"];

const audioMessages = [
  {
    id: 1,
    title: "La puissance de la prière dans la vie du disciple",
    author: "Pasteur Jean",
    date: "27 Fév 2026",
    duration: "45:30",
    category: "Prédications",
  },
  {
    id: 2,
    title: "Comment étudier la Bible efficacement",
    author: "Pasteur Marie",
    date: "25 Fév 2026",
    duration: "32:15",
    category: "Enseignements",
  },
  {
    id: 3,
    title: "Louange et adoration : une arme spirituelle",
    author: "Frère David",
    date: "23 Fév 2026",
    duration: "28:45",
    category: "Louanges",
  },
  {
    id: 4,
    title: "Mon témoignage de conversion",
    author: "Soeur Ruth",
    date: "20 Fév 2026",
    duration: "18:20",
    category: "Témoignages",
  },
  {
    id: 5,
    title: "La foi qui déplace les montagnes",
    author: "Pasteur Jean",
    date: "18 Fév 2026",
    duration: "52:10",
    category: "Prédications",
  },
  {
    id: 6,
    title: "Les dons du Saint-Esprit",
    author: "Pasteur Esther",
    date: "15 Fév 2026",
    duration: "40:05",
    category: "Enseignements",
  },
];

export function AudioPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tout");

  const filtered = audioMessages.filter((msg) => {
    const matchSearch =
      msg.title.toLowerCase().includes(search.toLowerCase()) ||
      msg.author.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === "Tout" || msg.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="pb-20">
      <div className="px-4 pt-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un message audio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background rounded-xl text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Categories */}
        <CategoryChips categories={categories} onSelect={setSelectedCategory} />

        {/* Count */}
        <p className="text-[12px] text-muted-foreground mt-4 mb-3">
          {filtered.length} message{filtered.length > 1 ? "s" : ""} audio
        </p>

        {/* List */}
        <div className="space-y-4">
          {filtered.map((msg) => (
            <MessageCard
              key={msg.id}
              type="audio"
              title={msg.title}
              author={msg.author}
              date={msg.date}
              duration={msg.duration}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-[14px]">Aucun message trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
