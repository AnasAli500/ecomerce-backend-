const dns = require('dns');
const mongoose = require('mongoose');

// Helper to mask credentials in connection string for safe logging
function maskMongoUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

async function connectDb() {
  // Support both MONGO_URI and MONGODB_URI
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    const errorMsg =
      '[MongoDB Error] Neither MONGO_URI nor MONGODB_URI is set in environment variables!\n' +
      'Please configure MONGO_URI in Railway / .env before starting the server.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const masked = maskMongoUri(uri);
  console.log(`[Database] Attempting to connect to MongoDB: ${masked}`);

  mongoose.set('strictQuery', true);

  // Setup connection lifecycle listeners
  mongoose.connection.removeAllListeners('error');
  mongoose.connection.removeAllListeners('disconnected');
  mongoose.connection.removeAllListeners('reconnected');

  mongoose.connection.on('error', (err) => {
    console.error('[Database Runtime Error]:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database]: Disconnected from MongoDB. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[Database]: Reconnected to MongoDB successfully.');
  });

  const connectionOptions = {
    serverSelectionTimeoutMS: 10000, // 10s timeout instead of hanging indefinitely
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(uri, connectionOptions);
    console.log('[Database] MongoDB connected successfully.');
  } catch (err) {
    console.error('[Database] Initial connection attempt failed:', err.message);

    // If DNS SRV lookup failed, try fallback DNS servers
    if (err.code === 'ECONNREFUSED' || err.syscall === 'querySrv') {
      console.log('[Database] DNS SRV resolution issue detected. Applying fallback public DNS (8.8.8.8, 1.1.1.1)...');
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch (dnsErr) {
        console.warn('[Database] Could not override DNS servers:', dnsErr.message);
      }

      try {
        await mongoose.connect(uri, connectionOptions);
        console.log('[Database] MongoDB connected successfully with fallback DNS.');
        return;
      } catch (fallbackErr) {
        console.error('[Database] Fallback DNS MongoDB connection also failed:', fallbackErr.message);
        diagnoseMongoError(fallbackErr);
        throw fallbackErr;
      }
    } else {
      diagnoseMongoError(err);
      throw err;
    }
  }
}

function diagnoseMongoError(err) {
  console.error('\n========== MONGODB CONNECTION DIAGNOSTIC ==========');
  console.error('Error Code/Name:', err.name || err.code || 'UNKNOWN');
  console.error('Error Message:', err.message);

  if (err.name === 'MongoServerSelectionError' || err.message?.includes('buffering timed out')) {
    console.error('\n-> ACTION REQUIRED: IP Whitelist / Network Access Issue');
    console.error('   Railway dynamically allocates outbound IP addresses for containers.');
    console.error('   1. Log into MongoDB Atlas (https://cloud.mongodb.com)');
    console.error('   2. Go to "Network Access" in the left sidebar menu.');
    console.error('   3. Click "Add IP Address" and select "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0).');
    console.error('   4. Confirm changes and wait 1 minute for rules to deploy.');
  } else if (err.code === 8000 || err.message?.includes('bad auth') || err.message?.includes('Authentication failed')) {
    console.error('\n-> ACTION REQUIRED: Authentication Issue');
    console.error('   1. Verify your database username and password in MONGO_URI.');
    console.error('   2. If password contains special characters (@, :, /, #), URL-encode them.');
    console.error('   3. In MongoDB Atlas -> Database Access, ensure the user has Read and Write permissions.');
  } else {
    console.error('\n-> Please check your MONGO_URI connection string and cluster status.');
  }
  console.error('===================================================\n');
}

module.exports = { connectDb };
