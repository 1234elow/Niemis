import React from "react";
import { Box } from "@mui/material";
import {
  School,
  People,
  PersonAdd,
  Timeline,
  FactCheck,
  Business,
  Class,
  TrendingUp,
} from "@mui/icons-material";
import StatCard from "./panels/StatCard";

/**
 * Compact Metrics Grid - All 9 key stats in a dense 2-row layout
 */
const CompactMetricsGrid = ({
  overview,
  enrollmentSummary,
  dataQualityScore,
  dataQualityStatus,
  onMetricSelect,
}) => {
  const formatCount = (value) => Number(value || 0).toLocaleString();

  const getQualityColor = () => {
    if (dataQualityStatus === "healthy") return "success";
    if (dataQualityStatus === "watch") return "warning";
    return "error";
  };

  const metrics = [
    {
      id: "schools",
      title: "Schools",
      value: formatCount(overview?.total_schools),
      icon: <School />,
      color: "primary",
    },
    {
      id: "students",
      title: "Students",
      value: formatCount(overview?.total_students),
      icon: <People />,
      color: "success",
    },
    {
      id: "teachers",
      title: "Teachers",
      value: formatCount(overview?.total_staff),
      icon: <PersonAdd />,
      color: "info",
    },
    {
      id: "activity_24h",
      title: "Activity (24h)",
      value: formatCount(overview?.recent_activity),
      icon: <Timeline />,
      color: "warning",
    },
    {
      id: "data_quality",
      title: "Data Quality",
      value: `${Math.round(dataQualityScore)}%`,
      icon: <FactCheck />,
      color: getQualityColor(),
    },
    {
      id: "classes",
      title: "Classes",
      value: formatCount(enrollmentSummary?.active_classes),
      icon: <Class />,
      color: "secondary",
    },
    {
      id: "facilities",
      title: "Facilities",
      value: formatCount(enrollmentSummary?.total_facilities),
      icon: <Business />,
      color: "primary",
    },
    {
      id: "new_30d",
      title: "New (30d)",
      value: `+${formatCount(enrollmentSummary?.new_students_last_30_days)}`,
      icon: <TrendingUp />,
      color: "success",
    },
    {
      id: "avg_class_size",
      title: "Avg Class Size",
      value: Number(enrollmentSummary?.average_class_size || 0).toFixed(1),
      icon: <People />,
      color: "info",
    },
  ];
  const primaryMetrics = metrics.slice(0, 5);
  const secondaryMetrics = metrics.slice(5);

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(5, minmax(0, 1fr))",
          },
          mb: 1.5,
        }}
      >
        {primaryMetrics.map((metric) => (
          <Box key={metric.title}>
            <StatCard
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              compact
              onClick={
                metric.id === "activity_24h" || metric.id === "data_quality"
                  ? () => onMetricSelect?.(metric.id)
                  : undefined
              }
            />
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {secondaryMetrics.map((metric) => (
          <Box key={metric.title}>
            <StatCard
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              compact
              onClick={
                metric.id === "activity_24h" || metric.id === "data_quality"
                  ? () => onMetricSelect?.(metric.id)
                  : undefined
              }
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default CompactMetricsGrid;
