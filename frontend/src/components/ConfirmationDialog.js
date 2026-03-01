import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Warning, Delete, Info } from "@mui/icons-material";

const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  severity = "warning",
  loading = false,
  details = null,
}) => {
  const getIcon = () => {
    switch (severity) {
      case "error":
        return <Delete color="error" />;
      case "warning":
        return <Warning color="warning" />;
      case "info":
        return <Info color="info" />;
      default:
        return <Warning color="warning" />;
    }
  };

  const getButtonColor = () => {
    switch (severity) {
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "info":
        return "primary";
      default:
        return "warning";
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {getIcon()}
          <Typography variant="h6">{title}</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {message}
        </Typography>

        {details && (
          <Alert severity={severity} sx={{ mb: 2 }}>
            <Typography variant="body2">{details}</Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={getButtonColor()}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
