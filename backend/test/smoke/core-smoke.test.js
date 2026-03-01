const express = require("express");

const attendanceRoutes = require("../../routes/attendance");
const facilityRoutes = require("../../routes/facilities");
const teacherRoutes = require("../../routes/teachers");
const studentRoutes = require("../../routes/students");
const {
  scoreToCaribbeanGrade,
  gradeToMidpointScore,
} = require("../../utils/caribbeanGradeScale");

describe("Backend smoke checks", () => {
  test("core route modules load and mount", () => {
    const app = express();
    app.use("/attendance", attendanceRoutes);
    app.use("/facilities", facilityRoutes);
    app.use("/teachers", teacherRoutes);
    app.use("/students", studentRoutes);
    expect(app).toBeDefined();
  });

  test("caribbean grading helpers produce expected values", () => {
    expect(scoreToCaribbeanGrade(92)).toBe("A+");
    expect(scoreToCaribbeanGrade(50)).toBe("C-");
    expect(scoreToCaribbeanGrade(44)).toBe("D");
    expect(scoreToCaribbeanGrade(38)).toBe("F");
    expect(gradeToMidpointScore("B")).toBe(72);
  });
});
