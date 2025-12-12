import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Building,
  User, FileText, Mail, Phone, Calendar,
  DollarSign, AlertCircle, MapPin
} from 'lucide-react';
import { contactsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ContactForm from '../components/ContactForm';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ContactDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [contact, setContact] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch contact details
  useEffect(() => {
    fetchContactDetail();
  }, [id, refreshKey]);

  const fetchContactDetail = async () => {
    try {
      setLoading(true);
      const response = await contactsAPI.getContactDetail(id);
      const { contact: contactData, accounts: accountsData } = response;

      setContact(contactData);
      setAccounts(accountsData || []);
    } catch (err) {
      setError('Failed to load contact details');
      console.error(err);
      toast.error('Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  // Tabs configuration
  const tabs = [
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'accounts', label: 'Related Accounts', icon: Building }
  ];

  // Handle contact update
  const handleUpdateContact = async (contactData) => {
    try {
      await contactsAPI.updateContact(id, contactData);
      toast.success('Contact updated successfully');
      setShowEditModal(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Update contact error:', err);
      toast.error(err.response?.data?.message || 'Failed to update contact');
    }
  };

  // Handle contact delete
  const handleDeleteContact = async () => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      await contactsAPI.deleteContact(id);
      toast.success('Contact deleted successfully');
      navigate('/contacts');
    } catch (err) {
      console.error('Delete contact error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete contact');
    }
  };

  // Status badge color
  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      prospect: 'bg-blue-100 text-blue-800',
      customer: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Type badge color
  const getTypeColor = (type) => {
    const colors = {
      customer: 'bg-green-100 text-green-800',
      prospect: 'bg-blue-100 text-blue-800',
      partner: 'bg-purple-100 text-purple-800',
      vendor: 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Priority badge color
  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate('/contacts')}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Back to Contacts"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {fullName}
                </h1>
                {contact.company && (
                  <p className="text-sm text-gray-600 mt-1">{contact.company}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(contact.status)}`}>
                    {contact.status || 'Unknown'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(contact.type)}`}>
                    {contact.type || 'Unknown'}
                  </span>
                  {contact.priority && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(contact.priority)}`}>
                      {contact.priority} priority
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit size={16} className="mr-2" />
                Edit
              </button>
              <button
                onClick={handleDeleteContact}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 size={16} className="mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <div className="flex gap-6 border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Contact Information Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <User size={20} />
                      Contact Information
                    </h3>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">First Name</p>
                      <p className="text-sm font-medium text-gray-900">{contact.first_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Name</p>
                      <p className="text-sm font-medium text-gray-900">{contact.last_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <div className="flex items-center gap-1">
                        <Mail size={14} className="text-gray-400" />
                        <a href={`mailto:${contact.email}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {contact.email || 'N/A'}
                        </a>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <div className="flex items-center gap-1">
                        <Phone size={14} className="text-gray-400" />
                        <a href={`tel:${contact.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {contact.phone || 'N/A'}
                        </a>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Title</p>
                      <p className="text-sm font-medium text-gray-900">{contact.title || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Company</p>
                      <div className="flex items-center gap-1">
                        <Building size={14} className="text-gray-400" />
                        <p className="text-sm font-medium text-gray-900">{contact.company || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business Information Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Building size={20} />
                      Business Information
                    </h3>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contact.status)}`}>
                        {contact.status || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(contact.type)}`}>
                        {contact.type || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Priority</p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(contact.priority)}`}>
                        {contact.priority || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Lifetime Value</p>
                      <div className="flex items-center gap-1">
                        <DollarSign size={14} className="text-gray-400" />
                        <p className="text-sm font-medium text-gray-900">
                          {contact.value ? `$${parseFloat(contact.value).toLocaleString()}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Source</p>
                      <p className="text-sm font-medium text-gray-900">{contact.source || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Assigned To</p>
                      <p className="text-sm font-medium text-gray-900">{contact.assigned_to_name || 'Unassigned'}</p>
                    </div>
                  </div>
                </div>

                {/* Activity Information Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Calendar size={20} />
                      Activity Information
                    </h3>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Created At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {contact.created_at ? format(new Date(contact.created_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Updated</p>
                      <p className="text-sm font-medium text-gray-900">
                        {contact.updated_at ? format(new Date(contact.updated_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Contact Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {contact.last_contact_date ? format(new Date(contact.last_contact_date), 'MMM d, yyyy') : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Next Follow Up</p>
                      <p className="text-sm font-medium text-gray-900">
                        {contact.next_follow_up ? format(new Date(contact.next_follow_up), 'MMM d, yyyy h:mm a') : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {contact.notes && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'accounts' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Related Accounts ({accounts.length})</h3>
                </div>
                <div className="p-6">
                  {accounts.length === 0 ? (
                    <div className="text-center py-12">
                      <Building size={48} className="mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-500">No accounts found for this contact</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {accounts.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => navigate(`/accounts/${account.id}`)}
                          className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-base font-semibold text-gray-900">
                                {account.account_name}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                                {account.edition_name && (
                                  <span className="flex items-center gap-1">
                                    <Building size={14} />
                                    {account.edition_name}
                                  </span>
                                )}
                                {account.price && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign size={14} />
                                    ${parseFloat(account.price).toLocaleString()}/{account.billing_cycle || 'month'}
                                  </span>
                                )}
                              </div>
                              {account.next_renewal_date && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Next renewal: {format(new Date(account.next_renewal_date), 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                            <div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                account.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {account.status || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Quick Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Contact Value</p>
                  <p className="text-sm font-medium text-gray-900">
                    {contact.value ? `$${parseFloat(contact.value).toLocaleString()}` : '$0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="text-sm font-medium text-gray-900">
                    {contact.assigned_to_name || 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Accounts</p>
                  <p className="text-sm font-medium text-gray-900">{accounts.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Contact</p>
                  <p className="text-sm font-medium text-gray-900">
                    {contact.last_contact_date
                      ? format(new Date(contact.last_contact_date), 'MMM d, yyyy')
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Related Accounts Preview */}
            {accounts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Accounts ({accounts.length})
                </h3>
                <div className="space-y-2">
                  {accounts.slice(0, 5).map((account) => (
                    <button
                      key={account.id}
                      onClick={() => navigate(`/accounts/${account.id}`)}
                      className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {account.account_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {account.edition_name || account.edition} - {account.status}
                      </p>
                    </button>
                  ))}
                  {accounts.length > 5 && (
                    <button
                      onClick={() => setActiveTab('accounts')}
                      className="text-sm text-blue-600 hover:underline mt-2"
                    >
                      View all {accounts.length} accounts
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ContactForm
              contact={contact}
              onClose={() => setShowEditModal(false)}
              onSubmit={handleUpdateContact}
              users={[]} // You can fetch users if needed
              isLoading={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactDetailPage;
