// middleware/authorize.js (CORRECTED VERSION)

module.exports = function(roles = []) {
    // roles can be a single string or an array of roles, e.g., 'admin' or ['admin', 'manager']
    if (typeof roles === 'string') {
        roles = [roles]; // Convert a single role string to an array
    }

    return (req, res, next) => {
        let userRole = null;

        // First, check if req.admin exists and has a role (for admin-protected routes)
        if (req.admin && req.admin.role) {
            userRole = req.admin.role;
        }
        // If not an admin context, or if req.admin doesn't have a role, check req.user
        else if (req.user && req.user.role) {
            userRole = req.user.role;
        }

        // If no user or admin role was found
        if (!userRole) {
            return res.status(401).json({ msg: 'Unauthorized: No valid authentication information or role found.' });
        }

        // Check if the obtained role is included in the allowed roles for this route
        if (roles.length && !roles.includes(userRole)) {
            return res.status(403).json({ msg: 'Forbidden: You do not have the necessary permissions to access this resource.' });
        }

        // If authorized, proceed to the next middleware/route handler
        next();
    };
};