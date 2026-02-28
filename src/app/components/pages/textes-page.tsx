import { Search } from "lucide-react";
import { useState } from "react";
import { MessageCard } from "../message-card";
import { CategoryChips } from "../category-chip";

const categories = ["Tout", "Études bibliques", "Méditations", "Articles", "Notes de prédication"];

const textMessages = [
  {
    id: 1,
    title: "Les béatitudes : un chemin de bonheur",
    author: "Pasteur Jean",
    date: "28 Fév 2026",
    description:
      "Les béatitudes sont au coeur du sermon sur la montagne. Jésus nous montre un chemin de bonheur qui passe par l'humilité, la douceur et la justice. Découvrons ensemble comment appliquer ces principes dans notre vie quotidienne de disciples...",
    category: "Études bibliques",
  },
  {
    id: 2,
    title: "Méditation du matin : Psaume 23",
    author: "Soeur Ruth",
    date: "27 Fév 2026",
    description:
      "L'Eternel est mon berger, je ne manquerai de rien. Cette déclaration puissante du roi David nous rappelle que Dieu pourvoit à tous nos besoins. Prenons le temps ce matin de méditer sur la fidélité de notre Père céleste...",
    category: "Méditations",
  },
  {
    id: 3,
    title: "Comment devenir un disciple engagé",
    author: "Pasteur Marie",
    date: "25 Fév 2026",
    description:
      "Le discipulat n'est pas simplement une activité, c'est un mode de vie. Dans cet article, nous explorons les caractéristiques d'un vrai disciple de Jésus-Christ et les étapes pratiques pour grandir dans notre engagement...",
    category: "Articles",
  },
  {
    id: 4,
    title: "Notes : La grâce suffisante de Dieu",
    author: "Frère Paul",
    date: "23 Fév 2026",
    description:
      "Résumé de la prédication du dimanche sur 2 Corinthiens 12:9. La grâce de Dieu est suffisante pour nous dans toutes nos faiblesses. Points clés et versets à retenir pour la semaine...",
    category: "Notes de prédication",
  },
  {
    id: 5,
    title: "L'importance de la communion fraternelle",
    author: "Pasteur Esther",
    date: "20 Fév 2026",
    description:
      "La vie chrétienne n'est pas faite pour être vécue seul. Dieu nous a placés dans une communauté pour que nous puissions nous encourager, nous soutenir et grandir ensemble dans la foi...",
    category: "Articles",
  },
  {
    id: 6,
    title: "Étude : Le livre des Actes - Chapitre 2",
    author: "Pasteur Jean",
    date: "18 Fév 2026",
    description:
      "Le jour de la Pentecôte, le Saint-Esprit est descendu sur les disciples. Cet événement a changé le cours de l'histoire. Étudions ensemble ce chapitre fondamental pour comprendre la mission de l'Église...",
    category: "Études bibliques",
  },
];

export function TextesPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tout");

  const filtered = textMessages.filter((msg) => {
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
            placeholder="Rechercher un texte..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background rounded-xl text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <CategoryChips categories={categories} onSelect={setSelectedCategory} />

        <p className="text-[12px] text-muted-foreground mt-4 mb-3">
          {filtered.length} texte{filtered.length > 1 ? "s" : ""}
        </p>

        <div className="space-y-4">
          {filtered.map((msg) => (
            <MessageCard
              key={msg.id}
              type="text"
              title={msg.title}
              author={msg.author}
              date={msg.date}
              description={msg.description}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-[14px]">Aucun texte trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
