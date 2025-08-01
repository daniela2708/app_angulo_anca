import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, prompt } = await req.json();
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'Image is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert base64 image to proper format for Gemini
    const base64Data = image.split(',')[1] || image;
    
    const analysisPrompt = `Eres un experto veterinario especializado en evaluación del ángulo de anca en vacas lecheras. 

Analiza esta imagen de una vaca y evalúa el ángulo de su anca. Debes responder ÚNICAMENTE con un JSON válido en el siguiente formato exacto:

{
  "valido": boolean,
  "razonInvalidez": string|null,
  "numeroVacasDetectadas": number,
  "vacaAnalizada": number|null,
  "anguloCm": number|null,
  "puntajeLineal": number|null,
  "categoria": "Alto|Nivelado|Ligera caída|Intermedio|Pronunciada",
  "recomendacion": string|null
}

Criterios:
- valido: true si hay al menos una vaca visible y se puede evaluar el anca, false si no
- razonInvalidez: explicación si valido=false
- numeroVacasDetectadas: cantidad de vacas en la imagen
- vacaAnalizada: número de la vaca analizada (1, 2, etc.)
- anguloCm: ángulo del anca en grados (15-35° típico)
- puntajeLineal: escala 1-9 donde 1=muy caído, 5=nivelado, 9=muy alto
- categoria: clasificación según puntaje
- recomendacion: consejo breve para el ganadero

NO agregues texto adicional, solo el JSON.`;

    const requestBody = {
      contents: [{
        parts: [
          {
            text: analysisPrompt
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 32,
        topP: 1,
        maxOutputTokens: 512,
      }
    };

    console.log('Making request to Gemini API...');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'Error from Gemini API',
        details: errorData 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('Gemini API response:', data);

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      return new Response(JSON.stringify({ 
        error: 'No valid response from Gemini API',
        data 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const analysisText = data.candidates[0].content.parts[0].text;
    
    // Try to parse the JSON response
    let analysisResult;
    try {
      // Clean the response text to extract JSON
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      // Return a fallback response
      analysisResult = {
        valido: false,
        razonInvalidez: "Error al procesar la respuesta del análisis. Intenta con otra imagen.",
        numeroVacasDetectadas: 0,
        vacaAnalizada: null,
        anguloCm: null,
        puntajeLineal: null,
        categoria: null,
        recomendacion: null
      };
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-image function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});