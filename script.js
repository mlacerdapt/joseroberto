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
    const modalVideo = document.getElementById("modalVideo");
    const polaroidCards = document.querySelectorAll(".media-frame, .polaroid-small, .cover-photo-frame");

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
        
        const isLocalVideo = url.match(/\.(mp4|webm|mov)$/i);
        
        if (isLocalVideo) {
            modalIframe.style.display = "none";
            modalIframe.src = "";
            
            modalVideo.src = url;
            modalVideo.style.display = "block";
            modalVideo.play().catch(() => {});
        } else {
            if (modalVideo) {
                modalVideo.style.display = "none";
                modalVideo.src = "";
                modalVideo.pause();
            }
            
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
            modalIframe.style.display = "block";
        }
        
        videoModal.classList.add("active");
    }

    function closeVideoModal() {
        videoModal.classList.remove("active");
        modalIframe.src = ""; // Para o vídeo imediatamente
        modalIframe.style.display = "none";
        
        if (modalVideo) {
            modalVideo.pause();
            modalVideo.src = "";
            modalVideo.style.display = "none";
        }
    }

    // Clique nas Polaroids (Vídeos abrem o modal; fotos normais navegam para a galeria)
    polaroidCards.forEach(card => {
        card.addEventListener("click", () => {
            const videoUrl = card.getAttribute("data-video-url");
            if (videoUrl) {
                openVideoModal(videoUrl);
            } else {
                // Tenta obter o ano diretamente da moldura (ex: capa) ou da seção correspondente (páginas)
                let year = card.getAttribute("data-year");
                if (!year) {
                    const section = card.closest("section");
                    if (section) {
                        year = section.getAttribute("data-year");
                    }
                }
                
                if (year) {
                    window.location.href = `gallery.html?year=${year}`;
                }
            }
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
    // 6. VERIFICAÇÃO AUTOMÁTICA DE VÍDEOS EM MOLDURAS (SUBSTITUI IMAGENS QUEBRADAS)
    // ==========================================================================
    
    function checkFileExists(url, isVideo = false) {
        if (window.location.protocol.startsWith('http')) {
            return fetch(url, { method: 'HEAD' })
                .then(res => {
                    if (res.ok) return true;
                    if (res.status === 405 || res.status === 501) {
                        return checkFileExistsFallback(url, isVideo);
                    }
                    return false;
                })
                .catch(() => checkFileExistsFallback(url, isVideo));
        }
        return checkFileExistsFallback(url, isVideo);
    }

    function checkFileExistsFallback(url, isVideo) {
        return new Promise((resolve) => {
            if (isVideo) {
                const video = document.createElement('video');
                video.onloadedmetadata = () => resolve(true);
                video.onerror = () => resolve(false);
                video.src = url;
            } else {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = url;
            }
        });
    }

    function getVideoThumbnail(videoUrl) {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            
            // Only set crossOrigin for external URLs
            if (videoUrl.startsWith("http") && !videoUrl.startsWith(window.location.origin)) {
                video.crossOrigin = "anonymous";
            }
            
            video.muted = true;
            video.playsInline = true;
            video.preload = "auto";
            video.style.position = "fixed";
            video.style.top = "-9999px";
            video.style.left = "-9999px";
            video.style.width = "100px";
            video.style.height = "100px";
            video.style.opacity = "0";
            video.style.pointerEvents = "none";
            
            // Append to DOM to ensure WebKit/Safari decodes the frames correctly
            document.body.appendChild(video);
            
            let resolved = false;

            const cleanup = () => {
                if (video.parentNode) {
                    video.parentNode.removeChild(video);
                }
            };

            video.onloadedmetadata = () => {
                video.currentTime = 0.1;
            };

            video.onseeked = () => {
                if (resolved) return;
                resolved = true;
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 480;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                    cleanup();
                    resolve(dataUrl);
                } catch (e) {
                    console.error("Failed to draw video frame to canvas:", e);
                    cleanup();
                    resolve(null);
                }
            };

            video.onerror = (e) => {
                console.error("Failed to load video for thumbnail:", videoUrl, e);
                cleanup();
                resolve(null);
            };

            // Safety fallback
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(null);
                }
            }, 5000);

            video.src = videoUrl;
            video.load();
        });
    }

    async function handleHeicImage(img, url) {
        if (typeof heic2any === 'undefined') {
            console.warn("heic2any library is not loaded. HEIC image might not render on some browsers.");
            img.src = url;
            return;
        }
        try {
            img.style.opacity = "0.5";
            const response = await fetch(url);
            const blob = await response.blob();
            const conversionResult = await heic2any({
                blob: blob,
                toType: "image/jpeg",
                quality: 0.7
            });
            const blobUrl = URL.createObjectURL(conversionResult);
            img.src = blobUrl;
            img.style.opacity = "1";
        } catch (e) {
            console.error("HEIC conversion failed:", e);
            img.src = url;
            img.style.opacity = "1";
        }
    }

    const storyPhotos = document.querySelectorAll(".story-photo, .cover-photo");
    storyPhotos.forEach(img => {
        const originalSrc = img.src;
        if (!originalSrc) return;

        const isVideoFile = originalSrc.match(/\.(mp4|webm|mov)$/i);

        const replaceWithVideo = async (videoUrl) => {
            if (img.dataset.replaced) return;
            img.dataset.replaced = "true";

            // Encontra o card pai (polaroid ou cover) para configurar a interatividade (modal ao clicar)
            const card = img.closest(".media-frame, .polaroid-small, .cover-photo-frame");
            if (card) {
                card.setAttribute("data-video-url", videoUrl);
                card.classList.add("has-video");
                
                // Adiciona um selo de vídeo (Play) no card pai, se não existir
                if (!card.querySelector(".gallery-video-badge")) {
                    const badge = document.createElement("div");
                    badge.className = "gallery-video-badge";
                    badge.innerHTML = "▶";
                    card.appendChild(badge);
                }
            }

            img.classList.add("video-thumbnail-placeholder");

            // Extrai o primeiro frame do vídeo como thumbnail
            const thumbnailUrl = await getVideoThumbnail(videoUrl);
            if (thumbnailUrl) {
                img.src = thumbnailUrl;
                img.classList.remove("video-thumbnail-placeholder");
            } else {
                img.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3C/svg%3E";
            }
        };

        if (isVideoFile) {
            replaceWithVideo(originalSrc);
        } else {
            const handleImgError = () => {
                const basePath = originalSrc.substring(0, originalSrc.lastIndexOf("."));
                const imgExts = ["jpg", "jpeg", "png", "JPG", "JPEG", "PNG", "webp", "WEBP", "heic", "HEIC"];
                const videoExts = ["mp4", "mov", "webm", "MP4", "MOV", "WEBM"];
                
                async function tryFindAlternative() {
                    // 1. Tentar outras extensões de imagem
                    for (const ext of imgExts) {
                        if (originalSrc.endsWith("." + ext)) continue;
                        const imgUrl = `${basePath}.${ext}`;
                        const exists = await checkFileExists(imgUrl, false);
                        if (exists) {
                            if (imgUrl.match(/\.heic$/i)) {
                                handleHeicImage(img, imgUrl);
                            } else {
                                img.src = imgUrl;
                            }
                            return;
                        }
                    }
                    
                    // 2. Tentar extensões de vídeo
                    for (const ext of videoExts) {
                        const videoUrl = `${basePath}.${ext}`;
                        const exists = await checkFileExists(videoUrl, true);
                        if (exists) {
                            replaceWithVideo(videoUrl);
                            return;
                        }
                    }

                    // Se não encontrou nenhuma alternativa de imagem ou vídeo, removemos o ícone de quebrado
                    img.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3C/svg%3E";
                    img.classList.add("photo-placeholder");
                }
                tryFindAlternative();
            };

            if (img.complete && img.naturalWidth === 0) {
                handleImgError();
            } else {
                img.addEventListener("error", handleImgError);
            }
        }
    });

    // ==========================================================================
    // 7. INICIALIZAÇÃO DO ESTADO VISUAL
    // ==========================================================================
    
    // Por padrão no desktop começa no Ajustar Altura. Em telas de celular começa no Ajustar Largura.
    if (window.innerWidth < 900) {
        fitToWidth();
    } else {
        fitToPage();
    }
});
