import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type { EditorialStatus, Message, ProgressEvent, ProgressUpdateResult, Series, SeriesProgress } from "./types";

function emptyProgress(seriesId: string): SeriesProgress {
  return {
    userId: "",
    seriesId,
    modules: {},
    completedMessageIds: [],
    totalModules: 0,
    progressPercent: 0,
    nextMessageId: null,
    isCompleted: false,
    lastAccessedAt: null,
  };
}

export async function fetchAllSeries(): Promise<Series[]> {
  try {
    const data = await fetchJson<{ series?: Series[] }>("/series", { headers: getHeaders() });
    return data.series ?? [];
  } catch (error) {
    console.error("Fetch series error:", error);
    return [];
  }
}

export async function fetchAdminSeries(accessToken: string): Promise<Series[]> {
  const data = await fetchJson<{ series?: Series[] }>("/admin/series", { headers: getHeaders(accessToken) });
  return data.series ?? [];
}

export async function fetchSeries(id: string, accessToken?: string | null): Promise<{ series: Series; messages: Message[] } | null> {
  try {
    const data = await fetchJson<{ series: Series; messages?: Message[] }>(`/series/${id}`, {
      headers: getHeaders(accessToken),
    });
    return { series: data.series, messages: data.messages ?? [] };
  } catch (error) {
    console.error("Fetch series detail error:", error);
    return null;
  }
}

export async function createSeries(seriesData: Partial<Series>, accessToken: string): Promise<Series | null> {
  try {
    const data = await fetchJson<{ series: Series }>("/series", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify(seriesData),
    });
    return data.series;
  } catch (error) {
    console.error("Create series error:", error);
    throw error;
  }
}

export async function deleteSeries(id: string, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>(`/series/${id}`, {
      method: "DELETE",
      headers: getHeaders(accessToken),
    });
    return data.success === true;
  } catch (error) {
    console.error("Delete series error:", error);
    return false;
  }
}

export async function transitionSeries(
  id: string,
  status: EditorialStatus,
  accessToken: string,
  scheduledAt?: string,
): Promise<Series> {
  const data = await fetchJson<{ series: Series }>(`/series/${id}/transitions`, {
    method: "POST",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ status, scheduledAt }),
  });
  return data.series;
}

export async function fetchSeriesProgress(seriesId: string, accessToken: string): Promise<SeriesProgress> {
  try {
    const data = await fetchJson<{ progress?: SeriesProgress }>(`/series/${seriesId}/progress`, {
      headers: getHeaders(accessToken),
    });
    return data.progress ?? emptyProgress(seriesId);
  } catch (error) {
    console.error("Fetch series progress error:", error);
    return emptyProgress(seriesId);
  }
}

export async function updateSeriesProgress(
  seriesId: string,
  messageId: string,
  event: ProgressEvent,
  accessToken: string,
  keepalive = false,
): Promise<ProgressUpdateResult> {
  return fetchJson<ProgressUpdateResult>(`/series/${seriesId}/progress/${messageId}`, {
    method: "PUT",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(event),
    keepalive,
  });
}

export async function markSeriesProgress(seriesId: string, messageId: string, accessToken: string): Promise<SeriesProgress | null> {
  try {
    const data = await updateSeriesProgress(seriesId, messageId, {
      eventId: crypto.randomUUID(),
      state: "completed",
      progressPercent: 100,
      positionSeconds: 0,
      durationSeconds: 0,
      clientUpdatedAt: new Date().toISOString(),
      source: "manual",
    }, accessToken);
    return data.progress;
  } catch (error) {
    console.error("Mark series progress error:", error);
    return null;
  }
}

export async function fetchAllSeriesProgress(accessToken: string): Promise<Record<string, SeriesProgress>> {
  try {
    const data = await fetchJson<{ progress?: Record<string, SeriesProgress> }>("/series-progress", {
      headers: getHeaders(accessToken),
    });
    return data.progress ?? {};
  } catch (error) {
    console.error("Fetch all series progress error:", error);
    return {};
  }
}

export async function fetchMessageSeries(messageId: string): Promise<Series[]> {
  try {
    const data = await fetchJson<{ series?: Series[] }>(`/messages/${messageId}/series`, {
      headers: getHeaders(),
    });
    return data.series ?? [];
  } catch (error) {
    console.error("Fetch message series error:", error);
    return [];
  }
}
