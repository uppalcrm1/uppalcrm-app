const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

class PlatformAdmin {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.password_hash = data.password_hash;
    this.name = data.name;
    this.is_active = data.is_active;
    this.last_login = data.last_login;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Static methods for database operations
  static async findByEmail(email) {
    try {
      const result = await query(
        'SELECT * FROM platform_admins WHERE email = $1 AND is_active = true',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return new PlatformAdmin(result.rows[0]);
    } catch (error) {
      console.error('Error finding platform admin by email:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM platform_admins WHERE id = $1 AND is_active = true',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return new PlatformAdmin(result.rows[0]);
    } catch (error) {
      console.error('Error finding platform admin by ID:', error);
      throw error;
    }
  }

  static async create(email, password, name) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await query(`
        INSERT INTO platform_admins (email, password_hash, name)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [email.toLowerCase(), hashedPassword, name]);

      return new PlatformAdmin(result.rows[0]);
    } catch (error) {
      console.error('Error creating platform admin:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      const result = await query(
        'SELECT * FROM platform_admins WHERE is_active = true ORDER BY created_at DESC'
      );

      return result.rows.map(row => new PlatformAdmin(row));
    } catch (error) {
      console.error('Error getting all platform admins:', error);
      throw error;
    }
  }

  // Instance methods
  async validatePassword(password) {
    try {
      return await bcrypt.compare(password, this.password_hash);
    } catch (error) {
      console.error('Error validating password:', error);
      throw error;
    }
  }

  async updateLastLogin() {
    try {
      await query(
        'UPDATE platform_admins SET last_login = NOW() WHERE id = $1',
        [this.id]
      );
      this.last_login = new Date();
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  generateToken() {
    try {
      return jwt.sign(
        {
          id: this.id,
          email: this.email,
          type: 'platform_admin'
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    } catch (error) {
      console.error('Error generating token:', error);
      throw error;
    }
  }

  async updateProfile(updates) {
    try {
      const allowedUpdates = ['name', 'email'];
      const setClause = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          if (key === 'email') {
            setClause.push(`${key} = $${paramCount}`);
            values.push(value.toLowerCase());
          } else {
            setClause.push(`${key} = $${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push(`updated_at = NOW()`);
      values.push(this.id);

      const result = await query(`
        UPDATE platform_admins
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error('Platform admin not found');
      }

      // Update instance properties
      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error updating platform admin profile:', error);
      throw error;
    }
  }

  async changePassword(newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await query(
        'UPDATE platform_admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, this.id]
      );

      this.password_hash = hashedPassword;
      this.updated_at = new Date();
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  async deactivate() {
    try {
      await query(
        'UPDATE platform_admins SET is_active = false, updated_at = NOW() WHERE id = $1',
        [this.id]
      );

      this.is_active = false;
      this.updated_at = new Date();
    } catch (error) {
      console.error('Error deactivating platform admin:', error);
      throw error;
    }
  }

  // Return safe data for API responses (without password hash)
  toJSON() {
    const { password_hash, ...safeData } = this;
    return safeData;
  }

  // Static method to verify JWT token
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type !== 'platform_admin') {
        throw new Error('Invalid token type');
      }

      const admin = await PlatformAdmin.findById(decoded.id);
      if (!admin) {
        throw new Error('Platform admin not found');
      }

      return admin;
    } catch (error) {
      console.error('Error verifying token:', error);
      throw error;
    }
  }
}

module.exports = PlatformAdmin;