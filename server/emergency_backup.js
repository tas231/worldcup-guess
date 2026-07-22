const sqlite3 = require('sqlite3').verbose();
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function backup() {
  console.log('Downloading live DB from GCS to local tmp...');
  if (!process.env.GCS_BUCKET_NAME) {
    console.error('Error: GCS_BUCKET_NAME environment variable is not set.');
    return;
  }
  const storage = new Storage();
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const liveFile = bucket.file('worldcup.db');
  
  await liveFile.download({ destination: './live_download.db' });
  console.log('Downloaded. Running VACUUM INTO...');
  
  const db = new sqlite3.Database('./live_download.db');
  db.serialize(() => {
    db.run(`VACUUM INTO './vacuumed_snapshot.db'`, async (err) => {
      if (err) {
        console.error('Vacuum failed:', err);
        return;
      }
      console.log('Vacuum complete. Uploading to GCS...');
      const destFile = bucket.file('EMERGENCY_LIVE_BACKUP_JUNE_2026.db');
      await bucket.upload('./vacuumed_snapshot.db', { destination: 'EMERGENCY_LIVE_BACKUP_JUNE_2026.db' });
      console.log('Emergency backup uploaded successfully.');
    });
  });
}

backup().catch(console.error);
