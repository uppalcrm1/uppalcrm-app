# Quick Integration Guide: Soft Delete Components

This guide shows you how to integrate the soft delete functionality into your existing AccountsPage and TransactionsPage.

---

## 🚀 Integrate into AccountsPage

### Step 1: Import the Component and API

Add to the top of `frontend/src/pages/AccountsPage.jsx`:

```javascript
import { AccountActions } from '../components/accounts/AccountActions';
import { accountsAPI } from '../services/api';
```

### Step 2: Add State for Deleted Toggle

```javascript
const [showDeleted, setShowDeleted] = useState(false);
```

### Step 3: Update fetchAccounts Function

```javascript
const fetchAccounts = async () => {
  try {
    setLoading(true);
    const params = {
      includeDeleted: showDeleted,  // Add this line
      limit: 100,
      offset: 0
    };
    const response = await accountsAPI.getAccounts(params);
    setAccounts(response.accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    toast.error('Failed to load accounts');
  } finally {
    setLoading(false);
  }
};

// Re-fetch when showDeleted changes
useEffect(() => {
  fetchAccounts();
}, [showDeleted]);
```

### Step 4: Add Delete and Restore Handlers

```javascript
const handleDeleteAccount = async (accountId, reason) => {
  try {
    await accountsAPI.softDeleteAccount(accountId, reason);
    await fetchAccounts(); // Refresh the list
  } catch (error) {
    throw error; // Let the component handle the error
  }
};

const handleRestoreAccount = async (accountId) => {
  try {
    await accountsAPI.restoreAccount(accountId);
    await fetchAccounts(); // Refresh the list
  } catch (error) {
    throw error; // Let the component handle the error
  }
};
```

### Step 5: Add the Toggle UI

Add this before your accounts table:

```javascript
<div className="flex justify-between items-center mb-4">
  <h1 className="text-2xl font-bold">Accounts</h1>

  {/* Toggle for showing deleted accounts */}
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={showDeleted}
      onChange={(e) => setShowDeleted(e.target.checked)}
      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
    />
    <span className="text-sm font-medium text-gray-700">
      Show deleted accounts
    </span>
  </label>
</div>
```

### Step 6: Update the Actions Column in Your Table

```javascript
{accounts.map((account) => (
  <tr
    key={account.id}
    className={account.deleted_at ? 'bg-red-50 opacity-75' : ''}
  >
    <td>{account.account_name}</td>
    <td>{account.contact_name}</td>
    <td>{account.product_name}</td>
    <td>{account.created_at}</td>

    {/* Actions column */}
    <td>
      <AccountActions
        account={account}
        onDelete={handleDeleteAccount}
        onRestore={handleRestoreAccount}
        onRefresh={fetchAccounts}
      />
    </td>
  </tr>
))}
```

---

## 📝 Integrate into TransactionsPage

### Step 1: Import the Component and API

Add to the top of `frontend/src/pages/TransactionsPage.jsx`:

```javascript
import { TransactionActions } from '../components/transactions/TransactionActions';
import { transactionsAPI } from '../services/api';
```

### Step 2: Add State for Voided Toggle

```javascript
const [showVoided, setShowVoided] = useState(false);
```

### Step 3: Update fetchTransactions Function

```javascript
const fetchTransactions = async () => {
  try {
    setLoading(true);
    const params = {
      includeVoided: showVoided,  // Add this line
      limit: 100,
      offset: 0
    };
    const response = await transactionsAPI.getTransactions(params);
    setTransactions(response.transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    toast.error('Failed to load transactions');
  } finally {
    setLoading(false);
  }
};

// Re-fetch when showVoided changes
useEffect(() => {
  fetchTransactions();
}, [showVoided]);
```

### Step 4: Add Void Handler

```javascript
const handleVoidTransaction = async (transactionId, reason) => {
  try {
    await transactionsAPI.voidTransaction(transactionId, reason);
    await fetchTransactions(); // Refresh the list
  } catch (error) {
    throw error; // Let the component handle the error
  }
};
```

### Step 5: Add the Toggle UI

```javascript
<div className="flex justify-between items-center mb-4">
  <h1 className="text-2xl font-bold">Transactions</h1>

  {/* Toggle for showing voided transactions */}
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={showVoided}
      onChange={(e) => setShowVoided(e.target.checked)}
      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
    />
    <span className="text-sm font-medium text-gray-700">
      Show voided transactions
    </span>
  </label>
</div>
```

### Step 6: Update the Actions Column

```javascript
{transactions.map((transaction) => (
  <tr
    key={transaction.id}
    className={transaction.is_void || transaction.deleted_at ? 'bg-gray-50 opacity-75' : ''}
  >
    <td>{transaction.transaction_id}</td>
    <td>${transaction.amount}</td>
    <td>{transaction.payment_date}</td>
    <td>{transaction.payment_method}</td>

    {/* Actions column */}
    <td>
      <TransactionActions
        transaction={transaction}
        onVoid={handleVoidTransaction}
        onRefresh={fetchTransactions}
      />
    </td>
  </tr>
))}
```

---

## 🎨 Optional: Add Visual Indicators

### Deleted Account Badge

```javascript
{account.deleted_at && (
  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
    Deleted
  </span>
)}
```

### Voided Transaction Badge

```javascript
{(transaction.is_void || transaction.deleted_at) && (
  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
    Voided
  </span>
)}
```

---

## 📊 Example: Complete AccountsPage Integration

```javascript
import React, { useState, useEffect } from 'react';
import { AccountActions } from '../components/accounts/AccountActions';
import { accountsAPI } from '../services/api';
import toast from 'react-hot-toast';

export function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const params = { includeDeleted: showDeleted };
      const response = await accountsAPI.getAccounts(params);
      setAccounts(response.accounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [showDeleted]);

  const handleDeleteAccount = async (accountId, reason) => {
    await accountsAPI.softDeleteAccount(accountId, reason);
    await fetchAccounts();
  };

  const handleRestoreAccount = async (accountId) => {
    await accountsAPI.restoreAccount(accountId);
    await fetchAccounts();
  };

  return (
    <div className="p-6">
      {/* Header with toggle */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Show deleted accounts
          </span>
        </label>
      </div>

      {/* Accounts Table */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accounts.map((account) => (
              <tr
                key={account.id}
                className={account.deleted_at ? 'bg-red-50 opacity-75' : ''}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  {account.account_name}
                  {account.deleted_at && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      Deleted
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {account.contact_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {account.product_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(account.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AccountActions
                    account={account}
                    onDelete={handleDeleteAccount}
                    onRestore={handleRestoreAccount}
                    onRefresh={fetchAccounts}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## 🧪 Quick Test

After integration:

1. **Test Delete:**
   - Click "Delete" on an account
   - Select a reason
   - Confirm deletion
   - Verify account disappears

2. **Test Show Deleted:**
   - Enable "Show deleted accounts" toggle
   - Verify deleted account appears with gray background
   - Verify "Deleted" badge shows

3. **Test Restore:**
   - Click "Restore" on a deleted account
   - Verify account returns to normal list
   - Disable "Show deleted" toggle
   - Verify restored account still visible

4. **Test Void:**
   - Click "Void" on a transaction
   - Read the warning
   - Select a reason
   - Confirm void
   - Verify transaction disappears

---

## 🎯 Next Steps

1. Run the database migration
2. Restart your backend server
3. Integrate the components into your pages
4. Test thoroughly in staging
5. Deploy to production

---

**Need Help?** Check `SOFT_DELETE_IMPLEMENTATION.md` for full details!
