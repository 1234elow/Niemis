import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
  CircularProgress,
} from "@mui/material";
import { Warning } from "@mui/icons-material";

const DeleteConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  loading = false,
  error = "",
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Warning color="error" />
        {title || "Confirm Deletion"}
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" sx={{ mb: 2 }}>
          {message || "Are you sure you want to delete this item?"}
        </Typography>

        {itemName && (
          <Box
            sx={{
              p: 2,
              backgroundColor: "grey.100",
              borderRadius: 1,
              mb: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Item to be deleted:
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {itemName}
            </Typography>
          </Box>
        )}

        <Alert severity="warning" sx={{ mt: 2 }}>
          This action cannot be undone. The item will be deactivated and hidden
          from the system.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
