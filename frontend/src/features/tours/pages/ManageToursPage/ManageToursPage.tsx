import React from 'react'
import { Header } from '@/components/layout/Header/Header'
import { useHeaderNavigation } from '@/hooks/useHeaderNavigation'
import '@/features/dashboard/pages/DashboardPage.css'
import './ManageToursPage.css'

export const ManageToursPage: React.FC = () => {
  const headerNav = useHeaderNavigation()

  return (
    <div className="dashboard-page-wrapper">
      <Header {...headerNav} activeTab={undefined} />
      <main className="manage-tours-content">
        <h2>Travel Agent & Admin Portal</h2>
        <p>Welcome to the tour management dashboard.</p>
      </main>
    </div>
  )
}
