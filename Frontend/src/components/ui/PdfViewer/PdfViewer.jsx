import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "./PdfViewer.scss";

// Initialize the local worker URL using Vite asset parsing
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

const PdfViewer = ({ 
    pdfUrl, 
    fileName = "resume.pdf", 
    pageNumber = 1, 
    onPageChange
}) => {
    const [numPages, setNumPages] = useState(null);
    const [scale, setScale] = useState(1.0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfDoc, setPdfDoc] = useState(null);
    
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const renderTaskRef = useRef(null);

    // Load PDF document on url mount/change
    useEffect(() => {
        let isMounted = true;
        
        const loadDoc = async () => {
            if (!pdfUrl) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);

            try {
                const loadingTask = pdfjsLib.getDocument({
                    url: pdfUrl,
                    withCredentials: true
                });
                const pdf = await loadingTask.promise;

                if (isMounted) {
                    setPdfDoc(pdf);
                    setNumPages(pdf.numPages);
                    if (onPageChange) {
                        onPageChange(1);
                    }
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("PDF.js loading task error:", err);
                if (isMounted) {
                    setError("Unable to render the PDF file. It might be corrupted or malformed.");
                    setIsLoading(false);
                }
            }
        };

        loadDoc();

        return () => {
            isMounted = false;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdfUrl]);

    // Render active page when document, page number, or scale changes
    useEffect(() => {
        if (!pdfDoc) return;

        let isRenderCancelled = false;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNumber);
                
                // Cancel previous render tasks if running
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext("2d");
                const viewport = page.getViewport({ scale });

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;

                await renderTask.promise;
            } catch (err) {
                if (err.name !== "RenderingCancelledException" && !isRenderCancelled) {
                    console.error("PDF canvas render error:", err);
                    setError("Failed to render page to viewscreen.");
                }
            }
        };

        renderPage();

        return () => {
            isRenderCancelled = true;
        };
    }, [pdfDoc, pageNumber, scale]);

    const handlePrevPage = () => {
        if (pageNumber > 1 && onPageChange) {
            onPageChange(pageNumber - 1);
        }
    };

    const handleNextPage = () => {
        if (pageNumber < numPages && onPageChange) {
            onPageChange(pageNumber + 1);
        }
    };

    const handleZoomIn = () => {
        setScale(prev => Math.min(3.0, prev + 0.2));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(0.5, prev - 0.2));
    };

    const handleFitWidth = () => {
        if (!pdfDoc || !canvasRef.current) return;
        pdfDoc.getPage(pageNumber).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            const parentWidth = containerRef.current?.clientWidth || 500;
            const targetScale = (parentWidth - 32) / viewport.width;
            setScale(targetScale);
        });
    };

    const handleFitPage = () => {
        if (!pdfDoc || !canvasRef.current) return;
        pdfDoc.getPage(pageNumber).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            const parentHeight = containerRef.current?.clientHeight || 600;
            const targetScale = (parentHeight - 48) / viewport.height;
            setScale(targetScale);
        });
    };



    const handleOpenTab = () => {
        if (pdfUrl) {
            window.open(pdfUrl, "_blank");
        }
    };

    return (
        <div className="pdf-viewer-module" ref={containerRef} aria-label="Resume Document Viewscreen">
            {/* Action Bar */}
            <div className="pdf-viewer-toolbar">
                <div className="toolbar-group navigation">
                    <button 
                        onClick={handlePrevPage} 
                        disabled={pageNumber <= 1 || isLoading} 
                        className="btn-action" 
                        aria-label="Previous Page"
                    >
                        ◀
                    </button>
                    <span className="page-indicator">
                        Page {pageNumber} of {numPages || "?"}
                    </span>
                    <button 
                        onClick={handleNextPage} 
                        disabled={pageNumber >= numPages || isLoading} 
                        className="btn-action" 
                        aria-label="Next Page"
                    >
                        ▶
                    </button>
                </div>

                <div className="toolbar-group zooming">
                    <button onClick={handleZoomOut} disabled={isLoading} className="btn-action" aria-label="Zoom Out">-</button>
                    <span className="scale-indicator">{Math.round(scale * 100)}%</span>
                    <button onClick={handleZoomIn} disabled={isLoading} className="btn-action" aria-label="Zoom In">+</button>
                    <button onClick={handleFitWidth} disabled={isLoading} className="btn-text" aria-label="Fit to width">Fit Width</button>
                    <button onClick={handleFitPage} disabled={isLoading} className="btn-text" aria-label="Fit to page">Fit Page</button>
                </div>

                <div className="toolbar-group exports">
                    <button onClick={handleOpenTab} disabled={isLoading} className="btn-action" title="Open PDF in new tab" aria-label="Open tab">
                        ↗️
                    </button>
                </div>
            </div>

            {/* Viewer Stage */}
            <div className="pdf-viewer-stage">
                {isLoading && (
                    <div className="pdf-viewer-skeleton">
                        <div className="skeleton-bar toolbar-dummy" />
                        <div className="skeleton-canvas-dummy">
                            <div className="skeleton-pulse" />
                            <div className="skeleton-pulse short" />
                            <div className="skeleton-pulse" />
                        </div>
                    </div>
                )}

                {error ? (
                    <div className="pdf-viewer-error" role="alert">
                        <p className="error-message">⚠️ {error}</p>
                    </div>
                ) : (
                    <div className="pdf-canvas-scroller" style={{ display: isLoading ? "none" : "flex" }}>
                        <canvas ref={canvasRef} className="pdf-canvas-node" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfViewer;
