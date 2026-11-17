import { ApiError } from "./api";
import type { SupportSettings } from "./support";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "赞助配置格式无效");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new ApiError(400, "赞助配置包含未知字段");
}
function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new ApiError(400, `${label}${required ? "不能为空，且" : ""}需在 ${max} 字以内`);
  return value.trim();
}
function link(value: unknown, label: string, image = false) {
  const url = text(value, label, 2048);
  if (!url) return url;
  if (image && /^\/uploads\/[0-9a-f-]{36}\.webp$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (!/^https?:\/\//i.test(url) || !["https:", "http:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || /[\s\\\u0000-\u001f]/.test(url)) throw new Error();
  } catch { throw new ApiError(400, `${label}需为完整的 http(s) 链接${image ? "或已上传的图片" : ""}`); }
  return url;
}
function rows(value: unknown, limit: number, label: string) {
  if (!Array.isArray(value) || value.length > limit) throw new ApiError(400, `${label}最多 ${limit} 项`);
  const items = value.map(object);
  const ids = items.map(item => text(item.id, "标识", 80, true));
  if (new Set(ids).size !== ids.length) throw new ApiError(400, `${label}有重复标识`);
  return items;
}

export function parseSupport(value: Record<string, unknown>): SupportSettings {
  fields(value, ["reason", "declaration", "thanks", "channels", "supporters", "revision"]);
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || Number(value.revision) >= 2147483647) throw new ApiError(400, "配置版本无效，请重新加载");
  return {
    revision: Number(value.revision),
    reason: text(value.reason, "赞助缘由", 20000),
    declaration: text(value.declaration, "赞助宣言", 20000),
    thanks: text(value.thanks, "感谢语", 20000),
    channels: rows(value.channels, 12, "赞助方式").map(item => {
      fields(item, ["id", "name", "url", "qrUrl", "description"]);
      const url = link(item.url, "平台链接"), qrUrl = link(item.qrUrl, "二维码链接", true);
      if (!url && !qrUrl) throw new ApiError(400, "每个赞助方式至少填写一个链接或上传二维码");
      return { id: text(item.id, "标识", 80, true), name: text(item.name, "平台名称", 80, true), url, qrUrl, description: text(item.description, "平台说明", 500) };
    }),
    supporters: rows(value.supporters, 500, "赞助者").map(item => {
      fields(item, ["id", "name", "url", "date", "amount", "message"]);
      const date = text(item.date, "赞助日期", 10);
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new ApiError(400, "赞助日期无效");
      return { id: text(item.id, "标识", 80, true), name: text(item.name, "赞助者昵称", 100, true), url: link(item.url, "赞助者主页"), date, amount: text(item.amount, "金额", 80), message: text(item.message, "致谢", 1000) };
    }),
  };
}
