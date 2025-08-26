import mongoose from 'mongoose';
import env from './config';

export async function connectDB() {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env');
  }
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(env.MONGODB_URI);
  console.log('[db] connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  console.log('[db] disconnected');
}
