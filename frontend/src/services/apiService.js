import { authService } from "./authService";

class ApiService {
  constructor() {
    this.api = authService.api;
  }

  // Schools - use admin API only (database-backed)
  async getSchools(params = {}) {
    try {
      const response = await this.api.get("/admin/schools", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching schools:", error);
      throw error;
    }
  }

  async getSchool(id) {
    try {
      const response = await this.api.get(`/admin/schools/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching school details:", error);
      if (error.response?.status === 404) {
        throw new Error("School not found");
      } else if (error.response?.status === 500) {
        throw new Error(
          "Server error loading school details. Please try again.",
        );
      } else {
        throw new Error(
          error.response?.data?.error ||
            error.message ||
            "Failed to load school details",
        );
      }
    }
  }

  async createSchool(schoolData) {
    try {
      const response = await this.api.post("/admin/schools", schoolData);
      return response.data;
    } catch (error) {
      console.error("Error creating school:", error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to create school",
      );
    }
  }

  async updateSchool(id, schoolData) {
    try {
      const response = await this.api.put(`/admin/schools/${id}`, schoolData);
      return response.data;
    } catch (error) {
      console.error("Error updating school:", error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to update school",
      );
    }
  }

  async deleteSchool(id) {
    try {
      const response = await this.api.delete(`/admin/schools/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting school:", error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to delete school",
      );
    }
  }

  // Static data for dropdowns (based on Barbados geography)
  getSchoolTypes() {
    return [
      { value: "pre_primary", label: "Pre-Primary/Nursery" },
      { value: "primary", label: "Primary" },
      { value: "secondary", label: "Secondary" },
    ];
  }

  async getParishes() {
    try {
      const response = await this.api.get("/admin/schools/parishes");
      return response.data.map((parish) => ({
        value: parish.name,
        label: parish.name,
        code: parish.code,
        id: parish.id,
      }));
    } catch (error) {
      console.error("Error fetching parishes:", error);
      throw error;
    }
  }

  getGradeLevels() {
    return [
      { value: "Reception", label: "Reception" },
      { value: "Class 1", label: "Class 1" },
      { value: "Class 2", label: "Class 2" },
      { value: "Class 3", label: "Class 3" },
      { value: "Class 4", label: "Class 4" },
      { value: "First Form", label: "First Form" },
      { value: "Second Form", label: "Second Form" },
      { value: "Third Form", label: "Third Form" },
      { value: "Fourth Form", label: "Fourth Form" },
      { value: "Fifth Form", label: "Fifth Form" },
      { value: "Lower Sixth", label: "Lower Sixth" },
      { value: "Upper Sixth", label: "Upper Sixth" },
    ];
  }

  async getSchoolStatistics(id, params = {}) {
    const response = await this.api.get(`/schools/${id}/statistics`, {
      params,
    });
    return response.data;
  }

  async getAdminDashboard() {
    const response = await this.api.get("/admin/dashboard");
    return response.data;
  }

  async getAdminAuditLogs(params = {}) {
    const response = await this.api.get("/admin/audit-logs", { params });
    return response.data;
  }

  async downloadReadinessSignedPdf(payload) {
    const response = await this.api.post("/admin/readiness/report/pdf", payload, {
      responseType: "blob",
    });
    const disposition =
      response.headers?.["content-disposition"] ||
      response.headers?.["Content-Disposition"] ||
      "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: response.data,
      filename: match?.[1] || null,
      reportId:
        response.headers?.["x-readiness-report-id"] ||
        response.headers?.["X-Readiness-Report-Id"] ||
        null,
      signature:
        response.headers?.["x-readiness-signature"] ||
        response.headers?.["X-Readiness-Signature"] ||
        null,
    };
  }

  async getDataQualityOverview(params = {}) {
    const response = await this.api.get("/admin/data-quality", { params });
    return response.data;
  }

  async getDataQualityIssues(params = {}) {
    const response = await this.api.get("/admin/data-quality/issues", { params });
    return response.data;
  }

  async updateDataQualityIssue(issueId, payload) {
    const response = await this.api.patch(`/admin/data-quality/issues/${issueId}`, payload);
    return response.data;
  }

