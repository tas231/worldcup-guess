const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' }); // Load from root
const { initCron } = require('./services/cron');
const apiRoutes = require('./routes/api');
const { initDB } = require('./services/db');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

// Start Server
initDB().then(() => {
  initCron();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to initialize DB:', err);
});
