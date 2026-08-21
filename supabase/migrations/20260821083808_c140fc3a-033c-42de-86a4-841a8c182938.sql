CREATE POLICY "Anyone can upload import files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'imports');
CREATE POLICY "Anyone can read import files" ON storage.objects FOR SELECT USING (bucket_id = 'imports');
CREATE POLICY "Anyone can delete import files" ON storage.objects FOR DELETE USING (bucket_id = 'imports');