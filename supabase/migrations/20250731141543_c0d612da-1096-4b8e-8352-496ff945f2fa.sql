-- Create storage bucket for cow images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vacas', 'vacas', true);

-- Create policies for the vacas bucket
CREATE POLICY "Public access for cow images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'vacas');

CREATE POLICY "Anyone can upload cow images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'vacas');

CREATE POLICY "Anyone can update cow images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'vacas');

CREATE POLICY "Anyone can delete cow images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'vacas');