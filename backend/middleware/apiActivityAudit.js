const { AuditLog } = require("../models");
const logger = require("../utils/logger");
const socketService = require("../services/socketService");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const READ_METHOD = "GET";
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
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
const DEFAULT_READ_PATH_PATTERNS = [
  /^\/api\/teachers\/profile$/i,
  /^\/api\/teachers\/classes\/[^/]+\/students$/i,
  /^\/api\/teachers\/classes\/[^/]+\/grades$/i,
  /^\/api\/reports\/student-report\/[^/]+\/[^/]+$/i,
  /^\/api\/reports\/term-report\/[^/]+\/[^/]+$/i,
  /^\/api\/reports\/export\/term-report\/[^/]+\/[^/]+$/i,
  /^\/api\/reports\/year-end-summary\/[^/]+$/i,
  /^\/api\/reports\/export\/year-end-summary\/[^/]+$/i,
];
const MAX_READ_AUDIT_KEYS = 5000;
const readAuditCooldownMap = new Map();

const toSafeString = (value, maxLength = 120) =>
  String(value ?? "").slice(0, maxLength);

const stripQueryString = (url = "") => String(url || "").split("?")[0];

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
    return value.length > 400 ? `${value.slice(0, 400)}...` : value;
  }

  return value;
};

const isLikelyIdentifier = (segment) =>
  /^[0-9a-fA-F-]{8,}$/.test(segment) || /^\d+$/.test(segment);

const extractPathSegments = (url = "") =>
  stripQueryString(url)
    .split("/")
    .filter(Boolean);

const inferTableName = (originalUrl) => {
  const segments = extractPathSegments(originalUrl);
  const apiIndex = segments.indexOf("api");
  const relative = apiIndex >= 0 ? segments.slice(apiIndex + 1) : segments;
  if (relative.length === 0) return "system";

  const namespace = relative[0];
  const primary =
    relative[1] && !isLikelyIdentifier(relative[1]) ? relative[1] : namespace;
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

  const actionPrefix = method === READ_METHOD ? "API_READ" : `API_${method}`;
  const raw = `${actionPrefix}_${namespace}_${resource}`
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

const shouldSkip = (req, skipPrefixes = []) => {
  const requestPath = stripQueryString(req.originalUrl || "");
  return skipPrefixes.some((prefix) => requestPath.startsWith(prefix));
};

const pruneReadCooldownMap = () => {
  if (readAuditCooldownMap.size <= MAX_READ_AUDIT_KEYS) return;
  const targetSize = Math.floor(MAX_READ_AUDIT_KEYS / 2);
  for (const key of readAuditCooldownMap.keys()) {
    readAuditCooldownMap.delete(key);
    if (readAuditCooldownMap.size <= targetSize) {
      break;
    }
  }
};

const normalizeReadAuditPatterns = (patterns = []) =>
  patterns
    .map((pattern) => {
      if (pattern instanceof RegExp) return pattern;
      if (typeof pattern !== "string" || !pattern.trim()) return null;
      try {
        return new RegExp(pattern, "i");
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);

const isTrackedReadRequest = (method, requestPath, patterns) =>
  method === READ_METHOD && patterns.some((pattern) => pattern.test(requestPath));

const createApiActivityAuditMiddleware = (options = {}) => {
  const skipPrefixes = Array.isArray(options.skipPrefixes)
    ? options.skipPrefixes
    : ["/api/auth", "/api/health", "/api/admin/audit-logs"];
  const auditReadRequests = options.auditReadRequests !== false;
  const readAuditPatterns = normalizeReadAuditPatterns(
    Array.isArray(options.readAuditPatterns) && options.readAuditPatterns.length > 0
      ? options.readAuditPatterns
      : DEFAULT_READ_PATH_PATTERNS,
  );
  const readAuditCooldownMs = Number(options.readAuditCooldownMs || 15000);

  return (req, res, next) => {
    const method = String(req.method || "").toUpperCase();
    const requestPath = stripQueryString(req.originalUrl || "");
    const shouldAuditWrite = MUTATING_METHODS.has(method);
    const shouldAuditRead =
      auditReadRequests && isTrackedReadRequest(method, requestPath, readAuditPatterns);

    if (!shouldAuditWrite && !shouldAuditRead) {
      return next();
    }

    if (shouldSkip(req, skipPrefixes)) {
      return next();
    }

    const startTime = Date.now();
    const bodySnapshot = sanitizeValue(truncateObjectKeys(req.body || {}));
    const querySnapshot = sanitizeValue(truncateObjectKeys(req.query || {}, 8));
    const paramsSnapshot = sanitizeValue(req.params || {});
    const readAuditKey =
      shouldAuditRead && req.user?.id ? `${req.user.id}:${method}:${requestPath}` : null;

    res.on("finish", async () => {
      try {
        if (!req.user) return;
        if (res.statusCode < 200 || res.statusCode >= 400) return;

        if (readAuditKey) {
          const lastSeenAt = readAuditCooldownMap.get(readAuditKey) || 0;
          if (Date.now() - lastSeenAt < readAuditCooldownMs) {
            return;
          }
          readAuditCooldownMap.set(readAuditKey, Date.now());
          pruneReadCooldownMap();
        }

        const action = inferAction(req);
        const tableName = inferTableName(req.originalUrl);
        const recordId = inferRecordId(req.params);
        const nowIso = new Date().toISOString();
        const accessContextSchoolId =
          req.accessContext?.school_id || req.user?.school_id || null;
        const eventType = shouldAuditRead ? "read" : "write";

        const auditRow = await AuditLog.create({
          user_id: req.user.id,
          action,
          table_name: tableName,
          record_id: recordId,
          new_values: {
            audit_context: {
              method,
              event_type: eventType,
              path: requestPath,
              status_code: res.statusCode,
              duration_ms: Date.now() - startTime,
              school_id: accessContextSchoolId,
              actor_role: req.user?.role || null,
              params: paramsSnapshot,
              query: querySnapshot,
              changed_fields: shouldAuditRead
                ? []
                : Object.keys(req.body || {}).slice(0, 25),
              request_body: shouldAuditRead ? null : bodySnapshot,
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
  READ_METHOD,
  WRITE_METHODS,
};
