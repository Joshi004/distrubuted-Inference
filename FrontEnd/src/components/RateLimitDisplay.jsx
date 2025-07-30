import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Paper,
  Tooltip
} from '@mui/material';
import { 
  Speed as SpeedIcon, 
  Timer as TimerIcon,
  Info as InfoIcon 
} from '@mui/icons-material';

const RateLimitDisplay = ({ rateLimitInfo, compact = false, darkMode = false }) => {
  if (!rateLimitInfo) {
    return null;
  }

  const {
    remainingRequests,
    maxRequests,
    nextResetInSeconds,
    windowDurationMinutes
  } = rateLimitInfo;

  const usedRequests = maxRequests - remainingRequests;
  const usagePercentage = (usedRequests / maxRequests) * 100;

  // Format time display
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  // Determine color based on usage
  const getColor = () => {
    if (usagePercentage >= 90) return 'error';
    if (usagePercentage >= 70) return 'warning';
    return 'success';
  };

  if (compact) {
    const chipStyle = darkMode ? {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      color: 'white',
      borderColor: 'rgba(255, 255, 255, 0.4)',
      '& .MuiChip-label': {
        color: 'white',
        fontWeight: 500,
        fontSize: '0.75rem'
      },
      '& .MuiSvgIcon-root': {
        color: 'rgba(255, 255, 255, 0.9)'
      }
    } : {};

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={`${remainingRequests} of ${maxRequests} requests remaining. Resets in ${formatTime(nextResetInSeconds)}`}>
          <Chip
            size="small"
            icon={<SpeedIcon />}
            label={`${remainingRequests}/${maxRequests}`}
            color={darkMode ? 'default' : getColor()}
            variant={darkMode ? 'filled' : 'outlined'}
            sx={chipStyle}
          />
        </Tooltip>
        <Tooltip title={`Next reset in ${formatTime(nextResetInSeconds)}`}>
          <Chip
            size="small"
            icon={<TimerIcon />}
            label={formatTime(nextResetInSeconds)}
            color="default"
            variant={darkMode ? 'filled' : 'outlined'}
            sx={chipStyle}
          />
        </Tooltip>
      </Box>
    );
  }

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 2, 
        backgroundColor: 'background.default',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SpeedIcon color="primary" />
        <Typography variant="h6" component="h3">
          API Rate Limits
        </Typography>
        <Tooltip title={`Rate limits reset every ${windowDurationMinutes} minute${windowDurationMinutes !== 1 ? 's' : ''}`}>
          <InfoIcon fontSize="small" color="action" sx={{ cursor: 'help' }} />
        </Tooltip>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Requests Used
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {usedRequests} / {maxRequests}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={usagePercentage}
          color={getColor()}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Remaining
          </Typography>
          <Typography variant="h6" color={getColor()}>
            {remainingRequests}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Next Reset
          </Typography>
          <Typography variant="h6">
            {formatTime(nextResetInSeconds)}
          </Typography>
        </Box>
      </Box>

      {remainingRequests === 0 && (
        <Box sx={{ mt: 2 }}>
          <Chip
            icon={<TimerIcon />}
            label={`Rate limit exceeded. Try again in ${formatTime(nextResetInSeconds)}`}
            color="error"
            variant="filled"
            size="small"
          />
        </Box>
      )}
    </Paper>
  );
};

export default RateLimitDisplay; 