  async applyDataQualityFix(payload) {
    const response = await this.api.post("/admin/data-quality/fix", payload);
    return response.data;
  }

  async getDataQualityAssignableUsers(params = {}) {
    const response = await this.api.get("/admin/data-quality/assignable-users", { params });
    return response.data;
  }

  async getDataQualityReleaseGate(params = {}) {
    const response = await this.api.get("/admin/data-quality/release-gate", { params });
    return response.data;
  }

  async getDataQualityPlaybooks(params = {}) {
    const response = await this.api.get("/admin/data-quality/playbooks", { params });
    return response.data;
  }

  async getDataQualityPlaybookPreview(checkKey, params = {}) {
    const response = await this.api.get(`/admin/data-quality/playbooks/${checkKey}/preview`, { params });
    return response.data;
  }

  async applyDataQualityPlaybook(checkKey, payload = {}) {
    const response = await this.api.post(`/admin/data-quality/playbooks/${checkKey}/apply`, payload);
    return response.data;
  }

  async getZonePerformance(params = {}) {
    const response = await this.api.get("/admin/zones/performance", { params });
    return response.data;
  }

  async getRolloverPreview(params = {}) {
    const response = await this.api.get("/admin/rollover/preview", { params });
    return response.data;
  }

  async executeRollover(payload) {
    const response = await this.api.post("/admin/rollover/execute", payload);
    return response.data;
  }

  async getTransferWorkflow(params = {}) {
    const response = await this.api.get("/admin/transfers/workflow", { params });
    return response.data;
  }

  async getTeacherTransferWorkflow(params = {}) {
    const response = await this.api.get("/admin/transfers/teachers/workflow", { params });
    return response.data;
  }

  async updateTransferWorkflow(transferId, payload) {
    const response = await this.api.patch(`/admin/transfers/${transferId}/workflow`, payload);
    return response.data;
  }

  async updateTeacherTransferWorkflow(transferId, payload) {
    const response = await this.api.patch(`/admin/transfers/teachers/${transferId}/workflow`, payload);
    return response.data;
  }

  async initiateStudentTransfer(payload) {
    try {
      const response = await this.api.post("/admin/transfers/initiate", payload);
      return response.data;
    } catch (error) {
      const routeMissing =
        error?.response?.status === 404 &&
        String(error?.response?.data?.code || "").toUpperCase() === "ROUTE_NOT_FOUND";
      if (!routeMissing) {
        throw error;
      }
      const fallbackResponse = await this.api.post("/admin/transfers", payload);
      return fallbackResponse.data;
    }
  }

  async initiateTeacherTransfer(payload) {
    try {
      const response = await this.api.post("/admin/transfers/teachers/initiate", payload);
      return response.data;
    } catch (error) {
      const routeMissing =
        error?.response?.status === 404 &&
        String(error?.response?.data?.code || "").toUpperCase() === "ROUTE_NOT_FOUND";
      if (!routeMissing) {
        throw error;
      }
      try {
        const fallbackResponse = await this.api.post("/admin/transfers/teachers", payload);
        return fallbackResponse.data;
      } catch (fallbackError) {
        const secondRouteMissing =
          fallbackError?.response?.status === 404 &&
          String(fallbackError?.response?.data?.code || "").toUpperCase() === "ROUTE_NOT_FOUND";
        if (!secondRouteMissing) {
          throw fallbackError;
        }
        const legacyResponse = await this.api.post("/admin/teacher-transfers/initiate", payload);
        return legacyResponse.data;
      }
    }
  }

  async getStudentDirectory(params = {}) {
    const response = await this.api.get("/admin/students/directory", { params });
    return response.data;
  }

  async getStaffDirectory(params = {}) {
    const response = await this.api.get("/admin/staff/directory", { params });
    return response.data;
  }

  async getBsseeOverview(params = {}) {
    const response = await this.api.get("/admin/bssee/overview", { params });
    return response.data;
  }

  async getBsseeApplications(params = {}) {
    const response = await this.api.get("/admin/bssee/applications", { params });
    return response.data;
  }

