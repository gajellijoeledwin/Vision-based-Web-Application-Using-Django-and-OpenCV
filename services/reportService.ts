import { jsPDF } from "jspdf";
import { AnalysisTask } from "../types";

export const generatePDFReport = (task: AnalysisTask) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // --- Header ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("VisionAI", margin, 28);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text("Official Analysis Report", margin + 100, 28, { align: 'left' });

  yPos = 60;

  // --- Task Metadata ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Task Information", margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  
  const dateStr = new Date(task.createdAt).toLocaleString();
  doc.text(`Task ID: ${task.id}`, margin, yPos);
  doc.text(`Date: ${dateStr}`, margin, yPos + 6);
  doc.text(`Status: ${task.status}`, margin, yPos + 12);
  doc.text(`Processing Time: ${task.processing_time ? task.processing_time.toFixed(3) + 's' : 'N/A'}`, margin, yPos + 18);
  doc.text(`File: ${task.file_name}`, margin, yPos + 24);
  
  // --- Summary ---
  if (task.result) {
    yPos += 35;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Executive Summary", margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(50, 50, 50);
    const splitSummary = doc.splitTextToSize(task.result.summary, pageWidth - (margin * 2));
    doc.text(splitSummary, margin, yPos);
    yPos += (splitSummary.length * 5) + 10;

    // --- Objects Table ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Detection Metrics", margin, yPos);
    yPos += 10;

    // Table Header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 6, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(9);
    doc.text("Class", margin + 5, yPos);
    doc.text("Confidence", margin + 80, yPos);
    doc.text("BBox [y, x, y2, x2]", margin + 130, yPos);
    yPos += 8;

    // Table Rows
    doc.setFont("helvetica", "normal");
    task.result.objects.forEach((obj, i) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(obj.label.toUpperCase(), margin + 5, yPos);
      doc.text(`${(obj.confidence * 100).toFixed(1)}%`, margin + 80, yPos);
      doc.text(`[${obj.box_2d.join(', ')}]`, margin + 130, yPos);
      yPos += 7;
    });

    // --- Image Evidence ---
    if (task.imageUrl) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Visual Evidence (Annotated)", margin, 20);
        
        try {
            const imgProps = doc.getImageProperties(task.imageUrl);
            const pdfWidth = pageWidth - (margin * 2);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            doc.addImage(task.imageUrl, 'JPEG', margin, 30, pdfWidth, pdfHeight);
        } catch (e) {
            console.error("Error adding image to PDF", e);
        }
    }
  }

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`VisionAI Generated Report - Page ${i} of ${pageCount}`, margin, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save(`VisionAI_Report_${task.id.substring(0,8)}.pdf`);
};