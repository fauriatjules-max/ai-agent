import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import skillRoutes from './routes/skill.routes';
import exchangeRoutes from './routes/exchange.routes';
import messageRoutes from './routes/message.routes';
import paymentRoutes from './routes/payment.routes';
import { errorHandler } from './middleware/error.middleware';
import { authenticate } from './middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/skills', authenticate, skillRoutes);
app.use('/api/exchanges', authenticate, exchangeRoutes);
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/payments', authenticate, paymentRoutes);

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
  });
  
  socket.on('send_message', async (data) => {
    const { chatId, message, senderId } = data;
    
    // Save to database
    const savedMessage = await prisma.message.create({
      data: {
        content: message,
        senderId,
        chatId
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true
          }
        }
      }
    });
    
    // Broadcast to chat room
    io.to(`chat_${chatId}`).emit('new_message', savedMessage);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