  async createBsseeApplication(payload) {
    const response = await this.api.post("/admin/bssee/applications", payload);
    return response.data;
  }

  async updateBsseeApplication(applicationId, payload) {
    const response = await this.api.patch(`/admin/bssee/applications/${applicationId}`, payload);
    return response.data;
  }

  async getAccessControlMatrix() {
    const response = await this.api.get("/admin/access-control/matrix");
    return response.data;
  }

  async getMyAccessProfile() {
    const response = await this.api.get("/admin/access-control/my-access");
    return response.data;
  }

  async getAccessControlUsers(params = {}) {
    const response = await this.api.get("/admin/access-control/users", { params });
    return response.data;
  }

  async createAccessControlUser(payload) {
    const response = await this.api.post("/admin/access-control/users", payload);
    return response.data;
  }

  async resetAccessControlUserPassword(userId, payload = {}) {
    const response = await this.api.post(`/admin/access-control/users/${userId}/reset-password`, payload);
    return response.data;
  }

  async getAdminGradingPolicies(params = {}) {
    const response = await this.api.get("/admin/grading-policies", { params });
    return response.data;
  }

  async saveAdminGradingPolicy(payload) {
    const response = await this.api.post("/admin/grading-policies", payload);
    return response.data;
  }

  async updateAdminGradingPolicy(policyId, payload) {
    const response = await this.api.patch(`/admin/grading-policies/${policyId}`, payload);
    return response.data;
  }

  async updateAccessControlUser(userId, payload) {
    const response = await this.api.patch(`/admin/access-control/users/${userId}`, payload);
    return response.data;
  }

  async getAccessControlUserHistory(userId, params = {}) {
    const response = await this.api.get(`/admin/access-control/users/${userId}/history`, {
      params,
    });
    return response.data;
  }

  // Students
  async getStudents(params = {}) {
    const response = await this.api.get("/students", { params });
    return response.data;
  }

  async getStudent(id) {
    const response = await this.api.get(`/students/${id}`);
    return response.data;
  }

  async createStudent(studentData) {
    const response = await this.api.post("/students", studentData);
    return response.data;
  }

  async updateStudent(id, studentData) {
    const response = await this.api.put(`/students/${id}`, studentData);
    return response.data;
  }

  async deleteStudent(id) {
    const response = await this.api.delete(`/students/${id}`);
    return response.data;
  }

  async getStudentAttendance(id, params = {}) {
    const response = await this.api.get(`/students/${id}/attendance`, {
      params,
    });
    return response.data;
  }

  async getStudentAcademics(id, params = {}) {
    const response = await this.api.get(`/students/${id}/academics`, {
      params,
    });
    return response.data;
  }

  // Teachers
  async getTeachers(params = {}) {
    const response = await this.api.get("/teachers", { params });
    return response.data;
  }

  async getTeacher(id) {
    const response = await this.api.get(`/teachers/${id}`);
    return response.data;
  }

  async createTeacher(teacherData) {
    const response = await this.api.post("/teachers", teacherData);
    return response.data;
  }

  async updateTeacher(id, teacherData) {
    const response = await this.api.put(`/teachers/${id}`, teacherData);
    return response.data;
  }

  async deleteTeacher(id) {
    const response = await this.api.delete(`/teachers/${id}`);
    return response.data;
  }

  // Attendance
  async getAttendance(params = {}) {
    const response = await this.api.get("/attendance", { params });
    return response.data;
  }

  async recordRFIDAttendance(data) {
    const response = await this.api.post("/attendance/rfid", data);
    return response.data;
  }

  // Facilities
  async getFacilities(params = {}) {
    const response = await this.api.get("/facilities", { params });
    return response.data;
  }

  async createFacility(facilityData) {
    const response = await this.api.post("/facilities", facilityData);
    return response.data;
  }

  // Reports
  async getSchoolSummaryReport(schoolId) {
    const response = await this.api.get(`/reports/school-summary/${schoolId}`);
    return response.data;
  }

  async getAttendanceReport(params = {}) {
    const response = await this.api.get("/reports/attendance", { params });
    return response.data;
  }

  // RFID
  async processRFIDScan(data) {
    const response = await this.api.post("/rfid/scan", data);
    return response.data;
  }

