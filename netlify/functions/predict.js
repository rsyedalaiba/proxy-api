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
    
    // Use the working endpoint from our local tests
    const response = await axios.post(
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

    console.log('API Response:', response.data);

    // If it returns event_id, use the correct status endpoint
    if (response.data && response.data.event_id) {
      const eventId = response.data.event_id;
      console.log('Got event_id:', eventId);
      
      // Use the correct status endpoint
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
    } else {
      // Direct response
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: true, 
          prediction: response.data 
        })
      };
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        response: error.response?.data
      })
    };
  }
};

// Correct polling function
async function pollForResult(eventId, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Correct status endpoint
      const statusResponse = await axios.get(
        `https://syedalaibarehman-integrate.hf.space/gradio_api/status?event_id=${eventId}`
      );
      
      const status = statusResponse.data;
      console.log(`Polling attempt ${attempt + 1}:`, status);
      
      if (status.status === 'COMPLETED' || status.status === 'SUCCESS') {
        return status.data || status.result;
      } else if (status.status === 'FAILED' || status.status === 'ERROR') {
        throw new Error('Prediction failed: ' + (status.error || status.message));
      }
      
      // Wait 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('Polling error:', error.message);
      // Continue polling on network errors
      if (attempt === maxAttempts - 1) throw error;
    }
  }
  throw new Error('Prediction timeout after ' + maxAttempts + ' attempts');
}
