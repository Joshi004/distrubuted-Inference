import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  IconButton,
  Tooltip,
  Chip
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  Key as KeyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const ApiTokenModal = ({ open, onClose }) => {
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const { getApiToken } = useAuth();

  const handleGetToken = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await getApiToken();
      
      if (result.success) {
        setApiToken(result.token);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to retrieve API token');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(apiToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy token to clipboard');
    }
  };

  const handleClose = () => {
    setApiToken('');
    setError('');
    setCopied(false);
    setShowToken(false);
    onClose();
  };

  const maskedToken = apiToken ? `${apiToken.substring(0, 8)}${'*'.repeat(Math.max(0, apiToken.length - 16))}${apiToken.substring(Math.max(8, apiToken.length - 8))}` : '';

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <KeyIcon color="primary" />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          API Access Token
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Use this token to access the API directly. Keep it secure and don't share it publicly.
            The token is valid for your current session.
          </Typography>
        </Alert>

        {!apiToken && !loading && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Click the button below to retrieve your current API token
            </Typography>
            <Button
              variant="contained"
              startIcon={<KeyIcon />}
              onClick={handleGetToken}
              size="large"
            >
              Get API Token
            </Button>
          </Box>
        )}

        {loading && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body1" color="text.secondary">
              Retrieving your API token...
            </Typography>
          </Box>
        )}

        {apiToken && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Your API Token:
            </Typography>
            
            <Box sx={{ position: 'relative', mb: 2 }}>
              <TextField
                fullWidth
                multiline
                value={showToken ? apiToken : maskedToken}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title={showToken ? 'Hide token' : 'Show token'}>
                        <IconButton 
                          onClick={() => setShowToken(!showToken)}
                          size="small"
                        >
                          {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={copied ? 'Copied!' : 'Copy token'}>
                        <IconButton 
                          onClick={handleCopyToken}
                          size="small"
                          color={copied ? 'success' : 'default'}
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                }}
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }
                }}
              />
            </Box>

            {copied && (
              <Chip 
                label="Token copied to clipboard!" 
                color="success" 
                size="small"
                sx={{ mb: 2 }}
              />
            )}

            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Important:</strong> This token will expire when you log out. 
                Store it securely and regenerate it by logging in again if needed.
              </Typography>
            </Alert>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Usage Example:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={`curl -X POST http://localhost:3000/inference \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Your AI prompt here"
  }'

Note: The token is automatically used from your current session.`}
                InputProps={{
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.50'
                  }
                }}
              />
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined">
          Close
        </Button>
        {apiToken && (
          <Button 
            onClick={handleGetToken} 
            variant="contained"
            disabled={loading}
          >
            Refresh Token
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ApiTokenModal; 