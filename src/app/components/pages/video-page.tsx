import { Search } from "lucide-react";
import { useState } from "react";
import { MessageCard } from "../message-card";
import { CategoryChips } from "../category-chip";

const categories = ["Tout", "Cultes", "Séminaires", "Formations", "Conférences"];

const videoMessages = [
  {
    id: 1,
    title: "Culte dominical - Marcher dans la foi",
    author: "Pasteur Jean",
    date: "27 Fév 2026",
    duration: "1:25:30",
    category: "Cultes",
    thumbnail:
      "https://images.unsplash.com/photo-1624499843552-7347d9f6d285?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZXJtb24lMjBwcmVhY2hpbmclMjBtaWNyb3Bob25lfGVufDF8fHx8MTc3MjMwODM0Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 2,
    title: "Séminaire sur le discipulat - Session 1",
    author: "Pasteur Marie",
    date: "24 Fév 2026",
    duration: "58:15",
    category: "Séminaires",
    thumbnail:
      "https://images.unsplash.com/photo-1760367120345-2b96c53de838?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b3JzaGlwJTIwY2h1cmNoJTIwY29tbXVuaXR5fGVufDF8fHx8MTc3MjMwODM0MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 3,
    title: "Formation des leaders - Module 3",
    author: "Frère Paul",
    date: "20 Fév 2026",
    duration: "1:10:45",
    category: "Formations",
    thumbnail:
      "https://images.unsplash.com/photo-1660176982561-0d9e8705877d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjBiaWJsZSUyMHN0dWR5JTIwZ3JvdXB8ZW58MXx8fHwxNzcyMzA4MzQxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 4,
    title: "Conférence annuelle - L'appel de Dieu",
    author: "Évangéliste Samuel",
    date: "15 Fév 2026",
    duration: "2:05:00",
    category: "Conférences",
    thumbnail:
      "https://images.unsplash.com/photo-1624499843552-7347d9f6d285?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZXJtb24lMjBwcmVhY2hpbmclMjBtaWNyb3Bob25lfGVufDF8fHx8MTc3MjMwODM0Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
];

export function VideoPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tout");

  const filtered = videoMessages.filter((msg) => {
    const matchSearch =
      msg.title.toLowerCase().includes(search.toLowerCase()) ||
      msg.author.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === "Tout" || msg.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="pb-20">
      <div className="px-4 pt-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une vidéo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background rounded-xl text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <CategoryChips categories={categories} onSelect={setSelectedCategory} />

        <p className="text-[12px] text-muted-foreground mt-4 mb-3">
          {filtered.length} vidéo{filtered.length > 1 ? "s" : ""}
        </p>

        <div className="space-y-4">
          {filtered.map((msg) => (
            <MessageCard
              key={msg.id}
              type="video"
              title={msg.title}
              author={msg.author}
              date={msg.date}
              duration={msg.duration}
              thumbnail={msg.thumbnail}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-[14px]">Aucune vidéo trouvée</p>
          </div>
        )}
      </div>
    </div>
  );
}
