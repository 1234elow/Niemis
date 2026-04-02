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
import { formatBarbadosDateTime } from "../utils/dateTime";

const AccessControlPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [notification, setNotification] = useState(null);
  const [editDialog, setEditDialog] = useState({
    open: false,
    user: null,
    username: "",
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
  const [createDialog, setCreateDialog] = useState({
    open: false,
    username: "",
    email: "",
    target_access_role: "school_admin",
    school_id: "",
    first_name: "",
    last_name: "",
    is_active: true,
    generate_password: true,
    password: "",
  });
  const [resetDialog, setResetDialog] = useState({
    open: false,
    user: null,
    generate_password: true,
    password: "",
  });
  const [credentialDialog, setCredentialDialog] = useState({
    open: false,
    title: "",
    username: "",
    password: "",
    message: "",
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
    ["access-control-users", page, search, roleFilter],
    () =>
      apiService.getAccessControlUsers({
        page,
        limit: 15,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
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
          username: "",
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

  const createUserMutation = useMutation(
    (payload) => apiService.createAccessControlUser(payload),
    {
      onSuccess: (response) => {
        setNotification({
          type: "success",
          message: "User account created successfully.",
        });
        setCreateDialog({
          open: false,
          username: "",
          email: "",
          target_access_role: "school_admin",
          school_id: "",
          first_name: "",
          last_name: "",
          is_active: true,
          generate_password: true,
          password: "",
        });
        setCredentialDialog({
          open: true,
          title: "New User Credentials",
          username: response?.user?.username || "",
          password: response?.credentials?.password || "",
          message: response?.credentials?.generated
            ? "System-generated password created. Share it securely with the user."
            : "Password set successfully for the new user.",
        });
        queryClient.invalidateQueries(["access-control-users"]);
      },
      onError: (mutationError) => {
        setNotification({
          type: "error",
          message:
            mutationError?.response?.data?.error ||
            mutationError?.message ||
            "Failed to create user account.",
        });
      },
    },
  );

  const resetPasswordMutation = useMutation(
    ({ userId, payload }) => apiService.resetAccessControlUserPassword(userId, payload),
    {
      onSuccess: (response) => {
        setNotification({
          type: "success",
          message: "Password reset completed.",
        });
        setResetDialog({
          open: false,
          user: null,
          generate_password: true,
          password: "",
        });
        setCredentialDialog({
          open: true,
          title: "Reset Password",
          username: response?.user?.username || "",
          password: response?.credentials?.password || "",
          message: "Provide this password securely to the user.",
        });
      },
      onError: (mutationError) => {
        setNotification({
          type: "error",
          message:
            mutationError?.response?.data?.error ||
            mutationError?.message ||
            "Failed to reset password.",
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
  const rolesRequiringStaff = new Set(["school_admin", "data_clerk", "teacher"]);

  const openEditDialog = (user) => {
    setEditDialog({
      open: true,
      user,
      username: user.username || "",
      target_access_role: user.access_role || "",
      school_id: user.school_id || "",
      is_active: Boolean(user.is_active),
    });
  };

  const closeEditDialog = () => {
    setEditDialog({
      open: false,
      user: null,
      username: "",
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

  const openCreateDialog = () => {
    setCreateDialog({
      open: true,
      username: "",
      email: "",
      target_access_role: "school_admin",
      school_id: "",
      first_name: "",
      last_name: "",
      is_active: true,
      generate_password: true,
      password: "",
    });
  };

  const closeCreateDialog = () => {
    setCreateDialog((prev) => ({ ...prev, open: false }));
  };

  const openResetDialog = (user) => {
    setResetDialog({
      open: true,
      user,
      generate_password: true,
      password: "",
    });
  };

  const closeResetDialog = () => {
    setResetDialog({
      open: false,
      user: null,
      generate_password: true,
      password: "",
    });
  };

  const handleCreateUser = () => {
    const payload = {
      username: createDialog.username.trim(),
      email: createDialog.email.trim(),
      target_access_role: createDialog.target_access_role,
      is_active: Boolean(createDialog.is_active),
    };

    if (rolesRequiringSchool.has(createDialog.target_access_role)) {
      payload.school_id = createDialog.school_id;
    }
    if (rolesRequiringStaff.has(createDialog.target_access_role)) {
      payload.first_name = createDialog.first_name.trim();
      payload.last_name = createDialog.last_name.trim();
    }
    if (!createDialog.generate_password && createDialog.password.trim()) {
      payload.password = createDialog.password;
    }

    createUserMutation.mutate(payload);
  };

  const handleResetPassword = () => {
    if (!resetDialog.user) return;
    const payload = {
      generate_password: Boolean(resetDialog.generate_password),
    };
    if (!resetDialog.generate_password && resetDialog.password.trim()) {
      payload.password = resetDialog.password;
    }
    resetPasswordMutation.mutate({
      userId: resetDialog.user.id,
      payload,
    });
  };

  const handleSave = () => {
    if (!editDialog.user) return;
    const payload = {
      username: editDialog.username.trim(),
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
    return formatBarbadosDateTime(value);
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

  const createRequiresSchool = rolesRequiringSchool.has(createDialog.target_access_role);
  const createRequiresStaff = rolesRequiringStaff.has(createDialog.target_access_role);
  const canSubmitCreate =
    Boolean(createDialog.username.trim()) &&
    Boolean(createDialog.email.trim()) &&
    Boolean(createDialog.target_access_role) &&
    (!createRequiresSchool || Boolean(createDialog.school_id)) &&
    (!createRequiresStaff ||
      (Boolean(createDialog.first_name.trim()) && Boolean(createDialog.last_name.trim()))) &&
    (createDialog.generate_password || Boolean(createDialog.password.trim()));
  const canSubmitReset =
    Boolean(resetDialog.user?.id) &&
    (resetDialog.generate_password || Boolean(resetDialog.password.trim()));

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
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="role-filter-label">Role</InputLabel>
            <Select
              labelId="role-filter-label"
              label="Role"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All roles</MenuItem>
              <MenuItem value="super_admin">Super Admin</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="teacher">Teacher</MenuItem>
              <MenuItem value="parent">Parent</MenuItem>
              <MenuItem value="student">Student</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={openCreateDialog}>
            Create User
          </Button>
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
                    <Button size="small" variant="outlined" onClick={() => openResetDialog(user)}>
                      Reset Password
                    </Button>
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
              value={editDialog.username}
              size="small"
              onChange={(event) =>
                setEditDialog((prev) => ({
                  ...prev,
                  username: event.target.value,
                }))
              }
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
              !editDialog.username.trim() ||
              (rolesRequiringSchool.has(editDialog.target_access_role) &&
                !editDialog.school_id)
            }
          >
            {updateUserMutation.isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialog.open} onClose={closeCreateDialog} fullWidth maxWidth="sm">
        <DialogTitle>Create User Account</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Username"
              size="small"
              value={createDialog.username}
              onChange={(event) =>
                setCreateDialog((prev) => ({ ...prev, username: event.target.value }))
              }
              required
            />
            <TextField
              label="Email"
              size="small"
              type="email"
              value={createDialog.email}
              onChange={(event) =>
                setCreateDialog((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />

            <FormControl size="small" fullWidth>
              <InputLabel id="create-target-access-role-label">Access Role</InputLabel>
              <Select
                labelId="create-target-access-role-label"
                label="Access Role"
                value={createDialog.target_access_role}
                onChange={(event) =>
                  setCreateDialog((prev) => ({
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

            <FormControl size="small" fullWidth disabled={!createRequiresSchool}>
              <InputLabel id="create-target-school-label">School Assignment</InputLabel>
              <Select
                labelId="create-target-school-label"
                label="School Assignment"
                value={createDialog.school_id || ""}
                onChange={(event) =>
                  setCreateDialog((prev) => ({ ...prev, school_id: event.target.value }))
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

            {createRequiresStaff && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="First Name"
                  size="small"
                  value={createDialog.first_name}
                  onChange={(event) =>
                    setCreateDialog((prev) => ({ ...prev, first_name: event.target.value }))
                  }
                  required
                  fullWidth
                />
                <TextField
                  label="Last Name"
                  size="small"
                  value={createDialog.last_name}
                  onChange={(event) =>
                    setCreateDialog((prev) => ({ ...prev, last_name: event.target.value }))
                  }
                  required
                  fullWidth
                />
              </Stack>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(createDialog.generate_password)}
                  onChange={(event) =>
                    setCreateDialog((prev) => ({
                      ...prev,
                      generate_password: event.target.checked,
                    }))
                  }
                />
              }
              label="Generate system password"
            />

            {!createDialog.generate_password && (
              <TextField
                label="Set Password"
                size="small"
                type="password"
                value={createDialog.password}
                onChange={(event) =>
                  setCreateDialog((prev) => ({ ...prev, password: event.target.value }))
                }
                helperText="Minimum 8 characters."
                required
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(createDialog.is_active)}
                  onChange={(event) =>
                    setCreateDialog((prev) => ({
                      ...prev,
                      is_active: event.target.checked,
                    }))
                  }
                />
              }
              label="Account is active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={!canSubmitCreate || createUserMutation.isLoading}
          >
            {createUserMutation.isLoading ? "Creating..." : "Create User"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetDialog.open} onClose={closeResetDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          Reset Password {resetDialog.user ? `- ${resetDialog.user.username}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              Use this for forgotten passwords. A new password will replace the current one
              immediately.
            </Alert>

            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(resetDialog.generate_password)}
                  onChange={(event) =>
                    setResetDialog((prev) => ({
                      ...prev,
                      generate_password: event.target.checked,
                    }))
                  }
                />
              }
              label="Generate system password"
            />

            {!resetDialog.generate_password && (
              <TextField
                label="New Password"
                size="small"
                type="password"
                value={resetDialog.password}
                onChange={(event) =>
                  setResetDialog((prev) => ({ ...prev, password: event.target.value }))
                }
                helperText="Minimum 8 characters."
                required
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleResetPassword}
            disabled={!canSubmitReset || resetPasswordMutation.isLoading}
          >
            {resetPasswordMutation.isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={credentialDialog.open}
        onClose={() => setCredentialDialog((prev) => ({ ...prev, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{credentialDialog.title || "Credentials"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {credentialDialog.message && (
              <Alert severity="success">{credentialDialog.message}</Alert>
            )}
            <TextField
              label="Username"
              value={credentialDialog.username}
              size="small"
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Password"
              value={credentialDialog.password}
              size="small"
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialDialog((prev) => ({ ...prev, open: false }))}>
            Close
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