  async registerRFIDDevice(deviceData) {
    const response = await this.api.post("/rfid/devices", deviceData);
    return response.data;
  }

  // Teacher-specific endpoints
  async getTeacherProfile() {
    try {
      const response = await this.api.get("/teachers/profile");
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher profile:", error);
      throw error;
    }
  }

  async getTeacherClasses() {
    try {
      const response = await this.api.get("/teachers/classes");
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher classes:", error);
      throw error;
    }
  }

  async getTeacherClassOptions() {
    try {
      const response = await this.api.get("/teachers/class-options");
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher class options:", error);
      throw error;
    }
  }

  async createTeacherClass(classData) {
    try {
      const response = await this.api.post("/teachers/classes", classData);
      return response.data;
    } catch (error) {
      console.error("Error creating teacher class:", error);
      throw error;
    }
  }

  async deleteTeacherClass(classId) {
    try {
      const response = await this.api.delete(`/teachers/classes/${classId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting teacher class:", error);
      throw error;
    }
  }

  async updateTeacherDayPolicy(policyData) {
    try {
      const response = await this.api.patch("/teachers/class-options/day-policy", policyData);
      return response.data;
    } catch (error) {
      console.error("Error updating school day policy:", error);
      throw error;
    }
  }

  async getClassTimetable(classId) {
    try {
      const response = await this.api.get(`/teachers/classes/${classId}/timetable`);
      return response.data;
    } catch (error) {
      console.error("Error fetching class timetable:", error);
      throw error;
    }
  }

  async createClassTimetableSlot(classId, slotData) {
    try {
      const response = await this.api.post(
        `/teachers/classes/${classId}/timetable-slots`,
        slotData,
      );
      return response.data;
    } catch (error) {
      console.error("Error creating timetable slot:", error);
      throw error;
    }
  }

  async updateClassTimetableSlot(classId, slotId, slotData) {
    try {
      const response = await this.api.patch(
        `/teachers/classes/${classId}/timetable-slots/${slotId}`,
        slotData,
      );
      return response.data;
    } catch (error) {
      console.error("Error updating timetable slot:", error);
      throw error;
    }
  }

  async deleteClassTimetableSlot(classId, slotId) {
    try {
      const response = await this.api.delete(
        `/teachers/classes/${classId}/timetable-slots/${slotId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error deleting timetable slot:", error);
      throw error;
    }
  }

  async getTeacherGradeQueue() {
    try {
      const response = await this.api.get("/teachers/grade-queue");
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher grade queue:", error);
      throw error;
    }
  }

  async getTeacherGradingPolicy(params = {}) {
    try {
      const response = await this.api.get("/teachers/grading-policy", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher grading policy:", error);
      throw error;
    }
  }

  async getTeacherGradeAnalytics(params = {}) {
    try {
      const response = await this.api.get("/teachers/grade-analytics", {
        params,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher grade analytics:", error);
      throw error;
    }
  }

  async getTeacherCommentBank() {
    try {
      const response = await this.api.get("/teachers/comment-bank");
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher comment bank:", error);
      throw error;
    }
  }

  async saveTeacherCommentTemplate(payload) {
    try {
      const response = await this.api.post("/teachers/comment-bank", payload);
      return response.data;
    } catch (error) {
      console.error("Error saving teacher comment template:", error);
      throw error;
    }
  }

  async deleteTeacherCommentTemplate(templateId) {
    try {
      const response = await this.api.delete(`/teachers/comment-bank/${templateId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting teacher comment template:", error);
      throw error;
    }
  }

  async getTeacherCoverRequests() {
    try {
      const response = await this.api.get("/teachers/cover-requests");
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher cover requests:", error);
      throw error;
    }
  }

  async createTeacherCoverRequest(payload) {
    try {
      const response = await this.api.post("/teachers/cover-requests", payload);
      return response.data;
    } catch (error) {
      console.error("Error creating teacher cover request:", error);
      throw error;
    }
  }

  async updateTeacherCoverRequest(requestId, payload) {
    try {
      const response = await this.api.patch(`/teachers/cover-requests/${requestId}`, payload);
      return response.data;
    } catch (error) {
      console.error("Error updating teacher cover request:", error);
      throw error;
    }
  }

  async getTeacherActivityTimeline(params = {}) {
    try {
      const response = await this.api.get("/teachers/activity-timeline", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher activity timeline:", error);
      throw error;
    }
  }

  async getTeacherStudents(classId) {
    try {
      const response = await this.api.get(
        `/teachers/classes/${classId}/students`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher students:", error);
      throw error;
    }
  }

  async markAttendance(classId, attendanceData) {
    try {
      const response = await this.api.post(
        `/teachers/classes/${classId}/attendance`,
        attendanceData,
      );
      return response.data;
    } catch (error) {
      console.error("Error marking attendance:", error);
      throw error;
    }
  }

  async enterGrades(classId, gradesData) {
    try {
      const response = await this.api.post(
        `/teachers/classes/${classId}/grades`,
        gradesData,
      );
      return response.data;
    } catch (error) {
      console.error("Error entering grades:", error);
      throw error;
    }
  }

  // Get grades for a specific class
  async getClassGrades(classId, filters = {}) {
    try {
      const response = await this.api.get(
        `/teachers/classes/${classId}/grades`,
        {
          params: filters,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching class grades:", error);
      throw error;
    }
  }

  // Get grade history for a specific student
  async getStudentGrades(classId, studentId) {
    try {
      const response = await this.api.get(
        `/teachers/classes/${classId}/students/${studentId}/grades`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching student grades:", error);
      throw error;
    }
  }

  // Reports - Term Reports
  async getTermReport(classId, termId) {
    try {
      const response = await this.api.get(
        `/reports/term-report/${classId}/${termId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching term report:", error);
      throw error;
    }
  }

  async getStudentReport(studentId, termId) {
    try {
      const response = await this.api.get(
        `/reports/student-report/${studentId}/${termId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching student report:", error);
      throw error;
    }
  }

  async exportTermReport(classId, termId) {
    try {
      const response = await this.api.get(
        `/reports/export/term-report/${classId}/${termId}`,
        {
          responseType: "blob",
        },
      );
      return response.data;
    } catch (error) {
      console.error("Error exporting term report:", error);
      throw error;
    }
  }

  async importGradesFromCSV(classId, termId, file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("classId", classId);
      formData.append("termId", termId);

      const response = await this.api.post("/reports/import-grades", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error importing grades:", error);
      throw error;
    }
  }

  async downloadCSVTemplate() {
    try {
      const response = await this.api.get("/reports/csv-template", {
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      console.error("Error downloading template:", error);
      throw error;
    }
  }

  // Reports - Year-End Status
  async setStudentYearEndStatus(studentId, status, notes = "") {
    try {
      const response = await this.api.put(
        `/students/${studentId}/year-end-status`,
        {
          status,
          notes,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Error setting year-end status:", error);
      throw error;
    }
  }

  async bulkSetYearEndStatus(students) {
    try {
      const response = await this.api.post("/reports/bulk-year-end-status", {
        students,
      });
      return response.data;
    } catch (error) {
      console.error("Error bulk updating year-end status:", error);
      throw error;
    }
  }

  async getYearEndSummary(schoolId) {
    try {
      const response = await this.api.get(
        `/reports/year-end-summary/${schoolId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching year-end summary:", error);
      throw error;
    }
  }

  async exportYearEndSummary(schoolId) {
    try {
      const response = await this.api.get(
        `/reports/export/year-end-summary/${schoolId}`,
        {
          responseType: "blob",
        },
      );
      return response.data;
    } catch (error) {
      console.error("Error exporting year-end summary:", error);
      throw error;
    }
  }

  // Reports - Helper endpoints
  async getReportTerms() {
    try {
      const response = await this.api.get("/reports/terms");
      return response.data;
    } catch (error) {
      console.error("Error fetching terms:", error);
      throw error;
    }
  }

  async getReportClasses(schoolId = null) {
    try {
      const params = schoolId ? { school_id: schoolId } : {};
      const response = await this.api.get("/reports/classes", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching classes:", error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
