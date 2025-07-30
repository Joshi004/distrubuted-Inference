import React, { useState } from 'react';
import {
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import { Send } from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PromptForm = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated, rateLimitInfo, setRateLimitInfo } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please share something you\'d like to discuss');
      return;
    }

    if (!isAuthenticated) {
      setError('Please sign in to start your conversation with the AI assistant');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await axios.post('http://localhost:3000/inference', {
        prompt: query
        // Note: ClientWorker handles authentication internally via sessionKey
      });
      
      // Check if the response is an error object
      if (result.data && result.data.error) {
        setError(result.data.message || 'An error occurred while processing your request');
        
        // Update rate limit info even for errors (if available)
        if (result.data.rateLimitInfo) {
          setRateLimitInfo(result.data.rateLimitInfo);
        }
      } else {
        // Handle successful response
        const responseText = result.data.response || result.data;
        
        // Update rate limit info from successful response
        if (result.data.rateLimitInfo) {
          setRateLimitInfo(result.data.rateLimitInfo);
        }
        
        // Ensure we're setting a string, not an object
        if (typeof responseText === 'string') {
          setResponse(responseText);
        } else if (typeof responseText === 'object') {
          // If it's still an object, stringify it safely
          setResponse(JSON.stringify(responseText, null, 2));
        } else {
          setResponse(String(responseText));
        }
      }
    } catch (err) {
      // Handle axios errors
      let errorMessage = 'I\'m having trouble connecting right now. Please try again in a moment.';
      
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResponse('');
    setError('');
  };

  return (
    <Box>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              label="What's on your mind?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              placeholder="Share your thoughts, ask questions, or explore new ideas..."
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <Send />}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Thinking...' : 'Send Message'}
            </Button>
          </Box>
          
          {loading && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ mt: 1, textAlign: 'center', fontStyle: 'italic' }}
            >
              Your AI assistant is carefully considering your message...
            </Typography>
          )}
        </form>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {response && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            AI Assistant:
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography 
            variant="body1" 
            component="pre" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit'
            }}
          >
            {response}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default PromptForm; 