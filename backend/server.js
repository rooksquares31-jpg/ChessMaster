require('dotenv').config();

const http        = require('http');
const app         = require('./src/app');
const connectDB   = require('./src/config/database');
const initSocket  = require('./src/socket/classroomSocket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Wrap Express in an HTTP server so Socket.io can share the same port
  const server = http.createServer(app);

  // Attach Socket.io
  const io = initSocket(server);
  app.set('io', io); // make io accessible in controllers if needed

  server.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`📋 Health check : http://localhost:${PORT}/api/health`);
    console.log(`🔌 Socket.io    : ws://localhost:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Closing server...`);
    server.close(() => { console.log('✅ Server closed'); process.exit(0); });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    server.close(() => process.exit(1));
  });
};

startServer();
