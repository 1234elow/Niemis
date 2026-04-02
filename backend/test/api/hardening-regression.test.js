const request = require("supertest");
const app = require("../../server");
const { sequelize } = require("../../config/database");
const TestHelpers = require("./test-helpers");

describe("Hardening Regression Tests", () => {
  let testHelpers;

  beforeAll(async () => {
    testHelpers = new TestHelpers();
    await testHelpers.createTestUsers();
  });

  afterAll(async () => {
    await testHelpers.cleanup();
    await sequelize.close();
  });

  test("legacy demo/debug/fix endpoints remain removed", async () => {
    const removedEndpoints = [
      "/api/demo",
      "/api/debug-staff",
      "/api/fix-proper-assignments",
    ];

    for (const endpoint of removedEndpoints) {
      const response = await request(app).get(endpoint);
      expect(response.status).toBe(404);
    }
  });

  test("barbados school stats endpoint requires authentication", async () => {
    const response = await request(app).get("/api/schools/statistics/barbados");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("NO_TOKEN");
  });

  test("admin cannot use super-admin-only security endpoints", async () => {
    const adminAuth = testHelpers.getAuthHeader("admin");

    const blockIpResponse = await request(app)
      .post("/api/security/block-ip")
      .set("Authorization", adminAuth)
      .send({ ip: "203.0.113.10" });
    expect(blockIpResponse.status).toBe(403);
    expect(blockIpResponse.body.code).toBe("INSUFFICIENT_PERMISSIONS");

    const addCorsOriginResponse = await request(app)
      .post("/api/security/cors/add-temp-origin")
      .set("Authorization", adminAuth)
      .send({ origin: "https://admin-should-not-change-cors.example" });
    expect(addCorsOriginResponse.status).toBe(403);
    expect(addCorsOriginResponse.body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  test("super admin can reach secured operational endpoints", async () => {
    const superAdminAuth = testHelpers.getAuthHeader("super_admin");
    const testIp = "203.0.113.11";
    const testOrigin = "https://cors-change-test.example";

    const statsResponse = await request(app)
      .get("/api/schools/statistics/barbados")
      .set("Authorization", superAdminAuth);
    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.overview).toBeDefined();

    const blockIpResponse = await request(app)
      .post("/api/security/block-ip")
      .set("Authorization", superAdminAuth)
      .send({ ip: testIp, reason: "test_hardening_regression", duration: 5000 });
    expect(blockIpResponse.status).toBe(200);

    const unblockIpResponse = await request(app)
      .post("/api/security/unblock-ip")
      .set("Authorization", superAdminAuth)
      .send({ ip: testIp, reason: "test_cleanup" });
    expect(unblockIpResponse.status).toBe(200);

    const addCorsOriginResponse = await request(app)
      .post("/api/security/cors/add-temp-origin")
      .set("Authorization", superAdminAuth)
      .send({ origin: testOrigin, duration: 1000 });
    expect(addCorsOriginResponse.status).toBe(200);

    const removeCorsOriginResponse = await request(app)
      .post("/api/security/cors/remove-temp-origin")
      .set("Authorization", superAdminAuth)
      .send({ origin: testOrigin });
    expect(removeCorsOriginResponse.status).toBe(200);
  });
});
