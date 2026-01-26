import React, { useEffect, useRef, useState } from 'react';
import { Upload, Download, Trash2, FileText, X, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { buildApiUrl, buildDirectUrl } from '../utils/apiConfig';
import { formatDateDDMMYY } from '../utils/dateFormatter';
import { isAdmin } from '../utils/authUtils';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

const ELearning = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMaterial, setViewerMaterial] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const canvasRef = useRef(null);
  const touchStartXRef = useRef(null);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    title: '',
    description: ''
  });

  const adminUser = isAdmin(user);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await axios.get(buildApiUrl('/elearning'), {
        withCredentials: true
      });
      setMaterials(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch E-Learning materials:', error);
      toast.error('Failed to load E-Learning materials');
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadForm.file || !uploadForm.title) {
      toast.error('Please provide a title and select a file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

  const token = localStorage.getItem('auth_token');

await axios.post(
  buildApiUrl('/elearning/upload'),
  formData,
  {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    withCredentials: true
  }
);


      toast.success('E-Learning material uploaded successfully');
      setShowUploadModal(false);
      setUploadForm({ file: null, title: '', description: '' });
      fetchMaterials();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload material');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (materialId) => {
    if (!window.confirm('Are you sure you want to delete this material?')) {
      return;
    }

    try {
      await axios.delete(buildApiUrl(`/elearning/${materialId}`), {
        withCredentials: true
      });
      toast.success('Material deleted successfully');
      fetchMaterials();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete material');
    }
  };

  const handleDownload = (material) => {
    const download = async () => {
      try {
        setDownloadingId(material._id);
        const url = buildDirectUrl(material.fileUrl);
        const token = localStorage.getItem('auth_token');
        const res = await axios.get(url, {
          responseType: 'blob',
          withCredentials: true,
          headers: {
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });

        const blob = new Blob([res.data], { type: material.mimeType || 'application/octet-stream' });
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;

        const rawName = material?.name || 'material';
        const fileName = material?.mimeType?.includes('pdf') && !rawName.toLowerCase().endsWith('.pdf')
          ? `${rawName}.pdf`
          : rawName;

        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download error:', error);
        toast.error('Failed to download material');
      } finally {
        setDownloadingId(null);
      }
    };

    download();
  };

  const openPdfViewer = (material) => {
    setViewerMaterial(material);
    setViewerOpen(true);
  };

  const closePdfViewer = () => {
    setViewerOpen(false);
    setViewerMaterial(null);
    setPdfDoc(null);
    setNumPages(0);
    setPageNumber(1);
    setPdfLoading(false);
    setPdfError('');
  };

  const onTouchStart = (e) => {
    const x = e.touches?.[0]?.clientX;
    touchStartXRef.current = typeof x === 'number' ? x : null;
  };

  const onTouchEnd = (e) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if (typeof endX !== 'number') return;
    const delta = endX - startX;
    if (Math.abs(delta) < 50) return;
    if (delta < 0) {
      setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p));
    } else {
      setPageNumber((p) => Math.max(1, p - 1));
    }
  };

  useEffect(() => {
    const loadPdf = async () => {
      if (!viewerOpen || !viewerMaterial) return;
      if (!viewerMaterial?.mimeType?.includes('pdf')) return;

      try {
        setPdfError('');
        setPdfLoading(true);
        setPdfDoc(null);
        setNumPages(0);
        setPageNumber(1);

        const url = buildDirectUrl(viewerMaterial.fileUrl);
        const token = localStorage.getItem('auth_token');

        const task = pdfjsLib.getDocument({
          url,
          withCredentials: true,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
          disableWorker: true
        });

        const doc = await task.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages || 0);
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setPdfError('Failed to load PDF');
      } finally {
        setPdfLoading(false);
      }
    };

    loadPdf();
  }, [viewerOpen, viewerMaterial]);

  useEffect(() => {
    const render = async () => {
      if (!pdfDoc) return;
      if (!canvasRef.current) return;
      if (!numPages) return;
      if (pageNumber < 1 || pageNumber > numPages) return;

      try {
        setPdfLoading(true);
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (error) {
        console.error('Failed to render PDF page:', error);
        setPdfError('Failed to render PDF');
      } finally {
        setPdfLoading(false);
      }
    };

    render();
  }, [pdfDoc, pageNumber, numPages]);

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return '📊';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝';
    return '📁';
  };

  const getFileType = (mimeType) => {
    if (mimeType?.includes('pdf')) return 'PDF';
    if (mimeType?.includes('presentation')) return 'PPTX';
    if (mimeType?.includes('powerpoint')) return 'PPT';
    if (mimeType?.includes('wordprocessingml')) return 'DOCX';
    if (mimeType?.includes('msword')) return 'DOC';
    return 'FILE';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading E-Learning materials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">E-Learning Materials</h1>
              <p className="text-gray-600 mt-1">
                {adminUser ? 'Upload and manage training materials' : 'Access training and learning resources'}
              </p>
            </div>
            {adminUser && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Upload Material
              </button>
            )}
          </div>
        </div>

        {/* Materials List */}
        {materials.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No materials available</h3>
            <p className="text-gray-600">
              {adminUser ? 'Upload your first E-Learning material to get started' : 'Check back later for new materials'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materials.map((material) => (
              <div
                key={material._id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{getFileIcon(material.mimeType)}</div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                    {getFileType(material.mimeType)}
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {material.name}
                </h3>
                
                {material.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {material.description}
                  </p>
                )}
                
                <div className="flex items-center text-xs text-gray-500 mb-4">
                  <span>{formatFileSize(material.fileSize)}</span>
                  <span className="mx-2">•</span>
                  <span>{formatDateDDMMYY(material.createdAt)}</span>
                </div>
                
                {material.uploadedBy && (
                  <p className="text-xs text-gray-500 mb-4">
                    Uploaded by: {material.uploadedBy.firstName} {material.uploadedBy.lastName}
                  </p>
                )}
                
                <div className="flex items-center gap-2">
                  {(material.mimeType?.includes('pdf') || material.mimeType?.includes('presentation') || material.mimeType?.includes('powerpoint')) && (
                    <button
                      onClick={() => openPdfViewer(material)}
                      className="p-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      title={material.mimeType?.includes('pdf') ? 'View PDF' : 'View Presentation'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(material)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    disabled={downloadingId === material._id}
                  >
                    <Download className="w-4 h-4" />
                    {downloadingId === material._id ? 'Downloading...' : 'Download'}
                  </button>
                  {adminUser && (
                    <button
                      onClick={() => handleDelete(material._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete material"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upload E-Learning Material</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadForm({ file: null, title: '', description: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter material title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File * (PDF, PPT, PPTX, DOC, DOCX - Max 15MB)
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  accept=".pdf,.ppt,.pptx,.doc,.docx"
                  className="w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                />
                {uploadForm.file && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadForm({ file: null, title: '', description: '' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploading || !uploadForm.file || !uploadForm.title}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl shadow-xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{viewerMaterial?.name || 'Document Viewer'}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {viewerMaterial?.mimeType?.includes('pdf') ? 'Swipe left/right or use arrows to change pages.' : 'Viewing presentation'}
                </p>
              </div>
              <button onClick={closePdfViewer} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden px-6 py-4"
              onTouchStart={viewerMaterial?.mimeType?.includes('pdf') ? onTouchStart : undefined}
              onTouchEnd={viewerMaterial?.mimeType?.includes('pdf') ? onTouchEnd : undefined}
            >
              {pdfError ? (
                <div className="p-8 text-center text-red-600">{pdfError}</div>
              ) : pdfLoading && !pdfDoc ? (
                <div className="p-8 text-center text-gray-600">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <div className="mt-3">Loading {getFileType(viewerMaterial?.mimeType)}...</div>
                </div>
              ) : viewerMaterial?.mimeType?.includes('pdf') ? (
                <div className="flex justify-center h-full items-center">
                  <canvas ref={canvasRef} className="max-w-full shadow-lg" />
                </div>
              ) : (viewerMaterial?.mimeType?.includes('presentation') || viewerMaterial?.mimeType?.includes('powerpoint')) ? (
                <div className="h-full w-full">
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(buildDirectUrl(viewerMaterial.fileUrl))}`}
                    className="w-full h-full border-0 rounded"
                    title={viewerMaterial.name}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              {viewerMaterial?.mimeType?.includes('pdf') ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                      disabled={!pdfDoc || pageNumber <= 1}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p))}
                      disabled={!pdfDoc || (numPages ? pageNumber >= numPages : true)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-sm text-gray-600">
                    {pdfDoc ? (
                      <span>
                        Page {pageNumber} of {numPages || '-'}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </>
              ) : (
                <div></div>
              )}

              <button
                onClick={() => handleDownload(viewerMaterial)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={!viewerMaterial || downloadingId === viewerMaterial?._id}
              >
                <Download className="w-4 h-4" />
                {downloadingId === viewerMaterial?._id ? 'Downloading...' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ELearning;
