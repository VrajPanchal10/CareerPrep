import React, { useState, useEffect } from "react";
import { downloadPerformancePdf } from "../../../features/interview/services/interview.api";
import "./PdfPreview.scss";

const PdfPreview = ({ reportId, onClose, onRegenerate }) => {
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [error, setError] = useState(null);
    const [zoom, setZoom] = useState(100); // 50%, 75%, 100%, 125%, 150%

    useEffect(() => {
        if (reportId) {
            loadPdfBlob();
        }
        return () => {
            cleanupPdfUrl();
        };
    }, [reportId]);

    const cleanupPdfUrl = () => {
        if (pdfUrl) {
            window.URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
        }
    };

    const loadPdfBlob = async () => {
        setIsLoading(true);
        setError(null);
        try {
            cleanupPdfUrl();
            const data = await downloadPerformancePdf({ reportId });
            const blob = new Blob([data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (err) {
            console.error("PDF preview generation error:", err);
            setError("Could not generate PDF preview. Please check backend connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = () => {
        loadPdfBlob();
    };

    const handleRegenerate = async () => {
        if (!onRegenerate) return;
        setIsRegenerating(true);
        setError(null);
        try {
            // Explicitly request a fresh AI compiled PDF from parent hook
            await onRegenerate();
            // Re-fetch the newly generated PDF file
            await loadPdfBlob();
        } catch (err) {
            console.error("Regeneration error:", err);
            setError("Failed to compile new report. Please try again.");
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.setAttribute("download", `careerprep_performance_report_${reportId}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        const iframe = document.getElementById("pdfPreviewIframe");
        if (iframe) {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                // Cross-origin fallback: open in new window and print
                window.open(pdfUrl, "_blank").print();
            }
        }
    };

    const handleZoomIn = () => setZoom(prev => Math.min(150, prev + 25));
    const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 25));

    // Handle Esc keypress to close preview modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div 
            className="pdf-preview-modal" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="pdfPreviewTitle"
        >
            <div className="pdf-preview-modal__backdrop" onClick={onClose} />
            <div className="pdf-preview-modal__content">
                
                {/* Header Action Controls */}
                <div className="pdf-preview-header">
                    <h3 id="pdfPreviewTitle">AI Performance Card Preview</h3>
                    
                    <div className="pdf-preview-toolbar">
                        {/* Zoom controls */}
                        <div className="zoom-controls">
                            <button onClick={handleZoomOut} disabled={zoom <= 50} title="Zoom Out">-</button>
                            <span className="zoom-label">{zoom}%</span>
                            <button onClick={handleZoomIn} disabled={zoom >= 150} title="Zoom In">+</button>
                        </div>

                        {/* File actions */}
                        <button className="tb-btn" onClick={handlePrint} disabled={isLoading || !pdfUrl} title="Print Document">
                            🖨️ Print
                        </button>
                        <button className="tb-btn" onClick={handleDownload} disabled={isLoading || !pdfUrl} title="Download PDF file">
                            💾 Save PDF
                        </button>
                        <button className="tb-btn" onClick={handleRefresh} disabled={isLoading} title="Reload Cached PDF file">
                            🔄 Refresh
                        </button>
                        {onRegenerate && (
                            <button className="tb-btn tb-btn--primary" onClick={handleRegenerate} disabled={isLoading || isRegenerating} title="Compile Fresh AI Assessment Report">
                                {isRegenerating ? "Compiling..." : "✨ Regenerate Report"}
                            </button>
                        )}
                        <button className="close-btn" onClick={onClose} aria-label="Close PDF preview">
                            ✕
                        </button>
                    </div>
                </div>

                {/* PDF Viewer Body */}
                <div className="pdf-preview-body">
                    {isLoading || isRegenerating ? (
                        <div className="pdf-loading">
                            <span className="spinner" />
                            <p>{isRegenerating ? "AI is compiling and rendering a fresh audit report..." : "Loading performance report document..."}</p>
                        </div>
                    ) : error ? (
                        <div className="pdf-error">
                            <p className="error-msg">⚠️ {error}</p>
                            <button className="retry-btn" onClick={loadPdfBlob}>Retry Loading</button>
                        </div>
                    ) : (
                        <div className="pdf-viewport" style={{ overflow: "auto" }}>
                            <iframe 
                                id="pdfPreviewIframe"
                                src={`${pdfUrl}#zoom=${zoom}`}
                                className="pdf-iframe" 
                                style={{ 
                                    transform: `scale(${zoom / 100})`, 
                                    transformOrigin: "top center",
                                    width: zoom <= 100 ? "100%" : `${100 * (100 / zoom)}%`,
                                    height: zoom <= 100 ? "100%" : `${100 * (zoom / 100)}%`
                                }}
                                title="Interactive PDF Preview Viewport"
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default PdfPreview;
