import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/anpr_city_intelligence';
  try {
    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    console.log(`[Database] MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    isConnected = false;
    console.warn(`[Database] MongoDB not reachable at ${uri}.`);
    console.warn(`[Database] System running in resilient hybrid mode (Data caching & memory fallback active). Set valid MONGODB_URI in server/.env for permanent Atlas/local storage.`);
  }
};

export const getDBStatus = () => ({
  connected: isConnected,
  readyState: mongoose.connection.readyState,
  host: mongoose.connection.host || 'local-fallback',
  name: mongoose.connection.name || 'anpr_city_intelligence'
});
