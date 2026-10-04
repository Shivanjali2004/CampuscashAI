require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const savingsRoutes = require('./routes/savingsRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const eventRoutes = require('./routes/eventRoutes');
const examRoutes = require('./routes/examRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const resetRoutes = require('./routes/resetRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Routes
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reset', resetRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Connect to MongoDB Atlas and start server
mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas');
        app.listen(PORT, () => {
            console.log(`CampusCash API running on http://localhost:${PORT}`);
            console.log(`Frontend should point to: http://localhost:${PORT}/api`);
        });
    })
    .catch((err) => {
        console.error('Failed to connect to MongoDB Atlas:', err.message);
        process.exit(1);
    });
