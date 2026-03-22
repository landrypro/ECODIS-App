import { Search, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { MessageCard } from "../message-card";
import { CategoryChips } from "../category-chip";
import { useMessageList } from "../../hooks/use-message-list";
import { useAuth } from "../auth-context";

const categories = ["Tout", "Cultes", "Seminaires", "Formations", "Conferences"];

export function VideoPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tout");
  const { messages, commentCounts, isLoading } = useMessageList("video");
  const navigate = useNavigate();
  const { favorites } = useAuth();

  const filtered = useMemo(
    () =>
      messages.filter((message) => {
        const matchSearch =
          message.title.toLowerCase().includes(search.toLowerCase()) ||
          message.author.toLowerCase().includes(search.toLowerCase());
        const matchCategory = selectedCategory === "Tout" || message.category === selectedCategory;
        return matchSearch && matchCategory;
      }),
    [messages, search, selectedCategory],
  );

  return (
    <div className="pb-20 lg:pb-6">
      <div className="px-4 lg:px-6 pt-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une video..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background rounded-xl text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <CategoryChips categories={categories} onSelect={setSelectedCategory} />

        <p className="text-[12px] text-muted-foreground mt-4 mb-3">{filtered.length} video{filtered.length > 1 ? "s" : ""}</p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((message) => (
              <div key={message.id} onClick={() => navigate(`/message/${message.id}`)} className="cursor-pointer">
                <MessageCard
                  type="video"
                  title={message.title}
                  author={message.author}
                  date={new Date(message.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  duration={message.duration}
                  thumbnail={message.thumbnail}
                  liked={favorites.includes(message.id)}
                  messageId={message.id}
                  commentCount={commentCounts[message.id] || 0}
                />
              </div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-[14px]">Aucune video trouvee</p>
          </div>
        )}
      </div>
    </div>
  );
}
