export const responseHandler = (req, res, next) => {
    res.ok = (data = null, message = 'Success operation') => {
        res.status(200).json({
            success: true,
            message,
            data,
        });
    };

    // Método success que acepta objeto con message y data
    res.success = (options = {}) => {
        const { message = 'Success', data = null } = typeof options === 'string' 
            ? { message: options } 
            : options;
        
        res.status(200).json({
            success: true,
            message,
            data,
        });
    };

    res.created = (data = null, message = 'Resource created') => {
        // Si se pasa un objeto con message y data, manejarlo
        if (typeof data === 'object' && data !== null && !Array.isArray(data) && 'message' in data) {
            res.status(201).json({
                success: true,
                message: data.message || 'Resource created',
                data: data.data || null,
            });
        } else {
            res.status(201).json({
                success: true,
                message,
                data,
            });
        }
    };

    res.badRequest = (message = 'Bad request', data = null) => {
        res.status(400).json({
            success: false,
            message,
            data,
        });
    };

    res.unauthorized = (message = 'Unauthorized') => {
        res.status(401).json({
            success: false,
            message,
        });
    };

    res.forbidden = (message = 'Access denied') => {
        res.status(403).json({
            success: false,
            message,
        });
    };

    res.notFound = (message = 'Not found') => {
        res.status(404).json({
            success: false,
            message,
        });
    };

    res.serverError = (message = 'Internal server error', data = null) => {
        res.status(500).json({
            success: false,
            message,
            data,
        });
    };

    next();
};