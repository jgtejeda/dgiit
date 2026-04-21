/**
 * DGIIT | SECTURI — Módulo Pre-Folios v2
 * Layout dividido: Formulario izquierda · Lista + filtros derecha
 */

const ELIZABETH_EMAIL_FE = 'emartinezes@guanajuato.gob.mx';

// ─── CACHE DE FOLIOS ────────────────────────────────────────────────────────
let _allFolios = [];
let _activeFilter = 'ALL';

// ─── API HELPERS ────────────────────────────────────────────────────────────
const folioAPI = {
    list:     ()           => apiClient.request('/folios'),
    search:   (q)          => apiClient.request(`/folios/search?q=${encodeURIComponent(q)}`),
    create:   (data)       => apiClient.request('/folios', { method: 'POST', body: JSON.stringify(data) }),
    approve:  (id)         => apiClient.request(`/folios/${id}/approve`, { method: 'PUT' }),
    cancel:   (id, reason) => apiClient.request(`/folios/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ cancel_reason: reason }) }),
    reassign: (id, data)   => apiClient.request(`/folios/${id}/reassign`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadEvidence: (id, file) => {
        const formData = new FormData();
        formData.append('evidence', file);
        const token = apiClient.getToken();
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const base = isLocal ? 'http://localhost:4001/api' : '/api-dgiit/api';
        return fetch(`${base}/folios/${id}/evidence`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData,
            credentials: 'include'
        }).then(r => r.json());
    }
};

// ─── DELIVERY LABELS ─────────────────────────────────────────────────────────
const DELIVERY_LABELS = {
    PAM: 'PAM',
    FIRMA_AUTOGRAFA: 'Firma Autógrafa',
    PAM_Y_FIRMA: 'PAM + Firma',
    CORREO: 'Correo'
};

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function statusBadge(status) {
    const map = {
        PENDING:   { label: 'Pendiente', cls: 'folio-badge-pending' },
        APPROVED:  { label: 'En Uso',    cls: 'folio-badge-approved' },
        CANCELLED: { label: 'Cancelado', cls: 'folio-badge-cancelled' }
    };
    const s = map[status] || { label: status, cls: '' };
    return `<span class="folio-badge ${s.cls}">${s.label}</span>`;
}

// ─── RENDER LISTA DE FOLIOS (cards) ──────────────────────────────────────────
function renderFoliosList(folios) {
    const list = document.getElementById('folios-list');
    if (!list) return;

    if (!folios || folios.length === 0) {
        list.innerHTML = `<div class="folios-empty"><i data-lucide="inbox"></i> No hay folios en esta categoría.</div>`;
        refreshIcons();
        return;
    }

    const isElizabeth = currentUser && currentUser.email === ELIZABETH_EMAIL_FE;
    const isPrivileged = isElizabeth || (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'GOD'));

    list.innerHTML = folios.map(f => {
        const date = f.created_at
            ? new Date(f.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
        const folioNum = f.folio_number || `<em style="opacity:.5;">Sin asignar</em>`;

        // Acciones
        let actions = `<button class="folio-card-btn folio-btn-view" onclick="openFolioDetail(${f.id})" title="Ver detalle"><i data-lucide="eye"></i></button>`;

        if (isElizabeth && f.status === 'PENDING') {
            actions += `<button class="folio-card-btn folio-btn-approve" onclick="approveFolio(${f.id})" title="Aprobar"><i data-lucide="check-circle"></i></button>`;
            actions += `<button class="folio-card-btn folio-btn-cancel" onclick="cancelFolioPrompt(${f.id})" title="Cancelar"><i data-lucide="x-circle"></i></button>`;
        }
        if (isElizabeth && f.status === 'CANCELLED') {
            actions += `<button class="folio-card-btn folio-btn-reassign" onclick="prefillReassign(${f.id})" title="Reasignar (nueva vida)"><i data-lucide="refresh-cw"></i></button>`;
        }

        const canUpload = f.status === 'APPROVED' && (
            (currentUser && currentUser.email === f.requested_by_email) || isPrivileged
        );
        if (canUpload) {
            const icon = f.evidence_pdf_name ? 'file-check' : 'upload';
            actions += `<button class="folio-card-btn folio-btn-evidence" onclick="uploadEvidencePrompt(${f.id})" title="${f.evidence_pdf_name ? 'Reemplazar PDF' : 'Subir evidencia PDF'}"><i data-lucide="${icon}"></i></button>`;
        }
        if (f.evidence_pdf_name) {
            const safeName = (f.evidence_pdf_name || 'evidencia.pdf').replace(/'/g, "\\'");
            actions += `<button class="folio-card-btn folio-btn-pdf" onclick="viewFolioPDF(${f.id}, '${safeName}')" title="Ver PDF"><i data-lucide="file-text"></i></button>`;
        }

        return `
        <div class="folio-card folio-card-${f.status.toLowerCase()}">
            <div class="folio-card-left">
                <div class="folio-card-num">${folioNum}</div>
                <div class="folio-card-meta">${date}</div>
            </div>
            <div class="folio-card-center">
                <div class="folio-card-subject">${f.subject.length > 70 ? f.subject.substring(0,70)+'…' : f.subject}</div>
                <div class="folio-card-info">
                    <span><i data-lucide="user-check" style="width:12px;"></i> ${f.directed_to}</span>
                    <span><i data-lucide="send" style="width:12px;"></i> ${DELIVERY_LABELS[f.delivery_mode] || f.delivery_mode}</span>
                    <span><i data-lucide="user" style="width:12px;"></i> ${f.requested_by_name}</span>
                </div>
            </div>
            <div class="folio-card-right">
                ${statusBadge(f.status)}
                ${f.cancel_reason ? `<span class="folio-cancel-hint" title="${f.cancel_reason}">⚠️</span>` : ''}
                <div class="folio-card-actions">${actions}</div>
            </div>
        </div>`;
    }).join('');

    refreshIcons();
}

// ─── FILTER LOGIC ────────────────────────────────────────────────────────────
function applyFilter(filter) {
    _activeFilter = filter;
    // Actualizar tabs UI
    document.querySelectorAll('.folio-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    let filtered = _allFolios;
    if (filter !== 'ALL') filtered = _allFolios.filter(f => f.status === filter);
    renderFoliosList(filtered);
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────
let _searchDebounce = null;
function handleFolioSearch(val) {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(async () => {
        if (!val.trim()) {
            applyFilter(_activeFilter);
            return;
        }
        const result = await folioAPI.search(val.trim());
        if (result.success) renderFoliosList(result.data);
    }, 350);
}

// ─── LOAD FOLIOS ─────────────────────────────────────────────────────────────
async function loadFolios() {
    const list = document.getElementById('folios-list');
    if (list) list.innerHTML = `<div class="folios-empty"><i data-lucide="loader" class="spin"></i> Cargando...</div>`;
    refreshIcons();

    const result = await folioAPI.list();
    if (result.success) {
        _allFolios = result.data;
        applyFilter(_activeFilter);
    } else {
        if (list) list.innerHTML = `<div class="folios-empty">❌ Error al cargar los folios.</div>`;
    }
}

// ─── FORM: Inicializar con datos de sesión ────────────────────────────────────
function initFolioForm() {
    if (currentUser) {
        const nameEl = document.getElementById('folio-signed-by-name');
        const emailEl = document.getElementById('folio-signed-by-email');
        if (nameEl) nameEl.value = currentUser.name || '';
        if (emailEl) emailEl.value = currentUser.email || '';
    }
}

// ─── FORM: Resetear ──────────────────────────────────────────────────────────
window.resetFolioForm = function () {
    const form = document.getElementById('folio-form');
    if (form) form.reset();
    document.getElementById('folio-editing-id').value = '';
    document.getElementById('folio-submit-btn').innerHTML = '<i data-lucide="send"></i> Enviar Solicitud';
    document.getElementById('folio-clear-btn').classList.add('hidden');
    initFolioForm();
    refreshIcons();
};

// ─── FORM: Pre-rellenar para REASIGNACIÓN ────────────────────────────────────
window.prefillReassign = async function (id) {
    const result = await folioAPI.list();
    const folio = result.success ? result.data.find(f => f.id === id) : null;
    if (!folio) return;

    document.getElementById('folio-editing-id').value = id;
    document.getElementById('folio-directed-to').value = folio.directed_to || '';
    document.getElementById('folio-position').value = folio.position || '';
    document.getElementById('folio-organism').value = folio.organism || '';
    document.getElementById('folio-area').value = folio.area || '';
    document.getElementById('folio-subject').value = folio.subject || '';
    document.getElementById('folio-delivery-mode').value = folio.delivery_mode || 'PAM';
    document.getElementById('folio-original-guard').checked = !!folio.original_guard;
    document.getElementById('folio-submit-btn').innerHTML = '<i data-lucide="refresh-cw"></i> Reasignar Folio';
    document.getElementById('folio-clear-btn').classList.remove('hidden');
    initFolioForm();

    // Scroll al formulario en móvil
    document.querySelector('.folios-sidebar')?.scrollIntoView({ behavior: 'smooth' });
    refreshIcons();
};

// ─── SUBMIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('folio-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editingId = document.getElementById('folio-editing-id').value;

        const data = {
            directed_to:        document.getElementById('folio-directed-to').value.trim(),
            position:           document.getElementById('folio-position').value.trim(),
            organism:           document.getElementById('folio-organism').value.trim(),
            area:               document.getElementById('folio-area').value.trim(),
            subject:            document.getElementById('folio-subject').value.trim(),
            delivery_mode:      document.getElementById('folio-delivery-mode').value,
            original_guard:     document.getElementById('folio-original-guard').checked,
            signed_by_name:     document.getElementById('folio-signed-by-name').value,
            signed_by_email:    document.getElementById('folio-signed-by-email').value,
            requested_by_name:  currentUser ? currentUser.name : '',
            requested_by_email: currentUser ? currentUser.email : ''
        };

        const submitBtn = document.getElementById('folio-submit-btn');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Enviando...';
        refreshIcons();

        let result;
        if (editingId) {
            result = await folioAPI.reassign(parseInt(editingId), data);
        } else {
            result = await folioAPI.create(data);
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        refreshIcons();

        if (result.success) {
            resetFolioForm();
            loadFolios();
            // Mini toast de confirmación
            showFolioToast(editingId ? '✅ Folio reasignado' : '✅ Petición enviada a Elizabeth');
        } else {
            alert('Error: ' + (result.message || 'No se pudo procesar la petición.'));
        }
    });

    // Filter tabs
    document.getElementById('folio-filter-tabs')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.folio-tab');
        if (btn) applyFilter(btn.dataset.filter);
    });
});

// ─── MINI TOAST ──────────────────────────────────────────────────────────────
function showFolioToast(msg) {
    const t = document.createElement('div');
    t.className = 'folio-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('folio-toast-show'), 10);
    setTimeout(() => { t.classList.remove('folio-toast-show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ─── DETAIL MODAL ────────────────────────────────────────────────────────────
window.openFolioDetail = async function (id) {
    const result = await folioAPI.list();
    if (!result.success) return;
    const folio = result.data.find(f => f.id === id);
    if (!folio) return;

    const isElizabeth = currentUser && currentUser.email === ELIZABETH_EMAIL_FE;
    const date = new Date(folio.created_at).toLocaleString('es-MX');

    let elizabethActions = '';
    if (isElizabeth) {
        if (folio.status === 'PENDING') {
            elizabethActions = `<div style="display:flex;gap:10px;margin-top:18px;">
                <button class="btn-corporate" style="flex:1;" onclick="approveFolio(${folio.id})">
                    <i data-lucide="check-circle"></i> Aprobar y Asignar Folio
                </button>
                <button class="btn-cancel-modal" onclick="cancelFolioPrompt(${folio.id})">
                    <i data-lucide="x-circle"></i> Cancelar
                </button>
            </div>`;
        } else if (folio.status === 'CANCELLED') {
            elizabethActions = `<div style="margin-top:18px;">
                <button class="btn-corporate" style="width:100%;" onclick="closeFolioDetailModal(); prefillReassign(${folio.id})">
                    <i data-lucide="refresh-cw"></i> Reasignar (Nueva Vida)
                </button>
            </div>`;
        }
    }

    let evidenceSection = '';
    if (folio.status === 'APPROVED') {
        const safeName = (folio.evidence_pdf_name || 'evidencia.pdf').replace(/'/g, "\\'");
        evidenceSection = `<div class="folio-detail-evidence">
            <div class="folio-detail-evidence-title"><i data-lucide="paperclip"></i> Evidencia de uso</div>
            ${folio.evidence_pdf_name
                ? `<div class="folio-evidence-file">
                       <i data-lucide="file-check"></i>
                       <span>${folio.evidence_pdf_name}</span>
                       <button class="folio-card-btn folio-btn-pdf" onclick="viewFolioPDF(${folio.id}, '${safeName}')" title="Ver PDF en visor">
                           <i data-lucide="eye"></i>
                       </button>
                   </div>`
                : `<p class="folio-no-evidence">Sin evidencia subida aún.</p>`
            }
            <label class="folio-upload-label">
                <i data-lucide="upload"></i> ${folio.evidence_pdf_name ? 'Reemplazar PDF' : 'Subir PDF de Evidencia'}
                <input type="file" accept="application/pdf" style="display:none;" onchange="handleEvidenceUpload(event,${folio.id})">
            </label>
        </div>`;
    }

    document.getElementById('folio-detail-content').innerHTML = `
        <div class="folio-detail-scroll">
            <div class="folio-detail-header-row">
                ${statusBadge(folio.status)}
                ${folio.folio_number ? `<span class="folio-num-big">${folio.folio_number}</span>` : `<span class="folio-no-num">Folio pendiente de asignación</span>`}
            </div>

            <div class="folio-detail-subject">${folio.subject}</div>

            <div class="folio-detail-grid2">
                <div class="folio-detail-col">
                    <div class="folio-detail-row"><span>Dirigido a</span><strong>${folio.directed_to}</strong></div>
                    <div class="folio-detail-row"><span>Cargo</span><strong>${folio.position}</strong></div>
                    <div class="folio-detail-row"><span>Organismo</span><strong>${folio.organism}</strong></div>
                    <div class="folio-detail-row"><span>Área</span><strong>${folio.area}</strong></div>
                    <div class="folio-detail-row"><span>Resguardo original</span><strong>${folio.original_guard ? '✅ Sí' : 'No'}</strong></div>
                </div>
                <div class="folio-detail-col">
                    <div class="folio-detail-row"><span>Modo de envío</span><strong>${DELIVERY_LABELS[folio.delivery_mode] || folio.delivery_mode}</strong></div>
                    <div class="folio-detail-row"><span>Solicitante</span><strong>${folio.requested_by_name}</strong></div>
                    <div class="folio-detail-row"><span>Correo</span><strong style="font-size:.72rem;">${folio.requested_by_email}</strong></div>
                    <div class="folio-detail-row"><span>Firmante</span><strong>${folio.signed_by_name}</strong></div>
                    <div class="folio-detail-row"><span>Fecha petición</span><strong>${date}</strong></div>
                </div>
            </div>

            ${folio.cancel_reason ? `<div class="folio-detail-cancel-box"><i data-lucide="alert-triangle"></i><div><strong>Motivo de cancelación</strong><p>${folio.cancel_reason}</p></div></div>` : ''}

            ${evidenceSection}

            ${elizabethActions}
        </div>`;

    document.getElementById('folio-detail-modal').classList.remove('hidden');
    refreshIcons();
};

window.closeFolioDetailModal = function () {
    document.getElementById('folio-detail-modal').classList.add('hidden');
};

// ─── APPROVE ─────────────────────────────────────────────────────────────────
window.approveFolio = async (id) => {
    if (!confirm('¿Confirmas que deseas aprobar esta petición y asignar un número de folio?')) return;
    const result = await folioAPI.approve(id);
    if (result.success) {
        closeFolioDetailModal();
        loadFolios();
        showFolioToast(`✅ Folio asignado: ${result.folio_number}`);
    } else {
        alert('Error: ' + result.message);
    }
};

// ─── CANCEL ──────────────────────────────────────────────────────────────────
window.cancelFolioPrompt = async (id) => {
    const reason = prompt('Motivo de cancelación (obligatorio):');
    if (!reason || !reason.trim()) { alert('Debes proporcionar un motivo.'); return; }
    const result = await folioAPI.cancel(id, reason.trim());
    if (result.success) {
        closeFolioDetailModal();
        loadFolios();
        showFolioToast('❌ Folio cancelado');
    } else {
        alert('Error: ' + result.message);
    }
};

// ─── EVIDENCE ────────────────────────────────────────────────────────────────
window.uploadEvidencePrompt = (id) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e) => handleEvidenceUpload(e, id);
    input.click();
};

window.handleEvidenceUpload = async (event, id) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se aceptan archivos PDF.'); return; }
    const result = await folioAPI.uploadEvidence(id, file);
    if (result.success) {
        closeFolioDetailModal();
        loadFolios();
        showFolioToast(`✅ PDF subido. ${result.chars_extracted} caracteres OCR extraídos.`);
    } else {
        alert('Error: ' + result.message);
    }
};

// ─── PDF VIEWER MODAL ────────────────────────────────────────────────────────
let _pdfBlobUrl = null;

window.viewFolioPDF = async (id, filename) => {
    const modal    = document.getElementById('folio-pdf-modal');
    const iframe   = document.getElementById('folio-pdf-iframe');
    const loading  = document.getElementById('folio-pdf-loading');
    const nameEl   = document.getElementById('folio-pdf-filename');
    const dlBtn    = document.getElementById('folio-pdf-download-btn');

    // Revoke any previous blob
    if (_pdfBlobUrl) { URL.revokeObjectURL(_pdfBlobUrl); _pdfBlobUrl = null; }

    nameEl.textContent = filename || 'Evidencia PDF';
    iframe.classList.add('hidden');
    loading.classList.remove('hidden');
    modal.classList.remove('hidden');
    iframe.src = '';
    refreshIcons();

    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const base    = isLocal ? 'http://localhost:4001/api' : '/api-dgiit/api';
        const token   = apiClient.getToken();

        const res = await fetch(`${base}/folios/${id}/evidence`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('No se pudo obtener el PDF');

        const blob = await res.blob();
        _pdfBlobUrl = URL.createObjectURL(blob);

        iframe.src = _pdfBlobUrl;
        loading.classList.add('hidden');
        iframe.classList.remove('hidden');

        dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href  = _pdfBlobUrl;
            a.download = filename || 'evidencia.pdf';
            a.click();
        };
    } catch (e) {
        loading.innerHTML = `<i data-lucide="alert-triangle"></i> <span>No se pudo cargar el PDF: ${e.message}</span>`;
        refreshIcons();
    }
};

window.closeFolioPDFModal = () => {
    document.getElementById('folio-pdf-modal').classList.add('hidden');
    const iframe = document.getElementById('folio-pdf-iframe');
    iframe.src = '';
    if (_pdfBlobUrl) { URL.revokeObjectURL(_pdfBlobUrl); _pdfBlobUrl = null; }
};


