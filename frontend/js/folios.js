/**
 * DGIIT | SECTURI — Módulo Pre-Folios v3
 * Layout dividido: Formulario izquierda · Lista + filtros derecha
 * Sincronizado con el esquema real del backend (Session 3)
 */

// ─── CACHE DE FOLIOS ────────────────────────────────────────────────────────
let _allFolios = [];
let _activeFilter = 'TODOS';

// ─── API HELPERS ────────────────────────────────────────────────────────────
const folioAPI = {
    list:   ()              => apiClient.request('/folios'),
    search: (q)             => apiClient.request(`/folios/search?q=${encodeURIComponent(q)}`),
    create: (data)          => apiClient.request('/folios', { method: 'POST', body: JSON.stringify(data) }),
    assign: (id, numManual) => apiClient.request(`/folios/${id}/assign`, { method: 'PUT', body: JSON.stringify({ folio_number_manual: numManual || undefined }) }),
    cancel: (id, reason)    => apiClient.request(`/folios/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ cancel_reason: reason }) }),
    reopen: (id, data)      => apiClient.request(`/folios/${id}/reopen`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadPDF: (id, file) => {
        const formData = new FormData();
        formData.append('pdf', file);
        const token = apiClient.getToken();
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const base = isLocal ? 'http://localhost:4001/api' : (window.location.pathname.includes('/dgiit/') ? '/dgiit/api' : '/api');
        return fetch(`${base}/folios/${id}/upload-pdf`, {
            method: 'PUT',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData,
            credentials: 'include'
        }).then(r => r.json());
    }
};

// ─── DELIVERY LABELS ────────────────────────────────────────────────────────
const DELIVERY_LABELS = {
    PAM:             'PAM',
    FIRMA_AUTOGRAFA: 'Firma Autógrafa',
    PAM_Y_FIRMA:     'PAM + Firma',
    CORREO:          'Correo'
};

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function statusBadge(status) {
    const map = {
        PENDIENTE: { label: 'Pendiente', cls: 'folio-badge-pending' },
        ASIGNADO:  { label: 'En Uso',    cls: 'folio-badge-approved' },
        CANCELADO: { label: 'Cancelado', cls: 'folio-badge-cancelled' },
        CERRADO:   { label: 'Cerrado',   cls: 'folio-badge-closed' }
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

    const isPrivileged = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'GOD');

    list.innerHTML = folios.map(f => {
        const date = f.created_at
            ? new Date(f.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
        const folioNum = f.folio_number || `<em style="opacity:.5;">Sin asignar</em>`;

        let actions = `<button class="folio-card-btn folio-btn-view" onclick="openFolioDetail(${f.id})" title="Ver detalle"><i data-lucide="eye"></i></button>`;

        if (isPrivileged && f.status === 'PENDIENTE') {
            actions += `<button class="folio-card-btn folio-btn-approve" onclick="approveFolio(${f.id})" title="Asignar folio"><i data-lucide="check-circle"></i></button>`;
            actions += `<button class="folio-card-btn folio-btn-cancel" onclick="cancelFolioPrompt(${f.id})" title="Cancelar"><i data-lucide="x-circle"></i></button>`;
        }
        if (isPrivileged && f.status === 'CANCELADO') {
            actions += `<button class="folio-card-btn folio-btn-reassign" onclick="prefillReopen(${f.id})" title="Reabrir folio"><i data-lucide="refresh-cw"></i></button>`;
        }

        const canUpload = f.status === 'ASIGNADO' && (
            (currentUser && currentUser.id === f.solicitante_id) || isPrivileged
        );
        if (canUpload) {
            const icon = f.pdf_filename ? 'file-check' : 'upload';
            actions += `<button class="folio-card-btn folio-btn-evidence" onclick="uploadPDFPrompt(${f.id})" title="${f.pdf_filename ? 'Reemplazar PDF' : 'Subir evidencia PDF'}"><i data-lucide="${icon}"></i></button>`;
        }
        if (f.pdf_filename) {
            const safeName = (f.pdf_filename || 'evidencia.pdf').replace(/'/g, "\\'");
            actions += `<button class="folio-card-btn folio-btn-pdf" onclick="viewFolioPDF(${f.id}, '${safeName}')" title="Ver PDF"><i data-lucide="file-text"></i></button>`;
        }

        return `
        <div class="folio-card folio-card-${f.status.toLowerCase()}">
            <div class="folio-card-left">
                <div class="folio-card-num">${folioNum}</div>
                <div class="folio-card-meta">${date}</div>
            </div>
            <div class="folio-card-center">
                <div class="folio-card-subject">${f.asunto.length > 70 ? f.asunto.substring(0,70)+'…' : f.asunto}</div>
                <div class="folio-card-info">
                    <span><i data-lucide="user-check" style="width:12px;"></i> ${f.dirigido_a}</span>
                    <span><i data-lucide="send" style="width:12px;"></i> ${DELIVERY_LABELS[f.medio_envio] || f.medio_envio}</span>
                    <span><i data-lucide="user" style="width:12px;"></i> ${f.solicitante_nombre}</span>
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
    document.querySelectorAll('.folio-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    let filtered = _allFolios;
    if (filter !== 'TODOS') filtered = _allFolios.filter(f => f.status === filter);
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
        if (nameEl) nameEl.value = currentUser.name || '';
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

// ─── FORM: Pre-rellenar para reapertura de folio cancelado ───────────────────
window.prefillReopen = function (id) {
    const folio = _allFolios.find(f => f.id === id);
    if (!folio) return;

    document.getElementById('folio-editing-id').value   = id;
    document.getElementById('folio-directed-to').value  = folio.dirigido_a     || '';
    document.getElementById('folio-position').value     = folio.cargo_dest     || '';
    document.getElementById('folio-organism').value     = folio.organismo      || '';
    document.getElementById('folio-area').value         = folio.area_resguardo || '';
    document.getElementById('folio-subject').value      = folio.asunto         || '';
    document.getElementById('folio-delivery-mode').value = folio.medio_envio   || 'PAM';
    document.getElementById('folio-submit-btn').innerHTML = '<i data-lucide="refresh-cw"></i> Reabrir Folio';
    document.getElementById('folio-clear-btn').classList.remove('hidden');
    initFolioForm();

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
            dirigido_a:     document.getElementById('folio-directed-to').value.trim(),
            cargo_dest:     document.getElementById('folio-position').value.trim(),
            organismo:      document.getElementById('folio-organism').value.trim(),
            area_resguardo: document.getElementById('folio-area').value.trim(),
            asunto:         document.getElementById('folio-subject').value.trim(),
            medio_envio:    document.getElementById('folio-delivery-mode').value,
            quien_firma:    document.getElementById('folio-signed-by-name').value
        };

        const submitBtn = document.getElementById('folio-submit-btn');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Enviando...';
        refreshIcons();

        let result;
        if (editingId) {
            result = await folioAPI.reopen(parseInt(editingId), data);
        } else {
            result = await folioAPI.create(data);
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        refreshIcons();

        if (result.success) {
            resetFolioForm();
            loadFolios();
            showFolioToast(editingId ? '✅ Folio reabierto' : '✅ Solicitud enviada. El administrador la revisará.');
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
window.openFolioDetail = function (id) {
    const folio = _allFolios.find(f => f.id === id);
    if (!folio) return;

    const isPrivileged = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'GOD');
    const date = new Date(folio.created_at).toLocaleString('es-MX');

    let adminActions = '';
    if (isPrivileged) {
        if (folio.status === 'PENDIENTE') {
            adminActions = `<div style="display:flex;gap:10px;margin-top:18px;">
                <button class="btn-corporate" style="flex:1;" onclick="approveFolio(${folio.id})">
                    <i data-lucide="check-circle"></i> Asignar Número de Folio
                </button>
                <button class="btn-cancel-modal" onclick="cancelFolioPrompt(${folio.id})">
                    <i data-lucide="x-circle"></i> Cancelar
                </button>
            </div>`;
        } else if (folio.status === 'CANCELADO') {
            adminActions = `<div style="margin-top:18px;">
                <button class="btn-corporate" style="width:100%;" onclick="closeFolioDetailModal(); prefillReopen(${folio.id})">
                    <i data-lucide="refresh-cw"></i> Reabrir Folio
                </button>
            </div>`;
        }
    }

    const canUpload = folio.status === 'ASIGNADO' && (
        (currentUser && currentUser.id === folio.solicitante_id) || isPrivileged
    );
    let evidenceSection = '';
    if (folio.status === 'ASIGNADO' || folio.status === 'CERRADO') {
        const safeName = (folio.pdf_filename || 'evidencia.pdf').replace(/'/g, "\\'");
        evidenceSection = `<div class="folio-detail-evidence">
            <div class="folio-detail-evidence-title"><i data-lucide="paperclip"></i> Evidencia de uso</div>
            ${folio.pdf_filename
                ? `<div class="folio-evidence-file">
                       <i data-lucide="file-check"></i>
                       <span>${folio.pdf_filename}</span>
                       <button class="folio-card-btn folio-btn-pdf" onclick="viewFolioPDF(${folio.id}, '${safeName}')" title="Ver PDF en visor">
                           <i data-lucide="eye"></i>
                       </button>
                   </div>`
                : `<p class="folio-no-evidence">Sin evidencia subida aún.</p>`
            }
            ${canUpload ? `<label class="folio-upload-label">
                <i data-lucide="upload"></i> ${folio.pdf_filename ? 'Reemplazar PDF' : 'Subir PDF de Evidencia'}
                <input type="file" accept="application/pdf" style="display:none;" onchange="handlePDFUpload(event,${folio.id})">
            </label>` : ''}
        </div>`;
    }

    document.getElementById('folio-detail-content').innerHTML = `
        <div class="folio-detail-scroll">
            <div class="folio-detail-header-row">
                ${statusBadge(folio.status)}
                ${folio.folio_number ? `<span class="folio-num-big">${folio.folio_number}</span>` : `<span class="folio-no-num">Folio pendiente de asignación</span>`}
            </div>

            <div class="folio-detail-subject">${folio.asunto}</div>

            <div class="folio-detail-grid2">
                <div class="folio-detail-col">
                    <div class="folio-detail-row"><span>Dirigido a</span><strong>${folio.dirigido_a}</strong></div>
                    <div class="folio-detail-row"><span>Cargo</span><strong>${folio.cargo_dest}</strong></div>
                    <div class="folio-detail-row"><span>Organismo</span><strong>${folio.organismo}</strong></div>
                    <div class="folio-detail-row"><span>Área de Resguardo</span><strong>${folio.area_resguardo}</strong></div>
                    <div class="folio-detail-row"><span>Quien Firma</span><strong>${folio.quien_firma}</strong></div>
                </div>
                <div class="folio-detail-col">
                    <div class="folio-detail-row"><span>Medio de envío</span><strong>${DELIVERY_LABELS[folio.medio_envio] || folio.medio_envio}</strong></div>
                    <div class="folio-detail-row"><span>Solicitante</span><strong>${folio.solicitante_nombre}</strong></div>
                    <div class="folio-detail-row"><span>Fecha petición</span><strong>${date}</strong></div>
                    ${folio.assigned_by_name ? `<div class="folio-detail-row"><span>Asignado por</span><strong>${folio.assigned_by_name}</strong></div>` : ''}
                </div>
            </div>

            ${folio.cancel_reason ? `<div class="folio-detail-cancel-box"><i data-lucide="alert-triangle"></i><div><strong>Motivo de cancelación</strong><p>${folio.cancel_reason}</p></div></div>` : ''}

            ${evidenceSection}

            ${adminActions}
        </div>`;

    document.getElementById('folio-detail-modal').classList.remove('hidden');
    refreshIcons();
};

window.closeFolioDetailModal = function () {
    document.getElementById('folio-detail-modal').classList.add('hidden');
};

// ─── ASSIGN (aprobación con número de folio) ─────────────────────────────────
window.approveFolio = async (id) => {
    const numManual = prompt('Número de folio a asignar (dejar vacío para auto-generar):');
    if (numManual === null) return; // canceló el prompt
    const result = await folioAPI.assign(id, numManual.trim() || null);
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

// ─── UPLOAD PDF ──────────────────────────────────────────────────────────────
window.uploadPDFPrompt = (id) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e) => handlePDFUpload(e, id);
    input.click();
};

window.handlePDFUpload = async (event, id) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se aceptan archivos PDF.'); return; }
    const result = await folioAPI.uploadPDF(id, file);
    if (result.success) {
        closeFolioDetailModal();
        loadFolios();
        showFolioToast('✅ PDF de evidencia subido. El folio queda cerrado.');
    } else {
        alert('Error: ' + result.message);
    }
};

// ─── PDF VIEWER MODAL ────────────────────────────────────────────────────────
let _pdfBlobUrl = null;

window.viewFolioPDF = async (id, filename) => {
    const modal   = document.getElementById('folio-pdf-modal');
    const iframe  = document.getElementById('folio-pdf-iframe');
    const loading = document.getElementById('folio-pdf-loading');
    const nameEl  = document.getElementById('folio-pdf-filename');
    const dlBtn   = document.getElementById('folio-pdf-download-btn');

    if (_pdfBlobUrl) { URL.revokeObjectURL(_pdfBlobUrl); _pdfBlobUrl = null; }

    nameEl.textContent = filename || 'Evidencia PDF';
    iframe.classList.add('hidden');
    loading.classList.remove('hidden');
    modal.classList.remove('hidden');
    iframe.src = '';
    refreshIcons();

    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const base    = isLocal ? 'http://localhost:4001/api' : (window.location.pathname.includes('/dgiit/') ? '/dgiit/api' : '/api');
        const token   = apiClient.getToken();

        const res = await fetch(`${base}/folios/${id}/pdf`, {
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
