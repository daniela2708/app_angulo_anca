import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const ImageAnalyzer = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "La imagen debe ser menor a 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setAnalysis(''); // Clear previous analysis
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) {
      toast({
        title: "Error",
        description: "Por favor selecciona una imagen primero",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-image', {
        body: {
          image: selectedImage,
          prompt: prompt || undefined
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

      if (data.error) {
        console.error('Function returned error:', data.error);
        toast({
          title: "Error",
          description: "Error del servidor: " + data.error,
          variant: "destructive",
        });
        return;
      }

      setAnalysis(data.analysis);
      toast({
        title: "¡Éxito!",
        description: "Imagen analizada correctamente",
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6" />
            Analizador de Imágenes con Gemini
          </CardTitle>
          <CardDescription>
            Sube una imagen y obtén un análisis detallado usando Google Gemini
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Image Upload Section */}
          <div className="space-y-4">
            <Label>Seleccionar Imagen</Label>
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedImage ? (
                <div className="space-y-4">
                  <img 
                    src={selectedImage} 
                    alt="Selected" 
                    className="max-w-full max-h-64 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-sm text-muted-foreground">
                    Haz clic para cambiar la imagen
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">Haz clic para subir una imagen</p>
                    <p className="text-sm text-muted-foreground">
                      Formatos soportados: JPG, PNG, GIF (max 5MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Custom Prompt Section */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Instrucciones personalizadas (opcional)</Label>
            <Textarea
              id="prompt"
              placeholder="Ej: Enfócate en los colores y objetos principales, o describe el estado emocional de las personas..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Si no especificas nada, se hará un análisis general de la imagen
            </p>
          </div>

          {/* Analyze Button */}
          <Button 
            onClick={analyzeImage}
            disabled={!selectedImage || isAnalyzing}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analizando imagen...
              </>
            ) : (
              'Analizar Imagen'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado del Análisis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {analysis}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};