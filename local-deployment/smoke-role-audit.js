#!/usr/bin/env node

const API_BASE = (process.env.QA_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");

const ROLE_CHECKS = [
  {
    role: "super_admin",
    required: true,
    loginEnv: "QA_SUPER_ADMIN_LOGIN",
    passwordEnv: "QA_SUPER_ADMIN_PASSWORD",
    endpoints: [
      { path: "/admin/dashboard", expect: 200 },
      { path: "/admin/access-control/matrix", expect: 200 },
      { path: "/admin/audit-logs?limit=5", expect: 200, validator: "auditLogs" },
    ],
  },
  {
    role: "admin",
    required: true,
    loginEnv: "QA_ADMIN_LOGIN",
    passwordEnv: "QA_ADMIN_PASSWORD",
    endpoints: [
      { path: "/admin/dashboard", expect: 200 },
      { path: "/reports/terms", expect: 200, validator: "terms" },
      { path: "/reports/classes", expect: 200 },
      { path: "/admin/audit-logs?limit=5", expect: 200, validator: "auditLogs" },
    ],
  },
  {
    role: "teacher",
    required: true,
    loginEnv: "QA_TEACHER_LOGIN",
    passwordEnv: "QA_TEACHER_PASSWORD",
    endpoints: [
      { path: "/teachers/profile", expect: 200 },
      { path: "/teachers/classes", expect: 200 },
    ],
  },
  {
    role: "student",
    required: false,
    loginEnv: "QA_STUDENT_LOGIN",
    passwordEnv: "QA_STUDENT_PASSWORD",
    endpoints: [{ path: "/students/profile", expect: 200 }],
  },
];

const parseBody = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return raw;
  }
};

const requestJson = async ({ path, method = "GET", token, body }) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseBody(response);
  return { status: response.status, payload };
};

const validatePayload = (validator, payload) => {
  if (!validator) return { ok: true };
  if (validator === "auditLogs") {
    const logs = payload?.audit_logs;
    if (!Array.isArray(logs)) {
      return { ok: false, message: "Expected audit_logs array in response" };
    }
    return { ok: true, meta: { audit_logs_count: logs.length } };
  }
  if (validator === "terms") {
    if (!Array.isArray(payload?.terms)) {
      return { ok: false, message: "Expected terms array in response" };
    }
    return { ok: true, meta: { terms_count: payload.terms.length } };
  }
  return { ok: true };
};

async function run() {
  const summary = {
    timestamp: new Date().toISOString(),
    api_base: API_BASE,
    passed: true,
    roles: [],
    failures: [],
  };

  for (const roleCheck of ROLE_CHECKS) {
    const login = (process.env[roleCheck.loginEnv] || "").trim();
    const password = (process.env[roleCheck.passwordEnv] || "").trim();
    const roleResult = { role: roleCheck.role, status: "passed", checks: [] };

    if (!login || !password) {
      if (roleCheck.required) {
        roleResult.status = "failed";
        roleResult.message = `Missing ${roleCheck.loginEnv}/${roleCheck.passwordEnv}`;
        summary.failures.push(`${roleCheck.role}: missing credentials`);
        summary.passed = false;
      } else {
        roleResult.status = "skipped";
        roleResult.message = `Optional role skipped (set ${roleCheck.loginEnv}/${roleCheck.passwordEnv} to test)`;
      }
      summary.roles.push(roleResult);
      continue;
    }

    let token = "";
    try {
      const loginResponse = await requestJson({
        path: "/auth/login",
        method: "POST",
        body: { login, password },
      });
      const loginOk = loginResponse.status === 200 && !!loginResponse.payload?.token;
      roleResult.checks.push({
        type: "login",
        status: loginResponse.status,
        ok: loginOk,
      });

      if (!loginOk) {
        roleResult.status = "failed";
        roleResult.message = "Login failed";
        summary.failures.push(`${roleCheck.role}: login failed (${loginResponse.status})`);
        summary.passed = false;
        summary.roles.push(roleResult);
        continue;
      }

      token = loginResponse.payload.token;

      for (const endpoint of roleCheck.endpoints) {
        const endpointResponse = await requestJson({
          path: endpoint.path,
          method: endpoint.method || "GET",
          token,
        });
        const expectedStatus = endpoint.expect || 200;
        const validatorResult = validatePayload(endpoint.validator, endpointResponse.payload);
        const endpointOk = endpointResponse.status === expectedStatus && validatorResult.ok;

        roleResult.checks.push({
          type: "endpoint",
          path: endpoint.path,
          status: endpointResponse.status,
          expected: expectedStatus,
          ok: endpointOk,
          ...(validatorResult.meta ? { meta: validatorResult.meta } : {}),
          ...(validatorResult.ok ? {} : { error: validatorResult.message }),
        });

        if (!endpointOk) {
          roleResult.status = "failed";
          summary.passed = false;
          summary.failures.push(
            `${roleCheck.role}: ${endpoint.path} status ${endpointResponse.status} (expected ${expectedStatus})`,
          );
        }
      }
    } catch (error) {
      roleResult.status = "failed";
      roleResult.message = error.message;
      summary.failures.push(`${roleCheck.role}: ${error.message}`);
      summary.passed = false;
    }

    summary.roles.push(roleResult);
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ passed: false, error: error.message }, null, 2));
  process.exit(1);
});
