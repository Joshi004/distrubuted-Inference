# Frontend Architecture Overview

## Technology Stack
- **Framework**: React 18 (Create React App)
- **UI Library**: Material-UI (MUI) v5
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios
- **State Management**: React Context API

## Architecture Pattern
The frontend follows a **component-based architecture** with clear separation of concerns organized into three main layers:

### 1. Application Layer (`src/`)
- **Entry Point**: `index.js` - Application bootstrap
- **Root Component**: `App.js` - Theme provider and global providers setup

### 2. Routing Layer (`components/AppRouter.jsx`)
- **Route Protection**: Implements protected and public routes
- **Authentication Guard**: Redirects based on authentication status
- **Route Structure**:
  - `/` - Main prompt interface (protected)
  - `/login` - User authentication (public)
  - `/register` - User registration (public)

### 3. State Management (`context/`)
- **AuthContext**: Centralized authentication state management
  - Rate limiting information
  - Login/logout/registration operations
  - Session persistence and verification

## Component Architecture

### Pages (`pages/`)
High-level page components that compose the main application views:

- **LoginPage**: Authentication interface
- **RegisterPage**: User registration interface  
- **PromptPage**: Main application interface for AI interactions

### Components (`components/`)
Reusable UI components organized by functionality:

#### Navigation Components
- **Navbar**: Top navigation with user info and actions
- **AppRouter**: Route management and protection logic

#### Form Components
- **LoginForm**: User authentication form
- **RegisterForm**: User registration form
- **PromptForm**: Main AI interaction interface

#### Feature Components
- **ApiTokenModal**: API token generation interface
- **RateLimitDisplay**: Rate limiting status display

## Data Flow Architecture

### Authentication Flow
1. **App Initialization**: AuthContext checks for existing sessions
2. **Route Protection**: AppRouter enforces authentication requirements
3. **State Management**: AuthContext manages user state across components
4. **Session Persistence**: Automatic session verification on app load

### Component Communication
- **Context Consumers**: Components access auth state via `useAuth()` hook
- **Parent-Child**: Props for component configuration
- **HTTP Communication**: Direct API calls via Axios from components

## Component Hierarchy

```
App
├── ThemeProvider (MUI)
├── AuthProvider (Context)
└── AppRouter
    ├── ProtectedRoute
    │   └── PromptPage
    │       ├── Navbar
    │       │   ├── RateLimitDisplay
    │       │   └── ApiTokenModal
    │       └── PromptForm
    └── PublicRoute
        ├── LoginPage
        │   └── LoginForm
        └── RegisterPage
            └── RegisterForm
```

## Design Principles

### Separation of Concerns
- **Pages**: Layout and composition
- **Components**: Specific functionality and UI elements
- **Context**: Global state management
- **Routing**: Navigation and access control

### Component Responsibilities
- **Smart Components**: Pages and forms that manage state and API calls
- **Presentation Components**: UI elements that receive props and display data
- **Context Providers**: Global state and business logic

### Security Architecture
- **Route Protection**: Authentication-based access control
- **Session Management**: Automatic session verification and restoration
- **Token Handling**: Secure API token management
- **Rate Limiting**: Built-in rate limit awareness and display

## Key Features

### Authentication System
- Session-based authentication with automatic restoration
- Protected route implementation
- Logout functionality with state cleanup

### User Interface
- Material Design components for consistent UI
- Responsive design with MUI's Container system
- Loading states and error handling

### API Integration
- Centralized HTTP client configuration
- Error handling and user feedback
- Rate limit integration and monitoring

### State Management
- Context-based global state for authentication
- Local component state for UI interactions
- Session persistence across browser refreshes
