import React, { useState, useCallback } from "react";
import { Box, Tabs, Tab, Badge, Alert, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useQuery } from "react-query";

import { apiService } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";

// Dashboard Components
import {
  DashboardHeader,
  CompactMetricsGrid,
  QuickAlertsBar,
  AttendanceTodayPanel,
  TransferStatusPanel,
  OperationalSignalsPanel,
  DataQualityPanel,
  GradingPolicyPanel,
  TrendChartPanel,
  buildLineOptions,
  DistributionPanel,
  BarbadosReadinessPanel,
  RecentAuditPanel,
  ccColors,
  dashboardAtmosphere,
  noiseOverlaySx,
  tabStyles,
} from "../components/dashboard";

/**
 * Tab Panel wrapper component
 */
const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`dashboard-tabpanel-${index}`}
    aria-labelledby={`dashboard-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
  </div>
);

const formatAuditDate = (value) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
};

/**
 * Super Admin Dashboard - Executive Command Center
 */
const DashboardPage = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [dataQualityActionError, setDataQualityActionError] = useState("");
  const [dataQualityWorking, setDataQualityWorking] = useState(false);

  // Main dashboard data query
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery(["admin-dashboard"], () => apiService.getAdminDashboard(), {
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    keepPreviousData: true,
  });

  // Live audit stream (last 24h) to keep activity log near real-time.
  const {
    data: auditStreamData,
    refetch: refetchAuditStream,
    isFetching: isFetchingAuditStream,
  } = useQuery(
    ["admin-audit-stream"],
    () =>
      apiService.getAdminAuditLogs({
        page: 1,
        limit: 50,
        date_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      }),
    {
      staleTime: 3 * 1000,
      refetchInterval: 5 * 1000,
      keepPreviousData: true,
      retry: 1,
    },
  );

  // Data quality detail query
  const {
    data: dataQualityDetail,
    refetch: refetchDataQuality,
    isFetching: isFetchingDataQuality,
  } = useQuery(
    ["data-quality-overview"],
    () => apiService.getDataQualityOverview({ refresh: false }),
    {
      staleTime: 45 * 1000,
      refetchInterval: 90 * 1000,
      keepPreviousData: true,
      retry: 1,
    },
  );

  // Data quality action handler
  const runDataQualityAction = useCallback(
    async (action) => {
      setDataQualityActionError("");
      setDataQualityWorking(true);
      try {
        await action();
        await Promise.all([refetch(), refetchDataQuality()]);
      } catch (actionError) {
        setDataQualityActionError(
          actionError?.message || "Data-quality action failed.",
        );
      } finally {
        setDataQualityWorking(false);
      }
    },
    [refetch, refetchDataQuality],
  );

  const handleRunDataQualityScan = useCallback(() => {
    runDataQualityAction(() =>
      apiService.getDataQualityOverview({ refresh: true }),
    );
  }, [runDataQualityAction]);

  const handleUpdateDataQualityIssue = useCallback(
    (issueId, payload) => {
      runDataQualityAction(() =>
        apiService.updateDataQualityIssue(issueId, payload),
      );
    },
    [runDataQualityAction],
  );

  const handleApplyDataQualityFix = useCallback(
    (checkKey, schoolId = null) => {
      runDataQualityAction(() =>
        apiService.applyDataQualityFix({
          check_key: checkKey,
          school_id: schoolId,
        }),
      );
    },
    [runDataQualityAction],
  );

  const handleRefreshAll = useCallback(() => {
    refetch();
    refetchDataQuality();
    refetchAuditStream();
  }, [refetch, refetchDataQuality, refetchAuditStream]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleMetricSelect = useCallback((metricId) => {
    if (metricId === "activity_24h") {
      setActiveTab(5);
      return;
    }
    if (metricId === "data_quality") {
      setActiveTab(1);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Error state
  if (isError) {
    return (
      <Box>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Failed to load dashboard data.
          {error?.message ? ` ${error.message}` : ""}
        </Alert>
      </Box>
    );
  }

  // Extract data from queries
  const overview = dashboardData?.overview || {};
  const recentAudits = auditStreamData?.audit_logs || dashboardData?.recent_audits || [];
  const attendanceToday = dashboardData?.attendance_today || {};
  const transfersSummary = dashboardData?.transfers_summary || {};
  const enrollmentSummary = dashboardData?.enrollment_summary || {};
  const barbadosReadiness = dashboardData?.barbados_readiness || {};
  const breakdowns = dashboardData?.breakdowns || {};
  const trends = dashboardData?.trends || {};
  const activity24h = dashboardData?.activity_24h || {};
  const dataQuality = dataQualityDetail || dashboardData?.data_quality || {};
  const liveRecentActivityCount = Number(
    auditStreamData?.pagination?.total_count ?? overview?.recent_activity ?? 0,
  );

  // Computed values
  const canManageDataQuality =
    typeof hasPermission === "function"
      ? hasPermission("data_quality.manage")
      : user?.role === "super_admin";
  const canManageGradingPolicy =
    typeof hasPermission === "function"
      ? hasPermission("grades.finalize")
      : user?.role === "super_admin" || user?.role === "admin";
  const pendingTransfers = Number(overview.pending_transfers || 0);
  const dataQualityScore = Number(dataQuality.overall_score || 0);
  const dataQualityStatus = dataQuality.status || "critical";
  const dataQualityIssueCount = Number(dataQuality?.totals?.issue_count || 0);
  const criticalIssues = Number(dataQuality?.totals?.critical_issues || 0);
  const overdueIssues = Number(dataQuality?.sla?.overdue_issues || 0);
  const releaseGateBlocked = dataQuality?.release_gate?.allowed === false;
  const lastSnapshotLabel = formatAuditDate(
    dataQuality?.generated_at || dashboardData?.generated_at,
  );

  // Distribution data
  const studentsByGender = breakdowns.students_by_gender || [];
  const schoolsByCategory = breakdowns.schools_by_category || [];
  const studentsByGrade = breakdowns.students_by_grade || [];
  const totalGenderCount = studentsByGender.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );
  const totalCategoryCount = schoolsByCategory.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );
  const totalGradeCount = studentsByGrade.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );

  // Trend data
  const attendanceTrendPoints = trends.attendance?.points || [];
  const enrollmentTrendPoints = trends.enrollment?.points || [];
  const transferTrendPoints = trends.transfers?.points || [];

  // Chart data
  const attendanceChartData = {
    labels: attendanceTrendPoints.map((p) => p.label),
    datasets: [
      {
        label: "Attendance Rate (%)",
        data: attendanceTrendPoints.map((p) => Number(p.attendance_rate || 0)),
        borderColor: ccColors.emerald,
        backgroundColor: `${ccColors.emerald}33`,
        fill: true,
        tension: 0.35,
      },
    ],
  };

  const enrollmentChartData = {
    labels: enrollmentTrendPoints.map((p) => p.label),
    datasets: [
      {
        label: "New Students",
        data: enrollmentTrendPoints.map((p) => Number(p.new_students || 0)),
        borderColor: ccColors.blue,
        backgroundColor: `${ccColors.blue}33`,
        fill: true,
        tension: 0.3,
      },
      {
        label: "30-Day Cumulative",
        data: enrollmentTrendPoints.map((p) => Number(p.rolling_total || 0)),
        borderColor: ccColors.amber,
        backgroundColor: `${ccColors.amber}1A`,
        fill: false,
        tension: 0.25,
      },
    ],
  };

  const transferChartData = {
    labels: transferTrendPoints.map((p) => p.label),
    datasets: [
      {
        label: "Total Transfers",
        data: transferTrendPoints.map((p) => Number(p.total || 0)),
        borderColor: ccColors.blue,
        backgroundColor: `${ccColors.blue}33`,
        fill: true,
        tension: 0.3,
      },
      {
        label: "Pending Transfers",
        data: transferTrendPoints.map((p) => Number(p.pending || 0)),
        borderColor: ccColors.coral,
        backgroundColor: `${ccColors.coral}1A`,
        fill: false,
        tension: 0.25,
      },
    ],
  };

  // Tab badges
  const dataQualityBadgeCount = criticalIssues + overdueIssues;

  return (
    <Box
      sx={{
        ...dashboardAtmosphere,
        minHeight: "calc(100vh - 64px)",
        p: { xs: 1.5, md: 2.5 },
        width: "100%",
        mx: 0,
        borderRadius: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box sx={noiseOverlaySx} />
      <Box sx={{ position: "relative", zIndex: 2 }}>
      {/* Command Header */}
      <DashboardHeader
        username={user?.username}
        dataQualityStatus={dataQualityStatus}
        dataQualityScore={dataQualityScore}
        pendingTransfers={pendingTransfers}
        lastSnapshot={lastSnapshotLabel}
        isRefreshing={isFetching || isFetchingDataQuality || isFetchingAuditStream}
        onRefresh={handleRefreshAll}
      />

      {/* Compact Metrics Grid - All 9 stats */}
      <CompactMetricsGrid
        overview={{
          ...overview,
          recent_activity: liveRecentActivityCount,
        }}
        enrollmentSummary={enrollmentSummary}
        dataQualityScore={dataQualityScore}
        dataQualityStatus={dataQualityStatus}
        dataQualityIssueCount={dataQualityIssueCount}
        onMetricSelect={handleMetricSelect}
      />

      {/* Conditional Alert Banner */}
      <QuickAlertsBar
        criticalIssues={criticalIssues}
        pendingTransfers={pendingTransfers}
        overdueIssues={overdueIssues}
        releaseGateBlocked={releaseGateBlocked}
      />

      {/* Tab Navigation */}
      <Box
        sx={{
          backgroundColor: ccColors.surface,
          border: `1px solid ${ccColors.border}`,
          borderRadius: 3,
          p: 0.75,
          mb: 2,
          display: "inline-block",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Dashboard sections"
          sx={{
            "& .MuiTab-root": {
              ...tabStyles.tab,
            },
            "& .MuiTabs-indicator": {
              ...tabStyles.indicator,
            },
          }}
        >
          <Tab label="Operations" id="dashboard-tab-0" />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                Data Quality
                {dataQualityBadgeCount > 0 && (
                  <Badge
                    badgeContent={dataQualityBadgeCount}
                    color="error"
                    sx={{ ml: 1.5 }}
                  />
                )}
              </Box>
            }
            id="dashboard-tab-1"
          />
          <Tab label="Trends" id="dashboard-tab-2" />
          <Tab label="Readiness" id="dashboard-tab-3" />
          <Tab label="Grading Policy" id="dashboard-tab-4" />
          <Tab label="Audit" id="dashboard-tab-5" />
        </Tabs>
      </Box>

      {/* Tab Content */}

      {/* Operations Tab */}
      <TabPanel value={activeTab} index={0}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, 1fr)",
            },
            gap: 2,
            mb: 3,
          }}
        >
          <AttendanceTodayPanel attendanceToday={attendanceToday} />
          <TransferStatusPanel transfersSummary={transfersSummary} />
          <OperationalSignalsPanel
            pendingTransfers={pendingTransfers}
            totalClassEnrollment={enrollmentSummary.total_class_enrollment}
            activity24h={{
              ...activity24h,
              total: liveRecentActivityCount,
            }}
            isFetching={isFetching}
          />
        </Box>

        {/* Distribution Panels */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, 1fr)",
            },
            gap: 2,
          }}
        >
          <DistributionPanel
            title="Students by Gender"
            rows={studentsByGender}
            total={totalGenderCount}
            emptyMessage="No student gender data available."
          />
          <DistributionPanel
            title="Schools by Category"
            rows={schoolsByCategory}
            total={totalCategoryCount}
            emptyMessage="No school category data available."
          />
          <DistributionPanel
            title="Top Grade Levels"
            rows={studentsByGrade}
            total={totalGradeCount}
            emptyMessage="No grade distribution data available."
          />
        </Box>
      </TabPanel>

      {/* Data Quality Tab */}
      <TabPanel value={activeTab} index={1}>
        <DataQualityPanel
          dataQuality={dataQuality}
          canManage={canManageDataQuality}
          isWorking={dataQualityWorking || isFetchingDataQuality}
          panelError={dataQualityActionError}
          onRunScan={handleRunDataQualityScan}
          onUpdateIssue={handleUpdateDataQualityIssue}
          onApplyFix={handleApplyDataQualityFix}
        />
      </TabPanel>

      {/* Trends Tab */}
      <TabPanel value={activeTab} index={2}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, 1fr)",
            },
            gap: 2,
          }}
        >
          <TrendChartPanel
            title="Attendance Trend (7d)"
            subtitle="Daily attendance percentage for the most recent week."
            chartData={attendanceChartData}
            chartOptions={buildLineOptions("Attendance %", 100)}
          />
          <TrendChartPanel
            title="Enrollment Trend (30d)"
            subtitle="Daily new admissions and rolling cumulative growth."
            chartData={enrollmentChartData}
            chartOptions={buildLineOptions("Students")}
          />
          <TrendChartPanel
            title="Transfer Trend (30d)"
            subtitle="Daily transfer volume with pending queue visibility."
            chartData={transferChartData}
            chartOptions={buildLineOptions("Transfers")}
          />
        </Box>
      </TabPanel>

      {/* Readiness Tab */}
      <TabPanel value={activeTab} index={3}>
        <BarbadosReadinessPanel
          readiness={barbadosReadiness}
          onNavigate={(path) => {
            if (!path) return;
            navigate(path);
          }}
          onOpenWorkspace={() => navigate("/readiness")}
        />
      </TabPanel>

      {/* Grading Policy Tab */}
      <TabPanel value={activeTab} index={4}>
        <GradingPolicyPanel canManage={canManageGradingPolicy} />
      </TabPanel>

      {/* Audit Tab */}
      <TabPanel value={activeTab} index={5}>
        <RecentAuditPanel recentAudits={recentAudits} />
      </TabPanel>
      </Box>
    </Box>
  );
};

export default DashboardPage;
