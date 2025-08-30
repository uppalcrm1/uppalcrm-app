# UppalCRM - Multi-Tenant CRM API

A secure, scalable multi-tenant CRM backend built for software licensing businesses with complete tenant isolation and enterprise-grade security.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- npm or yarn

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Create PostgreSQL database:**
```sql
CREATE DATABASE uppal_crm;
```

4. **Run migrations:**
```bash
npm run migrate
```

5. **Start the server:**
```bash
npm run dev  # Development with auto-reload
npm start    # Production
```

The API will be available at `http://localhost:3000/api`

## 🏗️ Architecture

### Multi-Tenancy Design

- **Row-Level Security (RLS)**: Complete database-level tenant isolation
- **Organization Context**: Determined via subdomain, custom domain, or headers
- **Secure by Default**: All queries automatically scoped to organization

### Security Features

- JWT-based authentication with session management
- Rate limiting per organization and IP
- Input sanitization and XSS prevention
- SQL injection protection
- Password strength requirements
- CORS configuration
- Helmet security headers

## 📡 API Endpoints

### Authentication (`/api/auth`)

#### Register Organization
```http
POST /api/auth/register
Content-Type: application/json

{
  "organization": {
    "name": "Acme Software",
    "slug": "acme",
    "domain": "acme.com"
  },
  "admin": {
    "email": "admin@acme.com",
    "password": "SecurePassword123!",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

#### Login
```http
POST /api/auth/login
X-Organization-Slug: acme
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "SecurePassword123!"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### User Management (`/api/users`)

#### List Users
```http
GET /api/users?page=1&limit=20&role=user&search=john
Authorization: Bearer <token>
```

#### Create User (Admin Only)
```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@acme.com",
  "password": "SecurePassword123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "role": "user"
}
```

#### Update User
```http
PUT /api/users/{user_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "first_name": "Jane",
  "last_name": "Doe",
  "role": "admin"
}
```

### Organization Management (`/api/organizations`)

#### Get Organization Info
```http
GET /api/organizations/current
Authorization: Bearer <token>
```

#### Update Organization (Admin Only)
```http
PUT /api/organizations/current
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Acme Software Inc",
  "domain": "acme.software",
  "max_users": 50
}
```

#### Get Usage Statistics
```http
GET /api/organizations/current/usage
Authorization: Bearer <token>
```

## 🔐 Authentication

### Organization Context

The API determines organization context through:

1. **Subdomain**: `acme.uppalcrm.com`
2. **Custom domain**: `crm.acme.com`
3. **Header**: `X-Organization-Slug: acme`
4. **Header**: `X-Organization-ID: uuid`

### JWT Tokens

- **Format**: `Bearer <token>`
- **Expiration**: 24 hours
- **Refresh**: Use `/api/auth/refresh` endpoint
- **Logout**: `/api/auth/logout` (single session) or `/api/auth/logout-all`

## 🛡️ Security

### Rate Limiting

- **General API**: 100 requests/15 minutes per organization+IP
- **Authentication**: 5 attempts/15 minutes per organization+IP+email
- **Registration**: 3 attempts/hour per IP
- **Password Reset**: 3 attempts/15 minutes per organization+email

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Input Validation

All inputs are validated using Joi schemas:
- Email format validation
- UUID format validation
- String length limits
- XSS prevention
- SQL injection prevention

## 🗄️ Database Schema

### Organizations Table
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    domain VARCHAR(255),
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'starter',
    max_users INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);
```

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    permissions JSONB DEFAULT '[]',
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, email)
);
```

### Row Level Security

All tables have RLS policies that automatically filter data by organization:

```sql
CREATE POLICY user_isolation ON users
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

## 📊 User Roles & Permissions

### Admin
- Full access to organization management
- User creation, modification, deletion
- Access to statistics and usage data
- Organization settings management

### User  
- Access to own profile
- Basic CRM functionality (when implemented)
- Can update own information

### Viewer
- Read-only access to assigned data
- Cannot modify any information

## 🚨 Error Handling

### Standard Error Response
```json
{
  "error": "Error type",
  "message": "Human readable message",
  "details": {
    "field": "validation error details"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `413` - Request Too Large
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🧪 Testing

### Database Migration Testing
```bash
# Check current database status
node scripts/migrate.js status

# Run migrations
npm run migrate

# Reset database (destructive!)
node scripts/migrate.js reset
```

### API Testing with curl

```bash
# Register organization
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "organization": {
      "name": "Test Org",
      "slug": "test"
    },
    "admin": {
      "email": "admin@test.com",
      "password": "TestPassword123!",
      "first_name": "Admin",
      "last_name": "User"
    }
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Organization-Slug: test" \
  -d '{
    "email": "admin@test.com",
    "password": "TestPassword123!"
  }'

# Get user profile (replace TOKEN)
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## 🔧 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/uppal_crm
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uppal_crm
DB_USER=postgres
DB_PASSWORD=password

# Security
JWT_SECRET=your-secret-key
BCRYPT_ROUNDS=12

# Server
PORT=3000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,*.uppalcrm.com
```

## 🚀 Deployment

### Production Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure DATABASE_URL for production DB
- [ ] Set NODE_ENV=production
- [ ] Configure ALLOWED_ORIGINS for your domains
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx/cloudflare)
- [ ] Set up database backups
- [ ] Configure monitoring and logging
- [ ] Set up health checks

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Support

For issues or questions:
1. Check the API documentation at `/api`
2. Review error messages and status codes
3. Ensure proper organization context is set
4. Verify authentication tokens are valid

## 📈 Monitoring

The API includes several monitoring endpoints:

- `GET /health` - Basic health check
- `GET /api` - API documentation
- `GET /api/organizations/current/stats` - Organization metrics
- `GET /api/organizations/current/usage` - Usage statistics

Built with ❤️ for secure, scalable multi-tenant CRM needs.