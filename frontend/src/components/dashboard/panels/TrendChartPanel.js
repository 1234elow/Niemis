import React from "react";
import { Paper, Typography, Box } from "@mui/material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

export const buildLineOptions = () => ({});

const width = 560;
const height = 220;
const padding = { top: 14, right: 12, bottom: 34, left: 34 };

const clampNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildPoints = (values, maxValue) => {
  if (!values.length) return [];
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  return values.map((value, index) => {
    const x =
      padding.left +
      (values.length === 1 ? chartW / 2 : (index / (values.length - 1)) * chartW);
    const y =
      padding.top + (1 - clampNumber(value) / Math.max(1, maxValue)) * chartH;
    return { x, y, value: clampNumber(value) };
  });
};

const linePath = (points) =>
  points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

const areaPath = (points) => {
  if (!points.length) return "";
  const baseline = height - padding.bottom;
  const start = `M ${points[0].x.toFixed(2)} ${baseline.toFixed(2)}`;
  const body = points
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const end = `L ${points[points.length - 1].x.toFixed(2)} ${baseline.toFixed(2)} Z`;
  return `${start} ${body} ${end}`;
};

const TrendChartPanel = ({ title, subtitle, chartData }) => {
  const labels = Array.isArray(chartData?.labels) ? chartData.labels : [];
  const datasets = Array.isArray(chartData?.datasets) ? chartData.datasets : [];
  const maxValue = Math.max(
    1,
    ...datasets.flatMap((dataset) =>
      (dataset?.data || []).map((value) => clampNumber(value)),
    ),
  );

  return (
    <Paper
      sx={{
        ...panelWrapper,
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      elevation={0}
    >
      <Typography
        variant="subtitle1"
        sx={{
          color: ccColors.textPrimary,
          fontWeight: 700,
          fontFamily: ccFonts.display,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: ccColors.textSecondary, fontFamily: ccFonts.body, mb: 1.2 }}
      >
        {subtitle}
      </Typography>

      <Box sx={{ flex: 1 }}>
        {labels.length === 0 || datasets.length === 0 ? (
          <Typography variant="body2" sx={{ color: ccColors.textSecondary }}>
            No trend data available.
          </Typography>
        ) : (
          <Box
            sx={{
              width: "100%",
              overflow: "hidden",
              "& .trend-line": {
                strokeDasharray: 1000,
                strokeDashoffset: 1000,
                animation: "drawTrend 1.8s ease-out forwards",
              },
              "& .trend-dot": {
                opacity: 0,
                animation: "fadeDot 320ms ease-out forwards",
              },
              "@keyframes drawTrend": {
                from: { strokeDashoffset: 1000 },
                to: { strokeDashoffset: 0 },
              },
              "@keyframes fadeDot": {
                from: { opacity: 0, transform: "scale(0.6)" },
                to: { opacity: 1, transform: "scale(1)" },
              },
            }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: "100%", height: "220px" }}
              role="img"
              aria-label={title}
            >
              <defs>
                <linearGradient
                  id={`trend-fill-${title.replace(/\s+/g, "-").toLowerCase()}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={ccColors.tealGlow} />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {[0, 1, 2, 3].map((step) => {
                const y =
                  padding.top +
                  (step / 3) * (height - padding.top - padding.bottom);
                return (
                  <line
                    key={`grid-${step}`}
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={ccColors.borderLight}
                    strokeWidth="1"
                  />
                );
              })}

              {datasets.map((dataset, datasetIndex) => {
                const points = buildPoints(dataset.data || [], maxValue);
                const stroke = dataset.borderColor || ccColors.teal;
                const fill =
                  dataset.backgroundColor || `${ccColors.tealGlow.replace("0.16", "0.4")}`;
                const dashDelay = `${datasetIndex * 180}ms`;
                const gradientId = `trend-fill-${title.replace(/\s+/g, "-").toLowerCase()}`;

                return (
                  <g key={`${dataset.label || "series"}-${datasetIndex}`}>
                    {datasetIndex === 0 && points.length > 1 && (
                      <path
                        d={areaPath(points)}
                        fill={`url(#${gradientId})`}
                        opacity="0.95"
                      />
                    )}
                    <path
                      className="trend-line"
                      d={linePath(points)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animationDelay: dashDelay }}
                    />
                    {points.map((point, pointIndex) => (
                      <circle
                        key={`dot-${datasetIndex}-${pointIndex}`}
                        className="trend-dot"
                        cx={point.x}
                        cy={point.y}
                        r="3.5"
                        fill={ccColors.bgPrimary}
                        stroke={fill}
                        strokeWidth="2"
                        style={{
                          animationDelay: `${240 + pointIndex * 90 + datasetIndex * 120}ms`,
                        }}
                      />
                    ))}
                  </g>
                );
              })}

              {labels.map((label, index) => {
                if (index !== 0 && index !== labels.length - 1 && labels.length > 6) {
                  return null;
                }
                const chartW = width - padding.left - padding.right;
                const x =
                  padding.left +
                  (labels.length === 1
                    ? chartW / 2
                    : (index / (labels.length - 1)) * chartW);
                return (
                  <text
                    key={`label-${index}`}
                    x={x}
                    y={height - 12}
                    textAnchor="middle"
                    fill={ccColors.textMuted}
                    fontSize="10"
                    fontFamily={ccFonts.display}
                  >
                    {String(label)}
                  </text>
                );
              })}
            </svg>
          </Box>
        )}
      </Box>

      {datasets.length > 0 && (
        <Box sx={{ mt: 0.5, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {datasets.map((dataset, index) => (
            <Box
              key={`${dataset.label || "series"}-legend-${index}`}
              sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: dataset.borderColor || ccColors.teal,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: ccColors.textSecondary, fontFamily: ccFonts.body }}
              >
                {dataset.label || `Series ${index + 1}`}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default TrendChartPanel;
