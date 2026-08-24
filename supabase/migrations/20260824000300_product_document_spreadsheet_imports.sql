-- Allow the existing tenant product-document extractor to receive spreadsheets.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv']
where id = 'product-documents';
