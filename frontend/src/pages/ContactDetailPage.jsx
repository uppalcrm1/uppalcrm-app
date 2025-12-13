import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Copy, ChevronDown, ChevronUp,
  MessageSquare, Edit, MoreVertical, Calendar, CheckCircle2,
  CalendarClock, Plus, ClipboardList, Laptop
} from 'lucide-react';
import { contactsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ContactDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [contact, setContact] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Collapsible sections state
  const [sectionsOpen, setSectionsOpen] = useState({
    contactDetails: true,
    accounts: true,
    recentActivity: true
  });

  // Fetch contact details
  useEffect(() => {
    fetchContactDetail();
    fetchInteractions();
  }, [id]);

  const fetchContactDetail = async () => {
    try {
      setLoading(true);
      const response = await contactsAPI.getContactDetail(id);
      setContact(response.contact);
      setAccounts(response.accounts || []);
    } catch (err) {
      setError('Failed to load contact details');
      console.error(err);
      toast.error('Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  const fetchInteractions = async () => {
    try {
      const response = await contactsAPI.getInteractions(id, { limit: 10 });
      setInteractions(response.interactions || []);
    } catch (err) {
      console.error('Failed to load interactions:', err);
    }
  };

  // Toggle section
  const toggleSection = (section) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Get badge color
  const getBadgeColor = (type, value) => {
    const colors = {
      status: {
        active: 'bg-green-100 text-green-700',
        inactive: 'bg-gray-100 text-gray-700',
        prospect: 'bg-blue-100 text-blue-700'
      },
      type: {
        customer: 'bg-purple-100 text-purple-700',
        prospect: 'bg-blue-100 text-blue-700',
        partner: 'bg-indigo-100 text-indigo-700',
        vendor: 'bg-orange-100 text-orange-700'
      },
      priority: {
        low: 'bg-gray-100 text-gray-700',
        medium: 'bg-yellow-100 text-yellow-700',
        high: 'bg-red-100 text-red-700'
      }
    };
    return colors[type]?.[value?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  // Get interaction icon and color
  const getInteractionStyle = (type) => {
    const styles = {
      email: { icon: Mail, color: 'bg-blue-100 text-blue-600' },
      call: { icon: Phone, color: 'bg-green-100 text-green-600' },
      meeting: { icon: Calendar, color: 'bg-purple-100 text-purple-600' },
      note: { icon: MessageSquare, color: 'bg-gray-100 text-gray-600' }
    };
    return styles[type] || styles.note;
  };

  // Format time ago
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  };

  if (loading) return <LoadingSpinner />;
  if (error && !contact) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button onClick={() => navigate('/contacts')} className="btn btn-primary">
            Back to Contacts
          </button>
        </div>
      </div>
    );
  }
  if (!contact) return null;

  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back button and contact info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/contacts')}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium"
              >
                <ArrowLeft size={16} />
                Back to Contacts
              </button>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium">
                <MessageSquare size={16} />
                Message
              </button>
              <button
                onClick={() => navigate(`/contacts/${id}/edit`)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
              >
                <Edit size={16} />
                Edit
              </button>
              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <MoreVertical size={16} />
              </button>
            </div>
          </div>

          {/* Contact Header */}
          <div className="flex items-center gap-4 mt-6">
            {/* Avatar */}
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
              {initials}
            </div>

            {/* Name and Badges */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor('status', contact.status)}`}>
                  {contact.status || 'Active'}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor('type', contact.type)}`}>
                  {contact.type || 'Customer'}
                </span>
                {contact.priority && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor('priority', contact.priority)}`}>
                    {contact.priority} Priority
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Email and Phone Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email Card */}
              {contact.email && (
                <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Email</p>
                      <p className="text-sm font-medium text-gray-900">{contact.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(contact.email, 'Email')}
                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Copy size={16} className="text-gray-600" />
                  </button>
                </div>
              )}

              {/* Phone Card */}
              {contact.phone && (
                <div className="bg-green-50 rounded-lg p-4 flex items-center justify-between border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Phone size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Phone</p>
                      <p className="text-sm font-medium text-gray-900">{contact.phone}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(contact.phone, 'Phone')}
                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Copy size={16} className="text-gray-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Contact Details Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('contactDetails')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <h2 className="text-lg font-semibold text-gray-900">Contact Details</h2>
                {sectionsOpen.contactDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {sectionsOpen.contactDetails && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-6 mt-4">
                    <div>
                      <p className="text-sm text-gray-600">Owner</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {contact.assigned_to_name || 'Admin User'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created Date</p>
                      <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-1">
                        <Calendar size={14} />
                        {contact.created_at ? format(new Date(contact.created_at), 'MMM d, yyyy') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {contact.address || '123 Market St, San Francisco, CA 94103'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tags</p>
                      <div className="flex gap-2 mt-1">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          VIP
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Tech Industry
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accounts Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('accounts')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    {accounts.length}
                  </span>
                </div>
                {sectionsOpen.accounts ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {sectionsOpen.accounts && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <div className="space-y-3 mt-4">
                    {accounts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No accounts found</p>
                    ) : (
                      accounts.slice(0, 2).map((account, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Laptop size={20} className="text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {account.account_name || `Account ${idx + 1}`}
                              </p>
                              <p className="text-xs text-gray-600">
                                MAC: {account.mac_address || `XX:XX:XX:XX:XX:XX`} • Added {account.created_at ? format(new Date(account.created_at), 'MMM yyyy') : 'Recently'}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Active
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Activity Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleSection('recentActivity')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                {sectionsOpen.recentActivity ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {sectionsOpen.recentActivity && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <div className="space-y-3 mt-4">
                    {interactions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                    ) : (
                      interactions.slice(0, 3).map((interaction, idx) => {
                        const style = getInteractionStyle(interaction.interaction_type);
                        const Icon = style.icon;

                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <div className={`w-10 h-10 ${style.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <Icon size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {interaction.subject || `${interaction.interaction_type} ${interaction.direction}`}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {timeAgo(interaction.created_at)} • by {interaction.user_name || 'Admin User'}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Key Metrics Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ChartIcon size={16} />
                Key Metrics
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Lifetime Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${contact.value ? parseFloat(contact.value).toLocaleString() : '0'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Accounts</p>
                    <p className="text-xl font-bold text-gray-900">{accounts.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Open Tasks</p>
                    <p className="text-xl font-bold text-orange-600">3</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Dates Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarClock size={16} />
                Important Dates
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Last Contact</p>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-green-600" />
                    {contact.last_contact_date
                      ? format(new Date(contact.last_contact_date), 'MMM d, yyyy')
                      : format(new Date(), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Next Follow-up</p>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                    <Calendar size={14} className="text-orange-600" />
                    {contact.next_follow_up
                      ? format(new Date(contact.next_follow_up), 'MMM d, yyyy')
                      : 'Not scheduled'}
                  </p>
                  <button className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-2">
                    Reschedule
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-left flex items-center gap-2">
                  <Calendar size={16} />
                  Schedule Meeting
                </button>
                <button className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-left flex items-center gap-2">
                  <ClipboardList size={16} />
                  Create Task
                </button>
                <button className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-left flex items-center gap-2">
                  <Plus size={16} />
                  Add Note
                </button>
              </div>
            </div>

            {/* Task Summary Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Task Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    12
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    3
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple chart icon component
const ChartIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10"></line>
    <line x1="18" y1="20" x2="18" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="16"></line>
  </svg>
);

export default ContactDetailPage;
