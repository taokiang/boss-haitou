import { createCloudflareStore, handleCardRequest } from "../../service/card-service.mjs";

export default {
  fetch(request, env) {
    return handleCardRequest(request, {
      store: createCloudflareStore(env.CARD_KEYS),
      adminToken: env.ADMIN_TOKEN,
      // 兼容尚未生成设备标识的旧扩展版本。
      allowLegacyDevice: true,
    });
  },
};
