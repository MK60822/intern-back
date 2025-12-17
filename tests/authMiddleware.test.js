const { protect, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../models/User');
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            user: null
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('protect middleware', () => {
        it('should call next() for valid token and existing user', async () => {
            // Mock request with valid token
            req.headers.authorization = 'Bearer validtoken123';

            // Mock JWT verification
            jwt.verify.mockReturnValue({ id: 'user123' });

            // Mock user find with select method
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                role: 'student'
            };
            const mockQuery = {
                select: jest.fn().mockResolvedValue(mockUser)
            };
            User.findById.mockReturnValue(mockQuery);

            await protect(req, res, next);

            expect(jwt.verify).toHaveBeenCalledWith('validtoken123', process.env.JWT_SECRET);
            expect(User.findById).toHaveBeenCalledWith('user123');
            expect(req.user).toEqual(mockUser);
            expect(next).toHaveBeenCalled();
        });

        it('should return 401 for missing authorization header', async () => {
            await protect(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 for invalid token', async () => {
            req.headers.authorization = 'Bearer invalidtoken';

            jwt.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await protect(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, token failed: Invalid token' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 for non-existent user', async () => {
            req.headers.authorization = 'Bearer validtoken123';

            jwt.verify.mockReturnValue({ id: 'user123' });
            const mockQuery = {
                select: jest.fn().mockResolvedValue(null)
            };
            User.findById.mockReturnValue(mockQuery);

            await protect(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, user not found' });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('authorize middleware', () => {
        it('should call next() for authorized role', () => {
            req.user = { role: 'teacher' };

            const authMiddleware = authorize('teacher', 'admin');
            authMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 403 for unauthorized student role with custom message', () => {
            req.user = { role: 'student' };

            const authMiddleware = authorize('teacher', 'admin');
            authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Access denied. Starting sessions is only available to teachers. Please log in as a teacher to generate session codes.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 for unauthorized admin role with custom message', () => {
            req.user = { role: 'admin' };

            const authMiddleware = authorize('teacher');
            authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Access denied. This route is restricted to teachers only.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 for unauthorized role with generic message', () => {
            req.user = { role: 'unknown' };

            const authMiddleware = authorize('teacher');
            authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: 'User role \'unknown\' is not authorized to access this route'
            });
            expect(next).not.toHaveBeenCalled();
        });
    });
});
