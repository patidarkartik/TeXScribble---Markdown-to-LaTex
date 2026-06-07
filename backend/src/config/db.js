import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/markdown_latex';
    await mongoose.connect(connStr);
    console.log(`MongoDB Connected: ${connStr}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Don't crash in local development if mongo is not running immediately
    console.warn('Continuing execution without strict MongoDB blocking...');
  }
};
