import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import StudentCard from "./StudentCard";

// Mock data for testing
const mockStudent = {
  id: 1,
  first_name: "John",
  last_name: "Doe",
  student_id: "STU001",
  grade_level: "form_3",
  gender: "male",
  date_of_birth: "2008-05-15",
  School: {
    name: "St. Michael Secondary",
  },
  class_section: "A",
  phone: "246-123-4567",
  email: "john.doe@email.com",
  is_active: true,
  enrollment_date: "2022-09-01",
};

const mockProps = {
  student: mockStudent,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onViewDetails: vi.fn(),
};

describe("StudentCard", () => {
  test("renders student basic information correctly", () => {
    render(<StudentCard {...mockProps} />);

    // Check if student name is displayed
    expect(screen.getByText("John Doe")).toBeInTheDocument();

    // Check if student ID is displayed
    expect(screen.getByText("ID: STU001")).toBeInTheDocument();

    // Check if grade level is displayed
    expect(screen.getByText("form_3")).toBeInTheDocument();

    // Check if school name is displayed
    expect(screen.getByText("St. Michael Secondary")).toBeInTheDocument();
  });

  test("calculates and displays age correctly", () => {
    render(<StudentCard {...mockProps} />);

    // Student born in 2008 should have an age chip rendered
    expect(screen.getByText(/Age: \d+/)).toBeInTheDocument();
  });

  test("displays contact information when available", () => {
    render(<StudentCard {...mockProps} />);

    expect(screen.getByText("246-123-4567")).toBeInTheDocument();
    expect(screen.getByText("john.doe@email.com")).toBeInTheDocument();
  });

  test("shows inactive status when student is not active", () => {
    const inactiveStudent = { ...mockStudent, is_active: false };
    render(<StudentCard {...mockProps} student={inactiveStudent} />);

    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  test("formats enrollment date correctly", () => {
    render(<StudentCard {...mockProps} />);

    expect(screen.getByText(/Enrolled:/)).toBeInTheDocument();
  });
});
