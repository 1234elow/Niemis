import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Refresh, Save } from "@mui/icons-material";
import { apiService } from "../../../services/apiService";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const GRADE_BAND_LABELS = {
  pre_primary: "Pre-Primary",
  primary: "Primary",
  lower_secondary: "Lower Secondary",
  upper_secondary: "Upper Secondary",
  sixth_form: "Sixth Form",
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const GradingPolicyPanel = ({ canManage = false }) => {
  const [loading, setLoading] = useState(true);
  const [savingBand, setSavingBand] = useState("");
  const [error, setError] = useState("");
  const [targetScope, setTargetScope] = useState("national");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [schools, setSchools] = useState([]);
  const [policyData, setPolicyData] = useState({
    grade_bands: [],
    effective_by_band: {},
  });
  const [drafts, setDrafts] = useState({});

  const selectedSchool = useMemo(
    () => schools.find((school) => String(school.id) === String(selectedSchoolId)) || null,
    [schools, selectedSchoolId],
  );

  const scopedSchoolId = targetScope === "school" ? selectedSchoolId || null : null;

  const hydrateDrafts = useCallback((effectiveByBand) => {
    const nextDrafts = {};
    Object.entries(effectiveByBand || {}).forEach(([band, row]) => {
      nextDrafts[band] = {
        continuous_assessment_weight: toNumber(row?.continuous_assessment_weight, 0),
        end_term_exam_weight: toNumber(row?.end_term_exam_weight, 0),
        pass_mark: toNumber(row?.pass_mark, 50),
      };
    });
    setDrafts(nextDrafts);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [policiesResponse, schoolsResponse] = await Promise.all([
        apiService.getAdminGradingPolicies(
          scopedSchoolId ? { school_id: scopedSchoolId } : {},
        ),
        apiService.getSchools({ page: 1, limit: 250 }),
      ]);

      setPolicyData({
        grade_bands: policiesResponse?.grade_bands || [],
        effective_by_band: policiesResponse?.effective_by_band || {},
      });
      hydrateDrafts(policiesResponse?.effective_by_band || {});
      setSchools(schoolsResponse?.schools || []);
    } catch (fetchError) {
      setError(fetchError?.message || "Failed to load grading policy settings.");
    } finally {
      setLoading(false);
    }
  }, [hydrateDrafts, scopedSchoolId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onDraftChange = useCallback((band, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [band]: {
        ...(prev[band] || {}),
        [field]: value,
      },
    }));
  }, []);

  const saveBand = useCallback(
    async (band) => {
      if (!canManage) return;
      setSavingBand(band);
      setError("");
      try {
        const current = policyData?.effective_by_band?.[band] || null;
        const draft = drafts?.[band] || {};
        const payload = {
          policy_name:
            current?.policy_name ||
            `Barbados Policy: ${GRADE_BAND_LABELS[band] || band}`,
          grade_band: band,
          school_id: scopedSchoolId || null,
          school_type: selectedSchool?.school_type || current?.school_type || null,
          continuous_assessment_weight: toNumber(
            draft.continuous_assessment_weight,
            current?.continuous_assessment_weight || 0,
          ),
          end_term_exam_weight: toNumber(
            draft.end_term_exam_weight,
            current?.end_term_exam_weight || 0,
          ),
          pass_mark: toNumber(draft.pass_mark, current?.pass_mark || 50),
        };

        const response = await apiService.saveAdminGradingPolicy(payload);
        setPolicyData({
          grade_bands: response?.grade_bands || [],
          effective_by_band: response?.effective_by_band || {},
        });
        hydrateDrafts(response?.effective_by_band || {});
      } catch (saveError) {
        setError(saveError?.message || "Failed to save grading policy.");
      } finally {
        setSavingBand("");
      }
    },
    [canManage, drafts, hydrateDrafts, policyData?.effective_by_band, scopedSchoolId, selectedSchool],
  );

  const rows = useMemo(() => {
    const bands = policyData?.grade_bands || [];
    return bands.map((band) => ({
      band,
      policy: policyData?.effective_by_band?.[band] || null,
      draft: drafts?.[band] || {},
    }));
  }, [drafts, policyData?.effective_by_band, policyData?.grade_bands]);

  return (
    <Paper sx={{ ...panelWrapper, borderRadius: 4 }} elevation={0}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: ccColors.textPrimary,
            fontFamily: ccFonts.display,
            letterSpacing: "-0.02em",
          }}
        >
          Grading Policy Table
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={loadData}
          startIcon={loading ? <CircularProgress size={14} /> : <Refresh fontSize="small" />}
          disabled={loading}
          sx={{
            borderColor: ccColors.border,
            color: ccColors.textPrimary,
            fontFamily: ccFonts.body,
            "&:hover": {
              borderColor: ccColors.teal,
              backgroundColor: ccColors.tealGlow,
            },
          }}
        >
          Refresh
        </Button>
      </Box>

      <Typography variant="body2" sx={{ mb: 1.5, color: ccColors.textSecondary }}>
        Configure term grade weighting by grade band. Teachers automatically use the active policy
        when entering class grades.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.2, mb: 2, flexWrap: "wrap" }}>
        <Select
          size="small"
          value={targetScope}
          onChange={(event) => setTargetScope(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="national">National Defaults</MenuItem>
          <MenuItem value="school">School Override</MenuItem>
        </Select>
        <Select
          size="small"
          value={selectedSchoolId}
          onChange={(event) => setSelectedSchoolId(event.target.value)}
          displayEmpty
          disabled={targetScope !== "school"}
          sx={{ minWidth: 280 }}
        >
          <MenuItem value="">
            <em>Select school</em>
          </MenuItem>
          {schools.map((school) => (
            <MenuItem key={school.id} value={school.id}>
              {school.name}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can view policies but cannot edit them with your current role.
        </Alert>
      )}

      {targetScope === "school" && !selectedSchoolId ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Select a school to edit school-specific policy overrides.
        </Alert>
      ) : loading ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: ccColors.textSecondary }}>Grade Band</TableCell>
              <TableCell sx={{ color: ccColors.textSecondary }}>CA Weight (%)</TableCell>
              <TableCell sx={{ color: ccColors.textSecondary }}>Exam Weight (%)</TableCell>
              <TableCell sx={{ color: ccColors.textSecondary }}>Pass Mark (%)</TableCell>
              <TableCell sx={{ color: ccColors.textSecondary }}>Policy Source</TableCell>
              <TableCell sx={{ color: ccColors.textSecondary }} align="right">
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ band, policy, draft }) => (
              <TableRow key={band}>
                <TableCell sx={{ color: ccColors.textPrimary, fontWeight: 700 }}>
                  {GRADE_BAND_LABELS[band] || band}
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={draft.continuous_assessment_weight ?? ""}
                    onChange={(event) =>
                      onDraftChange(band, "continuous_assessment_weight", event.target.value)
                    }
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                    disabled={!canManage}
                    sx={{ width: 120 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={draft.end_term_exam_weight ?? ""}
                    onChange={(event) =>
                      onDraftChange(band, "end_term_exam_weight", event.target.value)
                    }
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                    disabled={!canManage}
                    sx={{ width: 120 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={draft.pass_mark ?? ""}
                    onChange={(event) => onDraftChange(band, "pass_mark", event.target.value)}
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                    disabled={!canManage}
                    sx={{ width: 110 }}
                  />
                </TableCell>
                <TableCell sx={{ color: ccColors.textSecondary }}>
                  {policy?.school_id ? "School override" : "National default"}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={savingBand === band ? <CircularProgress size={12} /> : <Save />}
                    onClick={() => saveBand(band)}
                    disabled={
                      !canManage || savingBand === band || (targetScope === "school" && !selectedSchoolId)
                    }
                    sx={{ minWidth: 92 }}
                  >
                    Save
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" sx={{ color: ccColors.textMuted, fontFamily: ccFonts.body }}>
        Source context: {targetScope === "school" && selectedSchool ? selectedSchool.name : "National"}
      </Typography>
    </Paper>
  );
};

export default GradingPolicyPanel;
