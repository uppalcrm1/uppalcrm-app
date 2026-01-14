const { pool } = require('../database/connection');
const fieldMappingService = require('./fieldMappingService');
const transformationEngine = require('./transformationEngine');
const { AppError } = require('../utils/errors');

/**
 * Lead Conversion Service with Field Mapping Support
 * Handles conversion of leads to contacts/accounts/transactions using configured field mappings
 */

/**
 * Apply field mappings to lead data for conversion
 * Returns mapped data ready for contact/account/transaction creation
 */
exports.applyFieldMappingsToLead = async (organizationId, lead, templateId = null) => {
  try {
    // Get field mappings (from template or organization defaults)
    let mappings;

    if (templateId) {
      // Get mappings from template
      const templateQuery = `
        SELECT fmti.*, fmc.*
        FROM field_mapping_template_items fmti
        JOIN field_mapping_configurations fmc ON fmti.source_mapping_id = fmc.id
        WHERE fmti.template_id = $1 AND fmc.is_active = true
      `;
      const templateResult = await pool.query(templateQuery, [templateId]);
      mappings = templateResult.rows;
    } else {
      // Get organization's active mappings
      mappings = await fieldMappingService.getAllMappings(organizationId, {
        include_system: true
      });
    }

    // Initialize result objects for each entity
    const mappedData = {
      contacts: {},
      accounts: {},
      transactions: {},
      unmappedFields: {
        contacts: [],
        accounts: [],
        transactions: []
      }
    };

    // Track which fields were auto-filled vs. need user input
    const conversionHistory = [];

    // Apply each mapping
    for (const mapping of mappings) {
      if (!mapping.is_active) continue;

      const sourceValue = getNestedValue(lead, mapping.source_field, mapping.source_field_path);

      let transformedValue = sourceValue;
      let wasTransformed = false;

      // Apply transformation if value exists
      if (sourceValue !== null && sourceValue !== undefined) {
        try {
          transformedValue = await transformationEngine.applyTransformation(
            sourceValue,
            mapping.transformation_type,
            mapping.transformation_rule_id,
            { ...lead, organization_id: organizationId }
          );
          wasTransformed = (transformedValue !== sourceValue);
        } catch (error) {
          console.error(`Transformation error for mapping ${mapping.id}:`, error);
          // Fall back to original value on error
          transformedValue = sourceValue;
        }
      }

      // Use default value if no source value
      if ((transformedValue === null || transformedValue === undefined) && mapping.default_value) {
        transformedValue = mapping.default_value;
        wasTransformed = false;
      }

      // Store mapped value
      const entity = mapping.target_entity;
      const targetField = mapping.target_field;

      mappedData[entity][targetField] = transformedValue;

      // Track conversion history
      conversionHistory.push({
        field_mapping_id: mapping.id,
        source_field: mapping.source_field,
        target_field: targetField,
        target_entity: entity,
        source_value: sourceValue,
        transformed_value: transformedValue,
        was_transformed: wasTransformed,
        was_edited_by_user: false, // Will be updated if user changes value
        transformation_type: mapping.transformation_type
      });
    }

    return {
      mappedData,
      conversionHistory
    };
  } catch (error) {
    console.error('Error applying field mappings:', error);
    throw error;
  }
};

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj, fieldName, fieldPath = null) {
  if (fieldPath) {
    const parts = fieldPath.split('.');
    let value = obj;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return null;
    }
    return value;
  }
  return obj[fieldName];
}

/**
 * Convert lead to contact/account/transaction with field mapping support
 */
