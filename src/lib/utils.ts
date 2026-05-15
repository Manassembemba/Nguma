import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DOMPurify from "dompurify";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * @param html The potentially unsafe HTML string.
 * @returns A sanitized HTML string.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html);
}

/**
 * Formats a number into a currency string.
 * @param amount The number to format.
 * @param currency The currency code (e.g., "USD").
 * @returns A formatted currency string.
 */
export function formatCurrency(amount: number | null | undefined, currency: string = "USD") {
  const value = amount ?? 0; // Convert null or undefined to 0
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

/**
 * Formats a large number into a compact, readable string (e.g., 1.5K, 2M).
 * @param num The number to format.
 * @returns A compact string representation of the number.
 */
export function formatCompactNumber(num: number) {
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

/**
 * Generates and downloads a CSV file from an array of objects.
 * @param data The array of data to export.
 * @param headers An object mapping object keys to CSV header names.
 * @param filename The desired name of the downloaded file.
 */
export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  headers: Record<keyof T, string>,
  filename: string
): void {
  if (!data || data.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const escapeField = (field: any): string => {
    const str = String(field ?? '');
    // Replace " with "" and wrap in "
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerRow = Object.values(headers).map(escapeField).join(',');
  const dataKeys = Object.keys(headers) as (keyof T)[];

  const csvRows = data.map(row =>
    dataKeys.map(key => escapeField(row[key])).join(',')
  );

  const csvContent = [headerRow, ...csvRows].join('\n');
  
  // Add BOM for UTF-8 compatibility with Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a styled PDF file from an array of objects.
 * @param data The array of data to export.
 * @param headers An object mapping object keys to CSV header names.
 * @param filename The desired name of the downloaded file.
 * @param title The title to display at the top of the PDF document.
 * @param columnStyles Styles for specific columns.
 * @param summary Summary info to display at the bottom.
 * @param filters Optional description of filters applied to the data.
 */
export function exportToPdf<T extends Record<string, any>>(
  data: T[],
  headers: Record<keyof T, string>,
  filename: string,
  title: string,
  columnStyles: any = {},
  summary?: { label: string; value: string }[],
  filters?: string
): void {
  if (!data || data.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  // Use landscape for better column fit
  const doc = new jsPDF({
    orientation: 'l',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Add Logo if possible (using a placeholder or standard location)
  // For now, we use a styled header
  doc.setFillColor(24, 31, 46); // Dark primary color
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Set document title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("NGUMA - " + title.toUpperCase(), 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rapport généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, 28);
  
  if (filters) {
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`Filtres: ${filters}`, 14, 34);
  }

  const tableHeaders = Object.values(headers);
  const dataKeys = Object.keys(headers) as (keyof T)[];
  const tableBody = data.map(row => dataKeys.map(key => String(row[key] ?? '')));

  // Convert key-based columnStyles to index-based for jspdf-autotable
  const indexedColumnStyles: { [key: number]: any } = {};
  Object.keys(columnStyles).forEach(key => {
    const index = dataKeys.indexOf(key as keyof T);
    if (index !== -1) {
      indexedColumnStyles[index] = columnStyles[key];
    }
  });

  autoTable(doc, {
    startY: 45,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235], // Blue 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      valign: 'middle',
    },
    columnStyles: indexedColumnStyles,
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer: Page Number
      doc.setFontSize(8);
      doc.setTextColor(150);
      const str = "Page " + data.pageNumber;
      doc.text(str, pageWidth - 20, pageHeight - 10);
      doc.text("Nguma Investment Platform - Rapport Confidentiel", 14, pageHeight - 10);
    },
  });

  // Final Summary Box
  if (summary && summary.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Check if we have space for the summary, otherwise add a new page
    if (finalY > pageHeight - 40) {
      doc.addPage();
    }

    const summaryY = finalY > pageHeight - 40 ? 20 : finalY;
    
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(pageWidth - 114, summaryY, 100, (summary.length * 8) + 10, 2, 2, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("RÉSUMÉ FINANCIER", pageWidth - 109, summaryY + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    summary.forEach((item, index) => {
      const itemY = summaryY + 18 + (index * 8);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label + ":", pageWidth - 109, itemY);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, pageWidth - 14, itemY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });
  }

  doc.save(filename);
}
