import { routePartykitRequest } from "partyserver";
import { api } from "./api";
import { VERIFIED_ADMIN_HEADER, verifyAdmin } from "./auth";

export { QuizRoom } from "./quiz-room";

export default {
  async fetch(request, env, ctx) {
    // Real-time WebSockets: /parties/quiz-room/:code
    const party = await routePartykitRequest(request, env, {
      async onBeforeConnect(req) {
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
