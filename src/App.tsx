import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import store from './store'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import Admin from './pages/Admin'
import TemplatesGallery from './pages/TemplatesGallery'
import PrivateRoute from './components/PrivateRoute'
import './styles/globals.css'

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Toaster position="top-right" reverseOrder={false} toastOptions={{ style: { fontSize: '0.875rem', fontWeight: 500 } }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/templates" element={<TemplatesGallery />} />
          <Route path="/dashboard" element={<PrivateRoute element={<Dashboard />} />} />
          <Route path="/editor/:projectId" element={<PrivateRoute element={<Editor />} />} />
          <Route path="/admin" element={<PrivateRoute element={<Admin />} requireAdmin />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </Provider>
  )
}

export default App
