const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Crop Prediction Proxy Server is running!' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Crop Prediction Proxy Server is Running!',
    endpoints: {
      health: 'GET /health',
      predict: 'POST /api/predict'
    }
  });
});

// Prediction endpoint
app.post('/api/predict', async (req, res) => {
  try {
    console.log('📨 Received prediction request:', req.body);
    
    const submitResponse = await axios.post(
      'https://syedalaibarehman-integrate.hf.space/gradio_api/queue/push',
      {
        fn_index: 0,
        data: [
          req.body.province,
          req.body.district,
          req.body.crop_type,
          req.body.soil_type,
          req.body.sowing_date,
          req.body.harvest_date,
          parseFloat(req.body.area),
          parseInt(req.body.year),
          parseFloat(req.body.temperature),
          parseFloat(req.body.rainfall),
          parseFloat(req.body.nitrogen),
          parseFloat(req.body.phosphorus),
          parseFloat(req.body.potassium),
          parseFloat(req.body.soil_ph),
          parseFloat(req.body.ndvi)
        ],
        session_hash: Math.random().toString(36).substring(2)
      }
    );

    const hash = submitResponse.data.hash;
    console.log('✅ Prediction submitted, hash:', hash);

    const result = await pollForResult(hash);
    
    console.log('🎯 Prediction successful:', result);
    res.json({
      success: true,
      prediction: result
    });
    
  } catch (error) {
    console.error('❌ Prediction error:', error);
    res.status(500).json({
      success: false,
      error: 'Prediction failed',
      details: error.message
    });
  }
});

async function pollForResult(hash, maxAttempts = 30, interval = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const statusResponse = await axios.get(
        `https://syedalaibarehman-integrate.hf.space/gradio_api/queue/status?hash=${hash}`
      );
      
      const status = statusResponse.data;
      console.log(`🔄 Polling attempt ${attempt + 1}:`, status.status);
      
      if (status.status === 'COMPLETED') {
        return status.data?.data?.[0];
      } else if (status.status === 'FAILED') {
        throw new Error('Prediction job failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      throw error;
    }
  }
  throw new Error('Prediction timeout');
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
