import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip
} from '@mui/material';
import { Logout, SmartToy, Key as KeyIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import RateLimitDisplay from './RateLimitDisplay';
import ApiTokenModal from './ApiTokenModal';

const Navbar = () => {
  const { userEmail, logout, rateLimitInfo } = useAuth();
  const [apiTokenModalOpen, setApiTokenModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const handleApiTokenClick = () => {
    setApiTokenModalOpen(true);
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <SmartToy sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Inference UI
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {rateLimitInfo && (
            <RateLimitDisplay rateLimitInfo={rateLimitInfo} compact={true} darkMode={true} />
          )}
          <Chip 
            label={userEmail} 
            variant="outlined" 
            color="default"
            sx={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              fontWeight: 500,
              '& .MuiChip-label': {
                color: 'white'
              }
            }}
          />
          <Button
            color="inherit"
            onClick={handleApiTokenClick}
            startIcon={<KeyIcon />}
            variant="outlined"
            size="small"
            sx={{ 
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.4)',
              fontWeight: 500,
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: 'white'
              },
              '& .MuiButton-startIcon': {
                color: 'white'
              }
            }}
          >
            API Token
          </Button>
          <Button
            color="inherit"
            onClick={handleLogout}
            startIcon={<Logout />}
            variant="outlined"
            sx={{ 
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.4)',
              fontWeight: 500,
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: 'white'
              },
              '& .MuiButton-startIcon': {
                color: 'white'
              }
            }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>

      <ApiTokenModal 
        open={apiTokenModalOpen}
        onClose={() => setApiTokenModalOpen(false)}
      />
    </AppBar>
  );
};

export default Navbar; 