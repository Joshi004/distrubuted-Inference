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
            AI Assistant
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
            Welcome to your intelligent conversation partner. Share your thoughts, ask questions, 
            or explore ideas together in a natural dialogue.
          </Typography>
        </Box>

        <PromptForm />
      </Container>
    </Box>
  );
};

export default PromptPage; 