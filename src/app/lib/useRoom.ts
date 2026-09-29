import { useEffect, useState } from "react";
import usePartySocket from "partysocket/react";
import {
  PARTY,
  type ClientMessage,
  type HostView,
  type PlayerView,
  type ServerMessage,
} from "../../shared/types";
import type { UiError } from "./errors";

const PLAYER_ID_KEY = "quizz:player-id";

/** Stable per-browser id: lets a player rejoin the game after a refresh. */
export function getPlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

type ViewFor<R> = R extends "host" ? HostView : PlayerView;

export function useRoom<R extends "host" | "player">(code: string, role: R) {
  const [view, setView] = useState<ViewFor<R> | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [kicked, setKicked] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);

  const socket = usePartySocket({
    party: PARTY,
    room: code,
    id: role === "player" ? getPlayerId() : undefined,
    query: { role },
    onMessage(event) {
      const msg = JSON.parse(event.data) as ServerMessage;
      if (msg.type === "state") {
        setView(msg.view as ViewFor<R>);
        setError(null);
        // Convert the remaining time into a local deadline
        setDeadline(msg.view.remainingMs !== null ? Date.now() + msg.view.remainingMs : null);
      } else if (msg.type === "error") {
        setError({ code: msg.code, params: msg.params });
      } else if (msg.type === "kicked") {
        setKicked(true);
        socket.close();
      }
    },
    onClose(event) {
      // Application close codes 44xx: no point retrying
      if (event.code >= 4400 && event.code < 4500) socket.close();
    },
  });

  const send = (msg: ClientMessage) => socket.send(JSON.stringify(msg));

  return { view, error, kicked, deadline, send };
}

/** Seconds left until a deadline, refreshed 4 times per second. */
export function useCountdown(deadline: number | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}
