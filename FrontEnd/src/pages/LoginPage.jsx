import React from 'react';
import { Container, Box, Typography, Button, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    navigate('/');
  };

  const handleRegisterClick = () => {
    navigate('/register');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          Inference UI
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Distributed AI Interface
        </Typography>
      </Box>

      <LoginForm onSuccess={handleLoginSuccess} />

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Don't have an account?{' '}
          <Link
            component="button"
            variant="body2"
            onClick={handleRegisterClick}
            sx={{ cursor: 'pointer' }}
          >
            Create one here
          </Link>
        </Typography>
      </Box>
    </Container>
  );
};

export default LoginPage; 