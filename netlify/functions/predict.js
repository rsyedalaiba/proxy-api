const axios = require('axios');

exports.handler = async (event) => {
  // CORS handling
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('Received data:', body);
    
    // Submit prediction
    const submitResponse = await axios.post(
      'https://syedalaibarehman-integrate.hf.space/gradio_api/call/predict_fn',
      {
        data: [
          body.province,
          body.district,
          body.crop_type,
          body.soil_type,
          body.sowing_date,
          body.harvest_date,
          parseFloat(body.area),
          parseInt(body.year),
          parseFloat(body.temperature),
          parseFloat(body.rainfall),
          parseFloat(body.nitrogen),
          parseFloat(body.phosphorus),
          parseFloat(body.potassium),
          parseFloat(body.soil_ph),
          parseFloat(body.ndvi)
        ]
      }
    );

    console.log('API Response:', submitResponse.data);

    const eventId = submitResponse.data.event_id;
    console.log('Got event_id:', eventId);

    // Use the CORRECT status endpoint
    const result = await pollForResult(eventId);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        prediction: result 
      })
    };
    
  } catch (error) {
    console.error('Final Error:', error.message);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message
      })
    };
  }
};

// CORRECT polling function with right endpoint
async function pollForResult(eventId, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // CORRECT STATUS ENDPOINT - This is the fix!
      const statusResponse = await axios.get(
        `https://syedalaibarehman-integrate.hf.space/gradio_api/queue/status?hash=${eventId}`
      );
      
      const status = statusResponse.data;
      console.log(`Polling attempt ${attempt + 1}:`, status.status);
      
      if (status.status === 'COMPLETED') {
        console.log('Prediction completed:', status.data);
        return status.data?.data?.[0];
      } else if (status.status === 'FAILED') {
        throw new Error('Prediction job failed');
      } else if (status.status === 'PENDING') {
        // Continue polling
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`Polling error attempt ${attempt + 1}:`, error.message);
      
      // If it's the last attempt, throw the error
      if (attempt === maxAttempts - 1) {
        throw new Error(`Polling failed after ${maxAttempts} attempts: ${error.message}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  throw new Error('Prediction timeout');
}
