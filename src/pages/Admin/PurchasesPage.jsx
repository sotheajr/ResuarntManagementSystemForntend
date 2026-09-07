import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchasesAPI, suppliersAPI, partnersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle, Loader2, ShoppingBag,
  Plus, Edit3, Trash2, CheckCircle, RefreshCw,
  FileImage, FileX, Calendar, DollarSign, Building2,
  Upload
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'https://restaurant-backend-api-xsjc.onrender.com';

const PurchasesPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_date: '',
    total: '',
    partner_id: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [purchasesRes, suppliersRes, partnersRes] = await Promise.all([
        purchasesAPI.getAll(),
        suppliersAPI.getAll(),
        // Partners module has no backend yet — degrade gracefully instead of failing the whole load
        partnersAPI.getAll().catch(() => ({ data: { data: [] } })),
      ]);
      setPurchases(purchasesRes.data?.data || []);
      setSuppliers(suppliersRes.data?.data || []);
      setPartners(partnersRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const getField = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return '';
  };

  function getSupplierName(supplierId) {
    if (!supplierId) return t('Unknown', language) || 'Unknown';
    const supplier = suppliers.find(
      (s) => Number(s.Supplier_ID || s.supplier_id) === Number(supplierId)
    );
    return supplier ? (supplier.Supplier_Name || supplier.supplier_name || t('Unknown', language)) : t('Unknown', language);
  }

  function getPartnerName(item) {
    if (item.partner) {
      return item.partner.partner_name || item.partner.PARTNER_NAME || item.partner.company_name || item.partner.COMPANY_NAME || '—';
    }
    const partnerId = item.partner_id || item.PARTNER_ID;
    if (partnerId) {
      const partner = partners.find(
        (p) => Number(p.partner_id || p.PARTNER_ID) === Number(partnerId)
      );
      if (partner) return partner.partner_name || partner.PARTNER_NAME || partner.company_name || partner.COMPANY_NAME || '—';
    }
    return '—';
  }

  const filteredPurchases = purchases.filter((item) => {
    const term = searchTerm.toLowerCase();
    const supplierName = getSupplierName(item.Supplier_ID || item.supplier_id).toLowerCase();
    const partnerName = getPartnerName(item).toLowerCase();
    const id = String(item.Purchase_ID || item.purchase_id);
    return id.includes(term) || supplierName.includes(term) || partnerName.includes(term);
  });

  const handleReceiptSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      supplier_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      total: '',
      partner_id: '',
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      supplier_id: String(getField(item, 'Supplier_ID', 'supplier_id')),
      purchase_date: item.Purchase_Date ? item.Purchase_Date.split(' ')[0] || item.Purchase_Date : '',
      total: String(getField(item, 'Total', 'total')),
      partner_id: String(getField(item, 'PARTNER_ID', 'partner_id') || ''),
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setReceiptFile(null);
    setReceiptPreview(null);
    setFormError(null);
  };

  const handleFormSubmit = async () => {
    if (!formData.supplier_id || !formData.purchase_date || formData.total === '') {
      setFormError(t('Please fill in all required fields.', language) || 'Please fill in all required fields.');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const formPayload = new FormData();
      formPayload.append('supplier_id', formData.supplier_id);
      formPayload.append('purchase_date', formData.purchase_date);
      formPayload.append('total', formData.total);
      if (formData.partner_id) formPayload.append('partner_id', formData.partner_id);
      if (receiptFile) formPayload.append('receipt_image', receiptFile);

      if (editingItem) {
        const id = getField(editingItem, 'Purchase_ID', 'purchase_id');
        // Use POST with _method=PUT for file uploads (Laravel method spoofing)
        formPayload.append('_method', 'PUT');
        await purchasesAPI.update(id, formPayload);
        showToast('success', t('Purchase', language) + ' ' + t('updated successfully', language));
      } else {
        await purchasesAPI.create(formPayload);
        showToast('success', t('Purchase', language) + ' ' + t('created successfully', language));
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || t('Operation failed', language));
    } finally {
      setFormSubmitting(false);
    }
  };

  const confirmDelete = (item) => {
    setDeleteTarget(item);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      const id = getField(deleteTarget, 'Purchase_ID', 'purchase_id');
      await purchasesAPI.delete(id);
      showToast('success', t('Purchase', language) + ' ' + t('deleted successfully', language));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Operation failed', language));
      setShowDeleteConfirm(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount) => {
    const num = Number(amount);
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  };

  const getReceiptImageUrl = (item) => {
    // Check multiple possible field names for the attachment
    const rawPath = getField(item, 'invoice_attachment', 'INVOICE_ATTACHMENT', 'receipt_image', 'RECEIPT_IMAGE', 'attachment', 'ATTACHMENT');
    if (!rawPath) return null;
    
    // If it's already an absolute URL (e.g., Cloudinary), return it directly
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      return rawPath;
    }
    
    // Otherwise, it's a local storage path - prepend the API base URL
    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\//, '');
    return `${API_BASE_URL}/storage/${cleanPath}`;
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border transition-all duration-300 animate-slide-in ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="text-sm font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 text-current opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Purchases Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('Track purchase orders and deliveries', language)}</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus className="w-4 h-4" />
          {t('Add Purchase', language)}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">{t('Purchase Records', language) || 'Purchase Records'}</h3>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder={t('Search purchases...', language)} value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <button onClick={fetchData} disabled={loading} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title={t('Refresh', language)}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>}

        {!loading && filteredPurchases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <ShoppingBag className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">{t('No purchase records', language) || 'No purchase records'}</h3>
            <p className="text-sm text-gray-500">{t('Click "Add Purchase" to create your first purchase record.', language) || 'Click "Add Purchase" to create your first purchase record.'}</p>
          </div>
        )}

        {!loading && filteredPurchases.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700">{t('Invoice Attachment', language) || 'Invoice'}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700">{t('Purchase ID', language) || 'Purchase ID'}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700">{t('Supplier Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700">{t('Company Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700">{t('Purchase Date', language) || 'Purchase Date'}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700">{t('Total Cost', language) || 'Total Cost'}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPurchases.map((item) => {
                  const id = getField(item, 'Purchase_ID', 'purchase_id');
                  const supplierId = getField(item, 'Supplier_ID', 'supplier_id');
                  const supplierName = getSupplierName(supplierId);
                  const partnerName = getPartnerName(item);
                  const purchaseDate = getField(item, 'Purchase_Date', 'purchase_date');
                  const total = getField(item, 'Total', 'total');
                  const receiptUrl = getReceiptImageUrl(item);

                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {receiptUrl ? (
                          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-block" title={t('View receipt image', language) || 'View receipt'}>
                            <img src={receiptUrl} alt={t('Receipt', language) || 'Receipt'} className="w-12 h-12 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                              onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 hidden items-center justify-center">
                              <FileImage className="w-5 h-5 text-blue-500" />
                            </div>
                          </a>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center" title={t('No receipt attached', language) || 'No receipt'}>
                            <FileX className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className="font-mono font-medium text-gray-900">#{id}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{supplierName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-gray-700">{partnerName}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{formatDate(purchaseDate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right"><span className="font-bold text-gray-900">{formatCurrency(total)}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEditModal(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title={t('Edit Purchase', language) || 'Edit'}>
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button onClick={() => confirmDelete(item)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('Delete Purchase', language) || 'Delete'}>
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingItem ? t('Edit Purchase Record', language) || 'Edit Purchase' : t('Create Purchase Log', language) || 'Create Purchase'}
              </h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4" />{formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Supplier', language)} <span className="text-red-500">*</span></label>
                <select value={formData.supplier_id} onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">{t('-- Select Supplier --', language) || '-- Select Supplier --'}</option>
                  {suppliers.map((s) => (
                    <option key={s.Supplier_ID || s.supplier_id} value={s.Supplier_ID || s.supplier_id}>
                      {s.Supplier_Name || s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Company Name', language)} ({t('Partner', language)})</label>
                <select value={formData.partner_id} onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">{t('-- Select Company --', language) || '-- Select Company --'}</option>
                  {partners.map((p) => (
                    <option key={p.partner_id || p.PARTNER_ID} value={p.partner_id || p.PARTNER_ID}>
                      {p.partner_name || p.PARTNER_NAME || p.company_name || p.COMPANY_NAME}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Purchase Date', language) || 'Purchase Date'} <span className="text-red-500">*</span></label>
                <input type="date" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Total Cost Amount', language) || 'Total Cost'} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="number" min="0" step="0.01" value={formData.total} onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                    placeholder="0.00" className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Receipt Image', language) || 'Receipt Image'}</label>
                {receiptPreview ? (
                  <div className="relative mb-2">
                    <img src={receiptPreview} alt={t('Receipt Preview', language) || 'Preview'} className="w-full h-40 object-cover rounded-lg border border-gray-300" />
                    <button type="button" onClick={clearReceipt} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600" title={t('Remove image', language) || 'Remove'}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
                <input type="file" accept="image/*" onChange={handleReceiptSelect}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                <p className="text-xs text-gray-400 mt-1">{t('Supported formats: JPG, PNG, WEBP (max 2MB)', language) || 'Supported: JPG, PNG, WEBP (max 2MB)'}</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={closeModal} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">{t('Cancel', language)}</button>
                <button onClick={handleFormSubmit} disabled={formSubmitting} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
                  {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                  {formSubmitting ? t('Saving', language) : editingItem ? t('Update Purchase', language) || 'Update' : t('Save Purchase', language) || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Purchase', language) || 'Delete Purchase'}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete this item?', language) || 'Are you sure you want to permanently delete purchase'}{' '}
                <span className="font-medium text-gray-700">#{getField(deleteTarget, 'Purchase_ID', 'purchase_id')}</span>?
              </p>
              <p className="text-xs text-red-500">{t('This action cannot be undone.', language)}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">{t('Cancel', language)}</button>
              <button onClick={handleDelete} disabled={deleteSubmitting} className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                {deleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('Delete', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;