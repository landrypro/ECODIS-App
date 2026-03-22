import { fetchJson, getHeaders, jsonHeaders } from "./http";

export async function toggleFavorite(messageId: string, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ favorited: boolean }>("/favorites/toggle", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ messageId }),
    });
    return data.favorited;
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return false;
  }
}

export async function fetchFavorites(accessToken: string): Promise<string[]> {
  try {
    const data = await fetchJson<{ favorites?: string[] }>("/favorites", {
      headers: getHeaders(accessToken),
    });
    return data.favorites ?? [];
  } catch (error) {
    console.error("Fetch favorites error:", error);
    return [];
  }
}
