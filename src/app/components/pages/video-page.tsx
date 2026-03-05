import { Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { MessageCard } from "../message-card";
import { CategoryChips } from "../category-chip";
import { fetchMessages, fetchCommentCounts, Message } from "../api";
import { useAuth } from "../auth-context";

const categories = [
  "Tout",
  "Cultes",
  "Seminaires",
  "Formations",
  "Conferences",
];

export function VideoPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tout");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { favorites } = useAuth();

  useEffect(() => {
    Promise.all([fetchMessages("video"), fetchCommentCounts()]).then(([msgs, counts]) => {
      setMessages(msgs);
      setCommentCounts(counts);
      setLoading(false);
    });
  }, []);

  const filtered = messages.filter((msg) => {
    const matchSearch =
      msg.title.toLowerCase().includes(search.toLowerCase()) ||
      msg.author.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      selectedCategory === "Tout" || msg.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="pb-20 lg:pb-6">
      <div className="px-4 lg:px-6 pt-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une video..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background rounded-xl text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <CategoryChips categories={categories} onSelect={setSelectedCategory} />

        <p className="text-[12px] text-muted-foreground mt-4 mb-3">
          {filtered.length} video{filtered.length > 1 ? "s" : ""}
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((msg) => (
              <div
                key={msg.id}
                onClick={() => navigate(`/message/${msg.id}`)}
                className="cursor-pointer"
              >
                <MessageCard
                  type="video"
                  title={msg.title}
                  author={msg.author}
                  date={new Date(msg.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  duration={msg.duration}
                  thumbnail={msg.thumbnail}
                  liked={favorites.includes(msg.id)}
                  messageId={msg.id}
                  commentCount={commentCounts[msg.id] || 0}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-[14px]">
              Aucune video trouvee
            </p>
          </div>
        )}
      </div>
    </div>
  );
}