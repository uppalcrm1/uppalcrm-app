import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, CheckCircle2, User, Building2, CreditCard, Info, Search } from 'lucide-react';
import { contactsAPI, usersAPI, productsAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import api from '../services/api';

const ConvertLeadModal = ({ lead, onClose, onSubmit, isLoading }) => {
  console.log('🎯 ConvertLeadModal Version: 2.0 - Tab-Based Workflow - Build:', new Date().toISOString());

  const [createAccount, setCreateAccount] = useState(true);
  const [createTransaction, setCreateTransaction] = useState(true);
  const [activeTab, setActiveTab] = useState('contact');
  const [contactMode, setContactMode] = useState('new');
  const [selectedContact, setSelectedContact] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodOptions, setPaymentMethodOptions] = useState([
    'Credit Card', 'Debit Card', 'Bank Transfer', 'PayPal', 'Cash'
  ]); // Default options, will be replaced by field configuration

  // Form state
  const [contactForm, setContactForm] = useState({
    firstName: lead?.first_name || '',
    lastName: lead?.last_name || '',
    email: lead?.email || '',
    phone: lead?.phone || ''
  });

  const [accountForm, setAccountForm] = useState({
    productId: '',
    product: '',
    accountName: `${lead?.first_name || ''} ${lead?.last_name || ''}'s Account`.trim(),
    deviceName: '',
    macAddress: '',
    term: 'Monthly',
    app: lead?.custom_fields?.app || '' // Pre-populate from lead's custom fields
  });

  const [transactionForm, setTransactionForm] = useState({
    paymentMethod: 'Credit Card',
    amount: '',
    currency: 'CAD',
    owner: (lead?.assigned_first_name && lead?.assigned_last_name)
      ? `${lead.assigned_first_name} ${lead.assigned_last_name}`
      : null,
    paymentDate: new Date().toISOString().split('T')[0],
    source: lead?.source_name || lead?.source || 'website',
    term: 'Monthly',
    nextRenewalDate: ''
  });

  // Fetch existing contacts
  const { data: contactsData } = useQuery({
    queryKey: ['contacts', { search: searchTerm }],
    queryFn: () => contactsAPI.getContacts({ search: searchTerm, limit: 50 }),
    enabled: contactMode === 'existing'
  });

  // Fetch users for Owner dropdown
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getUsers()
  });

  // Fetch active products for Product dropdown
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', { active: true }],
    queryFn: () => productsAPI.getProducts(false), // false = only active products
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always' // Refetch when modal opens
  });

  const existingContacts = contactsData?.contacts || [];
  const users = usersData?.users || [];
  const products = productsData?.products || [];
  const defaultProduct = products.find(p => p.is_default);
  const filteredContacts = existingContacts.filter(contact =>
    contact.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Auto-calculate renewal date based on term and payment date
  useEffect(() => {
    if (transactionForm.paymentDate && transactionForm.term) {
      const paymentDate = new Date(transactionForm.paymentDate);
      let renewalDate = new Date(paymentDate);

      switch (transactionForm.term) {
        case 'Monthly':
          renewalDate.setMonth(renewalDate.getMonth() + 1);
          break;
        case 'Quarterly':
          renewalDate.setMonth(renewalDate.getMonth() + 3);
          break;
        case 'Annually':
          renewalDate.setFullYear(renewalDate.getFullYear() + 1);
          break;
      }

      setTransactionForm(prev => ({
        ...prev,
        nextRenewalDate: renewalDate.toISOString().split('T')[0]
      }));
    }
  }, [transactionForm.paymentDate, transactionForm.term]);

  // Sync term between account and transaction
  useEffect(() => {
    setTransactionForm(prev => ({
      ...prev,
      term: accountForm.term
    }));
  }, [accountForm.term]);

  // Fetch payment method field configuration
  useEffect(() => {
    const loadPaymentMethodOptions = async () => {
      try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = Date.now();
        const response = await api.get(`/custom-fields?entity_type=transactions&_t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        const customFields = response.data.customFields || [];
        const systemFields = response.data.systemFields || [];
        const allFields = [...customFields, ...systemFields];

        console.log('📋 All transaction fields:', allFields);

        // Find the payment_method field
        const paymentMethodField = allFields.find(
          field => field.field_name === 'payment_method' || field.field_name === 'paymentMethod'
        );

        console.log('🔍 Payment method field found:', paymentMethodField);
        if (paymentMethodField) {
          console.log('   - Field label:', paymentMethodField.field_label);
          console.log('   - Field type:', paymentMethodField.field_type);
          console.log('   - Field options:', paymentMethodField.field_options);
        }

        if (paymentMethodField && paymentMethodField.field_options && paymentMethodField.field_options.length > 0) {
          // Extract labels from field options
          const options = paymentMethodField.field_options.map(opt =>
            typeof opt === 'string' ? opt : opt.label || opt.value
          );
          setPaymentMethodOptions(options);
          console.log('✅ Loaded payment method options from field config:', options);
        } else {
          console.log('⚠️ No payment_method field found or no options configured, using defaults');
        }
      } catch (error) {
        console.warn('⚠️ Could not load payment method field config, using defaults:', error);
        // Keep default options if API call fails
      }
    };

    loadPaymentMethodOptions();
  }, []);

  // Sync owner when users load - ensure it matches the dropdown options format
  useEffect(() => {
    if (users.length > 0 && lead?.assigned_to) {
      const assignedUser = users.find(u => u.id === lead.assigned_to);
      if (assignedUser) {
        const ownerName = assignedUser.full_name || `${assignedUser.first_name} ${assignedUser.last_name}`;
        setTransactionForm(prev => ({
          ...prev,
          owner: ownerName
        }));
      }
    }
  }, [users, lead?.assigned_to]);

  // Auto-fill transaction amount based on selected product
  useEffect(() => {
    if (accountForm.productId && products.length > 0) {
      const selectedProduct = products.find(p => p.id === accountForm.productId);
      if (selectedProduct?.price) {
        setTransactionForm(prev => ({
          ...prev,
          amount: selectedProduct.price
        }));
      }
    }
  }, [accountForm.productId, products]);

  // Validation functions
  const isContactValid = () => {
    if (contactMode === 'existing') {
      return selectedContact !== '';
    }
    return contactForm.firstName.trim() !== '' &&
           contactForm.lastName.trim() !== '' &&
           (contactForm.email.trim() !== '' || contactForm.phone.trim() !== '');
  };

  const isAccountValid = () => {
    if (!createAccount) return true;
    return accountForm.accountName.trim() !== '' &&
           accountForm.deviceName.trim() !== '' &&
           accountForm.macAddress.trim() !== '';
  };

  const isTransactionValid = () => {
    if (!createTransaction) return true;
    return transactionForm.amount.trim() !== '' &&
           transactionForm.nextRenewalDate.trim() !== '';
  };

  const handleContactNext = () => {
    if (isContactValid()) {
      if (createAccount) {
        setActiveTab('account');
      } else if (createTransaction) {
        setActiveTab('transaction');
      }
    }
  };

  const handleAccountNext = () => {
    if (isAccountValid()) {
      if (createTransaction) {
        setActiveTab('transaction');
      }
    }
  };

  const handleConvert = () => {
    if (isContactValid() && isAccountValid() && isTransactionValid()) {
      const conversionData = {
        leadId: lead.id,
        contactMode,
        existingContactId: contactMode === 'existing' ? selectedContact : null,
        contact: contactMode === 'new' ? contactForm : null,
        createAccount,
        account: createAccount ? accountForm : null,
        createTransaction,
        transaction: createTransaction ? transactionForm : null
      };

      onSubmit(conversionData);
    }
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold">Convert Lead</h2>
            <p className="text-sm text-gray-600 mt-0.5">{lead.full_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* What will be created section */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-blue-900 mb-2">This conversion will create:</div>
              <div className="flex gap-6">
                {contactMode === 'new' ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <User className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span><strong>New Contact</strong></span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <User className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span><strong>Link to Existing Contact</strong></span>
                  </div>
                )}
                {createAccount && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <Building2 className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span><strong>Account</strong></span>
                  </div>
                )}
                {createTransaction && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <CreditCard className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span><strong>Transaction</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <div className="flex-1 px-6 py-4 overflow-y-auto">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('contact')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'contact'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Contact
              </div>
            </button>
            <button
              onClick={() => createAccount && setActiveTab('account')}
              disabled={!createAccount}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'account'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              } ${!createAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Account
                {!createAccount && <span className="text-xs">(disabled)</span>}
              </div>
            </button>
            <button
              onClick={() => createTransaction && setActiveTab('transaction')}
              disabled={!createTransaction}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'transaction'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              } ${!createTransaction ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Transaction
                {!createTransaction && <span className="text-xs">(disabled)</span>}
              </div>
            </button>
          </div>

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              {/* Contact Mode Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setContactMode('new')}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    contactMode === 'new'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      contactMode === 'new' ? 'border-blue-600' : 'border-gray-300'
                    }`}>
                      {contactMode === 'new' && (
                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <span className="text-sm font-medium">Create New Contact</span>
                  </div>
                  <p className="text-xs text-gray-600 ml-6">
                    Create a brand new contact from this lead
                  </p>
                </button>

                <button
                  onClick={() => setContactMode('existing')}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    contactMode === 'existing'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      contactMode === 'existing' ? 'border-blue-600' : 'border-gray-300'
                    }`}>
                      {contactMode === 'existing' && (
                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <span className="text-sm font-medium">Use Existing Contact</span>
                  </div>
                  <p className="text-xs text-gray-600 ml-6">
                    Add another account to an existing contact
                  </p>
                </button>
              </div>

              {/* New Contact Form */}
              {contactMode === 'new' && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">Contact Information</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={contactForm.firstName}
                        onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={contactForm.lastName}
                        onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        placeholder="Not provided"
                        className="input h-9"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">At least one contact method (email or phone) is required</p>
                </div>
              )}

              {/* Existing Contact Selection */}
              {contactMode === 'existing' && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">Select Existing Contact</h3>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search contacts by name or email..."
                        className="input pl-10 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            onClick={() => setSelectedContact(contact.id)}
                            className={`w-full p-3 border-b border-gray-100 last:border-b-0 text-left hover:bg-gray-50 transition-colors ${
                              selectedContact === contact.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                selectedContact === contact.id ? 'border-blue-600' : 'border-gray-300'
                              }`}>
                                {selectedContact === contact.id && (
                                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{contact.full_name}</div>
                                <div className="text-xs text-gray-600 truncate">{contact.email}</div>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-6 text-center text-gray-500">
                          <p className="text-sm">No contacts found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-gray-200">
                <input
                  type="checkbox"
                  id="createAccount"
                  checked={createAccount}
                  onChange={(e) => {
                    setCreateAccount(e.target.checked);
                    if (!e.target.checked && activeTab === 'account') {
                      setActiveTab('contact');
                    }
                  }}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="createAccount" className="cursor-pointer text-sm font-medium">
                    Create Account
                  </label>
                  <p className="text-xs text-gray-600">
                    Create a subscription account for this contact
                  </p>
                </div>
              </div>

              {createAccount && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    Account Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Product *</label>
                      {productsLoading ? (
                        <div className="flex items-center justify-center h-9 border border-gray-300 rounded-lg bg-gray-50">
                          <LoadingSpinner size="sm" />
                        </div>
                      ) : products.length === 0 ? (
                        <div className="h-9 px-3 py-2 border border-yellow-300 rounded-lg bg-yellow-50 text-xs text-yellow-800 flex items-center">
                          No products available
                        </div>
                      ) : (
                        <select
                          value={accountForm.productId}
                          onChange={(e) => {
                            const productId = e.target.value;
                            const selectedProduct = products.find(p => p.id === productId);
                            setAccountForm({
                              ...accountForm,
                              productId,
                              product: selectedProduct?.name || ''
                            });
                          }}
                          className="select h-9"
                          required
                        >
                          <option value="">
                            {defaultProduct ? `${defaultProduct.name} (Default)` : 'Select a product...'}
                          </option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.price ? ` - $${product.price}` : ''}
                              {product.is_default ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Term *</label>
                      <select
                        value={accountForm.term}
                        onChange={(e) => setAccountForm({ ...accountForm, term: e.target.value })}
                        className="select h-9"
                      >
                        <option>Monthly</option>
                        <option>Quarterly</option>
                        <option>Annually</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Account Name *</label>
                      <input
                        type="text"
                        value={accountForm.accountName}
                        onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Device Name *</label>
                      <input
                        type="text"
                        value={accountForm.deviceName}
                        onChange={(e) => setAccountForm({ ...accountForm, deviceName: e.target.value })}
                        placeholder="e.g., Device 001"
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">MAC Address *</label>
                      <input
                        type="text"
                        value={accountForm.macAddress}
                        onChange={(e) => setAccountForm({ ...accountForm, macAddress: e.target.value })}
                        placeholder="00:00:00:00:00:00"
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">App</label>
                      <input
                        type="text"
                        value={accountForm.app}
                        onChange={(e) => setAccountForm({ ...accountForm, app: e.target.value })}
                        placeholder="e.g., smart_stb"
                        className="input h-9"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction Tab */}
          {activeTab === 'transaction' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-gray-200">
                <input
                  type="checkbox"
                  id="createTransaction"
                  checked={createTransaction}
                  onChange={(e) => {
                    setCreateTransaction(e.target.checked);
                    if (!e.target.checked && activeTab === 'transaction') {
                      setActiveTab('contact');
                    }
                  }}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="createTransaction" className="cursor-pointer text-sm font-medium">
                    Create Initial Transaction
                  </label>
                  <p className="text-xs text-gray-600">
                    Record the first payment transaction for this account
                  </p>
                </div>
              </div>

              {createTransaction && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    Payment Method
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method *</label>
                      <select
                        value={transactionForm.paymentMethod}
                        onChange={(e) => setTransactionForm({ ...transactionForm, paymentMethod: e.target.value })}
                        className="select h-9"
                      >
                        {paymentMethodOptions.map((option, index) => (
                          <option key={index} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                      <input
                        type="number"
                        value={transactionForm.amount}
                        onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                        placeholder="0.00"
                        step="0.01"
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Currency *</label>
                      <select
                        value={transactionForm.currency}
                        onChange={(e) => setTransactionForm({ ...transactionForm, currency: e.target.value })}
                        className="select h-9"
                      >
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="USD">USD - US Dollar</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Owner *</label>
                      <select
                        value={transactionForm.owner}
                        onChange={(e) => setTransactionForm({ ...transactionForm, owner: e.target.value })}
                        className="select h-9"
                      >
                        {users.length > 0 ? (
                          users.map(user => (
                            <option key={user.id} value={user.full_name || `${user.first_name} ${user.last_name}`}>
                              {user.full_name || `${user.first_name} ${user.last_name}`}
                            </option>
                          ))
                        ) : (
                          <option value={transactionForm.owner}>{transactionForm.owner}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date *</label>
                      <input
                        type="date"
                        value={transactionForm.paymentDate}
                        onChange={(e) => setTransactionForm({ ...transactionForm, paymentDate: e.target.value })}
                        className="input h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Source *</label>
                      <input
                        type="text"
                        value={transactionForm.source}
                        onChange={(e) => setTransactionForm({ ...transactionForm, source: e.target.value })}
                        className="input h-9"
                        placeholder="Lead source"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Term *</label>
                      <select
                        value={transactionForm.term}
                        onChange={(e) => setTransactionForm({ ...transactionForm, term: e.target.value })}
                        className="select h-9"
                      >
                        <option>Monthly</option>
                        <option>Quarterly</option>
                        <option>Annually</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Next Renewal Date *</label>
                      <input
                        type="date"
                        value={transactionForm.nextRenewalDate}
                        onChange={(e) => setTransactionForm({ ...transactionForm, nextRenewalDate: e.target.value })}
                        className="input h-9"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Transaction will be created with status "Pending" and linked to both contact and account
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Summary */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-1.5">What happens next:</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-gray-700">
                <div className="flex items-start gap-1.5">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Lead status will be set to "Converted"</span>
                </div>
                {contactMode === 'new' ? (
                  <div className="flex items-start gap-1.5">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>A new contact will be created with lead information</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Lead will be linked to the selected existing contact</span>
                  </div>
                )}
                {createAccount && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>A subscription account will be created and linked</span>
                  </div>
                )}
                {createTransaction && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Initial transaction record will be created</span>
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Lead history and notes will be preserved</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              {activeTab === 'contact' && (
                <button
                  className="btn btn-primary btn-md"
                  onClick={handleContactNext}
                  disabled={!isContactValid()}
                >
                  Continue to {createAccount ? 'Account' : createTransaction ? 'Transaction' : 'Review'}
                </button>
              )}
              {activeTab === 'account' && (
                <button
                  className="btn btn-primary btn-md"
                  onClick={handleAccountNext}
                  disabled={!isAccountValid()}
                >
                  Continue to {createTransaction ? 'Transaction' : 'Review'}
                </button>
              )}
              {activeTab === 'transaction' && (
                <button
                  className="btn btn-primary btn-md"
                  onClick={handleConvert}
                  disabled={isLoading || !isContactValid() || !isAccountValid() || !isTransactionValid()}
                >
                  {isLoading ? <LoadingSpinner size="sm" /> : 'Convert Lead'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConvertLeadModal;
