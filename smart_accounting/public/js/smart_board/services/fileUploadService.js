/**
 * fileUploadService (Website-safe)
 * - Upload a file and attach to a document field (Attach/Attach Image)
 * - Uses Frappe's built-in /api/method/upload_file endpoint
 */
export async function uploadAttachmentToField({ doctype, docname, fieldname, file, is_private = 1 } = {}) {
  if (!doctype || !docname || !fieldname) throw new Error('Missing doctype/docname/fieldname');
  if (!file) throw new Error('Missing file');

  const fd = new FormData();
  fd.append('file', file);
  fd.append('doctype', doctype);
  fd.append('docname', docname);
  fd.append('fieldname', fieldname);
  fd.append('is_private', String(is_private ? 1 : 0));

  const csrf = (typeof frappe !== 'undefined' && frappe?.csrf_token) ? frappe.csrf_token : null;
  const headers = csrf ? { 'X-Frappe-CSRF-Token': csrf } : {};

  const resp = await fetch('/api/method/upload_file', {
    method: 'POST',
    body: fd,
    headers,
    credentials: 'include',
  });

  // Frappe returns JSON: {message: {...}} (or an error with exception)
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.exc || data?.message || resp.statusText;
    throw new Error(msg || 'Upload failed');
  }
  return data?.message || data;
}


