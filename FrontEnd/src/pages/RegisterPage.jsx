import React from 'react';
import { Container, Box, Typography, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';

const RegisterPage = () => {
  const navigate = useNavigate();

  const handleRegisterSuccess = () => {
    // After successful registration, redirect to login
    setTimeout(() => {
      navigate('/login');
    }, 2000); // Give user time to read success message
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          Inference UI
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Create Your Account
        </Typography>
      </Box>

      <RegisterForm onSuccess={handleRegisterSuccess} />

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Already have an account?{' '}
          <Link
            component="button"
            variant="body2"
            onClick={handleLoginClick}
            sx={{ cursor: 'pointer' }}
          >
            Sign in here
          </Link>
        </Typography>
      </Box>
    </Container>
  );
};

export default RegisterPage; 