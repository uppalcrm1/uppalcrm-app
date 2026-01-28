import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { timezoneAPI } from '../services/api'
import toast from 'react-hot-toast'
import './TimezoneSelector.css'

/**
 * TimezoneSelector Component
 * Allows users to select and change their timezone preference
 */
const TimezoneSelector = ({ showLabel = true, className = '' }) => {
  const { timezone, setTimezone } = useAuth()
  const [timezones, setTimezones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTz, setSelectedTz] = useState(timezone)

  // Fetch available timezones on mount
  useEffect(() => {
    const fetchTimezones = async () => {
      try {
        const response = await timezoneAPI.getTimezones()
        setTimezones(response.data || [])
      } catch (error) {
        console.error('Error fetching timezones:', error)
        toast.error('Failed to load timezones')
      } finally {
        setLoading(false)
      }
    }

    fetchTimezones()
  }, [])

  // Update selected timezone when context timezone changes
  useEffect(() => {
    setSelectedTz(timezone)
  }, [timezone])

  const handleChange = async (e) => {
    const newTimezone = e.target.value
    setSelectedTz(newTimezone)

    setSaving(true)
    try {
      await timezoneAPI.setUserTimezone(newTimezone)
      setTimezone(newTimezone)
      toast.success('Timezone updated successfully')
    } catch (error) {
      console.error('Error updating timezone:', error)
      toast.error('Failed to update timezone')
      setSelectedTz(timezone) // Revert to previous timezone
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="timezone-selector loading">Loading timezones...</div>
  }

  return (
    <div className={`timezone-selector ${className}`}>
      {showLabel && (
        <label htmlFor="timezone-select" className="timezone-label">
          Timezone
        </label>
      )}
      <select
        id="timezone-select"
        value={selectedTz}
        onChange={handleChange}
        disabled={saving}
        className="timezone-select"
      >
        {timezones.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label} ({tz.offset})
          </option>
        ))}
      </select>
      {saving && <span className="timezone-saving">Saving...</span>}
    </div>
  )
}

export default TimezoneSelector
