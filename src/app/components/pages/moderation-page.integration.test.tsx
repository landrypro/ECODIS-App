import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { ApiError } from "../../services/http";

const api = vi.hoisted(() => ({
  fetchCommentModerationEvents: vi.fn(),
  fetchModerationComments: vi.fn(),
  fetchModerationReports: vi.fn(),
  moderateComment: vi.fn(),
  resolveCommentReport: vi.fn(),
}));

vi.mock("../auth-context", () => ({
  useAuth: () => ({ accessToken: "moderator-token", roles: ["moderator"] }),
}));
vi.mock("../../services", () => api);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ModerationPage } from "./moderation-page";

const report = {
  id: "report-1",
  commentId: "comment-1",
  reporterId: "reporter-1",
  reason: "spam" as const,
  detail: "Texte commercial indésirable",
  status: "open" as const,
  reviewedAt: null,
  reviewedBy: null,
  resolutionNote: "",
  createdAt: "2026-10-16T12:00:00.000Z",
  version: 4,
  comment: {
    id: "comment-1",
    messageId: "message-1",
    userId: "author-1",
    userName: "Auteur recette",
    userEmail: "author@example.test",
    text: "Commentaire à examiner",
    status: "visible" as const,
    createdAt: "2026-10-16T11:00:00.000Z",
    version: 7,
    moderatedAt: null,
    moderatedBy: null,
    moderationReason: "",
  },
};

function renderPage() {
  // JSDOM n'a pas à déterminer si le poste est en ligne : ces appels sont tous
  // simulés. Ce réglage rend l'état de chargement déterministe sans changer la
  // politique réseau de l'application en production.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: "always" } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ModerationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openHideDecision() {
  // Au premier rendu de la suite, le chargement JSDOM/Vite peut dépasser le
  // délai implicite de Testing Library. La requête reste mockée et cette
  // attente ne tolère ni écran d'erreur ni résultat vide.
  fireEvent.click(await screen.findByRole("button", { name: "Masquer" }, { timeout: 10_000 }));
}

describe("MC-E - console de modération", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("n'envoie aucune mutation lorsqu'un dialogue est annulé", async () => {
    api.fetchModerationReports.mockResolvedValue({ items: [report], nextCursor: null, hasMore: false });
    api.fetchModerationComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    api.fetchCommentModerationEvents.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

    renderPage();
    await openHideDecision();
    expect(screen.getByRole("dialog")).toHaveTextContent("Masquer le commentaire");
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(api.moderateComment).not.toHaveBeenCalled();
    expect(api.resolveCommentReport).not.toHaveBeenCalled();
  });

  it("envoie la version affichée uniquement après confirmation", async () => {
    api.fetchModerationReports.mockResolvedValue({ items: [report], nextCursor: null, hasMore: false });
    api.fetchModerationComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    api.fetchCommentModerationEvents.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    api.moderateComment.mockResolvedValue({ ...report.comment, status: "hidden", version: 8 });

    renderPage();
    await openHideDecision();
    fireEvent.change(screen.getByRole("textbox", { name: "Motif" }), { target: { value: "Spam récurrent" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la décision" }));

    await waitFor(() => expect(api.moderateComment).toHaveBeenCalledWith("comment-1", "hide", "Spam récurrent", 7, "moderator-token"));
  });

  it("recharge les listes après un conflit 409 sans rejouer la décision", async () => {
    api.fetchModerationReports.mockResolvedValue({ items: [report], nextCursor: null, hasMore: false });
    api.fetchModerationComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    api.fetchCommentModerationEvents.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    api.moderateComment.mockRejectedValue(new ApiError("Version obsolète", 409));

    renderPage();
    await openHideDecision();
    fireEvent.change(screen.getByRole("textbox", { name: "Motif" }), { target: { value: "Spam récurrent" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la décision" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("n'a pas été appliquée"));
    expect(api.moderateComment).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.fetchModerationReports.mock.calls.length).toBeGreaterThan(1));
  });

  it("recherche, affiche le contexte interne et consulte l'historique protégé", async () => {
    api.fetchModerationReports.mockResolvedValue({ items: [report], nextCursor: null, hasMore: false });
    api.fetchModerationComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    api.fetchCommentModerationEvents.mockResolvedValue({
      items: [{
        id: "event-1", commentId: "comment-1", reportId: "report-1", actorId: "moderator-1", action: "hide",
        previousStatus: "visible", nextStatus: "hidden", previousVersion: 7, nextVersion: 8,
        reason: "Spam récurrent", requestId: "request-1", createdAt: "2026-10-16T12:10:00.000Z",
      }],
      nextCursor: null,
      hasMore: false,
    });

    renderPage();
    expect(await screen.findByText("Auteur recette · author@example.test")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Rechercher un auteur ou un contenu" }), { target: { value: "Auteur recette" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrer" }));
    await waitFor(() => expect(api.fetchModerationReports).toHaveBeenLastCalledWith("moderator-token", expect.objectContaining({ search: "Auteur recette" })));

    fireEvent.click(await screen.findByRole("button", { name: "Historique" }));
    expect(await screen.findByRole("heading", { name: "Historique protégé" })).toBeInTheDocument();
    expect(await screen.findByText("Commentaire masqué")).toBeInTheDocument();
  });

  it("propose la restauration uniquement depuis la vue Masqués", async () => {
    const hiddenComment = { ...report.comment, status: "hidden" as const, version: 8, moderatedAt: "2026-10-16T12:00:00.000Z", moderationReason: "Spam récurrent", reportCount: 2, openReportCount: 0, lastDecisionAt: "2026-10-16T12:00:00.000Z" };
    api.fetchModerationReports.mockResolvedValue({ items: [report], nextCursor: null, hasMore: false });
    api.fetchModerationComments.mockResolvedValue({ items: [hiddenComment], nextCursor: null, hasMore: false });
    api.fetchCommentModerationEvents.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    api.moderateComment.mockResolvedValue({ ...hiddenComment, status: "visible", version: 9 });

    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Masqués" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restaurer" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la décision" }));

    await waitFor(() => expect(api.moderateComment).toHaveBeenCalledWith("comment-1", "restore", "", 8, "moderator-token"));
  });
});
