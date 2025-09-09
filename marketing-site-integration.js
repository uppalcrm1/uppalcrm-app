// Marketing Site Lead Submission Integration
// Add this JavaScript to your https://uppalcrmapp.netlify.app/ site

// Configuration
const CRM_API_URL = 'https://uppalcrm-api.onrender.com/api/public/leads';

// Industry mapping (based on your form dropdown)
const industryMapping = {
  'Software/Technology': 'technology',
  'E-commerce': 'ecommerce', 
  'Healthcare': 'healthcare',
  'Finance': 'finance',
  'Education': 'education',
  'Manufacturing': 'manufacturing',
  'Other': 'other'
};

// Team size mapping
const teamSizeMapping = {
  '1-10': 'small',
  '11-50': 'medium', 
  '51-200': 'large',
  '200+': 'enterprise'
};

/**
 * Submit lead to CRM API
 * @param {Object} formData - The form data from your marketing site
 * @returns {Promise} - API response
 */
async function submitLeadToCRM(formData) {
  try {
    console.log('🎯 Submitting lead to CRM...', formData);
    
    // Map your form fields to CRM API format
    const leadData = {
      // Required fields
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.businessEmail,
      
      // Optional fields
      phone: formData.phoneNumber || null,
      company: formData.companyName || null,
      title: formData.jobTitle || null, // If you add this field
      
      // Marketing context
      source: 'website',
      message: `Lead from marketing site. Industry: ${formData.industry || 'Not specified'}, Team size: ${formData.teamSize || 'Not specified'}`,
      
      // UTM parameters (if available)
      utm_source: getUTMParameter('utm_source'),
      utm_medium: getUTMParameter('utm_medium'), 
      utm_campaign: getUTMParameter('utm_campaign'),
      referrer_url: document.referrer || null,
      
      // Additional context
      organization_domain: extractDomainFromEmail(formData.businessEmail)
    };
    
    const response = await fetch(CRM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leadData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Lead submitted successfully:', result);
      return { success: true, data: result };
    } else {
      console.error('❌ Lead submission failed:', result);
      return { success: false, error: result.error || 'Submission failed' };
    }
    
  } catch (error) {
    console.error('❌ Network error submitting lead:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Handle your existing form submission
 * Modify your current form handler to call this function
 */
async function handleFormSubmission(event) {
  event.preventDefault();
  
  // Show loading state
  const submitButton = document.querySelector('form button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.textContent = 'Submitting...';
  submitButton.disabled = true;
  
  try {
    // Get form data (adjust selectors to match your form)
    const formData = {
      firstName: document.querySelector('input[name="firstName"]')?.value || document.querySelector('#firstName')?.value,
      lastName: document.querySelector('input[name="lastName"]')?.value || document.querySelector('#lastName')?.value,
      businessEmail: document.querySelector('input[name="email"]')?.value || document.querySelector('#email')?.value,
      companyName: document.querySelector('input[name="company"]')?.value || document.querySelector('#company')?.value,
      companyWebsite: document.querySelector('input[name="website"]')?.value || document.querySelector('#website')?.value,
      phoneNumber: document.querySelector('input[name="phone"]')?.value || document.querySelector('#phone')?.value,
      industry: document.querySelector('select[name="industry"]')?.value || document.querySelector('#industry')?.value,
      teamSize: document.querySelector('select[name="teamSize"]')?.value || document.querySelector('#teamSize')?.value
    };
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.businessEmail || !formData.companyName) {
      throw new Error('Please fill in all required fields');
    }
    
    // Submit to CRM
    const result = await submitLeadToCRM(formData);
    
    if (result.success) {
      // Success handling
      showSuccessMessage('Thank you! We will be in touch within 24 hours to schedule your demo.');
      
      // Optional: Track conversion event
      if (typeof gtag !== 'undefined') {
        gtag('event', 'conversion', {
          'send_to': 'YOUR-CONVERSION-ID', // Replace with your Google Ads conversion ID
          'value': 1.0,
          'currency': 'USD'
        });
      }
      
      // Reset form
      document.querySelector('form').reset();
      
    } else {
      // Error handling
      showErrorMessage(result.error || 'Something went wrong. Please try again or contact us directly.');
    }
    
  } catch (error) {
    console.error('Form submission error:', error);
    showErrorMessage('Please check your information and try again.');
  } finally {
    // Reset button
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
}

/**
 * Utility functions
 */

// Extract domain from email address
function extractDomainFromEmail(email) {
  if (!email) return null;
  const match = email.match(/@([^.]+\..+)$/);
  return match ? match[1] : null;
}

// Get UTM parameters from URL
function getUTMParameter(paramName) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(paramName);
}

// Show success message
function showSuccessMessage(message) {
  // Customize this based on your site's design
  const messageDiv = document.createElement('div');
  messageDiv.className = 'success-message';
  messageDiv.style.cssText = `
    background-color: #d4edda;
    color: #155724;
    padding: 12px;
    border: 1px solid #c3e6cb;
    border-radius: 4px;
    margin: 10px 0;
  `;
  messageDiv.textContent = message;
  
  const form = document.querySelector('form');
  form.parentNode.insertBefore(messageDiv, form.nextSibling);
  
  // Remove after 5 seconds
  setTimeout(() => messageDiv.remove(), 5000);
}

// Show error message
function showErrorMessage(message) {
  // Customize this based on your site's design
  const messageDiv = document.createElement('div');
  messageDiv.className = 'error-message';
  messageDiv.style.cssText = `
    background-color: #f8d7da;
    color: #721c24;
    padding: 12px;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    margin: 10px 0;
  `;
  messageDiv.textContent = message;
  
  const form = document.querySelector('form');
  form.parentNode.insertBefore(messageDiv, form.nextSibling);
  
  // Remove after 5 seconds
  setTimeout(() => messageDiv.remove(), 5000);
}

/**
 * Initialize the integration
 * Call this when your page loads
 */
function initializeLeadCapture() {
  // Find your form and attach the handler
  const form = document.querySelector('form'); // Adjust selector as needed
  
  if (form) {
    form.addEventListener('submit', handleFormSubmission);
    console.log('✅ Lead capture integration initialized');
  } else {
    console.warn('⚠️ Lead capture form not found. Check your form selector.');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLeadCapture);
} else {
  initializeLeadCapture();
}

// For testing purposes - you can call this in browser console
window.testLeadSubmission = function() {
  const testData = {
    firstName: 'Test',
    lastName: 'User',
    businessEmail: 'test@example.com',
    companyName: 'Test Company',
    industry: 'Technology',
    teamSize: '1-10'
  };
  
  return submitLeadToCRM(testData);
};