import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Paper,
  Chip,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fab,
  Tooltip,
  Avatar,
  LinearProgress,
  TextField,
  InputAdornment,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Group,
  Schedule,
  Person,
  Grade,
  Add,
  Book,
  School,
  Assessment,
  Close,
  Search,
  Delete,
  Event,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";
import { toast } from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import GradeEntryForm from "../components/GradeEntryForm";
import AttendanceForm from "../components/AttendanceForm";
import GradeViewingModal from "../components/GradeViewingModal";
import StudentDetailsModal from "../components/StudentDetailsModal";

const DEFAULT_TIMETABLE_FORM = {
  day_of_week: "monday",
  start_time: "",
  end_time: "",
  slot_type: "lesson",
  subject_id: "",
  room: "",
  notes: "",
};
const DEFAULT_POLICY_FORM = {
  school_day_start: "",
  school_day_end: "",
  break_start: "",
  break_end: "",
  lunch_start: "",
  lunch_end: "",
};

const formatTimeLabel = (value) => {
  if (!value) return "N/A";
  const [hours, minutes] = String(value).split(":");
  if (hours == null || minutes == null) return value;
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const extractTimeForApi = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/(\d{2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
};

const dayLabel = (value) =>
  String(value || "")
    .replace(/^\w/, (char) => char.toUpperCase());

const TIMETABLE_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const TIMETABLE_DAY_ORDER = TIMETABLE_DAYS.reduce((acc, day, index) => {
  acc[day] = index;
  return acc;
}, {});
const TIMETABLE_TEMPLATE_STORAGE_PREFIX = "niemis_timetable_templates_";
const DEFAULT_TEMPLATE_DURATIONS = [
  { label: "Period 1", start_time: "08:00", end_time: "08:40" },
  { label: "Period 2", start_time: "08:45", end_time: "09:25" },
  { label: "Period 3", start_time: "09:30", end_time: "10:00" },
  { label: "Period 4", start_time: "10:20", end_time: "11:00" },
  { label: "Period 5", start_time: "11:05", end_time: "11:45" },
  { label: "Period 6", start_time: "12:45", end_time: "13:25" },
  { label: "Period 7", start_time: "13:30", end_time: "14:10" },
];

const timeToMinutes = (value) => {
  const normalized = extractTimeForApi(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":");
  return Number(hours) * 60 + Number(minutes);
};

const minutesToTimeValue = (minutes) => {
  if (!Number.isFinite(minutes)) return "";
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const sortTimetableSlots = (slots) =>
  [...slots].sort((a, b) => {
    const dayA = TIMETABLE_DAY_ORDER[String(a.day_of_week || "").toLowerCase()] ?? 99;
    const dayB = TIMETABLE_DAY_ORDER[String(b.day_of_week || "").toLowerCase()] ?? 99;
    if (dayA !== dayB) return dayA - dayB;
    return String(a.start_time || "").localeCompare(String(b.start_time || ""));
  });

const sortTemplateSlots = (slots) =>
  [...slots].sort((a, b) => {
    const startCompare = String(a.start_time || "").localeCompare(String(b.start_time || ""));
    if (startCompare !== 0) return startCompare;
    return String(a.end_time || "").localeCompare(String(b.end_time || ""));
  });

const createTemplateId = () =>
  `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildTemplateKey = (startTime, endTime) =>
  `${extractTimeForApi(startTime)}-${extractTimeForApi(endTime)}`;

const normalizeTemplateSlots = (slots = []) =>
  sortTemplateSlots(
    slots
      .map((slot, index) => {
        const startTime = extractTimeForApi(slot.start_time);
        const endTime = extractTimeForApi(slot.end_time);
        if (!startTime || !endTime || startTime >= endTime) {
          return null;
        }

        const label = String(slot.label || "").trim();
        return {
          id: slot.id || createTemplateId(),
          label: label || `Period ${index + 1}`,
          start_time: startTime,
          end_time: endTime,
        };
      })
      .filter(Boolean),
  );

const mergeTemplateSlots = (...templateGroups) => {
  const mergedByTime = new Map();
  for (const group of templateGroups) {
    for (const slot of normalizeTemplateSlots(group || [])) {
      const key = buildTemplateKey(slot.start_time, slot.end_time);
      if (!key) continue;
      if (!mergedByTime.has(key)) {
        mergedByTime.set(key, {
          ...slot,
          id: slot.id || createTemplateId(),
          label: slot.label || `Period ${mergedByTime.size + 1}`,
        });
      }
    }
  }

  const merged = normalizeTemplateSlots([...mergedByTime.values()]);
  return merged.map((slot, index) => ({
    ...slot,
    label: String(slot.label || "").trim() || `Period ${index + 1}`,
  }));
};

const buildPolicyFormValues = (policy) => ({
  school_day_start: extractTimeForApi(policy?.school_day_start),
  school_day_end: extractTimeForApi(policy?.school_day_end),
  break_start: extractTimeForApi(policy?.break_start),
  break_end: extractTimeForApi(policy?.break_end),
  lunch_start: extractTimeForApi(policy?.lunch_start),
  lunch_end: extractTimeForApi(policy?.lunch_end),
});

const buildTemplateSlotsFromPolicy = (policy) => {
  const schoolDayStart = timeToMinutes(policy?.school_day_start);
  const schoolDayEnd = timeToMinutes(policy?.school_day_end);
  const breakStart = timeToMinutes(policy?.break_start);
  const breakEnd = timeToMinutes(policy?.break_end);
  const lunchStart = timeToMinutes(policy?.lunch_start);
  const lunchEnd = timeToMinutes(policy?.lunch_end);

  const values = [
    schoolDayStart,
    schoolDayEnd,
    breakStart,
    breakEnd,
    lunchStart,
    lunchEnd,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    return normalizeTemplateSlots(DEFAULT_TEMPLATE_DURATIONS);
  }

  const segments = [
    [schoolDayStart, breakStart],
    [breakEnd, lunchStart],
    [lunchEnd, schoolDayEnd],
  ].filter(([segmentStart, segmentEnd]) => segmentStart < segmentEnd);

  const lessonLength = 40;
  const transitionLength = 5;
  const generated = [];
  let periodIndex = 1;

  for (const [segmentStart, segmentEnd] of segments) {
    let cursor = segmentStart;
    while (cursor + lessonLength <= segmentEnd) {
      generated.push({
        id: createTemplateId(),
        label: `Period ${periodIndex}`,
        start_time: minutesToTimeValue(cursor),
        end_time: minutesToTimeValue(cursor + lessonLength),
      });
      periodIndex += 1;
      cursor += lessonLength + transitionLength;
    }
  }

  if (generated.length === 0) {
    return normalizeTemplateSlots(DEFAULT_TEMPLATE_DURATIONS);
  }
  return normalizeTemplateSlots(generated);
};

const intervalsOverlapForUi = (startA, endA, startB, endB) => {
  const startAMins = timeToMinutes(startA);
  const endAMins = timeToMinutes(endA);
  const startBMins = timeToMinutes(startB);
  const endBMins = timeToMinutes(endB);
  if (
    !Number.isFinite(startAMins) ||
    !Number.isFinite(endAMins) ||
    !Number.isFinite(startBMins) ||
    !Number.isFinite(endBMins)
  ) {
    return false;
  }
  return startAMins < endBMins && startBMins < endAMins;
};

const buildTemplateSlotsFromTimetable = (slots = []) => {
  const uniqueByTime = new Map();
  for (const slot of slots) {
    const startTime = extractTimeForApi(slot.start_time);
    const endTime = extractTimeForApi(slot.end_time);
    if (!startTime || !endTime) continue;
    const key = buildTemplateKey(startTime, endTime);
    if (uniqueByTime.has(key)) continue;
    uniqueByTime.set(key, {
      id: createTemplateId(),
      label: `Period ${uniqueByTime.size + 1}`,
      start_time: startTime,
      end_time: endTime,
    });
  }
  return normalizeTemplateSlots([...uniqueByTime.values()]);
};

const getTemplateStorageKey = (classId) =>
  `${TIMETABLE_TEMPLATE_STORAGE_PREFIX}${classId}`;

const readTemplateSlotsFromStorage = (classId) => {
  if (!classId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getTemplateStorageKey(classId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeTemplateSlots(parsed);
  } catch (error) {
    return [];
  }
};

const persistTemplateSlots = (classId, slots) => {
  if (!classId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getTemplateStorageKey(classId),
      JSON.stringify(normalizeTemplateSlots(slots)),
    );
  } catch (error) {
    // Ignore storage write errors (private mode/quota)
  }
};

const MyClassesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [gradeEntryOpen, setGradeEntryOpen] = useState(false);
  const [selectedClassForGrades, setSelectedClassForGrades] = useState(null);
  const [gradeFocusStudentId, setGradeFocusStudentId] = useState(null);
  const [attendanceFormOpen, setAttendanceFormOpen] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState(null);
  const [gradeViewingOpen, setGradeViewingOpen] = useState(false);
  const [selectedClassForViewing, setSelectedClassForViewing] = useState(null);
  const [studentDetailsOpen, setStudentDetailsOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [classOptionsLoading, setClassOptionsLoading] = useState(false);
  const [classOptions, setClassOptions] = useState({
    school: null,
    default_sections: ["A", "B"],
    allowed_grade_levels: [],
    subjects: [],
    day_policy: null,
    grade_student_counts: {},
    existing_classes: [],
  });
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [classDeleteDialogOpen, setClassDeleteDialogOpen] = useState(false);
  const [classDeleteLoading, setClassDeleteLoading] = useState(false);
  const [classPendingDelete, setClassPendingDelete] = useState(null);
  const [createClassForm, setCreateClassForm] = useState({
    grade_level: "",
    section: "A",
    capacity: 30,
    school_year: "",
    name: "",
  });
  const [createClassErrors, setCreateClassErrors] = useState({});
  const [timetableOpen, setTimetableOpen] = useState(false);
  const [selectedClassForTimetable, setSelectedClassForTimetable] = useState(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableSaving, setTimetableSaving] = useState(false);
  const [timetableDeleteId, setTimetableDeleteId] = useState(null);
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [timetablePolicy, setTimetablePolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState(DEFAULT_POLICY_FORM);
  const [policySaving, setPolicySaving] = useState(false);
  const [timetableForm, setTimetableForm] = useState(DEFAULT_TIMETABLE_FORM);
  const [timetableViewMode, setTimetableViewMode] = useState("sheet");
  const [customLessonSlots, setCustomLessonSlots] = useState([]);
  const [customSlotDraft, setCustomSlotDraft] = useState({
    label: "",
    start_time: "",
    end_time: "",
  });
  const [dragPayload, setDragPayload] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const quickActionHandledRef = useRef(false);

  useEffect(() => {
    loadClasses();
    loadClassOptions();
  }, []);

  useEffect(() => {
    if (quickActionHandledRef.current) return;

    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    const requestedClassId = params.get("classId");
    const requestedStudentId = params.get("studentId");
    if (!action) return;
    if (classes.length === 0) {
      if (!loading) {
        quickActionHandledRef.current = true;
        toast.error("No classes assigned to your profile yet.");
        navigate("/teacher/classes", { replace: true });
      }
      return;
    }

    const targetClass =
      classes.find((classItem) => String(classItem.id) === String(requestedClassId)) ||
      classes[0];

    if (action === "attendance") {
      setSelectedClassForAttendance(targetClass);
      setAttendanceFormOpen(true);
      toast.success(`Opened attendance for ${getDisplayClassName(targetClass)}`);
    } else if (action === "grades") {
      setSelectedClassForGrades(targetClass);
      setGradeFocusStudentId(requestedStudentId || null);
      setGradeEntryOpen(true);
      toast.success(`Opened grade entry for ${getDisplayClassName(targetClass)}`);
    }

    quickActionHandledRef.current = true;
    navigate("/teacher/classes", { replace: true });
  }, [classes, loading, location.search, navigate]);

  const loadClasses = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiService.getTeacherClasses();
      setClasses(response.classes || []);
    } catch (err) {
      console.error("Error loading classes:", err);
      setError("Failed to load your classes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadClassOptions = async () => {
    try {
      setClassOptionsLoading(true);
      const response = await apiService.getTeacherClassOptions();
      setClassOptions({
        school: response.school || null,
        default_sections: response.default_sections || ["A", "B"],
        allowed_grade_levels: response.allowed_grade_levels || [],
        subjects: response.subjects || [],
        day_policy: response.day_policy || null,
        grade_student_counts: response.grade_student_counts || {},
        existing_classes: response.existing_classes || [],
      });

      setCreateClassForm((prev) => ({
        ...prev,
        grade_level: prev.grade_level || response.allowed_grade_levels?.[0] || "",
        section: prev.section || response.default_sections?.[0] || "A",
        capacity:
          Number(prev.capacity) > 0
            ? Number(prev.capacity)
            : Number(
                response.grade_student_counts?.[
                  prev.grade_level || response.allowed_grade_levels?.[0] || ""
                ],
              ) || 30,
        school_year:
          prev.school_year ||
          `${new Date().getMonth() + 1 >= 9 ? new Date().getFullYear() : new Date().getFullYear() - 1}-${(new Date().getMonth() + 1 >= 9 ? new Date().getFullYear() : new Date().getFullYear() - 1) + 1}`,
      }));
    } catch (err) {
      console.error("Error loading class options:", err);
      toast.error("Failed to load class setup options.");
    } finally {
      setClassOptionsLoading(false);
    }
  };

  const validateCreateClassForm = () => {
    const errors = {};
    const selectedGradeCount = Number(
      classOptions.grade_student_counts?.[createClassForm.grade_level] || 0,
    );
    if (!createClassForm.grade_level) {
      errors.grade_level = "Grade level is required";
    }
    if (!createClassForm.section) {
      errors.section = "Section is required";
    }
    if (!createClassForm.school_year) {
      errors.school_year = "School year is required";
    }
    const capacity = Number(createClassForm.capacity);
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 50) {
      errors.capacity = "Capacity must be between 1 and 50";
    } else if (selectedGradeCount > 0 && capacity > selectedGradeCount) {
      errors.capacity = `Capacity cannot exceed ${selectedGradeCount} students in ${createClassForm.grade_level}`;
    }
    setCreateClassErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateClass = async () => {
    if (!validateCreateClassForm()) {
      return;
    }

    try {
      setCreatingClass(true);
      const response = await apiService.createTeacherClass({
        grade_level: createClassForm.grade_level,
        section: createClassForm.section,
        school_year: createClassForm.school_year,
        capacity: Number(createClassForm.capacity),
        name: createClassForm.name?.trim() || undefined,
      });

      const assigned = Number(response?.assigned_students || 0);
      const effectiveCapacity = Number(response?.effective_capacity || 0);
      if (assigned > 0) {
        toast.success(
          `Class created and ${assigned} students auto-assigned (capacity ${effectiveCapacity}).`,
        );
      } else {
        toast.success("Class created successfully.");
      }
      setCreateClassOpen(false);
      setCreateClassErrors({});
      await Promise.all([loadClasses(), loadClassOptions()]);
    } catch (err) {
      console.error("Error creating class:", err);
      toast.error(err.response?.data?.error || "Failed to create class");
    } finally {
      setCreatingClass(false);
    }
  };

  const handleRequestDeleteClass = (classItem) => {
    setClassPendingDelete(classItem);
    setClassDeleteDialogOpen(true);
  };

  const handleCancelDeleteClass = () => {
    if (classDeleteLoading) return;
    setClassDeleteDialogOpen(false);
    setClassPendingDelete(null);
  };

  const handleConfirmDeleteClass = async () => {
    if (!classPendingDelete) return;

    try {
      setClassDeleteLoading(true);
      const response = await apiService.deleteTeacherClass(classPendingDelete.id);
      const unenrolled = Number(response?.unenrolled_students || 0);
      if (unenrolled > 0) {
        toast.success(`Class deleted. ${unenrolled} student(s) were unassigned.`);
      } else {
        toast.success("Class deleted.");
      }
      setClassDeleteDialogOpen(false);
      setClassPendingDelete(null);
      await Promise.all([loadClasses(), loadClassOptions()]);
    } catch (err) {
      console.error("Error deleting class:", err);
      toast.error(err.response?.data?.error || "Failed to delete class");
    } finally {
      setClassDeleteLoading(false);
    }
  };

  const loadClassTimetable = async (classItem) => {
    try {
      setTimetableLoading(true);
      setSelectedClassForTimetable(classItem);
      setTimetableOpen(true);
      setTimetableViewMode("sheet");
      setDragPayload(null);
      setDragOverCell(null);
      const response = await apiService.getClassTimetable(classItem.id);
      const slots = sortTimetableSlots(response.slots || []);
      setTimetableSlots(slots);
      setTimetablePolicy(response.day_policy || null);
      setPolicyForm(buildPolicyFormValues(response.day_policy));
      setClassOptions((prev) => ({
        ...prev,
        day_policy: response.day_policy || prev.day_policy,
      }));
      const storedTemplates = readTemplateSlotsFromStorage(classItem.id);
      const derivedTemplates = buildTemplateSlotsFromTimetable(slots);
      const policyTemplates = buildTemplateSlotsFromPolicy(response.day_policy);
      let templates = [];
      if (derivedTemplates.length > 0) {
        // If lessons already exist, always include their times in the grid.
        templates = mergeTemplateSlots(derivedTemplates, storedTemplates);
      } else if (storedTemplates.length > 0) {
        templates = mergeTemplateSlots(storedTemplates);
      } else {
        templates = mergeTemplateSlots(policyTemplates);
      }
      if (templates.length === 0) {
        templates = mergeTemplateSlots(DEFAULT_TEMPLATE_DURATIONS);
      }
      setCustomLessonSlots(templates);
      persistTemplateSlots(classItem.id, templates);
      setCustomSlotDraft({ label: "", start_time: "", end_time: "" });
      setTimetableForm((prev) => ({
        ...DEFAULT_TIMETABLE_FORM,
        subject_id: classOptions.subjects?.[0]?.id || prev.subject_id || "",
      }));
    } catch (err) {
      console.error("Error loading class timetable:", err);
      toast.error("Failed to load class timetable");
    } finally {
      setTimetableLoading(false);
    }
  };

  const handleCreateTimetableSlot = async () => {
    if (!selectedClassForTimetable) return;

    if (
      !timetableForm.day_of_week ||
      !timetableForm.start_time ||
      !timetableForm.end_time
    ) {
      toast.error("Day, start time, and end time are required.");
      return;
    }

    if (timetableForm.slot_type === "lesson" && !timetableForm.subject_id) {
      toast.error("Subject is required for lesson slots.");
      return;
    }

    try {
      setTimetableSaving(true);
      const response = await apiService.createClassTimetableSlot(
        selectedClassForTimetable.id,
        timetableForm,
      );
      setTimetableSlots((prev) => sortTimetableSlots([...prev, response.slot]));
      if (response.day_policy) {
        setTimetablePolicy(response.day_policy);
        setPolicyForm(buildPolicyFormValues(response.day_policy));
        setClassOptions((prev) => ({
          ...prev,
          day_policy: response.day_policy,
        }));
      }
      setTimetableForm((prev) => ({
        ...DEFAULT_TIMETABLE_FORM,
        subject_id: prev.subject_id,
      }));
      toast.success("Timetable slot added.");
    } catch (err) {
      console.error("Error creating timetable slot:", err);
      const apiError = err?.response?.data || {};
      if (apiError.day_policy) {
        setTimetablePolicy(apiError.day_policy);
        setPolicyForm(buildPolicyFormValues(apiError.day_policy));
        setClassOptions((prev) => ({
          ...prev,
          day_policy: apiError.day_policy,
        }));
      }
      toast.error(apiError.error || "Failed to add timetable slot");
    } finally {
      setTimetableSaving(false);
    }
  };

  const handleDeleteTimetableSlot = async (slotId) => {
    if (!selectedClassForTimetable) return;

    try {
      setTimetableDeleteId(slotId);
      await apiService.deleteClassTimetableSlot(selectedClassForTimetable.id, slotId);
      setTimetableSlots((prev) => prev.filter((slot) => slot.id !== slotId));
      toast.success("Timetable slot removed.");
    } catch (err) {
      console.error("Error deleting timetable slot:", err);
      toast.error(err.response?.data?.error || "Failed to remove slot");
    } finally {
      setTimetableDeleteId(null);
    }
  };

  const validatePolicyForm = (values) => {
    const schoolDayStart = timeToMinutes(values.school_day_start);
    const schoolDayEnd = timeToMinutes(values.school_day_end);
    const breakStart = timeToMinutes(values.break_start);
    const breakEnd = timeToMinutes(values.break_end);
    const lunchStart = timeToMinutes(values.lunch_start);
    const lunchEnd = timeToMinutes(values.lunch_end);

    if (
      [
        schoolDayStart,
        schoolDayEnd,
        breakStart,
        breakEnd,
        lunchStart,
        lunchEnd,
      ].some((value) => !Number.isFinite(value))
    ) {
      return "All policy times are required.";
    }

    if (schoolDayStart >= schoolDayEnd) {
      return "School day end must be after school day start.";
    }
    if (breakStart >= breakEnd) {
      return "Break end must be after break start.";
    }
    if (lunchStart >= lunchEnd) {
      return "Lunch end must be after lunch start.";
    }
    if (breakStart < schoolDayStart || breakEnd > schoolDayEnd) {
      return "Break time must stay inside school day hours.";
    }
    if (lunchStart < schoolDayStart || lunchEnd > schoolDayEnd) {
      return "Lunch time must stay inside school day hours.";
    }
    if (breakStart < lunchEnd && lunchStart < breakEnd) {
      return "Break and lunch times cannot overlap.";
    }

    return null;
  };

  const handleSavePolicy = async () => {
    if (!selectedClassForTimetable) return;

    const validationError = validatePolicyForm(policyForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setPolicySaving(true);
      const response = await apiService.updateTeacherDayPolicy(policyForm);
      if (response.day_policy) {
        setTimetablePolicy(response.day_policy);
        setPolicyForm(buildPolicyFormValues(response.day_policy));
        setClassOptions((prev) => ({
          ...prev,
          day_policy: response.day_policy,
        }));
      }
      toast.success("Timetable policy updated.");
    } catch (err) {
      console.error("Error updating timetable policy:", err);
      const apiError = err?.response?.data || {};
      if (apiError.day_policy) {
        setTimetablePolicy(apiError.day_policy);
        setPolicyForm(buildPolicyFormValues(apiError.day_policy));
        setClassOptions((prev) => ({
          ...prev,
          day_policy: apiError.day_policy,
        }));
      }
      if (apiError.conflict_count) {
        toast.error(
          `${apiError.error || "Policy conflicts detected"} (${apiError.conflict_count} lessons affected)`,
        );
      } else {
        toast.error(apiError.error || "Failed to update timetable policy");
      }
    } finally {
      setPolicySaving(false);
    }
  };

  const handleGenerateTemplateSlotsFromPolicy = () => {
    if (!selectedClassForTimetable) return;
    const templates = buildTemplateSlotsFromPolicy(policyForm);
    setCustomLessonSlots(templates);
    persistTemplateSlots(selectedClassForTimetable.id, templates);
    toast.success("Lesson periods regenerated from current policy.");
  };

  const handleDragStartSlot = (slot, event) => {
    const payload = { type: "slot", slotId: slot.id };
    setDragPayload(payload);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    }
  };

  const handleDragStartSubject = (subject, event) => {
    const payload = { type: "subject", subjectId: subject.id };
    setDragPayload(payload);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    }
  };

  const handleDragEnd = () => {
    setDragPayload(null);
    setDragOverCell(null);
  };

  const getDragPayloadFromEvent = (event) => {
    let payload = dragPayload;
    if (!payload && event?.dataTransfer) {
      const raw = event.dataTransfer.getData("text/plain");
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch (error) {
          payload = null;
        }
      }
    }
    return payload;
  };

  const applyTimetableDropAction = async ({
    day,
    startTime,
    endTime,
    payload,
  }) => {
    if (!selectedClassForTimetable || !payload?.type) {
      return;
    }

    const targetStart = extractTimeForApi(startTime || timetableForm.start_time);
    const targetEnd = extractTimeForApi(endTime || timetableForm.end_time);

    if (!targetStart || !targetEnd) {
      toast.error("Set lesson start and end time first.");
      return;
    }

    if (targetStart >= targetEnd) {
      toast.error("End time must be after start time.");
      return;
    }

    if (payload.type === "slot") {
      const slot = timetableSlots.find((item) => item.id === payload.slotId);
      if (!slot) return;

      const slotStart = extractTimeForApi(slot.start_time);
      const slotEnd = extractTimeForApi(slot.end_time);
      const sameDay = String(slot.day_of_week).toLowerCase() === day;
      const sameTime = slotStart === targetStart && slotEnd === targetEnd;
      if (sameDay && sameTime) return;

      const slotPayload = {
        day_of_week: day,
        start_time: targetStart,
        end_time: targetEnd,
        slot_type: slot.slot_type,
        subject_id: slot.subject_id || slot.Subject?.id || null,
        room: slot.room,
        notes: slot.notes,
      };

      setTimetableSaving(true);
      try {
        const response = await apiService.updateClassTimetableSlot(
          selectedClassForTimetable.id,
          slot.id,
          slotPayload,
        );

        setTimetableSlots((prev) =>
          sortTimetableSlots(
            prev.map((item) => (item.id === slot.id ? response.slot : item)),
          ),
        );
        if (response.day_policy) {
          setTimetablePolicy(response.day_policy);
          setPolicyForm(buildPolicyFormValues(response.day_policy));
          setClassOptions((prev) => ({
            ...prev,
            day_policy: response.day_policy,
          }));
        }
        toast.success("Lesson moved.");
      } catch (updateError) {
        const status = updateError?.response?.status;
        if (status === 404 || status === 405) {
          // Fallback for servers that don't yet expose PATCH route.
          const createResponse = await apiService.createClassTimetableSlot(
            selectedClassForTimetable.id,
            slotPayload,
          );
          await apiService.deleteClassTimetableSlot(
            selectedClassForTimetable.id,
            slot.id,
          );
          setTimetableSlots((prev) =>
            sortTimetableSlots(
              prev.filter((item) => item.id !== slot.id).concat(createResponse.slot),
            ),
          );
          if (createResponse.day_policy) {
            setTimetablePolicy(createResponse.day_policy);
            setPolicyForm(buildPolicyFormValues(createResponse.day_policy));
            setClassOptions((prev) => ({
              ...prev,
              day_policy: createResponse.day_policy,
            }));
          }
          toast.success("Lesson moved.");
        } else {
          throw updateError;
        }
      }
      return;
    }

    if (payload.type === "subject") {
      setTimetableSaving(true);
      const response = await apiService.createClassTimetableSlot(
        selectedClassForTimetable.id,
        {
          day_of_week: day,
          start_time: targetStart,
          end_time: targetEnd,
          slot_type: "lesson",
          subject_id: payload.subjectId,
          room: timetableForm.room,
          notes: timetableForm.notes,
        },
      );

      setTimetableSlots((prev) => sortTimetableSlots([...prev, response.slot]));
      if (response.day_policy) {
        setTimetablePolicy(response.day_policy);
        setPolicyForm(buildPolicyFormValues(response.day_policy));
        setClassOptions((prev) => ({
          ...prev,
          day_policy: response.day_policy,
        }));
      }
      toast.success("Lesson dropped into timetable.");
    }
  };

  const handleCellDragOver = (day, templateSlot, event) => {
    event.preventDefault();
    setDragOverCell({ day, templateId: templateSlot.id });
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = dragPayload?.type === "subject" ? "copy" : "move";
    }
  };

  const handleCellDrop = async (day, templateSlot, event) => {
    event.preventDefault();
    setDragOverCell(null);
    if (!selectedClassForTimetable) {
      setDragPayload(null);
      return;
    }

    const payload = getDragPayloadFromEvent(event);

    if (!payload?.type) {
      setDragPayload(null);
      return;
    }

    try {
      await applyTimetableDropAction({
        day,
        startTime: templateSlot.start_time,
        endTime: templateSlot.end_time,
        payload,
      });
    } catch (err) {
      console.error("Error applying drag/drop timetable action:", err);
      const apiError = err?.response?.data || {};
      if (apiError.day_policy) {
        setTimetablePolicy(apiError.day_policy);
        setPolicyForm(buildPolicyFormValues(apiError.day_policy));
        setClassOptions((prev) => ({
          ...prev,
          day_policy: apiError.day_policy,
        }));
      }
      const conflictSlot = apiError?.conflict_slot;
      if (conflictSlot) {
        const conflictDay = dayLabel(conflictSlot.day_of_week || "");
        const conflictStart = formatTimeLabel(conflictSlot.start_time);
        const conflictEnd = formatTimeLabel(conflictSlot.end_time);
        toast.error(
          `${apiError.error || "Time conflict"} (${conflictDay} ${conflictStart}-${conflictEnd})`,
        );
      } else {
        toast.error(apiError.error || "Unable to apply timetable change");
      }
    } finally {
      setTimetableSaving(false);
      setDragPayload(null);
    }
  };

  const handleAddCustomLessonSlot = () => {
    if (!selectedClassForTimetable) return;

    const startTime = extractTimeForApi(customSlotDraft.start_time);
    const endTime = extractTimeForApi(customSlotDraft.end_time);
    const label = String(customSlotDraft.label || "").trim();

    if (!startTime || !endTime) {
      toast.error("Start and end time are required for custom slots.");
      return;
    }

    if (startTime >= endTime) {
      toast.error("End time must be after start time.");
      return;
    }

    const duplicate = customLessonSlots.some(
      (slot) =>
        extractTimeForApi(slot.start_time) === startTime &&
        extractTimeForApi(slot.end_time) === endTime,
    );
    if (duplicate) {
      toast.error("That lesson time slot already exists.");
      return;
    }

    const nextSlots = [
      ...customLessonSlots,
      {
        id: createTemplateId(),
        label: label || `Period ${customLessonSlots.length + 1}`,
        start_time: startTime,
        end_time: endTime,
      },
    ];

    const normalized = normalizeTemplateSlots(nextSlots);
    setCustomLessonSlots(normalized);
    persistTemplateSlots(selectedClassForTimetable.id, normalized);
    setCustomSlotDraft({ label: "", start_time: "", end_time: "" });
    toast.success("Custom lesson slot added.");
  };

  const handleDeleteCustomLessonSlot = (templateId) => {
    if (!selectedClassForTimetable) return;
    const nextSlots = customLessonSlots.filter((slot) => slot.id !== templateId);
    setCustomLessonSlots(nextSlots);
    persistTemplateSlots(selectedClassForTimetable.id, nextSlots);
  };

  const loadClassStudents = async (classId) => {
    try {
      setStudentsLoading(true);
      const classData = classes.find((cls) => cls.id === classId);
      setSelectedClass({
        id: classId,
        name: getDisplayClassName(classData),
      });
      
      const response = await apiService.getTeacherStudents(classId);
      setClassStudents(response.students || []);
      setDialogOpen(true);
    } catch (err) {
      console.error("Error loading class students:", err);
      toast.error("Failed to load students for this class");
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedClass(null);
    setClassStudents([]);
    setStudentSearch("");
  };

  const handleMarkAttendance = (classId) => {
    const classData = classes.find(cls => cls.id === classId);
    if (classData) {
      setSelectedClassForAttendance(classData);
      setAttendanceFormOpen(true);
    }
  };

  const handleEnterGrades = (classId) => {
    const classData = classes.find(cls => cls.id === classId);
    if (classData) {
      setSelectedClassForGrades(classData);
      setGradeFocusStudentId(null);
      setGradeEntryOpen(true);
    }
  };

  const handleViewGrades = (classId) => {
    const classData = classes.find(cls => cls.id === classId);
    if (classData) {
      setSelectedClassForViewing(classData);
      setGradeViewingOpen(true);
    }
  };

  const handleViewStudentProfile = (student) => {
    setSelectedStudent(student);
    setStudentDetailsOpen(true);
  };

  const handleGradeEntrySuccess = () => {
    toast.success("Grades saved successfully!");
    // Optionally reload classes data to reflect any changes
    loadClasses();
  };

  const handleAttendanceSuccess = () => {
    toast.success("Attendance recorded successfully!");
    // Optionally reload classes data to reflect any changes
    loadClasses();
  };

  const formatGradeLevel = (gradeLevel) => {
    if (!gradeLevel) return "N/A";
    return gradeLevel.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getDisplayClassName = (classItem) => {
    if (!classItem) return "Class";
    const rawName = String(classItem.name || "").trim();
    const generatedName = `${formatGradeLevel(classItem.grade_level)}${
      classItem.section ? ` - Section ${classItem.section}` : ""
    }`;

    if (!rawName) return generatedName;
    if (/dashboard demo class|demo class/i.test(rawName)) return generatedName;
    return rawName;
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }

    return age;
  };

  const getClassStatusColor = (isActive) => {
    return isActive ? "success" : "default";
  };

  const getClassStatusLabel = (isActive) => {
    return isActive ? "Active" : "Inactive";
  };

  const filteredClassStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) {
      return classStudents;
    }

    return classStudents.filter((student) => {
      const fullName = `${student.first_name || ""} ${student.last_name || ""}`
        .trim()
        .toLowerCase();
      const studentId = String(student.student_id || "").toLowerCase();
      return fullName.includes(term) || studentId.includes(term);
    });
  }, [classStudents, studentSearch]);

  const timetableSlotLookup = useMemo(() => {
    const grouped = TIMETABLE_DAYS.reduce((acc, day) => {
      acc[day] = {};
      return acc;
    }, {});

    for (const slot of timetableSlots) {
      const day = String(slot.day_of_week || "").toLowerCase();
      const slotKey = buildTemplateKey(slot.start_time, slot.end_time);
      if (!grouped[day] || !slotKey || slotKey === "-") continue;
      grouped[day][slotKey] = slot;
    }

    return grouped;
  }, [timetableSlots]);

  const offGridTimetableSlots = useMemo(() => {
    const templateKeys = new Set(
      customLessonSlots.map((slot) => buildTemplateKey(slot.start_time, slot.end_time)),
    );
    return timetableSlots.filter(
      (slot) => !templateKeys.has(buildTemplateKey(slot.start_time, slot.end_time)),
    );
  }, [timetableSlots, customLessonSlots]);

  const policyConflictingTemplateCount = useMemo(() => {
    if (!timetablePolicy) return 0;
    return customLessonSlots.filter(
      (slot) =>
        intervalsOverlapForUi(
          slot.start_time,
          slot.end_time,
          timetablePolicy.break_start,
          timetablePolicy.break_end,
        ) ||
        intervalsOverlapForUi(
          slot.start_time,
          slot.end_time,
          timetablePolicy.lunch_start,
          timetablePolicy.lunch_end,
        ),
    ).length;
  }, [customLessonSlots, timetablePolicy]);

  const handleQuickAction = () => {
    if (classes.length === 0) {
      toast.error("No classes available for quick action.");
      return;
    }

    const firstClass = classes[0];
    setSelectedClassForGrades(firstClass);
    setGradeFocusStudentId(null);
    setGradeEntryOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, maxWidth: 1240, mx: "auto" }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Skeleton variant="text" width="35%" height={44} />
          <Skeleton variant="text" width="45%" />
        </Paper>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Grid item xs={12} sm={4} key={index}>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="60%" height={46} />
              </Grid>
            ))}
          </Grid>
        </Paper>
        <Grid container spacing={3}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="55%" />
                  <Skeleton variant="text" width="65%" />
                  <Skeleton variant="rounded" width="100%" height={12} sx={{ mt: 2 }} />
                  <Skeleton variant="rounded" width="100%" height={34} sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1240, mx: "auto" }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 3,
          color: "#f8fbff",
          background:
            "linear-gradient(130deg, #1d3557 0%, #2a6f97 48%, #4ea8de 100%)",
          boxShadow: "0 16px 32px rgba(15, 23, 42, 0.2)",
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          My Classes
        </Typography>
        <Typography variant="body1" sx={{ mt: 0.6, opacity: 0.95 }}>
          Manage students, attendance, and grades from one workspace.
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Class Setup
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create classes for your school and manage each class timetable.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          disabled={classOptionsLoading}
          onClick={() => setCreateClassOpen(true)}
        >
          Create Class
        </Button>
      </Paper>

      {/* Summary Stats */}
      <Paper
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.07)",
        }}
      >
        <Typography variant="h6" gutterBottom>
          Classroom Overview
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" component="div" color="primary.main">
                {classes.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Classes
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" component="div" color="success.main">
                {classes.reduce((total, cls) => total + (cls.current_enrollment || 0), 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Students
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" component="div" color="info.main">
                {classes.filter(cls => cls.is_active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Classes
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Classes Grid */}
      {classes.length === 0 ? (
        <Paper
          sx={{
            p: 4,
            textAlign: "center",
            borderRadius: 3,
            border: "1px dashed",
            borderColor: "divider",
          }}
        >
          <School sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Classes Assigned
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You don't have any classes assigned yet. Contact your administrator if this seems incorrect.
          </Typography>
          <Button sx={{ mt: 2 }} variant="outlined" onClick={loadClasses}>
            Refresh Assignments
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {classes.map((classItem) => (
            <Grid item xs={12} sm={6} md={4} key={classItem.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="div" gutterBottom>
                        {getDisplayClassName(classItem)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {formatGradeLevel(classItem.grade_level)} | Section {classItem.section}
                      </Typography>
                    </Box>
                    <Chip
                      label={getClassStatusLabel(classItem.is_active)}
                      color={getClassStatusColor(classItem.is_active)}
                      size="small"
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Enrollment
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {classItem.current_enrollment || 0} / {classItem.max_capacity || "N/A"}
                      </Typography>
                    </Box>
                    {classItem.max_capacity && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(((classItem.current_enrollment || 0) / classItem.max_capacity) * 100, 100)}
                        color={
                          (classItem.current_enrollment || 0) / classItem.max_capacity > 0.9
                            ? "warning"
                            : "primary"
                        }
                        sx={{ height: 7, borderRadius: 3 }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                    <Chip
                      icon={<Group />}
                      label={`${classItem.current_enrollment || 0} Students`}
                      size="small"
                      variant="outlined"
                    />
                    {classItem.subject && (
                      <Chip
                        icon={<Book />}
                        label={classItem.subject}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                  </Box>

                  {classItem.School && (
                    <Typography variant="body2" color="text.secondary">
                      <School fontSize="small" sx={{ mr: 1, verticalAlign: "middle" }} />
                      {classItem.School.name}
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Group />}
                      onClick={() => loadClassStudents(classItem.id)}
                      size="small"
                    >
                      View Students
                    </Button>
                    
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1,
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        alignItems: "stretch",
                      }}
                    >
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Schedule />}
                        onClick={() => handleMarkAttendance(classItem.id)}
                        size="small"
                        sx={{ minHeight: 36 }}
                      >
                        Attendance
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Grade />}
                        onClick={() => handleEnterGrades(classItem.id)}
                        size="small"
                        sx={{ minHeight: 36 }}
                      >
                        Enter Grades
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Event />}
                        onClick={() => loadClassTimetable(classItem)}
                        size="small"
                        sx={{ minHeight: 36 }}
                      >
                        Timetable
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Assessment />}
                        onClick={() => handleViewGrades(classItem.id)}
                        size="small"
                        sx={{ minHeight: 36 }}
                      >
                        View Grades
                      </Button>
                    </Box>

                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => handleRequestDeleteClass(classItem)}
                      size="small"
                    >
                      Delete Class
                    </Button>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Class Students Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: "70vh" }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="h6" component="div">
                {selectedClass?.name} - Students
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredClassStudents.length} of {classStudents.length} student
                {classStudents.length !== 1 ? "s" : ""} shown
              </Typography>
            </Box>
            <IconButton onClick={handleCloseDialog}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3 }}>
          {studentsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : classStudents.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Person sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Students Enrolled
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This class doesn't have any students enrolled yet.
              </Typography>
            </Box>
          ) : (
            <Box>
              <TextField
                fullWidth
                size="small"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search student by name or ID"
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              {filteredClassStudents.length === 0 ? (
                <Paper
                  sx={{
                    p: 3,
                    textAlign: "center",
                    borderRadius: 2,
                    border: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="body1" sx={{ mb: 0.6 }}>
                    No students match your search
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try a different name or student ID.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer
                  sx={{
                    maxHeight: 430,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Student ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Grade Level</TableCell>
                    <TableCell>Enrollment Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClassStudents.map((student) => (
                    <TableRow key={student.id} hover>
                      <TableCell>{student.student_id || "N/A"}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Avatar sx={{ mr: 2, bgcolor: "primary.main" }}>
                            {(student.first_name?.[0] || "S").toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {student.first_name} {student.last_name}
                            </Typography>
                            {student.date_of_birth && (
                              <Typography variant="caption" color="text.secondary">
                                Age: {calculateAge(student.date_of_birth)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{formatGradeLevel(student.grade_level)}</TableCell>
                      <TableCell>
                        {student.enrollment_date 
                          ? new Date(student.enrollment_date).toLocaleDateString()
                          : "N/A"
                        }
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Student Profile">
                          <IconButton
                            size="small"
                            onClick={() => handleViewStudentProfile(student)}
                          >
                            <Person />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog}>Close</Button>
          {selectedClass && (
            <>
              <Button
                variant="outlined"
                startIcon={<Schedule />}
                onClick={() => {
                  handleMarkAttendance(selectedClass.id);
                  handleCloseDialog();
                }}
              >
                Mark Attendance
              </Button>
              <Button
                variant="outlined"
                startIcon={<Grade />}
                onClick={() => {
                  handleEnterGrades(selectedClass.id);
                  handleCloseDialog();
                }}
              >
                Enter Grades
              </Button>
              <Button
                variant="contained"
                startIcon={<Assessment />}
                onClick={() => {
                  handleViewGrades(selectedClass.id);
                  handleCloseDialog();
                }}
              >
                View Grades
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={classDeleteDialogOpen}
        onClose={handleCancelDeleteClass}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Class</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will remove the class from your active list and unassign its students.
          </Alert>
          <Typography variant="body2">
            {classPendingDelete
              ? `Delete ${getDisplayClassName(classPendingDelete)}?`
              : "Delete this class?"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDeleteClass} disabled={classDeleteLoading}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeleteClass}
            disabled={classDeleteLoading}
          >
            {classDeleteLoading ? "Deleting..." : "Delete Class"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createClassOpen}
        onClose={() => {
          if (!creatingClass) {
            setCreateClassOpen(false);
            setCreateClassErrors({});
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Class</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            School: {classOptions.school?.name || "Your school"}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth error={Boolean(createClassErrors.grade_level)}>
                <InputLabel>Grade Level</InputLabel>
                <Select
                  value={createClassForm.grade_level}
                  label="Grade Level"
                  onChange={(event) => {
                    const gradeLevel = event.target.value;
                    const recommendedCapacity = Number(
                      classOptions.grade_student_counts?.[gradeLevel] || 0,
                    );
                    setCreateClassForm((prev) => ({
                      ...prev,
                      grade_level: gradeLevel,
                      capacity: recommendedCapacity > 0 ? recommendedCapacity : prev.capacity,
                    }));
                  }}
                >
                  {classOptions.allowed_grade_levels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{createClassErrors.grade_level}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={Boolean(createClassErrors.section)}>
                <InputLabel>Section</InputLabel>
                <Select
                  value={createClassForm.section}
                  label="Section"
                  onChange={(event) =>
                    setCreateClassForm((prev) => ({
                      ...prev,
                      section: event.target.value,
                    }))
                  }
                >
                  {(classOptions.default_sections || ["A", "B"]).map((section) => (
                    <MenuItem key={section} value={section}>
                      {section}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{createClassErrors.section}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Capacity"
                value={createClassForm.capacity}
                onChange={(event) =>
                  setCreateClassForm((prev) => ({
                    ...prev,
                    capacity: event.target.value,
                  }))
                }
                error={Boolean(createClassErrors.capacity)}
                helperText={
                  createClassErrors.capacity ||
                  (Number(classOptions.grade_student_counts?.[createClassForm.grade_level] || 0) >
                  0
                    ? `Student list for ${createClassForm.grade_level}: ${classOptions.grade_student_counts?.[createClassForm.grade_level]} students`
                    : "No student count found for this grade yet")
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="School Year"
                placeholder="2025-2026"
                value={createClassForm.school_year}
                onChange={(event) =>
                  setCreateClassForm((prev) => ({
                    ...prev,
                    school_year: event.target.value,
                  }))
                }
                error={Boolean(createClassErrors.school_year)}
                helperText={createClassErrors.school_year}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Class Name (Optional)"
                value={createClassForm.name}
                onChange={(event) =>
                  setCreateClassForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button disabled={creatingClass} onClick={() => setCreateClassOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={creatingClass}
            onClick={handleCreateClass}
          >
            {creatingClass ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={timetableOpen}
        onClose={() => {
          if (!timetableSaving) {
            setTimetableOpen(false);
            setSelectedClassForTimetable(null);
            setTimetableSlots([]);
            setTimetablePolicy(null);
            setPolicyForm(DEFAULT_POLICY_FORM);
            setPolicySaving(false);
            setTimetableForm(DEFAULT_TIMETABLE_FORM);
            setTimetableViewMode("sheet");
            setCustomLessonSlots([]);
            setCustomSlotDraft({ label: "", start_time: "", end_time: "" });
            setDragPayload(null);
            setDragOverCell(null);
          }
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedClassForTimetable
            ? `${getDisplayClassName(selectedClassForTimetable)} Timetable`
            : "Class Timetable"}
        </DialogTitle>
        <DialogContent>
          <Paper
            sx={{
              p: 2,
              mb: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1.2 }}>
              School Timetable Policy
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              Break and lunch times are enforced for all lesson slots in this school.
            </Typography>

            <Grid container spacing={1.2}>
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="Day Start"
                  value={policyForm.school_day_start}
                  onChange={(event) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      school_day_start: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="Day End"
                  value={policyForm.school_day_end}
                  onChange={(event) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      school_day_end: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="Break Start"
                  value={policyForm.break_start}
                  onChange={(event) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      break_start: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="Break End"
                  value={policyForm.break_end}
                  onChange={(event) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      break_end: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="Lunch Start"
                  value={policyForm.lunch_start}
                  onChange={(event) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      lunch_start: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="Lunch End"
                  value={policyForm.lunch_end}
                  onChange={(event) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      lunch_end: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleSavePolicy}
                disabled={policySaving || timetableSaving}
              >
                {policySaving ? "Saving..." : "Save Policy"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleGenerateTemplateSlotsFromPolicy}
              >
                Regenerate Period Boxes
              </Button>
            </Box>
          </Paper>

          <Paper
            sx={{
              p: 2,
              mb: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Add Timetable Slot
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Day</InputLabel>
                  <Select
                    value={timetableForm.day_of_week}
                    label="Day"
                    onChange={(event) =>
                      setTimetableForm((prev) => ({
                        ...prev,
                        day_of_week: event.target.value,
                      }))
                    }
                  >
                    {["monday", "tuesday", "wednesday", "thursday", "friday"].map((day) => (
                      <MenuItem key={day} value={day}>
                        {dayLabel(day)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="Start"
                  value={timetableForm.start_time}
                  onChange={(event) =>
                    setTimetableForm((prev) => ({
                      ...prev,
                      start_time: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="time"
                  label="End"
                  value={timetableForm.end_time}
                  onChange={(event) =>
                    setTimetableForm((prev) => ({
                      ...prev,
                      end_time: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={4} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={timetableForm.slot_type}
                    label="Type"
                    onChange={(event) =>
                      setTimetableForm((prev) => ({
                        ...prev,
                        slot_type: event.target.value,
                      }))
                    }
                  >
                    {["lesson", "assembly", "break", "lunch"].map((type) => (
                      <MenuItem key={type} value={type}>
                        {dayLabel(type)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Subject</InputLabel>
                  <Select
                    value={timetableForm.subject_id}
                    label="Subject"
                    onChange={(event) =>
                      setTimetableForm((prev) => ({
                        ...prev,
                        subject_id: event.target.value,
                      }))
                    }
                    disabled={timetableForm.slot_type !== "lesson"}
                  >
                    {(classOptions.subjects || []).map((subject) => (
                      <MenuItem key={subject.id} value={subject.id}>
                        {subject.code} - {subject.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Room"
                  value={timetableForm.room}
                  onChange={(event) =>
                    setTimetableForm((prev) => ({
                      ...prev,
                      room: event.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={12} sm={4} md={1}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleCreateTimetableSlot}
                  disabled={timetableSaving}
                  sx={{ height: 40 }}
                >
                  Add
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Paper
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Tabs
              value={timetableViewMode}
              onChange={(_, value) => setTimetableViewMode(value)}
              sx={{ borderBottom: "1px solid", borderColor: "divider", px: 1 }}
            >
              <Tab value="sheet" label="Weekly Sheet" />
              <Tab value="manage" label="Manage Slots" />
            </Tabs>

            <Box sx={{ p: 2 }}>
              {timetableLoading ? (
                <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                  <CircularProgress />
                </Box>
              ) : timetableViewMode === "sheet" ? (
                <Box>
                  <Alert severity="info" sx={{ mb: 1.5 }}>
                    Build your lesson-time boxes below, then drag a subject or lesson card into
                    a specific day and time cell.
                  </Alert>

                  <Paper
                    sx={{
                      p: 1.5,
                      mb: 1.5,
                      border: "1px dashed",
                      borderColor: "divider",
                      bgcolor: "background.default",
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.2 }}>
                      Custom Lesson Time Slots
                    </Typography>
                    <Grid container spacing={1.2} sx={{ mb: 1 }}>
                      <Grid item xs={12} sm={5} md={5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Label (optional)"
                          placeholder="Period 1"
                          value={customSlotDraft.label}
                          onChange={(event) =>
                            setCustomSlotDraft((prev) => ({
                              ...prev,
                              label: event.target.value,
                            }))
                          }
                        />
                      </Grid>
                      <Grid item xs={6} sm={3} md={2}>
                        <TextField
                          fullWidth
                          size="small"
                          type="time"
                          label="Start"
                          value={customSlotDraft.start_time}
                          onChange={(event) =>
                            setCustomSlotDraft((prev) => ({
                              ...prev,
                              start_time: event.target.value,
                            }))
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3} md={2}>
                        <TextField
                          fullWidth
                          size="small"
                          type="time"
                          label="End"
                          value={customSlotDraft.end_time}
                          onChange={(event) =>
                            setCustomSlotDraft((prev) => ({
                              ...prev,
                              end_time: event.target.value,
                            }))
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4} md={3}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={handleAddCustomLessonSlot}
                          sx={{ height: 40 }}
                        >
                          Add Time Slot
                        </Button>
                      </Grid>
                    </Grid>

                    {customLessonSlots.length > 0 ? (
                      <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
                        {customLessonSlots.map((slot, index) => (
                          <Chip
                            key={slot.id}
                            label={`${slot.label || `Period ${index + 1}`} (${formatTimeLabel(slot.start_time)}-${formatTimeLabel(slot.end_time)})`}
                            onDelete={() => handleDeleteCustomLessonSlot(slot.id)}
                            color="default"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Add at least one time slot to start drag and drop planning.
                      </Typography>
                    )}

                    {policyConflictingTemplateCount > 0 && (
                      <Alert severity="warning" sx={{ mt: 1.2 }}>
                        {policyConflictingTemplateCount} custom lesson period(s) overlap current
                        break/lunch windows.
                      </Alert>
                    )}
                  </Paper>

                  <Paper
                    sx={{
                      p: 1.2,
                      mb: 1.5,
                      border: "1px dashed",
                      borderColor: "divider",
                      bgcolor: "background.default",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.8 }}>
                      Lesson Bank (Drag into timetable cells)
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
                      {(classOptions.subjects || []).map((subject) => (
                        <Chip
                          key={subject.id}
                          label={`${subject.code} - ${subject.name}`}
                          color="primary"
                          variant="outlined"
                          draggable
                          onDragStart={(event) => handleDragStartSubject(subject, event)}
                          onDragEnd={handleDragEnd}
                          sx={{ cursor: "grab" }}
                        />
                      ))}
                    </Box>
                  </Paper>

                  {customLessonSlots.length === 0 ? (
                    <Paper
                      sx={{
                        p: 2.5,
                        textAlign: "center",
                        border: "1px dashed",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Add custom lesson slots to display timetable boxes.
                      </Typography>
                    </Paper>
                  ) : (
                    <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ minWidth: 180 }}>Time Slot</TableCell>
                            {TIMETABLE_DAYS.map((day) => (
                              <TableCell key={day} align="center" sx={{ minWidth: 170 }}>
                                {dayLabel(day)}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {customLessonSlots.map((templateSlot, index) => (
                            <TableRow key={templateSlot.id}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {templateSlot.label || `Period ${index + 1}`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatTimeLabel(templateSlot.start_time)}-
                                  {formatTimeLabel(templateSlot.end_time)}
                                </Typography>
                              </TableCell>
                              {TIMETABLE_DAYS.map((day) => {
                                const slotKey = buildTemplateKey(
                                  templateSlot.start_time,
                                  templateSlot.end_time,
                                );
                                const slot = timetableSlotLookup[day]?.[slotKey] || null;
                                const isDropTarget =
                                  dragOverCell?.day === day &&
                                  dragOverCell?.templateId === templateSlot.id;

                                return (
                                  <TableCell
                                    key={`${templateSlot.id}_${day}`}
                                    onDragOver={(event) => handleCellDragOver(day, templateSlot, event)}
                                    onDrop={(event) => handleCellDrop(day, templateSlot, event)}
                                    onDragLeave={() => setDragOverCell(null)}
                                    sx={{
                                      bgcolor: isDropTarget ? "#eef5ff" : "inherit",
                                      border: "1px solid",
                                      borderColor: isDropTarget ? "primary.main" : "divider",
                                      verticalAlign: "top",
                                      transition: "all 0.15s ease",
                                    }}
                                  >
                                    {slot ? (
                                      <Paper
                                        draggable={slot.slot_type === "lesson"}
                                        onDragStart={(event) => handleDragStartSlot(slot, event)}
                                        onDragEnd={handleDragEnd}
                                        sx={{
                                          p: 0.9,
                                          border: "1px solid",
                                          borderColor: "divider",
                                          borderLeft: "4px solid",
                                          borderLeftColor:
                                            slot.slot_type === "lesson"
                                              ? "primary.main"
                                              : slot.slot_type === "break"
                                                ? "warning.main"
                                                : slot.slot_type === "lunch"
                                                  ? "success.main"
                                                  : "info.main",
                                          bgcolor: "white",
                                          cursor:
                                            slot.slot_type === "lesson" ? "grab" : "default",
                                          opacity:
                                            dragPayload?.type === "slot" &&
                                            dragPayload?.slotId === slot.id
                                              ? 0.65
                                              : 1,
                                        }}
                                      >
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {slot.Subject
                                            ? `${slot.Subject.code} - ${slot.Subject.name}`
                                            : dayLabel(slot.slot_type)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {dayLabel(slot.slot_type)}
                                          {slot.room ? ` | Room ${slot.room}` : ""}
                                        </Typography>
                                      </Paper>
                                    ) : (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: "block", py: 1.2, textAlign: "center" }}
                                      >
                                        Drop lesson
                                      </Typography>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {offGridTimetableSlots.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      {offGridTimetableSlots.length} timetable slot(s) are off-grid for the
                      current custom time-box set. Add matching custom slots to show them in the
                      sheet.
                    </Alert>
                  )}
                </Box>
              ) : timetableSlots.length === 0 ? (
                <Paper
                  sx={{
                    p: 3,
                    textAlign: "center",
                    border: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No timetable slots yet.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Day</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell>Room</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {timetableSlots.map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell>{dayLabel(slot.day_of_week)}</TableCell>
                          <TableCell>
                            {formatTimeLabel(slot.start_time)} - {formatTimeLabel(slot.end_time)}
                          </TableCell>
                          <TableCell>{dayLabel(slot.slot_type)}</TableCell>
                          <TableCell>
                            {slot.Subject
                              ? `${slot.Subject.code} - ${slot.Subject.name}`
                              : "-"}
                          </TableCell>
                          <TableCell>{slot.room || "-"}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteTimetableSlot(slot.id)}
                              disabled={timetableDeleteId === slot.id}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTimetableOpen(false);
              setSelectedClassForTimetable(null);
              setTimetableSlots([]);
              setTimetablePolicy(null);
              setPolicyForm(DEFAULT_POLICY_FORM);
              setPolicySaving(false);
              setTimetableForm(DEFAULT_TIMETABLE_FORM);
              setTimetableViewMode("sheet");
              setCustomLessonSlots([]);
              setCustomSlotDraft({ label: "", start_time: "", end_time: "" });
              setDragPayload(null);
              setDragOverCell(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Grade Entry Form Dialog */}
      <GradeEntryForm
        open={gradeEntryOpen}
        onClose={() => {
          setGradeEntryOpen(false);
          setSelectedClassForGrades(null);
          setGradeFocusStudentId(null);
        }}
        classData={selectedClassForGrades}
        focusStudentId={gradeFocusStudentId}
        onSuccess={handleGradeEntrySuccess}
      />

      {/* Attendance Form Dialog */}
      <AttendanceForm
        open={attendanceFormOpen}
        onClose={() => {
          setAttendanceFormOpen(false);
          setSelectedClassForAttendance(null);
        }}
        classData={selectedClassForAttendance}
        onSuccess={handleAttendanceSuccess}
      />

      {/* Grade Viewing Modal */}
      <GradeViewingModal
        open={gradeViewingOpen}
        onClose={() => {
          setGradeViewingOpen(false);
          setSelectedClassForViewing(null);
        }}
        classData={selectedClassForViewing}
      />

      <StudentDetailsModal
        open={studentDetailsOpen}
        onClose={() => {
          setStudentDetailsOpen(false);
          setSelectedStudent(null);
        }}
        student={selectedStudent}
      />

      {/* Floating Action Button for Quick Actions */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: "fixed",
          bottom: 16,
          right: 16,
        }}
        onClick={handleQuickAction}
      >
        <Add />
      </Fab>
    </Box>
  );
};

export default MyClassesPage;
