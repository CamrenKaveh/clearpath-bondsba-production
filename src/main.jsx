import React from 'react'
import ReactDOM from 'react-dom/client'
const AppRouter = React.lazy(() => import('./AppRouter.jsx'));
const CashWorkspace = React.lazy(() => import('./cash-workspace/CashWorkspace.jsx'));
const cashRoutes = ['/', '/cash-flow', '/contractor-cash-flow', '/bond-prep'];
const cashPage = !/clearpathsbaloan|clearpathsba/.test(window.location.hostname) && cashRoutes.includes(window.location.pathname.replace(/\/+$/, '') || '/');
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<div style={{ padding: 40 }}>Loading BondSBA…</div>}>
      {cashPage ? <CashWorkspace /> : <AppRouter />}
    </React.Suspense>
  </React.StrictMode>
)
