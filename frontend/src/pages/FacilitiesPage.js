import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Build, Refresh, WarningAmber } from "@mui/icons-material";

import { apiService } from "../services/apiService";

const conditionColorMap = {
  excellent: "success",
  good: "info",
  fair: "warning",
  poor: "error",
};

const formatDate = (dateValue) => {
  if (!dateValue) return "N/A";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString();
};

const FacilitiesPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [schools, setSchools] = useState([]);
  const [filters, setFilters] = useState({
    school_id: "",
    condition_status: "",
    search: "",
  });

  const loadFacilities = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};
      if (filters.school_id) params.school_id = filters.school_id;
      const response = await apiService.getFacilities(params);
      setFacilities(response.facilities || []);
    } catch (err) {
      console.error("Error loading facilities:", err);
      setFacilities([]);
      setError("Failed to load facilities from the database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await apiService.getSchools({ limit: 200 });
        setSchools(response.schools || []);
      } catch (err) {
        console.error("Error loading schools for facilities filter:", err);
      }
    };
    loadSchools();
  }, []);

  useEffect(() => {
    loadFacilities();
  }, [filters.school_id]);

  const filteredFacilities = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return facilities.filter((facility) => {
      const byCondition = filters.condition_status
        ? facility.condition_status === filters.condition_status
        : true;

      const bySearch = searchTerm
        ? [
            facility.facility_name,
            facility.facility_type,
            facility.room_number,
            facility.School?.name,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(searchTerm),
            )
        : true;

      return byCondition && bySearch;
    });
  }, [facilities, filters.condition_status, filters.search]);

  const summary = useMemo(() => {
    const total = filteredFacilities.length;
    const needingAttention = filteredFacilities.filter((facility) =>
      ["poor", "fair"].includes(facility.condition_status),
    ).length;
    const totalCapacity = filteredFacilities.reduce(
      (sum, facility) => sum + (Number(facility.capacity) || 0),
      0,
    );

    return { total, needingAttention, totalCapacity };
  }, [filteredFacilities]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Facilities Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Facility inventory and condition data from the database.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadFacilities}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              select
              label="School"
              value={filters.school_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  school_id: event.target.value,
                }))
              }
            >
              <MenuItem value="">All Schools</MenuItem>
              {schools.map((school) => (
                <MenuItem key={school.id} value={school.id}>
                  {school.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              select
              label="Condition"
              value={filters.condition_status}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  condition_status: event.target.value,
                }))
              }
            >
              <MenuItem value="">All Conditions</MenuItem>
              <MenuItem value="excellent">Excellent</MenuItem>
              <MenuItem value="good">Good</MenuItem>
              <MenuItem value="fair">Fair</MenuItem>
              <MenuItem value="poor">Poor</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search by name, type, room, school"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Facilities
              </Typography>
              <Typography variant="h5">{summary.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Needs Attention
              </Typography>
              <Typography variant="h5" color="warning.main">
                {summary.needingAttention}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Capacity
              </Typography>
              <Typography variant="h5" color="primary.main">
                {summary.totalCapacity}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Facility Inventory
        </Typography>

        {loading ? (
          <Box sx={{ py: 5, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : filteredFacilities.length === 0 ? (
          <Alert severity="info">No facilities found for the current filters.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>School</TableCell>
                  <TableCell>Room</TableCell>
                  <TableCell>Capacity</TableCell>
                  <TableCell>Condition</TableCell>
                  <TableCell>Last Maintenance</TableCell>
                  <TableCell>Next Maintenance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFacilities.map((facility) => (
                  <TableRow key={facility.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {["poor", "fair"].includes(facility.condition_status) ? (
                          <WarningAmber fontSize="small" color="warning" />
                        ) : (
                          <Build fontSize="small" color="primary" />
                        )}
                        {facility.facility_name}
                      </Box>
                    </TableCell>
                    <TableCell>{facility.facility_type}</TableCell>
                    <TableCell>{facility.School?.name || "N/A"}</TableCell>
                    <TableCell>{facility.room_number || "N/A"}</TableCell>
                    <TableCell>{facility.capacity || "N/A"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          facility.condition_status
                            ? facility.condition_status.charAt(0).toUpperCase() +
                              facility.condition_status.slice(1)
                            : "Unknown"
                        }
                        color={conditionColorMap[facility.condition_status] || "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatDate(facility.last_maintenance)}</TableCell>
                    <TableCell>{formatDate(facility.next_maintenance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default FacilitiesPage;
