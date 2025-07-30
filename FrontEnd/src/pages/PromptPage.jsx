import React from 'react';
import { Container, Box, Typography } from '@mui/material';
import Navbar from '../components/Navbar';
import PromptForm from '../components/PromptForm';

const PromptPage = () => {
  return (
    <Box>
      <Navbar />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Chat with AI Models
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Ask questions and get intelligent responses from our distributed AI system
          </Typography>
        </Box>

        <PromptForm />
      </Container>
    </Box>
  );
};

export default PromptPage; 