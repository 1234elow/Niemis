const { AuditLog } = require("../models");
const logger = require("../utils/logger");
const socketService = require("../services/socketService");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ID_PARAM_KEYS = [
  "id",
  "studentId",
  "teacherId",
  "schoolId",
  "classId",
  "termId",
  "transferId",
  "issueId",
  "policyId",
  "userId",
];
const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "refreshToken",
  "refresh_token",
  "secret",
  "authorization",
  "auth",
]);

const toSafeString = (value, maxLength = 120) =>
  String(value ?? "").slice(0, maxLength);

const truncateObjectKeys = (obj = {}, maxKeys = 12) => {
  const entries = Object.entries(obj || {}).slice(0, maxKeys);
  return entries.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const sanitizeValue = (value, depth = 0) => {
  if (value == null) return value;
  if (depth > 3) return "[TRUNCATED]";

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitized = {};
    for (const [key, raw] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeValue(raw, depth + 1);
      }
    }
    return sanitized;
  }

  if (typeof value === "string") {
    return value.length > 400 ? `${value.slice(0, 400)}…` : value;
  }

  return value;
};

const isLikelyIdentifier = (segment) =>
  /^[0-9a-fA-F-]{8,}$/.test(segment) || /^\d+$/.test(segment);

const extractPathSegments = (url = "") =>
  String(url || "")
    .split("?")[0]
    .split("/")
    .filter(Boolean);

const inferTableName = (originalUrl) => {
  const segments = extractPathSegments(originalUrl);
  const apiIndex = segments.indexOf("api");
  const relative = apiIndex >= 0 ? segments.slice(apiIndex + 1) : segments;
  if (relative.length === 0) return "system";

  // Usually [namespace, resource, id, subresource]
  const namespace = relative[0];
  const primary = relative[1] && !isLikelyIdentifier(relative[1]) ? relative[1] : namespace;
  return toSafeString(primary, 50);
};

const inferAction = (req) => {
  const method = String(req.method || "").toUpperCase();
  const segments = extractPathSegments(req.originalUrl);
  const apiIndex = segments.indexOf("api");
  const relative = apiIndex >= 0 ? segments.slice(apiIndex + 1) : segments;

  const namespace = relative[0] || "system";
  const resource =
    relative.find((segment, index) => index > 0 && !isLikelyIdentifier(segment)) ||
    namespace;

  const raw = `API_${method}_${namespace}_${resource}`
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toUpperCase();
  return raw.slice(0, 50);
};

const inferRecordId = (params = {}) => {
  for (const key of ID_PARAM_KEYS) {
    if (params[key] != null && params[key] !== "") {
      return toSafeString(params[key], 80);
    }
  }
  return null;
};

const shouldSkip = (req, skipPrefixes = []) =>
  skipPrefixes.some((prefix) => String(req.originalUrl || "").startsWith(prefix));

const createApiActivityAuditMiddleware = (options = {}) => {
  const skipPrefixes = Array.isArray(options.skipPrefixes)
    ? options.skipPrefixes
    : ["/api/auth", "/api/health"];

  return (req, res, next) => {
    const method = String(req.method || "").toUpperCase();
    if (!MUTATING_METHODS.has(method)) {
      return next();
    }

    if (shouldSkip(req, skipPrefixes)) {
      return next();
    }

    const startTime = Date.now();
    const bodySnapshot = sanitizeValue(truncateObjectKeys(req.body || {}));
    const querySnapshot = sanitizeValue(truncateObjectKeys(req.query || {}, 8));
    const paramsSnapshot = sanitizeValue(req.params || {});

    res.on("finish", async () => {
      try {
        if (!req.user) return;
        if (res.statusCode < 200 || res.statusCode >= 400) return;

        const action = inferAction(req);
        const tableName = inferTableName(req.originalUrl);
        const recordId = inferRecordId(req.params);
        const nowIso = new Date().toISOString();

        const auditRow = await AuditLog.create({
          user_id: req.user.id,
          action,
          table_name: tableName,
          record_id: recordId,
          new_values: {
            audit_context: {
              method,
              path: req.originalUrl,
              status_code: res.statusCode,
              duration_ms: Date.now() - startTime,
              params: paramsSnapshot,
              query: querySnapshot,
              changed_fields: Object.keys(req.body || {}).slice(0, 25),
              request_body: bodySnapshot,
              audited_at: nowIso,
            },
          },
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
        });

        if (typeof socketService?.broadcastToRole === "function") {
          await socketService.broadcastToRole("super_admin", "audit_log_created", {
            id: auditRow.id,
            action: auditRow.action,
            table_name: auditRow.table_name,
            record_id: auditRow.record_id,
            user_id: auditRow.user_id,
            created_at: auditRow.created_at || nowIso,
            context: auditRow.new_values?.audit_context || null,
          });
        }
      } catch (error) {
        logger.warn("Automatic API activity audit failed", {
          error: error.message,
          path: req.originalUrl,
          method,
        });
      }
    });

    return next();
  };
};

module.exports = {
  createApiActivityAuditMiddleware,
};

