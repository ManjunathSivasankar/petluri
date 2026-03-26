const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role '${req.user.role}' is not authorized to access this route (${req.originalUrl})`
            });
        }
        next();
    };
};

const adminOnly = authorize('admin', 'super-admin');
const studentOnly = authorize('student', 'admin', 'super-admin');

module.exports = { authorize, adminOnly, studentOnly };
