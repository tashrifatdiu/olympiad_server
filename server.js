require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const examRoutes = require('./routes/examRoutes');
const logRoutes = require('./routes/logRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { apiLimiter } = require('./middlewares/rateLimitMiddleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

connectDB();

app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

const resultRoutes = require('./routes/resultRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/log', logRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/results', resultRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Olympiad Platform API is running' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('student-join', (data) => {
    socket.join(`student-${data.userId}`);
    console.log(`Student ${data.userId} joined`);
  });

  socket.on('admin-join', () => {
    socket.join('admin-room');
    console.log('Admin joined');
  });

  socket.on('question-changed', (data) => {
    io.to('admin-room').emit('student-progress', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('All systems operational');
});



