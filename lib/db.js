const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;

  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI Vercel Environment Variables içinde tanımlı değil. MongoDB Atlas bağlantı linkini ekleyin.');
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log('✅ MongoDB bağlantısı kuruldu');
  } catch (err) {
    isConnected = false;
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    throw err;
  }
}

module.exports = { connectDB, mongoose };
