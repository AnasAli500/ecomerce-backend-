const dns = require('dns');
const mongoose = require('mongoose');

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.syscall === 'querySrv') {
      console.log('DNS SRV resolution issue detected. Applying public DNS servers (8.8.8.8, 1.1.1.1)...');
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch (dnsErr) {
        // ignore if not supported
      }
      await mongoose.connect(uri);
      console.log('MongoDB connected successfully with fallback DNS');
    } else {
      throw err;
    }
  }
}

module.exports = { connectDb };
