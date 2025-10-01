const jwt = require('jsonwebtoken');
const PlatformAdmin = require('../models/PlatformAdmin');

const platformAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        error: 'Access denied. No authorization header provided.'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type !== 'platform_admin') {
        return res.status(401).json({
          error: 'Access denied. Invalid token type.'
        });
      }

      const platformAdmin = await PlatformAdmin.findById(decoded.id);

      if (!platformAdmin) {
        return res.status(401).json({
          error: 'Access denied. Platform admin not found.'
        });
      }

      if (!platformAdmin.is_active) {
        return res.status(401).json({
          error: 'Access denied. Platform admin account is inactive.'
        });
      }

      req.platformAdmin = platformAdmin;
      next();

    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Access denied. Token has expired.'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Access denied. Invalid token.'
        });
      } else {
        throw jwtError;
      }
    }

  } catch (error) {
    console.error('Platform auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error during authentication.'
    });
  }
};

const optionalPlatformAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      req.platformAdmin = null;
      return next();
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      req.platformAdmin = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type === 'platform_admin') {
        const platformAdmin = await PlatformAdmin.findById(decoded.id);

        if (platformAdmin && platformAdmin.is_active) {
          req.platformAdmin = platformAdmin;
        } else {
          req.platformAdmin = null;
        }
      } else {
        req.platformAdmin = null;
      }

    } catch (jwtError) {
      req.platformAdmin = null;
    }

    next();

  } catch (error) {
    console.error('Optional platform auth middleware error:', error);
    req.platformAdmin = null;
    next();
  }
};

module.exports = {
  platformAuth,
  optionalPlatformAuth
};