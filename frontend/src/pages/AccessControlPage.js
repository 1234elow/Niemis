import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  FormControl,
  InputLabel,
  TextField,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Pagination,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { apiService } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";

const AccessControlPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notification, setNotification] = useState(null);
  const [editDialog, setEditDialog] = useState({
    open: false,
    user: null,
    target_access_role: "",
    school_id: "",
    is_active: true,
  });
  const [historyDialog, setHistoryDialog] = useState({
    open: false,
    user: null,
    page: 1,
  });
  const [diffDialog, setDiffDialog] = useState({
    open: false,
    entry: null,
  });

  const {
    data: matrix,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(["access-control-matrix"], () => apiService.getAccessControlMatrix(), {
    staleTime: 60 * 1000,
  });

  const {
    data: myAccess,
    isLoading: isLoadingMyAccess,
  } = useQuery(["my-access-profile"], () => apiService.getMyAccessProfile(), {
    staleTime: 60 * 1000,
  });

  const { data: schools } = useQuery(["access-control-schools"], () =>
    apiService.getSchools({ page: 1, limit: 500 }),
  );

  const {
    data: userDirectory,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useQuery(
    ["access-control-users", page, search],
    () =>
      apiService.getAccessControlUsers({
        page,
        limit: 15,
        search: search.trim() || undefined,
      }),
    {
      keepPreviousData: true,
      staleTime: 30 * 1000,
    },
  );

  const {
    data: userHistoryData,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery(
    ["access-control-user-history", historyDialog.user?.id, historyDialog.page],
    () =>
      apiService.getAccessControlUserHistory(historyDialog.user.id, {
        page: historyDialog.page,
        limit: 12,
      }),
    {
      enabled: Boolean(historyDialog.open && historyDialog.user?.id),
      keepPreviousData: true,
      staleTime: 15 * 1000,
    },
  );

  const updateUserMutation = useMutation(
    ({ userId, payload }) => apiService.updateAccessControlUser(userId, payload),
    {
      onSuccess: () => {
        setNotification({
          type: "success",
          message: "Access assignment updated successfully.",
        });
        setEditDialog({
          open: false,
          user: null,
          target_access_role: "",
          school_id: "",
          is_active: true,
        });
        queryClient.invalidateQueries(["access-control-users"]);
        queryClient.invalidateQueries(["my-access-profile"]);
      },
      onError: (mutationError) => {
        setNotification({
          type: "error",
          message:
            mutationError?.response?.data?.error ||
            mutationError?.message ||
            "Failed to update user access.",
        });
      },
    },
  );

  const roles = matrix?.roles || [];
  const current = myAccess?.access || null;
  const users = userDirectory?.users || [];
  const userPagination = userDirectory?.pagination || {};
  const roleOptions = userDirectory?.access_role_options || [];
  const schoolOptions = schools?.schools || [];

  const roleLabels = useMemo(
    () =>
      roleOptions.reduce((acc, row) => {
        acc[row.value] = row.label;
        return acc;
      }, {}),
    [roleOptions],
  );

  const rolesRequiringSchool = new Set(["school_admin", "data_clerk", "teacher"]);

  const openEditDialog = (user) => {
    setEditDialog({
      open: true,
      user,
      target_access_role: user.access_role || "",
      school_id: user.school_id || "",
      is_active: Boolean(user.is_active),
    });
  };

  const closeEditDialog = () => {
    setEditDialog({
      open: false,
      user: null,
      target_access_role: "",
      school_id: "",
      is_active: true,
    });
  };

  const openHistoryDialog = (user) => {
    setHistoryDialog({
      open: true,
      user,
      page: 1,
    });
  };

  const closeHistoryDialog = () => {
    setHistoryDialog({
      open: false,
      user: null,
      page: 1,
    });
    setDiffDialog({
      open: false,
      entry: null,
    });
  };

  const openDiffDialog = (entry) => {
    setDiffDialog({
      open: true,
      entry,
    });
  };

  const closeDiffDialog = () => {
    setDiffDialog({
      open: false,
      entry: null,
    });
  };

  const handleSave = () => {
    if (!editDialog.user) return;
    const payload = {
      target_access_role: editDialog.target_access_role,
      is_active: Boolean(editDialog.is_active),
    };
    if (editDialog.school_id) {
      payload.school_id = editDialog.school_id;
    }
    updateUserMutation.mutate({
      userId: editDialog.user.id,
      payload,
    });
  };

  const historyRows = userHistoryData?.history || [];
  const historyPagination = userHistoryData?.pagination || {};
  const formatHistoryDate = (value) => {
    if (!value) return "Unknown time";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown time";
    return parsed.toLocaleString();
  };
  const formatActionLabel = (action) =>
    String(action || "unknown")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());

  const isPlainObject = (value) =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]";

  const flattenObject = (value, prefix = "", result = {}) => {
    if (!isPlainObject(value)) {
      if (prefix) {
        result[prefix] = value;
      }
      return result;
    }

    const entries = Object.entries(value);
    if (entries.length === 0 && prefix) {
      result[prefix] = {};
      return result;
    }

    entries.forEach(([key, nestedValue]) => {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(nestedValue)) {
        flattenObject(nestedValue, nextPath, result);
      } else {
        result[nextPath] = nestedValue;
      }
    });

    return result;
  };

  const valueFingerprint = (value) => {
    if (typeof value === "undefined") {
      return "__undefined__";
    }
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  };

  const formatDiffValue = (value) => {
    if (typeof value === "undefined") return "Not set";
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }
    const stringValue = String(value);
    return stringValue.length > 140 ? `${stringValue.slice(0, 140)}...` : stringValue;
  };

  const diffRows = useMemo(() => {
    const entry = diffDialog.entry;
    if (!entry) return [];

    const flattenedOld = flattenObject(entry.old_values || {});
    const flattenedNew = flattenObject(entry.new_values || {});
    const keys = Array.from(
      new Set([...Object.keys(flattenedOld), ...Object.keys(flattenedNew)]),
    ).sort((a, b) => a.localeCompare(b));

    return keys
      .map((field) => ({
        field,
        oldValue: flattenedOld[field],
        newValue: flattenedNew[field],
      }))
      .filter((row) => valueFingerprint(row.oldValue) !== valueFingerprint(row.newValue));
  }, [diffDialog.entry]);

  if (isLoading || isLoadingMyAccess || isLoadingUsers) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Access Control
        </Typography>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Unable to load access-control matrix. {error?.message || ""}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Access Control Matrix
      </Typography>

      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Define who can view, edit, approve, and manage each part of NiEMIS.
      </Typography>

      {notification && (
        <Alert
          severity={notification.type}
          onClose={() => setNotification(null)}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Your Access Profile
        </Typography>
        {current ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Chip label={`Role: ${current.access_role}`} color="primary" />
            <Chip label={`Scope: ${current.scope}`} />
            {current.school_id && <Chip label={`School: ${current.school_id}`} />}
            <Chip label={`Permissions: ${current.permissions?.length || 0}`} color="info" />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Access profile not available.
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Role Assignment Console
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Super Admin can assign user access role, account status, and school scope.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="Search users"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            fullWidth
          />
          <Button variant="outlined" onClick={() => refetchUsers()}>
            Refresh
          </Button>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Current Access</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>School</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {user.username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={roleLabels[user.access_role] || user.access_role || user.role}
                    color="primary"
                  />
                </TableCell>
                <TableCell>{user.scope || "-"}</TableCell>
                <TableCell>{user.school_name || "-"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={user.is_active ? "Active" : "Inactive"}
                    color={user.is_active ? "success" : "default"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => openHistoryDialog(user)}>
                      History
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => openEditDialog(user)}>
                      Edit Access
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Pagination
            page={page}
            count={Math.max(1, Number(userPagination.total_pages || 1))}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {roles.map((role) => (
          <Grid item xs={12} md={6} key={role.key}>
            <Paper sx={{ p: 3, height: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="h6">{role.label}</Typography>
                <Chip size="small" label={`Scope: ${role.scope}`} />
              </Box>
              <List dense disablePadding>
                {(role.permissions || []).map((permission, index) => (
                  <React.Fragment key={`${role.key}-${permission}-${index}`}>
                    <ListItem disableGutters>
                      <ListItemText primary={permission} />
                    </ListItem>
                    {index < role.permissions.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog open={editDialog.open} onClose={closeEditDialog} fullWidth maxWidth="sm">
        <DialogTitle>Update User Access</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Username"
              value={editDialog.user?.username || ""}
              size="small"
              InputProps={{ readOnly: true }}
            />

            <FormControl size="small" fullWidth>
              <InputLabel id="target-access-role-label">Access Role</InputLabel>
              <Select
                labelId="target-access-role-label"
                label="Access Role"
                value={editDialog.target_access_role}
                onChange={(event) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    target_access_role: event.target.value,
                  }))
                }
              >
                {roleOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl
              size="small"
              fullWidth
              disabled={!rolesRequiringSchool.has(editDialog.target_access_role)}
            >
              <InputLabel id="target-school-label">School Assignment</InputLabel>
              <Select
                labelId="target-school-label"
                label="School Assignment"
                value={editDialog.school_id || ""}
                onChange={(event) =>
                  setEditDialog((prev) => ({ ...prev, school_id: event.target.value }))
                }
              >
                <MenuItem value="">
                  <em>Not set</em>
                </MenuItem>
                {schoolOptions.map((school) => (
                  <MenuItem key={school.id} value={school.id}>
                    {school.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editDialog.is_active)}
                  onChange={(event) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      is_active: event.target.checked,
                    }))
                  }
                />
              }
              label="Account is active"
            />

            {rolesRequiringSchool.has(editDialog.target_access_role) &&
              !editDialog.school_id && (
                <Alert severity="warning">
                  School assignment is required for this role.
                </Alert>
              )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              updateUserMutation.isLoading ||
              (rolesRequiringSchool.has(editDialog.target_access_role) &&
                !editDialog.school_id)
            }
          >
            {updateUserMutation.isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={historyDialog.open} onClose={closeHistoryDialog} fullWidth maxWidth="md">
        <DialogTitle>
          Access History
          {historyDialog.user ? ` - ${historyDialog.user.username}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Role assignment and account status changes for this user.
            </Typography>
            <Button size="small" variant="outlined" onClick={() => refetchHistory()}>
              Refresh
            </Button>
          </Stack>

          {isLoadingHistory ? (
            <Typography variant="body2" color="text.secondary">
              Loading history...
            </Typography>
          ) : historyRows.length === 0 ? (
            <Alert severity="info">No access history entries found for this user.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Changed By</TableCell>
                  <TableCell>Summary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyRows.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatHistoryDate(entry.changed_at)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={formatActionLabel(entry.action)} />
                    </TableCell>
                    <TableCell>
                      {entry.actor?.username || entry.actor?.email || entry.actor?.id || "System"}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{entry.summary || "-"}</Typography>
                        {(entry.old_values || entry.new_values) && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => openDiffDialog(entry)}
                          >
                            View Diff
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            <Pagination
              page={historyDialog.page}
              count={Math.max(1, Number(historyPagination.total_pages || 1))}
              onChange={(_, value) =>
                setHistoryDialog((prev) => ({
                  ...prev,
                  page: value,
                }))
              }
              color="primary"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeHistoryDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={diffDialog.open} onClose={closeDiffDialog} fullWidth maxWidth="md">
        <DialogTitle>
          Field Diff
          {diffDialog.entry ? ` - ${formatActionLabel(diffDialog.entry.action)}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Changed at: {formatHistoryDate(diffDialog.entry?.changed_at)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Changed by:{" "}
              {diffDialog.entry?.actor?.username ||
                diffDialog.entry?.actor?.email ||
                diffDialog.entry?.actor?.id ||
                "System"}
            </Typography>
          </Stack>

          {diffRows.length === 0 ? (
            <Alert severity="info">
              No field-level differences were detected in this entry.
            </Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "30%" }}>Field</TableCell>
                  <TableCell sx={{ width: "35%" }}>Old Value</TableCell>
                  <TableCell sx={{ width: "35%" }}>New Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {diffRows.map((row) => (
                  <TableRow key={row.field}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.field}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatDiffValue(row.oldValue)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.primary">
                        {formatDiffValue(row.newValue)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDiffDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccessControlPage;
