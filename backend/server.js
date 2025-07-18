const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vulnerabilities', require('./routes/vulnerabilityRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/scan', require('./routes/scanRoutes'));

const http = require('http').createServer(app);
const { Server } = require('socket.io');

const io = new Server(http, {
  cors: {
    origin: '*', // Adjust this to your frontend origin in production
    methods: ['GET', 'POST'],
  },
});

// Make io available globally or via a module to controllers
// We'll export io so controllers can import and emit events
module.exports.io = io;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
