/**
 * SGC PRO | Folios (Pre-Folios)
 * Módulo para la gestión de solicitudes, asignación y cierre de folios oficiales.
 */

const FoliosApp = {
    // Estado del módulo
    state: {
        folios: [],
        searchQuery: '',
        currentFolioId: null,
        currentStatus: 'TODOS',
        currentPage: 0,
        limit: 10,
        hasMore: true
    },

    // Referencias a elementos del DOM
    elements: {
        container: document.getElementById('view-folios'),
        list: document.getElementById('folios-list'),
        search: document.getElementById('folios-search-input'),
        form: document.getElementById('new-folio-form'),
        modals: {
            assign: document.getElementById('modal-assign-folio'),
            upload: document.getElementById('modal-upload-pdf'),
            viewPdf: document.getElementById('modal-view-pdf'),
            cancel: document.getElementById('modal-cancel-folio'),
            reopen: document.getElementById('modal-reopen-folio')
        },
        tabs: document.querySelectorAll('.folio-tab'),
        loadMoreContainer: document.getElementById('folios-load-more-container'),
        btnLoadMore: document.getElementById('btn-folios-load-more')
    },

    init() {
        if (!this.elements.container) return; // Si no existe la vista, salir
        
        console.log('📦 Inicializando módulo de Folios...');
        this.bindEvents();
        this.loadFolios();
        
        // Ajustar visibilidad según persmisos
        this.adjustPermissions();
    },

    adjustPermissions() {
        const user = typeof currentUser !== 'undefined' ? currentUser : JSON.parse(localStorage.getItem('sgc_user') || 'null');
        if (!user) return;
        
        // Mostrar vista solo si tiene acceso a folios
        if (user.access_type === 'FICHAS' && user.role === 'USER') {
            document.querySelectorAll('[data-view="view-folios"]').forEach(el => el.style.display = 'none');
        } else {
            document.querySelectorAll('[data-view="view-folios"]').forEach(el => el.style.display = '');
        }
        
        // Si no es admin/god, no puede asignar ni cancelar, esto se maneja en el renderizado
    },

    bindEvents() {
        // Enviar nueva solicitud de folio
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitFolioRequest();
            });
        }

        // Búsqueda (con debounce)
        if (this.elements.search) {
            let timeout;
            this.elements.search.addEventListener('input', (e) => {
                clearTimeout(timeout);
                this.state.searchQuery = e.target.value;
                timeout = setTimeout(() => {
                    this.state.currentPage = 0;
                    this.loadFolios(false);
                }, 400);
            });
        }

        // Pestañas de filtrado
        if (this.elements.tabs) {
            this.elements.tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.elements.tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.state.currentStatus = tab.dataset.status;
                    this.state.currentPage = 0;
                    this.loadFolios(false);
                });
            });
        }

        // Cargar más
        if (this.elements.btnLoadMore) {
            this.elements.btnLoadMore.addEventListener('click', () => {
                this.state.currentPage++;
                this.loadFolios(true);
            });
        }

        // Delegación de eventos para la lista de folios
        if (this.elements.list) {
            this.elements.list.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                
                const id = btn.dataset.id;
                
                if (btn.classList.contains('btn-assign')) this.openAssignModal(id);
                if (btn.classList.contains('btn-upload')) this.openUploadModal(id);
                if (btn.classList.contains('btn-view-pdf')) this.viewPdf(id);
                if (btn.classList.contains('btn-cancel')) this.openCancelModal(id);
                if (btn.classList.contains('btn-reopen')) this.openReopenModal(id);
            });
        }

        // Modales - Reabrir Folio
        const formReopen = document.getElementById('form-reopen-folio');
        if (formReopen) {
            formReopen.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitReopenFolio();
            });
        }

        // Modales - Asignar Folio
        const formAssign = document.getElementById('form-assign-folio');
        if (formAssign) {
            formAssign.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.assignFolio();
            });
        }

        // Modales - Subir PDF
        const formUpload = document.getElementById('form-upload-pdf');
        if (formUpload) {
            formUpload.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.uploadPdf();
            });
        }
        
        // Modales - Cancelar Folio
        const formCancel = document.getElementById('form-cancel-folio');
        if (formCancel) {
            formCancel.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.cancelFolio();
            });
        }
    },

    async loadFolios(append = false) {
        try {
            if (!append) {
                this.elements.list.innerHTML = '<div class="loading-msg">Cargando folios...</div>';
                this.elements.loadMoreContainer.classList.add('hidden');
            }
            
            let res;
            const offset = this.state.currentPage * this.state.limit;

            if (this.state.searchQuery.trim().length > 0) {
                res = await apiClient.searchFolios(this.state.searchQuery, this.state.limit, offset);
            } else {
                res = await apiClient.getFolios(this.state.currentStatus, this.state.limit, offset);
            }
            
            if (res.success) {
                if (append) {
                    this.state.folios = [...this.state.folios, ...res.data];
                } else {
                    this.state.folios = res.data;
                }
                
                this.state.hasMore = res.data.length === this.state.limit;
                this.renderFolios(append);
            } else {
                this.elements.list.innerHTML = `<div class="empty-msg error">${res.message || 'Error cargando folios'}</div>`;
            }
        } catch (error) {
            console.error(error);
            this.elements.list.innerHTML = '<div class="empty-msg error">Error de conexión</div>';
        }
    },

    renderFolios(append = false) {
        if (!this.state.folios || this.state.folios.length === 0) {
            this.elements.list.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox" style="width:48px;height:48px;opacity:0.3;margin-bottom:10px;"></i>
                    <p>No se encontraron folios.</p>
                </div>`;
            this.elements.loadMoreContainer.classList.add('hidden');
            if(window.lucide) lucide.createIcons();
            return;
        }

        const user = typeof currentUser !== 'undefined' ? currentUser : JSON.parse(localStorage.getItem('sgc_user') || '{}');
        const isAdmin = user.role === 'ADMIN' || user.role === 'GOD';

        const html = this.state.folios.map(folio => {
            const dateStr = new Date(folio.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            const isSolicitante = folio.solicitante_id === user.id;
            
            let statusLabel = folio.status;
            if (folio.status === 'ASIGNADO') statusLabel = 'EN USO';

            let actionsHtml = '';
            
            if (folio.status === 'PENDIENTE') {
                if (isAdmin) {
                    actionsHtml += `<button class="btn-assign btn-success" data-id="${folio.id}"><i data-lucide="check-circle"></i> Asignar</button>`;
                    actionsHtml += `<button class="btn-cancel btn-danger" data-id="${folio.id}"><i data-lucide="x-circle"></i> Cancelar</button>`;
                } else {
                     actionsHtml += `<button disabled><i data-lucide="clock"></i> En Espera</button>`;
                }
            } 
            else if (folio.status === 'ASIGNADO') {
                if (isSolicitante || isAdmin) {
                    actionsHtml += `<button class="btn-upload btn-success" data-id="${folio.id}"><i data-lucide="upload-cloud"></i> Subir PDF</button>`;
                }
                if (isAdmin) {
                    actionsHtml += `<button class="btn-cancel btn-danger" data-id="${folio.id}"><i data-lucide="x-circle"></i> Cancelar</button>`;
                }
            }
            else if (folio.status === 'CERRADO') {
                actionsHtml += `<button class="btn-view-pdf" data-id="${folio.id}"><i data-lucide="file-text"></i> Ver PDF</button>`;
            }
            else if (folio.status === 'CANCELADO') {
                if (isAdmin) {
                    actionsHtml += `<button class="btn-reopen" data-id="${folio.id}"><i data-lucide="refresh-cw"></i> Reabrir</button>`;
                }
            }

            return `
                <div class="folio-card" id="folio-${folio.id}">
                    <div class="folio-header">
                        <div class="folio-number ${folio.status === 'PENDIENTE' ? 'pending' : ''}">
                            ${folio.folio_number || 'S/N'}
                        </div>
                        <div class="folio-status status-${folio.status}">
                            ${statusLabel}
                        </div>
                    </div>
                    
                    <div class="folio-body">
                        <strong>${folio.asunto}</strong><br/>
                        <span style="font-size:0.8rem; opacity:0.8;">Hacia: ${folio.dirigido_a}</span>
                    </div>
                    
                    <div class="folio-details">
                        <div><i data-lucide="user" style="width:12px;height:12px;"></i> ${folio.solicitante_nombre}</div>
                        <div><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${dateStr}</div>
                    </div>
                    
                    <div class="folio-actions">
                        ${actionsHtml}
                    </div>
                </div>
            `;
        }).join('');

        this.elements.list.innerHTML = html;
        
        // Mostrar/ocultar Cargar más
        if (this.state.hasMore) {
            this.elements.loadMoreContainer.classList.remove('hidden');
        } else {
            this.elements.loadMoreContainer.classList.add('hidden');
        }

        if(window.lucide) lucide.createIcons();
    },

    async submitFolioRequest() {
        const btn = this.elements.form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Enviando...';
            btn.disabled = true;

            const formData = new FormData(this.elements.form);
            const data = Object.fromEntries(formData.entries());
            
            const res = await apiClient.createFolio(data);
            
            if (res.success) {
                alert('Solicitud enviada correctamente. Se te notificará cuando Elizabeth asigne el folio.');
                this.elements.form.reset();
                this.loadFolios();
            } else {
                alert(res.message || 'Error al enviar la solicitud');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    openAssignModal(id) {
        this.state.currentFolioId = id;
        document.getElementById('folio-assign-id-display').textContent = id;
        document.getElementById('folio_number_manual').value = '';
        window.openModal(this.elements.modals.assign);
    },

    async assignFolio() {
        const btn = document.getElementById('btn-submit-assign');
        const originalText = btn.innerHTML;
        const manualInput = document.getElementById('folio_number_manual').value;
        const noteInput = document.getElementById('folio_number_manual').value.trim();

        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Asignando...';
            btn.disabled = true;

            const res = await apiClient.assignFolio(this.state.currentFolioId, manualInput || null);
            
            if (res.success) {
                window.closeModal(this.elements.modals.assign);
                alert(`Folio asignado correctamente: ${res.folio_number}`);
                this.loadFolios();
            } else {
                alert(res.message || 'Error al asignar');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    openUploadModal(id) {
        this.state.currentFolioId = id;
        document.getElementById('folio-upload-id-display').textContent = id;
        document.getElementById('pdf-upload-input').value = '';
        window.openModal(this.elements.modals.upload);
    },

    async uploadPdf() {
        const fileInput = document.getElementById('pdf-upload-input');
        const file = fileInput.files[0];
        
        if (!file) return alert('Selecciona un archivo PDF');
        if (file.type !== 'application/pdf') return alert('El archivo debe ser un PDF válido');
        if (file.size > 20 * 1024 * 1024) return alert('El archivo excede los 20MB permitidos');

        const btn = document.getElementById('btn-submit-upload');
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Subiendo (puede tardar por el OCR)...';
            btn.disabled = true;

            const res = await apiClient.uploadFolioPdf(this.state.currentFolioId, file);
            
            if (res.success) {
                window.closeModal(this.elements.modals.upload);
                alert('Evidencia cargada correctamente. Folio cerrado.');
                this.loadFolios();
            } else {
                alert(res.message || 'Error al subir PDF');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    viewPdf(id) {
        const url = apiClient.getFolioPdfUrl(id);
        const container = document.getElementById('pdf-viewer-container');
        container.innerHTML = `<iframe src="${url}#toolbar=0" width="100%" height="100%"></iframe>`;
        window.openModal(this.elements.modals.viewPdf);
    },

    openCancelModal(id) {
        this.state.currentFolioId = id;
        document.getElementById('folio-cancel-reason').value = '';
        window.openModal(this.elements.modals.cancel);
    },

    async cancelFolio() {
        const form = document.getElementById('form-cancel-folio');
        if (!form.reportValidity()) return;
        
        const reason = document.getElementById('folio-cancel-reason').value;
        const btn = document.getElementById('btn-submit-cancel');
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cancelando...';
            btn.disabled = true;

            const res = await apiClient.cancelFolio(this.state.currentFolioId, reason);
            
            if (res.success) {
                window.closeModal(this.elements.modals.cancel);
                this.loadFolios();
            } else {
                alert(res.message || 'Error al cancelar');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    submitReopenFolio: async function() {
        const id = document.getElementById('reopen-folio-id').value;
        const btn = document.getElementById('btn-submit-reopen');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Reabriendo...';
            btn.disabled = true;

            const data = {
                asunto: document.getElementById('reopen-asunto').value,
                solicitante_id: document.getElementById('reopen-solicitante-id').value,
                dirigido_a: document.getElementById('reopen-dirigido-a').value,
                cargo_dest: document.getElementById('reopen-cargo-dest').value,
                organismo: document.getElementById('reopen-organismo').value,
                quien_firma: document.getElementById('reopen-quien-firma').value,
                area_resguardo: document.getElementById('reopen-area-resguardo').value,
                medio_envio: document.getElementById('reopen-medio-envio').value
            };

            const res = await apiClient.reopenFolio(id, data);
            
            if (res.success) {
                window.closeModal(this.elements.modals.reopen);
                this.loadFolios();
            } else {
                alert(res.message || 'Error al reabrir');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    openReopenModal: async function(id) {
        this.state.currentFolioId = id;
        const folio = this.state.folios.find(f => f.id == id);
        if (!folio) return;

        document.getElementById('reopen-folio-id').value = id;
        document.getElementById('reopen-folio-id-display').textContent = id;
        
        // Pre-llenar campos
        document.getElementById('reopen-asunto').value = folio.asunto || '';
        document.getElementById('reopen-dirigido-a').value = folio.dirigido_a || '';
        document.getElementById('reopen-cargo-dest').value = folio.cargo_dest || '';
        document.getElementById('reopen-organismo').value = folio.organismo || '';
        document.getElementById('reopen-quien-firma').value = folio.quien_firma || '';
        document.getElementById('reopen-area-resguardo').value = folio.area_resguardo || '';
        document.getElementById('reopen-medio-envio').value = folio.medio_envio || 'PAM';

        // Poblar select de usuarios
        const userSelect = document.getElementById('reopen-solicitante-id');
        userSelect.innerHTML = '<option value="">Cargando usuarios...</option>';
        
        try {
            const res = await apiClient.getUsers();
            if (res.success) {
                userSelect.innerHTML = res.data
                    .filter(u => u.role !== 'GOD') // Omitir GOD si es necesario
                    .map(u => `<option value="${u.id}" ${u.id == folio.solicitante_id ? 'selected' : ''}>${u.name} (${u.email})</option>`)
                    .join('');
            } else {
                userSelect.innerHTML = '<option value="">Error al cargar usuarios</option>';
            }
        } catch (e) {
            userSelect.innerHTML = '<option value="">Error de conexión</option>';
        }

        window.openModal(this.elements.modals.reopen);
    }
};

// Inicializar folios dinámicamente cuando el DOM esté listo o a través de clics en navegación
document.addEventListener('DOMContentLoaded', () => {
    // Interceptar clics de navegación globales
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-btn');
        if (btn && btn.getAttribute('data-view') === 'view-folios') {
            if (!FoliosApp.initialized) {
                FoliosApp.initialized = true;
                FoliosApp.init();
            } else {
                FoliosApp.loadFolios();
            }
        }
    });

    // Validar si estamos recargando la página en la vista de folios (por ejemplo si ya pasamos el login)
    setTimeout(() => {
        const foliosView = document.getElementById('view-folios');
        if (foliosView && !foliosView.classList.contains('hidden')) {
            if (!FoliosApp.initialized) {
                FoliosApp.initialized = true;
                FoliosApp.init();
            }
        }
    }, 500);
});

// Export para posibles usos globales
window.FoliosApp = FoliosApp;
