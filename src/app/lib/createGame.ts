import { api } from "./api";

/** Creates a game from a question set and opens the presentation view in a new tab. */
export async function createGame(setId: string) {
  // Open the tab synchronously so the popup blocker doesn't stop it
  const tab = window.open("about:blank", "_blank");
  try {
    const { code } = await api<{ code: string }>("/admin/games", { method: "POST", json: { setId } });
    if (tab) tab.location.href = `/host/${code}`;
    return code;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
