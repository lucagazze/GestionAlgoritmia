
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Proposal, ProposalItem, Contractor } from '../types';

// Helper to load logo
const loadLogo = async (): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        logoImg.onload = () => resolve(logoImg);
        logoImg.onerror = reject;
    });
};

const addHeader = async (doc: jsPDF, title: string, subtitle: string) => {
    try {
        const logoImg = await loadLogo();
        const imgWidth = logoImg.width;
        const imgHeight = logoImg.height;
        const maxW = 40;
        const maxH = 15;
        const scale = Math.min(maxW / imgWidth, maxH / imgHeight);
        doc.addImage(logoImg, 'PNG', 14, 12, imgWidth * scale, imgHeight * scale);
    } catch (e) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text("ALGORITMIA", 14, 20);
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(subtitle, 14, 28);
};

export const generateProposalPDF = async (proposal: Proposal) => {
    const doc: any = new jsPDF();
    const clientName = proposal.client?.name || 'Cliente';
    const industry = proposal.client?.industry || '';

    await addHeader(doc, "Algoritmia", "Desarrollo de Software & Growth");

    // -- CLIENT INFO --
    doc.setDrawColor(240);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, 35, 180, 25, 3, 3, 'FD');
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("PREPARADO PARA", 20, 42);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(clientName, 20, 50);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(industry, 20, 56);

    doc.text(new Date(proposal.createdAt).toLocaleDateString(), 180, 20, { align: 'right' });

    let yPos = 70;

    // -- STRATEGIC CONTEXT --
    if (proposal.objective || proposal.currentSituation) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Plan Estratégico", 14, yPos);
        yPos += 5;
        
        doc.setDrawColor(230);
        doc.line(14, yPos, 194, yPos);
        yPos += 8;

        if (proposal.currentSituation && proposal.objective) {
            const colWidth = 85;
            const gap = 10;
            const startX2 = 14 + colWidth + gap;

            // SITUATION
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("SITUACIÓN ACTUAL (Punto A)", 14, yPos);
            
            doc.setFontSize(9);
            doc.setTextColor(80);
            doc.setFont("helvetica", "normal");
            const splitSit = doc.splitTextToSize(proposal.currentSituation, colWidth);
            doc.text(splitSit, 14, yPos + 5);

            // OBJECTIVE
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("OBJETIVO (Punto B)", startX2, yPos);

            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            const splitObj = doc.splitTextToSize(proposal.objective, colWidth);
            doc.text(splitObj, startX2, yPos + 5);
            
            const heightSit = (splitSit.length * 4.5);
            const heightObj = (splitObj.length * 4.5);
            yPos += Math.max(heightSit, heightObj) + 15;
        }
    }

    // -- SERVICES TABLE --
    doc.autoTable({
        startY: yPos,
        head: [['Servicio', 'Tipo', 'Inversión']],
        body: proposal.items.map(s => [
            s.serviceSnapshotName + (s.serviceSnapshotDescription ? `\n${s.serviceSnapshotDescription}` : ''),
            s.serviceSnapshotType === 'ONE_TIME' ? 'Setup' : 'Mes',
            `$${s.serviceSnapshotCost.toLocaleString()}`
        ]),
        styles: { 
            fontSize: 9, 
            cellPadding: 4, 
            overflow: 'linebreak', 
            valign: 'top',
            textColor: [100, 100, 100]
        },
        headStyles: { 
            fillColor: [0, 0, 0], 
            textColor: 255, 
            fontStyle: 'bold',
            cellPadding: 4
        },
        columnStyles: { 
            0: { cellWidth: 110 },
            2: { halign: 'right', fontStyle: 'bold', textColor: [0,0,0] } 
        },
        theme: 'grid',
        willDrawCell: function(data: any) {
             if (data.section === 'body' && data.column.index === 0) {
                 const text = data.cell.text;
                 if (text && text.length > 0) data.cell.text = [];
             }
        },
        didDrawCell: function(data: any) {
            if (data.section === 'body' && data.column.index === 0) {
                const rawText = data.row.raw[0];
                if (rawText) {
                    const lines = (rawText as string).split('\n');
                    const serviceName = lines[0];
                    const description = lines.slice(1).join('\n');
                    const x = data.cell.x + data.cell.padding('left');
                    let y = data.cell.y + data.cell.padding('top') + 3;
                    
                    data.doc.setFont("helvetica", "bold");
                    data.doc.setTextColor(0, 0, 0);
                    data.doc.setFontSize(9);
                    data.doc.text(serviceName, x, y);
                    
                    if (description) {
                        y += 4;
                        data.doc.setFont("helvetica", "normal");
                        data.doc.setTextColor(100, 100, 100);
                        const descLines = data.doc.splitTextToSize(description, data.cell.width - data.cell.padding('left') - data.cell.padding('right'));
                        data.doc.text(descLines, x, y);
                    }
                }
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    // -- SUMMARY --
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(200);
    doc.roundedRect(120, finalY, 76, 50, 3, 3, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Setup Inicial", 125, finalY + 10);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`$${proposal.totalOneTimePrice.toLocaleString()}`, 190, finalY + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Fee Mensual", 125, finalY + 20);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`$${proposal.totalRecurringPrice.toLocaleString()}`, 190, finalY + 20, { align: 'right' });

    doc.setDrawColor(200);
    doc.line(125, finalY + 28, 190, finalY + 28);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("TOTAL", 125, finalY + 40);
    doc.setFontSize(8);
    doc.text(`(${proposal.durationMonths} meses)`, 125, finalY + 44);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 204);
    doc.setFont("helvetica", "bold");
    doc.text(`$${proposal.totalContractValue.toLocaleString()}`, 190, finalY + 42, { align: 'right' });

    doc.save(`Propuesta_${clientName.replace(/\s+/g, '_')}.pdf`);
};

export const generatePartnerPDF = async (proposal: Proposal, contractor: Contractor, items: ProposalItem[]) => {
    const doc: any = new jsPDF();
    const clientName = proposal.client?.name || 'Cliente';

    await addHeader(doc, "Algoritmia", "Orden de Trabajo (Partner)");

    // -- PARTNER INFO --
    doc.setDrawColor(240);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, 35, 180, 25, 3, 3, 'FD');
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("ORDEN PARA", 20, 42);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(contractor.name, 20, 50);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(`Cliente Final: ${clientName}`, 20, 56);

    doc.text(new Date().toLocaleDateString(), 180, 20, { align: 'right' });

    // -- DETAILS --
    doc.autoTable({
        startY: 70,
        head: [['Servicio / Entregable', 'Tipo', 'Pago Acordado']],
        body: items.map(s => [
            s.serviceSnapshotName + (s.serviceSnapshotDescription ? `\n${s.serviceSnapshotDescription}` : ''),
            s.serviceSnapshotType === 'ONE_TIME' ? 'Setup' : 'Mes',
            `$${(s.outsourcingCost || 0).toLocaleString()}`
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 110 }, 2: { halign: 'right', fontStyle: 'bold' } },
        theme: 'grid'
    });

     // -- TOTAL --
     const totalPay = items.reduce((sum, s) => sum + (s.outsourcingCost || 0), 0);
     const finalY = (doc as any).lastAutoTable.finalY + 15;

     doc.setFillColor(248, 250, 252);
     doc.setDrawColor(200);
     doc.roundedRect(120, finalY, 76, 20, 3, 3, 'FD');
     doc.setFontSize(10); doc.setTextColor(100);
     doc.text("TOTAL A PAGAR", 125, finalY + 13);
     doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
     doc.text(`$${totalPay.toLocaleString()}`, 190, finalY + 13, { align: 'right' });

    doc.save(`Orden_${contractor.name.split(' ')[0]}_${clientName}.pdf`);
};
