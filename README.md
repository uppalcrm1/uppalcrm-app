# UppalCRM - Complete Multi-Tenant CRM System

A complete, production-ready CRM system built for software licensing businesses with multi-tenant architecture, modern React frontend, secure Node.js backend, and responsive marketing website.

## 🚀 Live Demo

- **Frontend App**: [https://uppalcrm-frontend.onrender.com](https://uppalcrm-frontend.onrender.com)
- **Backend API**: [https://uppalcrm-api.onrender.com](https://uppalcrm-api.onrender.com)
- **Marketing Site**: Available at root domain

## ✨ CRM Features

### Lead Management
- ✅ Complete CRUD operations for leads
- ✅ Advanced filtering (status, priority, source, assignment)
- ✅ Search across multiple fields
- ✅ Pagination for large datasets
- ✅ Team member assignment
- ✅ Lead value tracking
- ✅ Follow-up scheduling

### Dashboard & Analytics
- ✅ Real-time statistics and metrics
- ✅ Lead conversion tracking
- ✅ Interactive charts (pie charts, bar charts)
- ✅ Recent activity feeds
- ✅ Quick action shortcuts

### Authentication & Security
- ✅ Multi-tenant organization isolation
- ✅ JWT-based authentication
- ✅ Role-based access control
- ✅ Rate limiting and security headers
- ✅ Input sanitization and validation
- ✅ CORS configuration

### Marketing Website
- **Modern Design**: Clean, professional design with smooth animations and hover effects
- **Mobile Responsive**: Fully responsive design that works on all devices
- **Hero Section**: Compelling hero with interactive dashboard preview
- **Features Section**: Highlights contact-centric approach vs traditional B2B CRMs
- **Pricing Tiers**: Four pricing plans (Starter $49, Professional $149, Business $299, Enterprise custom)
- **Trial Signup Form**: Comprehensive form capturing company information

## 📐 Architecture

Uppal CRM uses a **two-tier multi-tenant architecture**:

### 🏢 Super Admin Platform (`/super-admin/*`)
Manage the CRM as a SaaS business:
- Monitor trial signups
- Manage subscribing organizations
- Track platform revenue ($15/user/month)
- View platform analytics

### 🏪 Organization CRM (`/*`)
Each business manages their customers:
- Lead & contact management
- **Customer accounts** (software licenses)
- Billing & payments (from customers)
- Team management
- Integrations & customization

⚠️ **Important**: "Accounts" has different meanings in each tier:
- **Super Admin Accounts** = Organizations paying us
- **Organization Accounts** = Customers buying software licenses

📚 **See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete details.**

📋 **See [docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) for quick reference.**

## 🛠 Tech Stack

### Backend
- **Node.js** + **Express.js** - Server framework
- **PostgreSQL** - Primary database with Row-Level Security
- **JWT** - Authentication tokens
- **Joi** - Request validation
- **Helmet** - Security headers
- **bcryptjs** - Password hashing

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **React Query** - Server state management
- **React Router** - Client-side routing
- **React Hook Form** - Form management
- **Recharts** - Data visualization

### Database
- **PostgreSQL** with Row-Level Security (RLS)
- **Multi-tenant architecture** - Organization-based data isolation
- **Indexed queries** - Optimized for performance

## 📁 Project Structure

```
uppal-crm-project/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React context providers
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service layer
│   │   └── styles/         # CSS and styling
│   └── dist/               # Built static files
├── routes/                  # Express API routes
├── models/                  # Database models and queries
├── middleware/             # Authentication, validation, security
├── database/               # SQL schemas and migrations
├── scripts/                # Utility scripts
├── docs/                   # Documentation
├── index.html              # Marketing website
├── styles.css              # Marketing site styles
├── script.js               # Marketing site functionality
└── server.js               # Main backend server
```

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd uppal-crm-project
   ```

2. **Set up backend**
   ```bash
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   npm run migrate
   npm run dev
   ```

3. **Set up frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3002
   - Backend API: http://localhost:3000
   - Marketing Site: http://localhost:3000

### Production Deployment (Render)

See [docs/render-deployment-steps.md](docs/render-deployment-steps.md) for complete deployment guide.

**Quick Deploy:**
1. Create PostgreSQL database on Render
2. Deploy backend API service
3. Deploy frontend static site
4. Run database migrations
5. Configure environment variables

**Generate Secure Secrets:**
```bash
npm run generate:secrets
```

## Customization

### Colors and Branding
- Update CSS custom properties in `:root` section of `styles.css`
- Replace "UppalCRM" with your brand name throughout files
- Update favicon and add your logo

### Form Integration
- Replace the simulated API call in `script.js` with your actual endpoint
- Integrate with email services (Mailchimp, SendGrid, etc.)
- Add CRM integration for lead capture

### Analytics Integration
- Add Google Analytics tracking code
- Integrate Facebook Pixel for ads
- Connect to your preferred analytics platform

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Features

- Optimized CSS with minimal specificity
- Efficient JavaScript with event delegation
- Smooth animations with CSS transforms
- Responsive images and fonts
- Minimal external dependencies

## SEO Optimized

- Semantic HTML structure
- Meta tags for social sharing
- Proper heading hierarchy
- Alt text for accessibility
- Fast loading performance

## Mobile Features

- Touch-friendly navigation
- Optimized form layouts
- Responsive typography
- Mobile-first CSS approach

## Security Considerations

- Form validation on frontend (add backend validation)
- No sensitive data in client-side code
- HTTPS recommended for production
- GDPR-friendly design

## Next Steps for Production

1. **Backend Integration**: Set up server-side form processing
2. **Email Marketing**: Integrate with email service provider
3. **Analytics**: Add comprehensive tracking
4. **A/B Testing**: Test different headlines and pricing
5. **SEO**: Add structured data and optimize meta tags
6. **Performance**: Optimize images and implement CDN
7. **Security**: Add CSRF protection and rate limiting

## Support

For questions or issues with the website code, please refer to the documentation or contact support.

---

*Built with modern web technologies for optimal performance and user experience.*