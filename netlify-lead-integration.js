// UppalCRM Lead Integration for Netlify Marketing Site
// This file should be included in your https://uppalcrmapp.netlify.app/ site

// Configuration - CORRECTED API URL
const CRM_API_URL = 'https://uppalcrm-api.onrender.com/api/public/leads';

/**
 * Submit lead to CRM API
 * @param {Object} formData - The form data from marketing site
 * @returns {Promise} - API response
 */
async function submitLeadToCRM(formData) {
  try {
    console.log('🎯 Submitting lead to CRM...', formData);
    
    // Map form fields to CRM API format
    const leadData = {
      // Required fields
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.business_email,
      
      // Optional fields
      phone: formData.phone_number || null,
      company: formData.company_name || null,
      
      // Marketing context
      source: 'website',
      message: `Lead from marketing site. Industry: ${formData.industry || 'Not specified'}, Team size: ${formData.team_size || 'Not specified'}${formData.company_website ? `, Website: ${formData.company_website}` : ''}`,
      
      // UTM parameters (if available)
      utm_source: getUTMParameter('utm_source'),
      utm_medium: getUTMParameter('utm_medium'),
      utm_campaign: getUTMParameter('utm_campaign'),
      referrer_url: document.referrer || null,
      
      // Additional context
      organization_domain: extractDomainFromEmail(formData.business_email)
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
 * Handle form submission
 */
async function handleFormSubmission(event) {
  event.preventDefault();
  
  // Show loading state
  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.textContent = 'Submitting...';
  submitButton.disabled = true;
  
  try {
    // Get form data
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // Validate required fields
    if (!data.first_name || !data.last_name || !data.business_email || !data.company_name) {
      throw new Error('Please fill in all required fields');
    }
    
    // Submit to CRM
    const result = await submitLeadToCRM(data);
    
    if (result.success) {
      // Success handling
      showSuccessMessage('🎉 Thank you! We will be in touch within 24 hours to schedule your demo.');
      
      // Optional: Track conversion event (if Google Analytics is set up)
      if (typeof gtag !== 'undefined') {
        gtag('event', 'conversion', {
          'send_to': 'YOUR-CONVERSION-ID', // Replace with your Google Ads conversion ID
          'value': 1.0,
          'currency': 'USD'
        });
      }
      
      // Reset form
      event.target.reset();
      
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
  // Remove any existing messages
  const existingMessages = document.querySelectorAll('.success-message, .error-message');
  existingMessages.forEach(msg => msg.remove());
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'success-message';
  messageDiv.style.cssText = `
    background-color: #d4edda;
    color: #155724;
    padding: 16px;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    margin: 16px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  `;
  messageDiv.textContent = message;
  
  const form = document.querySelector('form');
  form.parentNode.insertBefore(messageDiv, form.nextSibling);
  
  // Remove after 7 seconds
  setTimeout(() => messageDiv.remove(), 7000);
}

// Show error message
function showErrorMessage(message) {
  // Remove any existing messages
  const existingMessages = document.querySelectorAll('.success-message, .error-message');
  existingMessages.forEach(msg => msg.remove());
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'error-message';
  messageDiv.style.cssText = `
    background-color: #f8d7da;
    color: #721c24;
    padding: 16px;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    margin: 16px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  `;
  messageDiv.textContent = message;
  
  const form = document.querySelector('form');
  form.parentNode.insertBefore(messageDiv, form.nextSibling);
  
  // Remove after 7 seconds
  setTimeout(() => messageDiv.remove(), 7000);
}

/**
 * Initialize the integration
 * Call this when page loads
 */
function initializeLeadCapture() {
  // Find form and attach handler
  const form = document.querySelector('form');
  
  if (form) {
    form.addEventListener('submit', handleFormSubmission);
    console.log('✅ UppalCRM lead capture integration initialized');
    console.log('📡 API Endpoint:', CRM_API_URL);
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
    first_name: 'Test',
    last_name: 'User',
    business_email: 'test@example.com',
    company_name: 'Test Company',
    industry: 'Software/SaaS',
    team_size: '1-5 people'
  };
  
  return submitLeadToCRM(testData);
};