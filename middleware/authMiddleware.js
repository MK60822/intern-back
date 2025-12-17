const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('Token received:', token.substring(0, 20) + '...');
            
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decoded:', decoded);

            // Get user from token (exclude password)
            req.user = await User.findById(decoded.id).select('-password');
            console.log('User found:', req.user?.email, req.user?.role);
            
            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            console.error('Auth error:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed: ' + error.message });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Role Authorization Wrapper
const authorize = (...roles) => {
    return (req, res, next) => {
        console.log('Checking role:', req.user?.role, 'against allowed:', roles);
        if (!roles.includes(req.user.role)) {
            const roleMessages = {
                'student': 'Access denied. Starting sessions is only available to teachers. Please log in as a teacher to generate session codes.',
                'admin': 'Access denied. This route is restricted to teachers only.'
            };
            const message = roleMessages[req.user.role] || `User role '${req.user.role}' is not authorized to access this route`;
            return res.status(403).json({
                message: message
            });
        }
        next();
    };
};

module.exports = { protect, authorize };