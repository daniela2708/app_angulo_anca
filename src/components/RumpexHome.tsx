import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/Logo.png';
import vacaImage from '@/assets/vaca.png';

type AnalysisResult = {
  valido: boolean;
  razonInvalidez?: string;
  numeroVacasDetectadas?: number;
  vacaAnalizada?: number;
  anguloCm?: number;
  puntajeLineal?: number;
  categoria?: 'Alto' | 'Nivelado' | 'Ligera caída' | 'Intermedio' | 'Pronunciada';
  recomendacion?: string;
};

type Screen = 'home' | 'preview' | 'result';

export const RumpexHome = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateAndProcessImage = (file: File) => {
    // Verificar tipo MIME soportado según documentación de Gemini
    const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    if (!supportedTypes.includes(file.type)) {
      toast({
        title: "Formato no soportado",
        description: "Por favor usa archivos PNG, JPEG, WEBP, HEIC o HEIF",
        variant: "destructive",
      });
      return false;
    }

    // Gemini soporta archivos grandes usando la API de Files
    // Para archivos > 20MB se usará automáticamente la File API
    // Límite práctico más generoso para la interfaz web
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      toast({
        title: "Archivo muy grande",
        description: "La imagen debe ser menor a 100MB para procesamiento web",
        variant: "destructive",
      });
      return false;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setCurrentScreen('preview');
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndProcessImage(file);
    }
    // Reset input para permitir seleccionar la misma imagen
    event.target.value = '';
  };

  const handleGallerySelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndProcessImage(file);
    }
    // Reset input para permitir seleccionar la misma imagen
    event.target.value = '';
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-image', {
        body: {
          image: selectedImage,
          prompt: `Eres un experto veterinario especializado en conformación bovina. Analiza esta imagen de una vaca lechera y evalúa ESPECÍFICAMENTE el ángulo de su anca (rump angle).

PROCESO DE ANÁLISIS TÉCNICO:
1. VALIDACIÓN: Confirma que la imagen contiene una vaca lechera vista de perfil lateral
2. IDENTIFICACIÓN ANATÓMICA: Localiza exactamente:
   - Tuberosidad coxal (hueso de la cadera/pin bone)
   - Tuberosidad isquiática (pin bone/isquion)
   - Línea dorsal del anca
3. MEDICIÓN PRECISA: Mide el ángulo entre la línea horizontal y la línea que conecta estos puntos anatómicos
4. EVALUACIÓN CRÍTICA: Analiza la conformación real de ESTA vaca específica

ESCALA DE PUNTUACIÓN LINEAL (1-9):
- 1-2: Anca muy caída (>35°) - Defecto severo
- 3-4: Anca pronunciadamente caída (25-35°) - Defecto moderado  
- 5-6: Anca intermedia/ligera caída (15-25°) - Aceptable
- 7-8: Anca nivelada/alta (5-15°) - Deseable
- 9: Anca muy alta (<5°) - Excelente

ANÁLISIS DIFERENCIAL OBLIGATORIO:
- Considera la raza, edad aparente, posición de la vaca
- Evalúa la calidad ósea y muscular del área
- NO uses valores por defecto - cada vaca es única
- Sé crítico y preciso en tu evaluación

Devuelve ÚNICAMENTE este JSON con mediciones reales:
{
  "valido": boolean,
  "razonInvalidez": "string detallada si no es válida",
  "numeroVacasDetectadas": number,
  "vacaAnalizada": number,
  "anguloCm": number (ángulo real medido),
  "puntajeLineal": number (1-9, basado en medición real),
  "categoria": "Alto" | "Nivelado" | "Ligera caída" | "Intermedio" | "Pronunciada",
  "recomendacion": "string con análisis técnico específico de esta vaca"
}`
        }
      });

      if (error) {
        console.error('Error calling function:', error);
        toast({
          title: "Error",
          description: "Error al analizar la imagen: " + error.message,
          variant: "destructive",
        });
        return;
      }

      // Use the structured response from the edge function
      setAnalysisResult(data as AnalysisResult);
      setCurrentScreen('result');
      
      toast({
        title: "¡Análisis completo!",
        description: "La imagen ha sido analizada exitosamente",
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Error",
        description: "Error inesperado al analizar la imagen",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetToHome = () => {
    setCurrentScreen('home');
    setSelectedImage(null);
    setAnalysisResult(null);
  };

  const getCategoryColor = (categoria?: string) => {
    switch (categoria) {
      case 'Alto':
        return 'text-green-600'; // Excelente - Verde
      case 'Nivelado':
        return 'text-green-500'; // Muy bueno - Verde claro
      case 'Ligera caída':
        return 'text-yellow-500'; // Aceptable - Amarillo
      case 'Intermedio':
        return 'text-orange-500'; // Necesita atención - Naranja
      case 'Pronunciada':
        return 'text-red-600'; // Problemático - Rojo
      default:
        return 'text-foreground';
    }
  };

  // Home Screen
  if (currentScreen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EAD9C3] to-[#FBF5E9] flex flex-col">
        {/* Navbar */}
        <div className="bg-[#7A4E32] shadow-md p-4 sticky top-0 z-10">
          <div className="flex items-center justify-center max-w-md mx-auto">
            <div className="flex items-center">
              <div className="w-10 h-10 mr-3">
                <img 
                  src={logo} 
                  alt="Rumpex AI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-xl font-serif font-bold text-[#FBF5E9]">Rumpex AI</h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
          <div className="text-center space-y-4">
            {/* Central Illustration with Integrated Circular Design */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              {/* Main circular container with integrated design */}
              <div className="w-full h-full rounded-full bg-pink-100 relative overflow-hidden">
                {/* Cow image perfectly integrated */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <img 
                    src={vacaImage} 
                    alt="Demo cow" 
                    className="w-[85%] h-[85%] object-contain"
                  />
                </div>
              </div>
            </div>
            
            <h2 className="font-serif text-2xl md:text-3xl text-[#404335] font-bold">
              Análisis del ángulo de anca
            </h2>
            <p className="text-[#5A5751] font-inter text-lg max-w-sm mx-auto leading-relaxed">
              Toma o sube una foto de tu vaca para obtener un análisis instantáneo
            </p>
            <p className="text-[#5A5751]/70 font-inter text-sm max-w-sm mx-auto">
              Acepta archivos PNG, JPEG, WEBP, HEIC o HEIF hasta 100MB
            </p>
          </div>

          <div className="w-full max-w-sm space-y-4">
            {/* Primary CTA Button - Camera */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => cameraInputRef.current?.click()}
              className="w-full bg-[#6C7E49] hover:bg-[#5d6e3c] text-[#FBF5E9] flex items-center justify-center gap-3 py-4 rounded-xl font-medium text-lg shadow-lg transition-colors active:scale-95"
            >
              <Camera size={24} />
              Tomar Foto
            </motion.button>

            {/* Secondary CTA Button - Gallery */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[#7A4E32] hover:bg-[#6b4129] text-[#FBF5E9] flex items-center justify-center gap-3 py-4 rounded-xl font-medium text-lg shadow-lg transition-colors active:scale-95"
            >
              <Upload size={24} />
              Subir Imagen
            </motion.button>
          </div>

          {/* Input para galería */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            onChange={handleGallerySelect}
            className="hidden"
            aria-label="Seleccionar imagen de galería"
          />
          
          {/* Input para cámara */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleCameraCapture}
            className="hidden"
            aria-label="Tomar foto con cámara"
          />
        </div>
      </div>
    );
  }

  // Preview Screen
  if (currentScreen === 'preview' && selectedImage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EAD9C3] to-[#FBF5E9] flex flex-col">
        {/* Header */}
        <div className="bg-[#7A4E32] shadow-md p-4">
          <div className="flex items-center max-w-md mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToHome}
              className="mr-3 text-[#FBF5E9] hover:bg-[#FBF5E9]/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center">
              <div className="w-8 h-8 mr-2">
                <img 
                  src={logo} 
                  alt="Rumpex AI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-xl font-serif font-bold text-[#FBF5E9]">Vista Previa</h1>
            </div>
          </div>
        </div>

        {/* Image Preview */}
        <div className="flex-1 flex flex-col p-4">
          <Card className="flex-1 mb-6">
            <CardContent className="p-4 h-full flex items-center justify-center">
              <img 
                src={selectedImage} 
                alt="Vista previa" 
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={analyzeImage}
              disabled={isAnalyzing}
              className="w-full bg-[#6C7E49] hover:bg-[#5d6e3c] disabled:bg-[#6C7E49]/50 text-[#FBF5E9] flex items-center justify-center gap-3 py-4 rounded-xl font-medium text-lg shadow-lg transition-colors"
              aria-label="Analizar imagen de vaca"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Analizando...
                </>
              ) : (
                'Analizar Imagen'
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={resetToHome}
              className="w-full bg-[#7A4E32] hover:bg-[#6b4129] text-[#FBF5E9] flex items-center justify-center gap-3 py-4 rounded-xl font-medium text-lg shadow-lg transition-colors"
            >
              Cambiar Imagen
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // Result Screen
  if (currentScreen === 'result' && analysisResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EAD9C3] to-[#FBF5E9] flex flex-col">
        {/* Header */}
        <div className="bg-[#7A4E32] shadow-md p-4">
          <div className="flex items-center max-w-md mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToHome}
              className="mr-3 text-[#FBF5E9] hover:bg-[#FBF5E9]/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center">
              <div className="w-8 h-8 mr-2">
                <img 
                  src={logo} 
                  alt="Rumpex AI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-xl font-serif font-bold text-[#FBF5E9]">Resultado</h1>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 p-4 space-y-6">
          {!analysisResult.valido ? (
            <Card className="border-[#C35E38] bg-[#C35E38]/5">
              <CardContent className="p-6 text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-serif font-bold mb-2 text-[#C35E38]">
                  Imagen no válida
                </h3>
                <p className="text-white bg-[#C35E38] p-3 rounded-lg font-inter">
                  {analysisResult.razonInvalidez}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Score Card */}
              <Card className="shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="text-7xl font-serif font-bold text-[#6C7E49] mb-2">
                    {analysisResult.puntajeLineal}
                  </div>
                  <div className="text-sm text-[#5A5751] mb-2 font-inter">
                    Puntaje Lineal (1-9)
                  </div>
                  <div className={`text-2xl font-serif font-bold ${getCategoryColor(analysisResult.categoria)}`}>
                    {analysisResult.categoria}
                  </div>
                  {analysisResult.anguloCm && (
                    <div className="text-sm text-muted-foreground mt-2 font-inter">
                      Ángulo: {analysisResult.anguloCm}°
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Details Card */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-lg font-serif font-bold text-[#404335]">Detalles del Análisis</h3>
                  
                  <div className="space-y-2 font-inter text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vacas detectadas:</span>
                      <span>{analysisResult.numeroVacasDetectadas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vaca analizada:</span>
                      <span>#{analysisResult.vacaAnalizada}</span>
                    </div>
                  </div>

                  {analysisResult.recomendacion && (
                    <div className="pt-4 border-t">
                      <h4 className="font-serif font-semibold mb-2 text-[#404335]">Recomendación</h4>
                      <p className="text-sm text-muted-foreground font-inter leading-relaxed">
                        {analysisResult.recomendacion}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Action Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={resetToHome}
            className="w-full bg-[#6C7E49] hover:bg-[#5d6e3c] text-[#FBF5E9] flex items-center justify-center py-4 rounded-xl font-medium text-lg shadow-lg transition-colors"
          >
            Analizar Otra Vaca
          </motion.button>
        </div>
      </div>
    );
  }

  return null;
};