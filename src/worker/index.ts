import { routePartykitRequest } from "partyserver";
import { api } from "./api";
import { VERIFIED_ADMIN_HEADER, verifyAdmin } from "./auth";
import { isValidPin } from "../shared/validation";

export { QuizRoom } from "./quiz-room";

export default {
  async fetch(request, env, ctx) {
    // Anti-spam: a Durable Object is only instantiated for a game that exists in D1.
    // Random or malformed codes are rejected here, before reaching (and creating) one.
    const gameExists = async (code: string) =>
      isValidPin(code) && !!(await env.DB.prepare("SELECT 1 FROM games WHERE code = ?").bind(code).first());
    const notFound = () => new Response("Not found", { status: 404 });

    // Real-time WebSockets: /parties/quiz-room/:code
    const party = await routePartykitRequest(request, env, {
      // The Durable Object only speaks WebSocket: plain HTTP requests never reach it
      onBeforeRequest: notFound,
      async onBeforeConnect(req, lobby) {
        if (!(await gameExists(lobby.name))) return notFound();

        // Never trust this header when it comes from the client
        const headers = new Headers(req.headers);
        headers.delete(VERIFIED_ADMIN_HEADER);

        // Without the verified header, the Durable Object cleanly rejects the host (close 4401, no client retry)
        if (new URL(req.url).searchParams.get("role") === "host") {
          const admin = await verifyAdmin(req, env);
          if (admin) headers.set(VERIFIED_ADMIN_HEADER, admin.email);
        }
        return new Request(req, { headers });
      },
    });
    if (party) return party;

    // REST API: /api/*
    return api.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
