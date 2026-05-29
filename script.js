document.addEventListener("DOMContentLoaded", () => {
    const pdfViewer = document.getElementById("pdfViewer");
    const albumContainer = document.getElementById("albumContainer");
    const pageWrappers = document.querySelectorAll(".page-wrapper");
    const currentPageNum = document.getElementById("currentPageNum");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    
    const timelineDots = document.querySelectorAll(".timeline-dots li");
    
    const zoomOutBtn = document.getElementById("zoomOut");
    const zoomInBtn = document.getElementById("zoomIn");
    const zoomValueText = document.getElementById("zoomValue");
    const fitWidthBtn = document.getElementById("fitWidth");
    const fitPageBtn = document.getElementById("fitPage");

    // Modal de Vídeo
    const videoModal = document.getElementById("videoModal");
    const videoModalBackdrop = document.getElementById("videoModalBackdrop");
    const closeModalBtn = document.getElementById("closeModal");
    const modalIframe = document.getElementById("modalIframe");
    const polaroidCards = document.querySelectorAll(".media-frame, .polaroid-small");

    // Estado local
    let scale = 1.0;
    let activePageIndex = 0; // 0-indexed
    let lastZoomMode = "fitPage"; // 'manual', 'fitWidth', 'fitPage'
    let isManualScrolling = false;
    let manualScrollTimeout = null;

    // ==========================================================================
    // 1. SISTEMA DE ZOOM E REDIMENSIONAMENTO
    // ==========================================================================
    
    function setZoom(newScale, mode = "manual") {
        // Limita o zoom entre 30% e 200%
        scale = Math.max(0.3, Math.min(2.0, newScale));
        lastZoomMode = mode;
        
        // Aplica a escala via variável CSS no container do álbum
        albumContainer.style.setProperty("--pdf-scale", scale);
        
        // Atualiza a interface
        zoomValueText.textContent = `${Math.round(scale * 100)}%`;
        
        // Ativa/Desativa estados visuais dos botões de predefinição
        if (mode === "fitWidth") {
            fitWidthBtn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
            fitPageBtn.style.backgroundColor = "";
        } else if (mode === "fitPage") {
            fitPageBtn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
            fitWidthBtn.style.backgroundColor = "";
        } else {
            fitWidthBtn.style.backgroundColor = "";
            fitPageBtn.style.backgroundColor = "";
        }
    }

    // Ajusta o zoom para preencher a largura útil
    function fitToWidth() {
        const viewerWidth = pdfViewer.clientWidth;
        const padding = viewerWidth < 900 ? 20 : 60;
        const availableWidth = viewerWidth - padding;
        const widthScale = availableWidth / 794; // 794px é a largura base do A4
        setZoom(widthScale, "fitWidth");
    }

    // Ajusta o zoom para caber a página inteira na tela verticalmente
    function fitToPage() {
        const viewerHeight = pdfViewer.clientHeight;
        const padding = 60; // Padding superior e inferior somados
        const availableHeight = viewerHeight - padding;
        const heightScale = availableHeight / 1123; // 1123px é a altura base do A4
        setZoom(heightScale, "fitPage");
    }

    // Eventos de Zoom
    zoomInBtn.addEventListener("click", () => {
        setZoom(scale + 0.1, "manual");
    });

    zoomOutBtn.addEventListener("click", () => {
        setZoom(scale - 0.1, "manual");
    });

    fitWidthBtn.addEventListener("click", fitToWidth);
    fitPageBtn.addEventListener("click", fitToPage);

    // Ajusta o zoom automaticamente ao redimensionar a janela
    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (lastZoomMode === "fitWidth") {
                fitToWidth();
            } else if (lastZoomMode === "fitPage") {
                fitToPage();
            }
        }, 100);
    });

    // ==========================================================================
    // 2. CONTROLE DA TIMELINE DE BOLINHAS (RÉGUA DE PÁGINAS)
    // ==========================================================================
    
    function updateActiveDot(activeIndex) {
        timelineDots.forEach((dot, idx) => {
            if (idx === activeIndex) {
                dot.classList.add("active");
            } else {
                dot.classList.remove("active");
            }
        });
        
        // Atualiza controles numéricos no topo
        currentPageNum.textContent = activeIndex + 1;
    }

    // Clique nas bolinhas da timeline
    timelineDots.forEach((dot, idx) => {
        dot.addEventListener("click", () => {
            const targetWrapperId = dot.getAttribute("data-target");
            const targetWrapper = document.getElementById(targetWrapperId);
            
            if (targetWrapper) {
                isManualScrolling = true;
                clearTimeout(manualScrollTimeout);
                
                targetWrapper.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                
                // Marca ativa imediatamente
                activePageIndex = idx;
                updateActiveDot(idx);
                
                // Libera o scroll de volta após 800ms (tempo do scroll suave acabar)
                manualScrollTimeout = setTimeout(() => {
                    isManualScrolling = false;
                }, 800);
            }
        });
    });

    // ==========================================================================
    // 3. SCROLL LISTENER MATEMÁTICO (CORREÇÃO DE SINCRO DA RÉGUA)
    // ==========================================================================
    
    function handleViewerScroll() {
        if (isManualScrolling) return;
        
        const viewerHeight = pdfViewer.clientHeight;
        const viewerScrollTop = pdfViewer.scrollTop;
        
        // Caso de Borda 1: Se chegou ao topo do scroll, ativa a primeira página (Capa)
        if (viewerScrollTop <= 5) {
            activePageIndex = 0;
            updateActiveDot(0);
            return;
        }
        
        // Caso de Borda 2: Se chegou perto do fim absoluto do scroll, ativa a última página (Fim)
        if (viewerScrollTop + viewerHeight >= pdfViewer.scrollHeight - 15) {
            activePageIndex = pageWrappers.length - 1;
            updateActiveDot(activePageIndex);
            return;
        }
        
        // Caso Geral: Encontra a página cujo centro está mais perto do centro geométrico do visualizador
        const viewerCenter = viewerScrollTop + (viewerHeight / 2);
        let closestIdx = 0;
        let minDistance = Infinity;
        
        pageWrappers.forEach((wrapper, idx) => {
            const wrapperTop = wrapper.offsetTop;
            const wrapperHeight = wrapper.offsetHeight;
            const wrapperCenter = wrapperTop + (wrapperHeight / 2);
            
            const distance = Math.abs(viewerCenter - wrapperCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestIdx = idx;
            }
        });
        
        activePageIndex = closestIdx;
        updateActiveDot(activePageIndex);
    }
    
    pdfViewer.addEventListener("scroll", handleViewerScroll);

    // ==========================================================================
    // 4. INTERATIVIDADE DO MODAL DE VÍDEO (POPUPS DAS POLAROIDS)
    // ==========================================================================
    
    function openVideoModal(url) {
        if (!url) return;
        
        // Transforma URL normal do Youtube em formato embed se necessário
        let embedUrl = url;
        if (url.includes("watch?v=")) {
            const videoId = url.split("v=")[1].split("&")[0];
            embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        } else if (!url.includes("?")) {
            embedUrl = `${url}?autoplay=1`;
        } else {
            embedUrl = `${url}&autoplay=1`;
        }
        
        modalIframe.src = embedUrl;
        videoModal.classList.add("active");
    }

    function closeVideoModal() {
        videoModal.classList.remove("active");
        modalIframe.src = ""; // Para o vídeo imediatamente
    }

    // Clique nas Polaroids
    polaroidCards.forEach(card => {
        card.addEventListener("click", () => {
            const videoUrl = card.getAttribute("data-video-url");
            openVideoModal(videoUrl);
        });
    });

    closeModalBtn.addEventListener("click", closeVideoModal);
    videoModalBackdrop.addEventListener("click", closeVideoModal);

    // Fechar com a tecla ESC
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && videoModal.classList.contains("active")) {
            closeVideoModal();
        }
    });

    // ==========================================================================
    // 5. SETAS DE NAVEGAÇÃO
    // ==========================================================================
    
    prevPageBtn.addEventListener("click", () => {
        if (activePageIndex > 0) {
            const prevWrapper = pageWrappers[activePageIndex - 1];
            isManualScrolling = true;
            clearTimeout(manualScrollTimeout);
            
            prevWrapper.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            
            activePageIndex--;
            updateActiveDot(activePageIndex);
            
            manualScrollTimeout = setTimeout(() => {
                isManualScrolling = false;
            }, 800);
        }
    });

    nextPageBtn.addEventListener("click", () => {
        if (activePageIndex < pageWrappers.length - 1) {
            const nextWrapper = pageWrappers[activePageIndex + 1];
            isManualScrolling = true;
            clearTimeout(manualScrollTimeout);
            
            nextWrapper.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            
            activePageIndex++;
            updateActiveDot(activePageIndex);
            
            manualScrollTimeout = setTimeout(() => {
                isManualScrolling = false;
            }, 800);
        }
    });

    // ==========================================================================
    // 6. INICIALIZAÇÃO DO ESTADO VISUAL
    // ==========================================================================
    
    // Por padrão no desktop começa no Ajustar Altura. Em telas de celular começa no Ajustar Largura.
    if (window.innerWidth < 900) {
        fitToWidth();
    } else {
        fitToPage();
    }
});