exports.convertLeadWithMappings = async (
  organizationId,
  leadId,
  userId,
  options = {},
  client = null
) => {
  const shouldManageTransaction = !client;
  if (!client) {
    client = await pool.connect();
  }

  try {
    if (shouldManageTransaction) {
      await client.query('BEGIN');
    }

    // Set session variables for RLS
    await client.query(
      "SELECT set_config('app.current_organization_id', $1, true)",
      [organizationId]
    );
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [userId]
    );

    // 1. Get the lead
    const leadResult = await client.query(
      `SELECT * FROM leads WHERE id = $1 AND organization_id = $2`,
      [leadId, organizationId]
    );

    if (leadResult.rows.length === 0) {
      throw new AppError('Lead not found', 404);
    }

    const lead = leadResult.rows[0];

    if (lead.status === 'converted') {
      throw new AppError('Lead already converted', 400);
    }

    // 2. Check if field mapping is enabled for this organization
    const mappingsExist = await client.query(
      `SELECT COUNT(*) as count FROM field_mapping_configurations
       WHERE organization_id = $1 AND is_active = true`,
      [organizationId]
    );

    const useFieldMappings = parseInt(mappingsExist.rows[0].count) > 0;

    let mappedData = null;
    let conversionHistory = [];

    if (useFieldMappings) {
      // Use field mapping system
      console.log('Using field mapping system for conversion');
      const mappingResult = await exports.applyFieldMappingsToLead(
        organizationId,
        lead,
        options.templateId
      );
      mappedData = mappingResult.mappedData;
      conversionHistory = mappingResult.conversionHistory;
    }

    // 3. Handle contact creation/linking
    let contact;
    let isNewContact = true;

    if (options.existingContactId) {
      // Link to existing contact
      const existingContactResult = await client.query(
        `SELECT * FROM contacts WHERE id = $1 AND organization_id = $2`,
        [options.existingContactId, organizationId]
      );

      if (existingContactResult.rows.length === 0) {
        throw new AppError('Contact not found', 404);
      }

      contact = existingContactResult.rows[0];
      isNewContact = false;

      // Create relationship
      await client.query(
        `INSERT INTO lead_contact_relationships
         (lead_id, contact_id, relationship_type, interest_type, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          lead.id,
          contact.id,
          options.relationshipType || 'existing_customer',
          options.interestType,
          userId
        ]
      );
    } else {
      // Create new contact
      let contactData;

      if (useFieldMappings && mappedData) {
        // Use mapped data with fallback to lead data
        contactData = {
          first_name: mappedData.contacts.first_name || lead.first_name,
          last_name: mappedData.contacts.last_name || lead.last_name,
          email: mappedData.contacts.email || lead.email,
          phone: mappedData.contacts.phone || lead.phone,
          company: mappedData.contacts.company || lead.company,
          title: mappedData.contacts.title || lead.title,
          address_line1: mappedData.contacts.address_line1 || lead.address_line1,
          address_line2: mappedData.contacts.address_line2 || lead.address_line2,
          city: mappedData.contacts.city || lead.city,
          state: mappedData.contacts.state || lead.state,
          postal_code: mappedData.contacts.postal_code || lead.postal_code,
          country: mappedData.contacts.country || lead.country,
          contact_source: mappedData.contacts.contact_source || lead.source,
          notes: mappedData.contacts.notes || lead.notes,
          type: mappedData.contacts.type || 'customer',
          contact_status: mappedData.contacts.contact_status || 'active',
          custom_fields: { ...(lead.custom_fields || {}), ...mappedData.contacts }
        };
      } else {
        // Fallback to direct mapping (backward compatible)
        contactData = {
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          title: lead.title,
          address_line1: lead.address_line1,
          address_line2: lead.address_line2,
          city: lead.city,
          state: lead.state,
          postal_code: lead.postal_code,
          country: lead.country,
          contact_source: lead.source,
          notes: lead.notes,
          type: 'customer',
          contact_status: 'active',
          custom_fields: lead.custom_fields || {}
        };
      }

      const contactResult = await client.query(
        `INSERT INTO contacts (
          organization_id, first_name, last_name, email, phone,
          company, title, address_line1, address_line2, city,
          state, postal_code, country, converted_from_lead_id,
          contact_source, notes, created_by, type, contact_status, custom_fields
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *`,
        [
          organizationId,
          contactData.first_name,
          contactData.last_name,
          contactData.email,
          contactData.phone,
          contactData.company,
          contactData.title,
          contactData.address_line1,
          contactData.address_line2,
          contactData.city,
          contactData.state,
          contactData.postal_code,
          contactData.country,
          lead.id,
          contactData.contact_source,
          contactData.notes,
          userId,
          contactData.type,
          contactData.contact_status,
          contactData.custom_fields
        ]
      );

      contact = contactResult.rows[0];
    }

    // 4. Update lead status
    await client.query(
      `UPDATE leads
       SET status = 'converted',
           converted_date = NOW(),
           linked_contact_id = $1,
           relationship_type = $2,
           interest_type = $3,
           updated_at = NOW()
       WHERE id = $4 AND organization_id = $5`,
      [
        contact.id,
        options.relationshipType || 'new_customer',
        options.interestType,
        lead.id,
        organizationId
      ]
    );

    // 5. Create account if requested
    let account = null;
    if (options.createAccount && options.accountDetails) {
      const details = options.accountDetails;

      // Get product_id
      let productId = details.productId;
      if (!productId) {
        const defaultProductResult = await client.query(
          `SELECT id FROM products
           WHERE organization_id = $1 AND is_active = true AND is_default = true
           LIMIT 1`,
          [organizationId]
        );
        if (defaultProductResult.rows.length > 0) {
          productId = defaultProductResult.rows[0].id;
        }
      }

      // Use mapped account data if available
      let accountData = details;
      if (useFieldMappings && mappedData) {
        accountData = {
          ...details,
          ...mappedData.accounts
        };
      }

      // Convert term to billing cycle
      let finalBillingCycle = accountData.billingCycle;
      let billingTermMonths = null;

      if (accountData.term) {
        const termMap = {
          '1': 'monthly',
          '3': 'quarterly',
          '6': 'semi-annual',
          '12': 'annual',
          '24': 'biennial'
        };
        finalBillingCycle = termMap[accountData.term.toString()] || 'monthly';
        billingTermMonths = parseInt(accountData.term);
      }

      const accountResult = await client.query(
        `INSERT INTO accounts (
          organization_id, contact_id, account_name, edition,
          device_name, mac_address, billing_cycle, billing_term_months, price,
          is_trial, account_type, license_status, created_by, product_id, custom_fields
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          organizationId,
          contact.id,
          accountData.accountName || `${contact.first_name} ${contact.last_name}'s Account`,
          accountData.edition,
          accountData.deviceName,
          accountData.macAddress,
          finalBillingCycle,
          billingTermMonths,
          accountData.price || 0,
          accountData.isTrial || false,
          accountData.isTrial ? 'trial' : 'active',
          'pending',
          userId,
          productId,
          { ...(lead.custom_fields || {}), ...accountData }
        ]
      );

      account = accountResult.rows[0];

      // Handle trial dates
      if (accountData.isTrial) {
        const trialStart = new Date();
        const trialEnd = new Date(trialStart.getTime() + (30 * 24 * 60 * 60 * 1000));

        await client.query(
          `UPDATE accounts SET trial_start_date = $1, trial_end_date = $2 WHERE id = $3`,
          [trialStart, trialEnd, account.id]
        );
      }

      // Create transaction if details provided
      if (options.transactionDetails) {
        const txnDetails = options.transactionDetails;

        await client.query(
          `INSERT INTO transactions (
            organization_id, account_id, contact_id, product_id,
            payment_method, term, amount, currency, status,
            transaction_date, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
          [
            organizationId,
            account.id,
            contact.id,
            productId,
            txnDetails.paymentMethod || 'Credit Card',
            txnDetails.term,
            txnDetails.amount,
            txnDetails.currency || 'USD',
            txnDetails.status || 'completed',
            userId
          ]
        );
      }
    }

    // 6. Record conversion history if field mappings were used
    if (useFieldMappings && conversionHistory.length > 0) {
      for (const history of conversionHistory) {
        await client.query(
          `INSERT INTO conversion_field_history (
            organization_id, lead_id, contact_id, account_id,
            field_mapping_id, source_field, target_field, target_entity,
            source_value, transformed_value, final_value,
            was_transformed, was_edited_by_user, transformation_type,
            converted_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            organizationId,
            lead.id,
            contact.id,
            account?.id,
            history.field_mapping_id,
            history.source_field,
            history.target_field,
            history.target_entity,
            JSON.stringify(history.source_value),
            JSON.stringify(history.transformed_value),
            JSON.stringify(history.transformed_value), // Same as transformed unless user edited
            history.was_transformed,
            history.was_edited_by_user,
            history.transformation_type,
            userId
          ]
        );
      }

      // Update statistics
      for (const history of conversionHistory) {
        await client.query(
          `INSERT INTO field_mapping_statistics (
            organization_id, field_mapping_id, event_type, event_count
          ) VALUES ($1, $2, 'field_used_in_conversion', 1)
          ON CONFLICT (organization_id, field_mapping_id, event_type)
          DO UPDATE SET
            event_count = field_mapping_statistics.event_count + 1,
            last_event_at = CURRENT_TIMESTAMP`,
          [organizationId, history.field_mapping_id]
        );
      }
    }

    if (shouldManageTransaction) {
      await client.query('COMMIT');
    }

    return {
      success: true,
      contact,
      account,
      isNewContact,
      usedFieldMappings: useFieldMappings
    };
  } catch (error) {
    if (shouldManageTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (shouldManageTransaction) {
      client.release();
    }
  }
};
