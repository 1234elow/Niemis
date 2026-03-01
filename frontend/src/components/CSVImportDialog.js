import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Link,
} from "@mui/material";
import {
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Close,
  Download,
  InsertDriveFile,
} from "@mui/icons-material";
import { useDropzone } from "react-dropzone";
import { apiService } from "../services/apiService";

const steps = ["Upload CSV", "Preview & Validate", "Import Results"];

const CSVImportDialog = ({
  open,
  onClose,
  classId,
  termId,
  onImportComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError("");
    if (rejectedFiles.length > 0) {
      setError("Only CSV files are allowed");
      return;
    }
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFile(file);
      parseCSVPreview(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const parseCSVPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim());

      const requiredHeaders = [
        "student_id",
        "subject_code",
        "numeric_score",
        "effort_grade",
        "behavior_grade",
      ];

      const missingHeaders = requiredHeaders.filter(
        (h) => !headers.includes(h),
      );

      if (missingHeaders.length > 0) {
        setValidationErrors([
          {
            row: 0,
            field: "headers",
            message: `Missing required headers: ${missingHeaders.join(", ")}`,
          },
        ]);
      } else {
        setValidationErrors([]);
      }

      const data = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        row._rowNum = i + 1;
        data.push(row);
      }
      setPreviewData(data);
      setActiveStep(1);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiService.downloadCSVTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "grade-import-template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download template");
    }
  };

  const handleImport = async () => {
    if (!file || !classId || !termId) {
      setError("Missing required data for import");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await apiService.importGradesFromCSV(
        classId,
        termId,
        file,
      );
      setImportResult(result);
      setActiveStep(2);
      onImportComplete?.(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Import failed");
      if (err.response?.data?.errors) {
        setValidationErrors(err.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setFile(null);
    setPreviewData([]);
    setValidationErrors([]);
    setImportResult(null);
    setError("");
    onClose();
  };

  const handleBack = () => {
    if (activeStep === 1) {
      setFile(null);
      setPreviewData([]);
      setValidationErrors([]);
    }
    setActiveStep((prev) => prev - 1);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">Import Grades from CSV</Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {/* Step 0: Upload */}
        {activeStep === 0 && (
          <Box>
            <Box
              {...getRootProps()}
              sx={{
                border: "2px dashed",
                borderColor: isDragActive ? "primary.main" : "grey.400",
                borderRadius: 2,
                p: 4,
                textAlign: "center",
                cursor: "pointer",
                bgcolor: isDragActive ? "action.hover" : "background.paper",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "action.hover",
                },
              }}
            >
              <input {...getInputProps()} />
              <CloudUpload
                sx={{ fontSize: 48, color: "primary.main", mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                {isDragActive
                  ? "Drop the CSV file here"
                  : "Drag & drop a CSV file here"}
              </Typography>
              <Typography color="text.secondary">
                or click to select a file
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                Maximum file size: 5MB
              </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Required CSV Format:
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                component="div"
              >
                <code>
                  student_id,subject_code,numeric_score,effort_grade,behavior_grade,comments
                </code>
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Link
                  component="button"
                  variant="body2"
                  onClick={handleDownloadTemplate}
                  sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                >
                  <Download fontSize="small" />
                  Download CSV Template
                </Link>
              </Box>
            </Box>
          </Box>
        )}

        {/* Step 1: Preview */}
        {activeStep === 1 && (
          <Box>
            {file && (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
              >
                <InsertDriveFile color="primary" />
                <Typography variant="body2">{file.name}</Typography>
                <Chip
                  label={`${(file.size / 1024).toFixed(1)} KB`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}

            {validationErrors.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Validation Issues:</Typography>
                <List dense>
                  {validationErrors.slice(0, 5).map((err, idx) => (
                    <ListItem key={idx} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Warning color="warning" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Row ${err.row}: ${err.message}`}
                        primaryTypographyProps={{ variant: "body2" }}
                      />
                    </ListItem>
                  ))}
                  {validationErrors.length > 5 && (
                    <ListItem sx={{ py: 0 }}>
                      <ListItemText
                        primary={`...and ${validationErrors.length - 5} more errors`}
                        primaryTypographyProps={{
                          variant: "body2",
                          color: "text.secondary",
                        }}
                      />
                    </ListItem>
                  )}
                </List>
              </Alert>
            )}

            <Typography variant="subtitle2" gutterBottom>
              Preview (first 10 rows):
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Student ID</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Effort</TableCell>
                    <TableCell>Behavior</TableCell>
                    <TableCell>Comments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row._rowNum}</TableCell>
                      <TableCell>{row.student_id}</TableCell>
                      <TableCell>{row.subject_code}</TableCell>
                      <TableCell>{row.numeric_score}</TableCell>
                      <TableCell>{row.effort_grade}</TableCell>
                      <TableCell>{row.behavior_grade}</TableCell>
                      <TableCell>
                        {row.comments?.substring(0, 30)}
                        {row.comments?.length > 30 ? "..." : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Step 2: Results */}
        {activeStep === 2 && importResult && (
          <Box>
            <Alert
              severity={
                importResult.summary.errors === 0 ? "success" : "warning"
              }
              sx={{ mb: 3 }}
            >
              Import completed: {importResult.summary.imported} grades imported
              {importResult.summary.errors > 0 &&
                `, ${importResult.summary.errors} errors`}
            </Alert>

            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${importResult.summary.imported} Imported`}
                color="success"
                variant="outlined"
              />
              {importResult.summary.validation_errors > 0 && (
                <Chip
                  icon={<Warning />}
                  label={`${importResult.summary.validation_errors} Validation Errors`}
                  color="warning"
                  variant="outlined"
                />
              )}
              {importResult.summary.import_errors > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${importResult.summary.import_errors} Import Errors`}
                  color="error"
                  variant="outlined"
                />
              )}
            </Box>

            {importResult.validation_errors?.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle2"
                  color="warning.main"
                  gutterBottom
                >
                  Validation Errors:
                </Typography>
                <List dense>
                  {importResult.validation_errors
                    .slice(0, 5)
                    .map((err, idx) => (
                      <ListItem key={idx} sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Warning color="warning" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Row ${err.row}: ${err.field} - ${err.message}`}
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItem>
                    ))}
                </List>
              </Box>
            )}

            {importResult.import_errors?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Import Errors:
                </Typography>
                <List dense>
                  {importResult.import_errors.slice(0, 5).map((err, idx) => (
                    <ListItem key={idx} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${err.student_id} - ${err.subject_code}: ${err.message}`}
                        primaryTypographyProps={{ variant: "body2" }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {activeStep > 0 && activeStep < 2 && (
          <Button onClick={handleBack}>Back</Button>
        )}
        <Box sx={{ flex: 1 }} />
        {activeStep === 1 && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={
              loading || validationErrors.some((e) => e.field === "headers")
            }
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? "Importing..." : "Import Grades"}
          </Button>
        )}
        {activeStep === 2 && (
          <Button variant="contained" onClick={handleClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CSVImportDialog;
