// Security utilities for NiEMIS frontend
// Content Security Policy and security headers configuration

/**
 * Content Security Policy configuration for NiEMIS
 * Designed to protect against XSS attacks while allowing necessary resources
 */
export const CSP_CONFIG = {
  // Base directives
  "default-src": ["'self'"],

  // Script sources - allow inline scripts for React development
  "script-src": [
    "'self'",
    "'unsafe-inline'", // Required for React in development
    "'unsafe-eval'", // Required for development tools
    "https://cdn.jsdelivr.net", // CDN for external libraries
    "https://unpkg.com", // CDN fallback
  ],

  // Style sources - allow inline styles for Material-UI
  "style-src": [
    "'self'",
    "'unsafe-inline'", // Required for Material-UI and styled-components
    "https://fonts.googleapis.com", // Google Fonts
    "https://cdn.jsdelivr.net",
  ],

  // Font sources
  "font-src": [
    "'self'",
    "https://fonts.gstatic.com", // Google Fonts
    "data:", // Data URLs for embedded fonts
  ],

  // Image sources
  "img-src": [
    "'self'",
    "data:", // Data URLs for inline images
    "blob:", // Blob URLs for generated images
    "https://*.amazonaws.com", // AWS S3 for file uploads
    "https://picsum.photos", // Placeholder images for development
  ],

  // Connect sources - API endpoints
  "connect-src": [
    "'self'",
    "https://niemis-backend.onrender.com", // Production API
    "http://localhost:5000", // Development API
    "https://api.cloudflare.com", // Potential CDN
    "wss://*.onrender.com", // WebSocket connections
  ],

  // Object sources - disable for security
  "object-src": ["'none'"],

  // Base URI - restrict to same origin
  "base-uri": ["'self'"],

  // Form actions - restrict to same origin
  "form-action": ["'self'"],

  // Frame ancestors - prevent embedding
  "frame-ancestors": ["'none'"],

  // Upgrade insecure requests in production
  "upgrade-insecure-requests": process.env.NODE_ENV === "production",
};

/**
 * Generate CSP header string from configuration
 */
export function generateCSPHeader() {
  const policies = Object.entries(CSP_CONFIG)
    .filter(([key, value]) => {
      // Skip upgrade-insecure-requests if false
      if (key === "upgrade-insecure-requests" && !value) {
        return false;
      }
      return true;
    })
    .map(([key, value]) => {
      if (key === "upgrade-insecure-requests") {
        return key;
      }
      return `${key} ${Array.isArray(value) ? value.join(" ") : value}`;
    });

  return policies.join("; ");
}

/**
 * Security headers configuration for production
 */
export const SECURITY_HEADERS = {
  // Content Security Policy
  "Content-Security-Policy": generateCSPHeader(),

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Prevent clickjacking
  "X-Frame-Options": "DENY",

  // Enable XSS protection
  "X-XSS-Protection": "1; mode=block",

  // Strict Transport Security (HTTPS only)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

  // Referrer Policy
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions Policy (formerly Feature Policy)
  "Permissions-Policy": [
    "geolocation=('self')", // Allow geolocation for school locations
    "microphone=()", // Block microphone access
    "camera=()", // Block camera access
    "payment=()", // Block payment APIs
    "usb=()", // Block USB access
    "magnetometer=()", // Block magnetometer
    "gyroscope=()", // Block gyroscope
    "accelerometer=()", // Block accelerometer
  ].join(", "),
};

/**
 * Apply security headers to the document
 * Used for client-side security enforcement
 */
export function applySecurityHeaders() {
  if (import.meta.env.VITE_ENABLE_CSP !== "true") {
    return;
  }

  // Create meta tag for CSP
  const cspMeta = document.createElement("meta");
  cspMeta.httpEquiv = "Content-Security-Policy";
  cspMeta.content = generateCSPHeader();
  document.head.appendChild(cspMeta);

  // Log security configuration in development
  if (import.meta.env.VITE_DEBUG_MODE === "true") {
    console.log("Security headers applied:", SECURITY_HEADERS);
  }
}

/**
 * Student data encryption utilities
 */
export const StudentDataSecurity = {
  /**
   * Encrypt sensitive student data before storing
   */
  encryptStudentData(data) {
    if (!import.meta.env.VITE_ENABLE_STUDENT_DATA_ENCRYPTION) {
      return data;
    }

    // Simple base64 encoding for demo purposes
    // In production, use proper encryption libraries
    try {
      return btoa(JSON.stringify(data));
    } catch (error) {
      console.error("Failed to encrypt student data:", error);
      return data;
    }
  },

  /**
   * Decrypt student data after retrieval
   */
  decryptStudentData(encryptedData) {
    if (!import.meta.env.VITE_ENABLE_STUDENT_DATA_ENCRYPTION) {
      return encryptedData;
    }

    try {
      return JSON.parse(atob(encryptedData));
    } catch (error) {
      console.error("Failed to decrypt student data:", error);
      return encryptedData;
    }
  },

  /**
   * Sanitize student data for display
   */
  sanitizeStudentData(data) {
    if (!data || typeof data !== "object") {
      return data;
    }

    const sanitized = { ...data };

    // Remove sensitive fields from display
    const sensitiveFields = [
      "national_id",
      "passport_number",
      "medical_conditions",
      "family_income",
      "parent_phone",
      "emergency_contact",
    ];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "[PROTECTED]";
      }
    });

    return sanitized;
  },
};

/**
 * Session timeout management
 */
export const SessionSecurity = {
  /**
   * Set up session timeout for students
   */
  setupSessionTimeout() {
    const timeout = parseInt(
      import.meta.env.VITE_STUDENT_SESSION_TIMEOUT || "1800000",
    ); // 30 minutes

    let timeoutId;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }, timeout);
    };

    // Reset timeout on user activity
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) => {
      document.addEventListener(event, resetTimeout, true);
    });

    // Initial timeout
    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimeout, true);
      });
    };
  },
};

/**
 * Initialize security measures
 */
export function initializeSecurity() {
  // Apply security headers
  applySecurityHeaders();

  // Set up session timeout
  if (import.meta.env.VITE_ENABLE_STUDENT_DATA_ENCRYPTION === "true") {
    SessionSecurity.setupSessionTimeout();
  }

  // Log security initialization
  if (import.meta.env.VITE_DEBUG_MODE === "true") {
    console.log("Security initialized for NiEMIS");
  }
}
