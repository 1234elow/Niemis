import React, { createContext, useContext, useReducer, useEffect } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_START":
      return { ...state, loading: true, error: null };
    case "LOGIN_SUCCESS":
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        access: action.payload.access || null,
        token: action.payload.token,
        error: null,
      };
    case "LOGIN_FAILURE":
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
        access: null,
        token: null,
        error: action.payload,
      };
    case "LOGOUT":
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        access: null,
        token: null,
        error: null,
      };
    case "SET_USER":
      return {
        ...state,
        user: action.payload.user || null,
        access: action.payload.access || null,
        isAuthenticated: true,
      };
    default:
      return state;
  }
};

const initialState = {
  user: null,
  access: null,
  token: localStorage.getItem("token"),
  isAuthenticated: false,
  loading: false,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authService.setAuthToken(token);
      // Verify token and get user profile
      authService
        .getProfile()
        .then((response) => {
          dispatch({
            type: "SET_USER",
            payload: {
              user: response.data.user,
              access: response.data.access || null,
            },
          });
        })
        .catch(() => {
          localStorage.removeItem("token");
          authService.setAuthToken(null);
        });
    }
  }, []);

  const login = async (credentials) => {
    dispatch({ type: "LOGIN_START" });
    try {
      const response = await authService.login(credentials);
      const { user, token, access } = response.data;

      localStorage.setItem("token", token);
      authService.setAuthToken(token);

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user, token, access: access || null },
      });

      return response;
    } catch (error) {
      dispatch({
        type: "LOGIN_FAILURE",
        payload: error.response?.data?.error || "Login failed",
      });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    authService.setAuthToken(null);
    dispatch({ type: "LOGOUT" });
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        authService.setAuthToken(token);
        const response = await authService.getProfile();
        dispatch({
          type: "SET_USER",
          payload: {
            user: response.data.user,
            access: response.data.access || null,
          },
        });
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
      localStorage.removeItem("token");
      authService.setAuthToken(null);
    }
  };

  const value = {
    ...state,
    hasPermission: (permission) => {
      if (!permission) return true;
      const permissions = state.access?.permissions || [];
      if (permissions.includes("*")) return true;
      if (permissions.includes(permission)) return true;
      return permissions.some((grantedPermission) => {
        if (typeof grantedPermission !== "string") return false;
        if (!grantedPermission.endsWith(".*")) return false;
        const prefix = grantedPermission.slice(0, -1);
        return permission.startsWith(prefix);
      });
    },
    login,
    logout,
    register,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
