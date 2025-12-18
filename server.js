const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["https://intern-frontend-theta.vercel.app", "http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

// Make io available globally
global.io = io;

// 1. Elite Security Middleware
app.use(express.json({ limit: '10kb' })); // Prevent DoS attacks with large payloads
app.use(cors({
    origin: true,
    credentials: true
}));

// 2. Route Mounting
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes')); // Handles users & classes
app.use('/api/teacher', require('./routes/teacherRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/classes', require('./routes/classRoutes')); // Class listing for admin
app.use('/api/sessions', require('./routes/sessionRoutes')); // Session & attendance

// 3. Global Error Handler
app.use((err, req, res, next) => {
    console.error(`❌ Error: ${err.message}`);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Server Error'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // Join teacher room for real-time updates
    socket.on('join-teacher-room', (teacherId) => {
        socket.join(`teacher-${teacherId}`);
        console.log(`👨‍🏫 Teacher ${teacherId} joined their room`);
    });

    // Join class room for attendance updates
    socket.on('join-class-room', (classId) => {
        socket.join(`class-${classId}`);
        console.log(`📚 User joined class room: ${classId}`);
    });

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Attendance Management Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
