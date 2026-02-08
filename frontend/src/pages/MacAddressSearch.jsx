import React, { useState, useEffect } from 'react'
import { Search, Loader, CheckCircle, AlertCircle, Download } from 'lucide-react'
import api from '../services/api'

const MacAddressSearch = () => {
  const [macAddress, setMacAddress] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [searchHistory, setSearchHistory] = useState([])
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('search')

  // Fetch search history on mount
  useEffect(() => {
    fetchSearchHistory()
  }, [])

  const fetchSearchHistory = async () => {
    try {
      const { data } = await api.get('/mac-search/history')
      setSearchHistory(data.results || [])
    } catch (err) {
      console.error('Error fetching history:', err)
    }
  }

  const validateMacAddress = (mac) => {
    return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setError(null)
    setResults(null)

    if (!validateMacAddress(macAddress)) {
      setError('Invalid MAC address format. Expected: 00:1A:79:B2:5A:58 or 00-1A-79-B2-5A-58')
      return
    }

    setSearching(true)

    try {
      const { data } = await api.post('/mac-search/search', {
        macAddress: macAddress,
      })

      setResults(data)
      // Refresh history
      fetchSearchHistory()
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  const exportToCSV = (data) => {
    const headers = ['Portal Name', 'Account Name', 'MAC Address', 'Status', 'Expiry Date']
    const rows = data.portalResults
      .flatMap(pr =>
        pr.results.map(r => [
          pr.portalName,
          r.accountName,
          r.macAddress,
          r.status,
          r.expiryDate,
        ])
      )

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mac-search-${macAddress}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Search className="text-blue-600" size={32} />
            MAC Address Search
          </h1>
          <p className="mt-2 text-gray-600">
            Search for MAC addresses across all configured billing portals
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'search'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="bg-white rounded-lg shadow p-6">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={macAddress}
                  onChange={(e) => setMacAddress(e.target.value)}
                  placeholder="Enter MAC address (e.g., 00:1A:79:B2:5A:58)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={searching}
                />
                <button
                  type="submit"
                  disabled={searching || !macAddress.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {searching ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      Search
                    </>
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </form>

            {/* Results */}
            {results && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <CheckCircle size={24} className="text-green-600" />
                        Search Results
                      </h2>
                      <p className="mt-2 text-gray-600">
                        Found <strong>{results.totalFound}</strong> result
                        {results.totalFound !== 1 ? 's' : ''} across{' '}
                        <strong>{results.portalResults.length}</strong> portal
                        {results.portalResults.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {results.totalFound > 0 && (
                      <button
                        onClick={() => exportToCSV(results)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Download size={18} />
                        Export CSV
                      </button>
                    )}
                  </div>
                </div>

                {/* Portal Results */}
                {results.portalResults.map((portalResult, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Portal Header */}
                    <div
                      className={`px-6 py-4 font-semibold ${
                        portalResult.found ? 'bg-green-50 text-green-900' : 'bg-gray-50 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{portalResult.portalName}</span>
                        {portalResult.success ? (
                          <span className={portalResult.found ? 'text-green-600 font-bold' : 'text-gray-500'}>
                            {portalResult.found ? `Found ${portalResult.results.length}` : 'Not found'}
                          </span>
                        ) : (
                          <span className="text-red-600 text-sm">{portalResult.error}</span>
                        )}
                      </div>
                    </div>

                    {/* Portal Results Table */}
                    {portalResult.found && portalResult.results.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-100 border-t border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                                Account Name
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                                MAC Address
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                                Expiry Date
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {portalResult.results.map((result, rIdx) => (
                              <tr key={rIdx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                  {result.accountName}
                                </td>
                                <td className="px-6 py-4 text-sm font-mono text-gray-600">
                                  {result.macAddress}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                      result.status?.toLowerCase() === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : result.status?.toLowerCase() === 'disable'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {result.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                  {result.expiryDate}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!searching && !results && !error && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Search className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">Enter a MAC address and click Search to get started</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {searchHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        MAC Address
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Results Found
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Search Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {searchHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">
                          {item.mac_address}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            {item.total_found} found
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(item.searched_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-600">No search history yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MacAddressSearch
