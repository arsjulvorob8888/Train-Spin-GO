import { createServerFn } from "@tanstack/react-start";

const BASE = "https://gcp-fn-treebuilder.prod-eu01.deepsolver.cloud";

export type DeepsolverCheck = { ok: boolean; text: string };

export const checkDeepsolver = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }): { token: string } => {
    const token = data.token.trim();
    if (!token || token.length > 500) throw new Error("Вставьте ключ Deepsolver.");
    return { token };
  })
  .handler(async ({ data }): Promise<DeepsolverCheck> => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/application/quota`, {
        headers: { Authorization: `Token ${data.token}` },
      });
    } catch {
      return { ok: false, text: "Deepsolver не ответил. Сеть или их сервер." };
    }
    if (res.status === 401) return { ok: false, text: "Ключ не принят. Проверьте, что это токен приложения, не пароль." };
    if (!res.ok) return { ok: false, text: `Deepsolver ответил ${res.status}. Расчёт не запускался, квота не тратилась.` };
    const body = (await res.json()) as { remaining?: number | null; unlimited?: boolean };
    const left = body.unlimited ? "лимит не ограничен" : body.remaining == null ? "квота не названа" : `осталось ${body.remaining} расчётов`;
    return { ok: true, text: `Ключ работает, ${left}. Живой ход по-прежнему считает чарт: их расчёт занимает секунды и только хедз-ап.` };
  });
