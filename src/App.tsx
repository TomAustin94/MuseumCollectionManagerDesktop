import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import MfaPage from './pages/MfaPage'
import SetupPage from './pages/SetupPage'
import DashboardPage from './pages/DashboardPage'
import ItemsPage from './pages/ItemsPage'
import ItemDetailPage from './pages/ItemDetailPage'
import ItemFormPage from './pages/ItemFormPage'
import CategoriesPage from './pages/CategoriesPage'
import LocationsPage from './pages/LocationsPage'
import ReportsPage from './pages/ReportsPage'
import AdminPage from './pages/AdminPage'
import SettingsPage from './pages/SettingsPage'

function NavigationListener() {
  const navigate = useNavigate()

  useEffect(() => {
    if (window.api?.onNavigate) {
      window.api.onNavigate((path) => navigate(path))
    }
  }, [navigate])

  useEffect(() => {
    if (!window.api?.updater?.onStatus) return
    window.api.updater.onStatus((payload) => {
      if (payload.status === 'checking') {
        toast.loading('Checking for updates…', { id: 'updater' })
      } else if (payload.status === 'available') {
        toast.loading(`Update v${payload.version} available — downloading…`, { id: 'updater' })
      } else if (payload.status === 'downloading') {
        toast.loading(`Downloading update… ${payload.percent ?? 0}%`, { id: 'updater' })
      } else if (payload.status === 'downloaded') {
        toast.success(
          `Update v${payload.version} ready`,
          {
            id: 'updater',
            duration: Infinity,
            action: { label: 'Restart & install', onClick: () => window.api.updater.install() }
          }
        )
      } else if (payload.status === 'not-available') {
        toast.success('You are on the latest version', { id: 'updater', duration: 3000 })
      } else if (payload.status === 'error') {
        toast.error(`Update error: ${payload.error}`, { id: 'updater' })
      }
    })
  }, [])

  return null
}

function App() {
  return (
    <HashRouter>
      <NavigationListener />
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/mfa" element={<MfaPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="items/new" element={<ItemFormPage />} />
          <Route path="items/:id" element={<ItemDetailPage />} />
          <Route path="items/:id/edit" element={<ItemFormPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
      <Toaster richColors position="top-right" />
    </HashRouter>
  )
}

export default App
