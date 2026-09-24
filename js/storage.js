// File uploads. Both images and resumes go through free, key-less-enough
// third-party upload APIs directly from the browser (ImgBB for images,
// Cloudinary for resumes) — only the resulting URL is saved into Firestore.
// Firebase Storage is NOT used: as of late 2024, Google requires the paid
// Blaze plan just to provision a Storage bucket, even for tiny free usage.
// For production, move these calls behind a secure proxy/Cloud Function so
// the upload credentials below aren't shipped to clients.

const IMGBB_ENDPOINT = 'https://api.imgbb.com/1/upload';
const IMGBB_API_KEY = 'bdf79b7d013d7a3ed9188d870579aebf';
export const MAX_IMAGE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
export function validateImageFile(file) {
  if (!file) return 'Please select a file.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only image files (JPG, PNG, WEBP, GIF, BMP) are supported.';
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `File is too large. Maximum size is ${MAX_IMAGE_MB}MB.`;
  return null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImageToImgBB(file) {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  try {
    const base64 = await fileToBase64(file);
    const body = new FormData();
    body.append('image', base64.split(',')[1]); // raw base64, no data-uri prefix
    const res = await fetch(`${IMGBB_ENDPOINT}?key=${IMGBB_API_KEY}`, { method: 'POST', body });
    const data = await res.json();
    if (!data?.success) throw new Error('upload rejected');
    return { url: data.data.url, thumbUrl: data.data.thumb?.url || data.data.url, deleteUrl: data.data.delete_url };
  } catch (e) {
    if (e.message.includes('Only image') || e.message.includes('too large')) throw e;
    if (!navigator.onLine) throw new Error('No internet connection. Please check your network.');
    throw new Error('Unable to upload file. Please try again.');
  }
}

/**
 * Wires an <input type="file"> + preview avatar. Calls onUploaded(url) when done.
 * Returns { getUrl(), reset() } so the parent form can read the current URL.
 */
export function setupImageUpload({ inputEl, previewEl, onUploaded }) {
  let currentUrl = previewEl?.dataset?.existing || '';
  inputEl.addEventListener('change', async () => {
    const file = inputEl.files[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { alert(err); inputEl.value = ''; return; }
    previewEl.insertAdjacentHTML('beforeend',
      '<span class="upload-overlay"><span class="spinner spinner-sm" style="border-top-color:#fff"></span></span>');
    try {
      const result = await uploadImageToImgBB(file);
      currentUrl = result.url;
      previewEl.innerHTML = `<img src="${result.url}" alt="preview">`;
      onUploaded?.(result.url);
    } catch (e) {
      previewEl.querySelector('.upload-overlay')?.remove();
      alert(e.message);
    }
  });
  return { getUrl: () => currentUrl, reset: () => { currentUrl = ''; inputEl.value = ''; } };
}

/* ==================== Resume uploads (PDF/DOCX, via Cloudinary) ====================
 * Resumes are real documents, not images, so they can't go through ImgBB above.
 * Uses Cloudinary's free tier with an UNSIGNED upload preset — safe to call
 * directly from the browser with no secret key involved (an unsigned preset
 * can only do what it's configured to allow; it can't manage your account).
 *
 * Trade-off worth knowing: because this is unsigned (no backend), we can't
 * make an authenticated *delete* request either — deletion requires a signed
 * request with the account's API secret, which must never live in browser
 * code. So "Remove"/"Replace" in the app fully work (the old resume stops
 * being referenced/shown), but the old file itself may remain, unused, on
 * Cloudinary's servers. Fine for a free-tier project; if this ever needs real
 * cleanup, that means adding a small backend (e.g. a Cloud Function) that
 * holds the API secret and issues signed deletes.
 */
const CLOUDINARY_CLOUD_NAME = 'cl6nhybi';
const CLOUDINARY_UPLOAD_PRESET = 'resumes_unsigned';
const CLOUDINARY_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`;

export const MAX_RESUME_MB = 5;
const RESUME_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

export function validateResumeFile(file) {
  if (!file) return 'Please select a file.';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const okByType = RESUME_TYPES[file.type];
  const okByExt = ['pdf', 'doc', 'docx'].includes(ext);
  // Some browsers/OSes report a blank or generic MIME type for .doc/.docx —
  // fall back to the file extension so real resumes aren't rejected.
  if (!okByType && !okByExt) return 'Only PDF, DOC, or DOCX files are supported.';
  if (file.size > MAX_RESUME_MB * 1024 * 1024) return `File is too large. Maximum size is ${MAX_RESUME_MB}MB.`;
  return null;
}

/**
 * Uploads a resume to Cloudinary (resource_type "raw", since PDFs/DOCX aren't
 * images) and returns its public URL.
 */
export async function uploadResumeFile(file, uid) {
  const validationError = validateResumeFile(file);
  if (validationError) throw new Error(validationError);
  try {
    const ext = (file.name.split('.').pop() || RESUME_TYPES[file.type] || 'pdf').toLowerCase();
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // A stable, collision-resistant id per student+upload. Raw resource types
    // need the extension included directly in the public_id to be served back
    // (and downloaded) with the right file type.
    form.append('public_id', `${uid}_${Date.now()}.${ext}`);
    const res = await fetch(CLOUDINARY_ENDPOINT, { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'upload rejected');
    return { url: json.secure_url, publicId: json.public_id, name: file.name };
  } catch (e) {
    if (!navigator.onLine) throw new Error('No internet connection. Please check your network.');
    throw new Error('Unable to upload resume. Please try again.');
  }
}