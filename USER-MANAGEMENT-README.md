# User Management System

A comprehensive user management system for the Uppal CRM with advanced features including bulk operations, audit logging, email notifications, and user status management.

## Features Implemented ✅

### 1. **Complete User Lifecycle Management**
- ✅ Add users with auto-generated secure passwords
- ✅ Role management (Admin/Standard User)
- ✅ Password reset functionality
- ✅ User activation/deactivation (soft delete)
- ✅ User deletion with safety checks

### 2. **API Integration**
- ✅ Real API endpoints with proper authentication
- ✅ Input validation and error handling
- ✅ Rate limiting and security measures
- ✅ Pagination and filtering support
- ✅ Organization-scoped data isolation

### 3. **Email Service Integration**
- ✅ Welcome emails with login credentials
- ✅ Password reset notifications
- ✅ Bulk operation notifications
- ✅ Professional HTML email templates
- ✅ SMTP configuration support

### 4. **Audit Logging System**
- ✅ Complete audit trail for all user management actions
- ✅ Track who performed what action and when
- ✅ Detailed action logging with context
- ✅ Audit log viewing interface
- ✅ Data retention and cleanup capabilities

### 5. **Bulk Operations**
- ✅ Bulk user activation/deactivation
- ✅ Bulk password reset
- ✅ Bulk user deletion
- ✅ Role assignment in bulk operations
- ✅ Progress tracking and error reporting

### 6. **User Status Management**
- ✅ Active/Inactive status tracking
- ✅ Soft delete functionality
- ✅ Session management integration
- ✅ Access control based on status
- ✅ Visual status indicators

### 7. **Enhanced UX Features**
- ✅ Advanced search and filtering
- ✅ Sortable columns
- ✅ Pagination support
- ✅ Export functionality (CSV)
- ✅ Responsive design
- ✅ Real-time notifications
- ✅ Loading states and error handling

## Installation & Setup

### 1. **Database Migration**

Run the user management migration to add required fields:

```bash
npm run migrate:user-management
```

This will:
- Add required columns to the users table
- Create necessary indexes
- Set up default values for existing users

### 2. **Email Configuration**

Add email settings to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Uppal CRM
SMTP_FROM_EMAIL=noreply@uppalsolutions.com

# Application URLs
FRONTEND_URL=http://localhost:3000
ORGANIZATION_NAME=Your Organization Name
```

### 3. **Frontend Integration**

The user management component is located at:
```
frontend/src/components/UserManagement.jsx
```

Import and use it in your application:

```jsx
import UserManagement from './components/UserManagement';

function App() {
  return (
    <div>
      <UserManagement />
    </div>
  );
}
```

## API Endpoints

### User Management Routes

All routes require admin authentication and are prefixed with `/api/user-management`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all users with pagination/filtering |
| POST | `/` | Create new user |
| PUT | `/:id` | Update user details |
| POST | `/:id/reset-password` | Reset user password |
| DELETE | `/:id` | Delete/deactivate user |
| POST | `/bulk` | Perform bulk operations |
| GET | `/audit-log` | Get user management audit log |

### Example API Usage

```javascript
// Create new user
const newUser = await userManagementAPI.createUser({
  name: 'John Smith',
  email: 'john@company.com',
  role: 'user'
});

// Get users with filtering
const users = await userManagementAPI.getUsers({
  page: 1,
  limit: 20,
  search: 'john',
  role: 'user',
  status: 'active'
});

// Bulk operation
await userManagementAPI.bulkOperation({
  userIds: ['user-id-1', 'user-id-2'],
  operation: 'activate'
});
```

## Security Features

### 1. **Password Security**
- Auto-generated secure passwords (12+ characters)
- Forced password change on first login
- Password hashing with bcrypt (12 rounds)
- Password reset functionality

### 2. **Access Control**
- Role-based permissions (Admin/User)
- Organization-scoped data isolation
- Session management
- Admin-only user management access

### 3. **Audit Trail**
- Complete action logging
- User identification
- Timestamp tracking
- Context preservation
- Tamper-proof logs

### 4. **Email Security**
- Secure credential delivery
- Professional email templates
- Sender verification
- Delivery confirmation

## Database Schema

### Users Table Additions

```sql
-- User status and management fields
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN is_first_login BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN created_by UUID REFERENCES users(id);
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Email Templates

The system includes professional email templates for:

1. **Welcome Email** - Sent when new users are created
2. **Password Reset** - Sent when passwords are reset
3. **Bulk Operations** - Sent for bulk status changes

Templates are fully customizable and include:
- Professional styling
- Security notices
- Clear instructions
- Branding elements

## Error Handling

### Frontend Error Handling
- React Query for data fetching and error states
- Toast notifications for user feedback
- Graceful degradation for network issues
- Loading states and retry mechanisms

### Backend Error Handling
- Input validation with Joi
- Proper HTTP status codes
- Detailed error messages
- Security-conscious error responses

## Performance Optimizations

### Database
- Proper indexing on frequently queried columns
- Pagination for large datasets
- Efficient bulk operations
- Connection pooling

### Frontend
- React Query caching
- Debounced search
- Virtual scrolling for large lists
- Optimistic updates

## Monitoring & Maintenance

### Audit Log Cleanup
```javascript
// Clean up old audit logs (optional)
await AuditLog.cleanup(organizationId, 365); // Keep 1 year
```

### Email Testing
```javascript
// Test email configuration
const result = await testEmailConfig();
console.log(result.success ? 'Email configured' : result.message);
```

## Troubleshooting

### Common Issues

1. **Email not sending**
   - Check SMTP credentials in .env
   - Verify email server settings
   - Check firewall/network restrictions

2. **Users not appearing**
   - Run database migration
   - Check organization context
   - Verify authentication

3. **Bulk operations failing**
   - Check selected user IDs
   - Verify admin permissions
   - Review audit logs

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=true
NODE_ENV=development
```

## Contributing

When adding new features:

1. Update API endpoints in `routes/user-management.js`
2. Add frontend functions to `userManagementAPI`
3. Update the React component as needed
4. Add audit logging for new actions
5. Update email templates if applicable
6. Write tests for new functionality

## License

This user management system is part of the Uppal CRM project and follows the same licensing terms.