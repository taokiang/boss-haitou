import { createEdgeOneStore, handleCardRequest } from "../service/card-service.mjs";

export default function onRequest(context) {
  const kv = context.env?.CARD_KEYS ??
    (typeof CARD_KEYS !== "undefined" ? CARD_KEYS : undefined);
  return handleCardRequest(context.request, {
    store: kv ? createEdgeOneStore(kv) : null,
    adminToken: context.env?.ADMIN_TOKEN,
  });
}
