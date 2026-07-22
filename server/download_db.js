const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function downloadDB() {
  if (!process.env.K_SERVICE || !process.env.GCS_BUCKET_NAME) {
    console.log('Not running in Cloud Run or GCS_BUCKET_NAME not set, skipping DB download.');
    return;
  }
  
  const storage = new Storage();
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const file = bucket.file('worldcup.db');
  
  try {
    const [exists] = await file.exists();
    if (exists) {
      console.log('Downloading database from GCS to /tmp/worldcup.db...');
      await file.download({ destination: '/tmp/worldcup.db' });
      console.log('Download complete.');
    } else {
      console.log('No existing database found in GCS. A new one will be created.');
    }
  } catch (err) {
    console.error('Error downloading database:', err.message);
  }
}

downloadDB();
