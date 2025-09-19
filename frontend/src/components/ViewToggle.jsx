import React from 'react'
import { Table, Kanban } from 'lucide-react'

const ViewToggle = ({ currentView, onViewChange }) => {
  const views = [
    {
      key: 'list',
      label: 'List View',
      icon: Table,
      description: 'Table format with detailed information'
    },
    {
      key: 'kanban',
      label: 'Kanban View',
      icon: Kanban,
      description: 'Board view organized by status'
    }
  ]

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      {views.map((view) => {
        const Icon = view.icon
        const isActive = currentView === view.key

        return (
          <button
            key={view.key}
            onClick={() => onViewChange(view.key)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
            title={view.description}
            aria-label={view.label}
            aria-pressed={isActive}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ViewToggle