const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/auth',    require('./routes/authRoutes'));
app.use('/api/entries', require('./routes/entryRoutes'));
app.use('/api/stats',   require('./routes/statsRoutes'));

app.get('/', (req, res) => {
  res.json({ message: '🌿 Reflect API is running...' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});