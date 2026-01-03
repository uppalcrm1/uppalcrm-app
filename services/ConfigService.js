const db = require('../database/connection');

class ConfigService {
  /**
   * Get configuration value
   * @param {string} organizationId
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  static async get(organizationId, key) {
    try {
      const result = await db.query(
        'SELECT config_value FROM system_config WHERE organization_id = $1 AND config_key = $2',
        [organizationId, key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].config_value;
    } catch (error) {
      console.error(`Error getting config ${key}:`, error);
      return null;
    }
  }

  /**
   * Set configuration value
   * @param {string} organizationId
   * @param {string} key
   * @param {string} value
   * @param {string} description
   * @returns {Promise<object>}
   */
  static async set(organizationId, key, value, description = null) {
    const result = await db.query(`
      INSERT INTO system_config (organization_id, config_key, config_value, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (organization_id, config_key)
      DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = COALESCE(EXCLUDED.description, system_config.description),
        updated_at = NOW()
      RETURNING *
    `, [organizationId, key, value, description]);

    return result.rows[0];
  }

  /**
   * Get USD to CAD exchange rate
   * Default: 1.25 (1 USD = 1.25 CAD)
   * @param {string} organizationId
   * @returns {Promise<number>}
   */
  static async getExchangeRate(organizationId) {
    const rate = await this.get(organizationId, 'exchange_rate_usd_to_cad');
    return parseFloat(rate) || 1.25; // Default: 1 USD = 1.25 CAD
  }

  /**
   * Get default reporting currency
   * Default: CAD
   * @param {string} organizationId
   * @returns {Promise<string>}
   */
  static async getReportingCurrency(organizationId) {
    const currency = await this.get(organizationId, 'default_reporting_currency');
    return currency || 'CAD';
  }
}

module.exports = ConfigService;
