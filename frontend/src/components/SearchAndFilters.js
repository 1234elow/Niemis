import React, { useEffect, useState } from "react";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Grid,
  Typography,
  Chip,
  Collapse,
  IconButton,
  Divider,
} from "@mui/material";
import {
  Search,
  FilterList,
  Clear,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";

const SearchAndFilters = ({
  onSearch,
  onFilter,
  onClear,
  searchTerm = "",
  filters = {},
  resultsCount = 0,
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [localFilters, setLocalFilters] = useState(filters);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [parishes, setParishes] = useState([]);

  const schoolTypes = apiService.getSchoolTypes();

  useEffect(() => {
    const fetchParishes = async () => {
      try {
        const parishData = await apiService.getParishes();
        setParishes(parishData);
      } catch (error) {
        console.error("Error loading parishes:", error);
        setParishes([]);
      }
    };

    fetchParishes();
  }, []);

  const handleSearchChange = (event) => {
    setLocalSearchTerm(event.target.value);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    onSearch(localSearchTerm);
  };

  const handleFilterChange = (filterName) => (event) => {
    const newFilters = {
      ...localFilters,
      [filterName]: event.target.value,
    };
    setLocalFilters(newFilters);
    onFilter(newFilters);
  };

  const handleClearFilters = () => {
    setLocalSearchTerm("");
    setLocalFilters({});
    onClear();
  };

  const getActiveFiltersCount = () => {
    return Object.values(localFilters).filter((value) => value && value !== "")
      .length;
  };

  const getActiveFiltersText = () => {
    const activeFilters = [];

    if (localFilters.school_type) {
      const type = schoolTypes.find(
        (t) => t.value === localFilters.school_type,
      );
      activeFilters.push(type?.label || localFilters.school_type);
    }

    if (localFilters.parish) {
      const parish = parishes.find((p) => p.value === localFilters.parish);
      activeFilters.push(parish?.label || localFilters.parish);
    }

    return activeFilters;
  };

  const activeFiltersCount = getActiveFiltersCount();
  const activeFiltersText = getActiveFiltersText();

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Search Bar */}
        <Grid item xs={12} md={8}>
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{ display: "flex", gap: 1 }}
          >
            <TextField
              fullWidth
              placeholder="Search schools by name or principal..."
              value={localSearchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <Search sx={{ color: "text.secondary", mr: 1 }} />
                ),
              }}
            />
            <Button type="submit" variant="contained">
              Search
            </Button>
          </Box>
        </Grid>

        {/* Filter Controls */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              endIcon={filtersExpanded ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              Filters
              {activeFiltersCount > 0 && (
                <Chip
                  label={activeFiltersCount}
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                />
              )}
            </Button>

            {(localSearchTerm || activeFiltersCount > 0) && (
              <Button
                variant="text"
                startIcon={<Clear />}
                onClick={handleClearFilters}
                color="secondary"
              >
                Clear
              </Button>
            )}
          </Box>
        </Grid>

        {/* Results Count */}
        <Grid item xs={12}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {resultsCount} school{resultsCount !== 1 ? "s" : ""} found
              {localSearchTerm && <span> for "{localSearchTerm}"</span>}
            </Typography>

            {/* Active Filters Display */}
            {activeFiltersText.length > 0 && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {activeFiltersText.map((filter, index) => (
                  <Chip
                    key={index}
                    label={filter}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Expanded Filters */}
      <Collapse in={filtersExpanded}>
        <Box sx={{ pt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Filter by:
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>School Type</InputLabel>
                <Select
                  value={localFilters.school_type || ""}
                  onChange={handleFilterChange("school_type")}
                  label="School Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  {schoolTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Parish</InputLabel>
                <Select
                  value={localFilters.parish || ""}
                  onChange={handleFilterChange("parish")}
                  label="Parish"
                >
                  <MenuItem value="">All Parishes</MenuItem>
                  {parishes.map((parish) => (
                    <MenuItem key={parish.value} value={parish.value}>
                      {parish.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Capacity Status</InputLabel>
                <Select
                  value={localFilters.capacity_status || ""}
                  onChange={handleFilterChange("capacity_status")}
                  label="Capacity Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="under_capacity">
                    Under Capacity (&lt;80%)
                  </MenuItem>
                  <MenuItem value="near_capacity">
                    Near Capacity (80-94%)
                  </MenuItem>
                  <MenuItem value="over_capacity">
                    Over Capacity (≥95%)
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={localFilters.sort_by || "name"}
                  onChange={handleFilterChange("sort_by")}
                  label="Sort By"
                >
                  <MenuItem value="name">Name (A-Z)</MenuItem>
                  <MenuItem value="name_desc">Name (Z-A)</MenuItem>
                  <MenuItem value="student_population">
                    Student Population
                  </MenuItem>
                  <MenuItem value="capacity">Capacity</MenuItem>
                  <MenuItem value="parish">Parish</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SearchAndFilters;
