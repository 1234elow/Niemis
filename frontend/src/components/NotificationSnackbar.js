import React from "react";
import { Snackbar, Alert, AlertTitle, Slide } from "@mui/material";

const SlideTransition = (props) => {
  return <Slide {...props} direction="down" />;
};

const NotificationSnackbar = ({
  open,
  onClose,
  message,
  severity = "info",
  title = null,
  autoHideDuration = 6000,
}) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      TransitionComponent={SlideTransition}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{ width: "100%" }}
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationSnackbar;
