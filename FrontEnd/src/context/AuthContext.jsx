import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true); // New state for app initialization
  const [rateLimitInfo, setRateLimitInfo] = useState(null); // Rate limit information

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3000/login', {
        email,
        password
      });

      if (response.data.success) {
        setToken(response.data.key);
        setUserEmail(response.data.email);
        
        // Store rate limit info if available
        if (response.data.rateLimitInfo) {
          setRateLimitInfo(response.data.rateLimitInfo);
        }
        
        return { success: true };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Login failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Login failed' 
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3000/register', {
        email,
        password
      });

      if (response.data.success) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Registration failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Registration failed' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUserEmail(null);
    setRateLimitInfo(null);
  };

  // Get API token for direct API access
  const getApiToken = async () => {
    try {
      const response = await axios.post('http://localhost:3000/get-api-token');
      
      if (response.data.success) {
        return { 
          success: true, 
          token: response.data.token,
          message: response.data.message 
        };
      } else {
        return { 
          success: false, 
          error: response.data.message || 'Failed to retrieve API token' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to retrieve API token' 
      };
    }
  };

  // Session verification method
  const checkSession = async () => {
    try {
      console.log('🔍 Checking existing session...');
      const response = await axios.post('http://localhost:3000/verify-session');
      
      if (response.data.success && response.data.valid) {
        console.log('✅ Valid session found, restoring authentication');
        setToken('restored'); // We don't get the actual token back, but we know it's valid
        setUserEmail(response.data.email);
        
        // Store rate limit info if available
        if (response.data.rateLimitInfo) {
          setRateLimitInfo(response.data.rateLimitInfo);
        }
        
        return true;
      } else {
        console.log('🚫 No valid session found');
        return false;
      }
    } catch (error) {
      console.log('❌ Session check failed:', error.message);
      return false;
    }
  };

  // Check session on app initialization
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🚀 Initializing authentication...');
      await checkSession();
      setInitializing(false);
      console.log('✅ Authentication initialization complete');
    };

    initializeAuth();
  }, []);

  const value = {
    token,
    userEmail,
    loading,
    initializing,
    rateLimitInfo,
    login,
    register,
    logout,
    checkSession,
    getApiToken,
    isAuthenticated: !!token,
    setRateLimitInfo // Expose this so components can update rate limit info
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 